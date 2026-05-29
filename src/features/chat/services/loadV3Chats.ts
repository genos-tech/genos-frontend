/**
 * `loadV3Chats` — main-thread chat-list loader backed by the v3
 * channelService.
 *
 * Replaces the per-type chain (`loadDMChats` + `loadGMChats` +
 * `loadPMChats` + `loadMDMChats` + worker IDB merge in
 * `chat.handlers.ts::popAllChats`) for the chat-list source. Issues
 * one `/api/v3/channels/` REST call instead of four, then converts
 * the response through `v3ChannelsToLegacyChats` so the legacy UI's
 * `useChatManagement.allChats` slot stays the same `AllChatProps[]`.
 *
 * Lifecycle: the caller is expected to have mounted
 * `useChannelServiceBootstrap` first (so the socket + IDB hydrate
 * have run). This loader does not subscribe to channelService events
 * — it returns a one-shot snapshot. Live updates flow through the
 * existing socket-handler path in useChatManagement OR through a
 * follow-on session that wires a useSyncExternalStore subscription
 * directly into useChatManagement.
 */

import { channelService } from "../../../services/channel/channelService";
import type { AllChatProps } from "../../../types/chat";
import { v3ChannelsToLegacyChats } from "../adapters/v3ToLegacy";

/**
 * Fetch the chat list via v3 + adapt to the legacy shape.
 *
 * `currentUserId` is needed for DM partner resolution. Pass `null`
 * pre-auth; the adapter returns empty `dmPartnerUser` rows.
 *
 * Returns an empty array on failure (legacy chain swallowed errors
 * the same way). The caller's read-from-state path stays consistent
 * across failures.
 */
export async function loadV3Chats(currentUserId: string | null): Promise<AllChatProps[]> {
    try {
        // `listChannels` is a pure REST GET — it doesn't auto-upsert.
        // We push each row through `handleChannelCreated` so the
        // in-memory store + IDB stay current, and subsequent reads
        // off the snapshot see the same data the wire response had.
        const fresh = await channelService.listChannels();
        for (const c of fresh) channelService.handleChannelCreated(c);
    } catch {
        // Network failure: fall through to whatever the snapshot
        // already had (e.g. from a prior boot's IDB hydration).
    }
    const snapshot = channelService.getSnapshot();
    return v3ChannelsToLegacyChats({
        channels: snapshot.channels.values(),
        pinByChannelId: snapshot.pinByChannelId,
        membersByChannel: snapshot.membersByChannel,
        currentUserId,
    });
}
