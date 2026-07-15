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
        // The list payload carries `members` for DM/MDM rows — seed them
        // into the snapshot so DM partner names/avatars (and MDM member
        // avatars) resolve on the FIRST chat-list render, instead of only
        // after the channel is opened (which lazily fetches members).
        channelService.ingestListMembers(fresh);
    } catch (e) {
        // Falling back to the snapshot (a prior boot's IDB hydration) is
        // deliberate — offline should still render the cached list. But
        // this MUST be loud: swallowing it silently is what let a frozen
        // chat list look like a rendering bug for days. The most common
        // failure isn't the network at all, it's `UNAUTHENTICATED`:
        // `channelService.api()` throws when no token is set yet, and the
        // caller may be racing the async token refresh (see the
        // token-landing re-fire in `useChatManagement`). When that
        // happens every channel created since the last good load is
        // invisible for the whole session, with nothing in the console
        // to say why.
        console.error(
            "[loadV3Chats] listChannels failed — rendering the cached channel list, " +
                "which will be missing anything created since the last successful load:",
            e
        );
    }
    const snapshot = channelService.getSnapshot();
    return v3ChannelsToLegacyChats({
        channels: snapshot.channels.values(),
        pinByChannelId: snapshot.pinByChannelId,
        membersByChannel: snapshot.membersByChannel,
        currentUserId,
    });
}
