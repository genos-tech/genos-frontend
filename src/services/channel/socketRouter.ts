/**
 * Socket router for the unified `/v3` namespace.
 *
 * Replaces the legacy 691-line `hooks/common/handlers/message-handlers.ts`
 * with a one-event-per-line demux that delegates to `channelService`.
 *
 * Pattern: every server-emitted event from `socketio_events_v3/` lands
 * in exactly one `socket.on(...)` registration here. The handler body is
 * one line — call the matching `channelService.handle*` method. All the
 * IDB writes, dedup logic, and side effects live in the service, not
 * in this router.
 *
 * This file's job is just to wire event names to service methods. Per
 * the plan, demuxing by socket-native event name (not by a string
 * field on a JSON payload) is what eliminates the per-chat-type `if`
 * chains the legacy code accumulated.
 */

import type { Socket } from "socket.io-client";

import { handleV3Activity } from "../../features/chat/services/handleV3Activity";
import type {
    Channel,
    ChannelKind,
    ChannelMember,
    DeltaEnvelope,
    Flag,
    Message,
    MessageReaction,
    MessagesDeltaData,
    Pin,
    ReadCursor,
} from "../../types/channel";
import { channelService } from "./channelService";

export const V3_NAMESPACE = "/v3";

/**
 * Wire every `/v3` server event into the channel service. Call once
 * after the socket is constructed and before connecting; new events
 * land at the service the moment the socket connects.
 *
 * Returns a teardown function that unregisters every handler. Call
 * on logout / socket teardown to avoid leaks.
 */
export function registerSocketRouter(socket: Socket): () => void {
    const offs: Array<() => void> = [];

    function on<TPayload>(event: string, fn: (data: TPayload) => void) {
        socket.on(event, fn);
        offs.push(() => socket.off(event, fn));
    }

    on<Message>("message.created", (m) => {
        channelService.handleMessageCreated(m);
        // Live notification fan-out. Fires ONLY for events arriving on
        // the live socket — not for REST hydration or resync batches,
        // which use channelService.handleMessageCreated directly. This
        // matches the legacy notification trigger point (a single
        // socket "message" event). `setupWebSocketHandlers` listens
        // for `v3:message:created` and builds chat / thread intents
        // through the existing notification router.
        window.dispatchEvent(new CustomEvent("v3:message:created", { detail: { message: m } }));
    });
    on<Message>("message.updated", (m) => channelService.handleMessageUpdated(m));
    on<{ id: string; channelId: string; channelKind: ChannelKind }>("message.deleted", (e) =>
        channelService.handleMessageDeleted(e)
    );

    on<{
        messageId: string;
        channelId: string;
        channelKind: ChannelKind;
        reaction: MessageReaction;
    }>("reaction.added", (e) => channelService.handleReactionAdded(e));
    on<{
        messageId: string;
        channelId: string;
        channelKind: ChannelKind;
        userId: string;
        emoji: string;
    }>("reaction.removed", (e) => channelService.handleReactionRemoved(e));

    on<ReadCursor>("read.advanced", (c) => channelService.handleReadAdvanced(c));

    on<Channel>("channel.created", (c) => channelService.handleChannelCreated(c));
    on<Channel>("channel.updated", (c) => channelService.handleChannelUpdated(c));
    on<{
        channelId: string;
        channelKind: ChannelKind;
        member: ChannelMember;
    }>("channel.member_added", (e) => channelService.handleChannelMemberAdded(e));
    on<{
        channelId: string;
        channelKind: ChannelKind;
        userId: string;
    }>("channel.member_removed", (e) => channelService.handleChannelMemberRemoved(e));

    on<{
        // The connect-time auto-replay (connect_handlers.py) pushes ONE
        // channel per `resync.batch` event as {channel_id, envelope}.
        // `applyResyncBatch` normalizes this single-channel shape and the
        // batched {channels:[...]} shape the explicit `resync` ack uses.
        channel_id: string;
        envelope: DeltaEnvelope<MessagesDeltaData & { thread_messages?: Message[] }>;
    }>("resync.batch", (b) => {
        // Fire-and-forget: applyResyncBatch is async (checkpoint writes
        // hit IDB), but the synchronous prefix already lands every
        // upsert into the in-memory store, so subscribers see the
        // updated messages immediately. The trailing IDB writes catch
        // up in the next microtask.
        void channelService.applyResyncBatch(b);
    });

    // Pin / Flag broadcasts arrive on the `user:<userId>` room so every
    // tab the same user has open stays in sync. Self-emitted events
    // come back through here too — the service's _upsert* helpers
    // reconcile the optimistic placeholder against the server-issued
    // row via the secondary index, so re-receiving our own emit is a
    // no-op except for replacing the placeholder id.
    on<{ pin: Pin }>("pin.added", (e) => channelService.handlePinAdded(e.pin));
    on<{ channelId: string }>("pin.removed", (e) => channelService.handlePinRemoved(e.channelId));
    on<{ flag: Flag }>("flag.added", (e) => channelService.handleFlagAdded(e.flag));
    on<{ messageId: string }>("flag.removed", (e) =>
        channelService.handleFlagRemoved(e.messageId)
    );

    // Activity-feed live push. The v3 message and reaction handlers
    // emit `activity.created` to each recipient's `user:{id}` room
    // alongside the per-channel broadcasts; landing here means a
    // sidebar entry needs to materialise for the current user without
    // a refresh. Fire-and-forget — failures are non-fatal (the next
    // `loadActivityHistory` call reconciles).
    on<Record<string, unknown>>("activity.created", (a) => {
        // Diagnostic log retained while the activity pipeline beds in.
        // Drop once the live-update flow is verified end-to-end.
        // eslint-disable-next-line no-console
        console.log("[v3 socketRouter] activity.created received", a);
        void handleV3Activity(a);
    });

    return () => {
        offs.forEach((off) => off());
    };
}
