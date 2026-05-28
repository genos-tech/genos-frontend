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

import type {
    Channel,
    ChannelKind,
    ChannelMember,
    DeltaEnvelope,
    Message,
    MessageReaction,
    MessagesDeltaData,
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

    on<Message>("message.created", (m) => channelService.handleMessageCreated(m));
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
        channels: Array<{
            channel_id: string;
            envelope: DeltaEnvelope<MessagesDeltaData>;
        }>;
    }>("resync.batch", (b) => channelService.applyResyncBatch(b));

    return () => {
        offs.forEach((off) => off());
    };
}
