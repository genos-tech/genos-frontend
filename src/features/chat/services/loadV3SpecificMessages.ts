/**
 * `loadV3SpecificMessages` — main-thread per-channel message loader
 * backed by the v3 channelService.
 *
 * Replaces the per-type chain (`popSpecificMessages` → worker IDB pop
 * across `DM_MESSAGES` / `GM_MESSAGES` / `PM_MESSAGES` / `MDM_MESSAGES`)
 * for the chat-open hot path. Issues at most one
 * `/api/v3/channels/{id}/messages/?since=` REST call (the channelService
 * hydration deduplicates with anything already in the in-memory store),
 * then adapts to the legacy `MessageProps[]` shape so
 * `useChatManagement.defineNewChat(allChat, messages)` keeps working
 * with the existing UI surfaces.
 *
 * Lifecycle: the caller must have mounted `useChannelServiceBootstrap`
 * (so the WS connection and IDB hydration are in flight). This loader
 * is one-shot; live updates flow through the parallel
 * `useSyncExternalStore` subscription on `useChatManagement` (see the
 * follow-on wiring in that hook).
 *
 * Failure mode: on REST error we still return whatever the in-memory
 * snapshot has (e.g. from a prior boot's IDB hydration or a live socket
 * stream). The legacy chain swallowed errors the same way.
 */

import { channelService } from "../../../services/channel/channelService";
import type { Message } from "../../../types/channel";
import type { MessageProps } from "../../../types/chat";
import { v3MessagesToLegacy } from "../adapters/v3ToLegacy";

/**
 * Fetch the message list for one channel via v3, adapt to the legacy
 * `MessageProps[]` shape.
 *
 * `chatType` is the legacy integer chat-type code (1=DM, 2=GM, 3=PM,
 * 4=MDM) — passed through into each `MessageProps.chatType` slot.
 *
 * Returns an empty array on failure (mirrors the legacy chain's
 * silent-failure contract). The caller's chat-open flow handles
 * empty arrays by rendering an empty pane.
 */
export async function loadV3SpecificMessages(
    channelId: string,
    chatType: number
): Promise<MessageProps[]> {
    try {
        // `syncChannel` is the canonical "fetch + write to store"
        // entry point. It pulls top-level messages, thread replies
        // and (first time only) the member roster from `/api/v3/`,
        // upserts into the in-memory store, persists to IDB, and
        // records the delta checkpoint so the next call only fetches
        // rows newer than the last sync. Idempotent — replays are
        // no-ops thanks to the by-id upsert in `handleMessageCreated`.
        await channelService.syncChannel(channelId);
    } catch {
        // Network failure — fall through to whatever the snapshot
        // already has cached (typically a prior boot's IDB hydration
        // or a partial sync from this session).
    }
    const snapshot = channelService.getSnapshot();
    const messages: readonly Message[] = snapshot.messagesByChannel.get(channelId) ?? [];
    return v3MessagesToLegacy({ messages, channelId, chatType });
}
