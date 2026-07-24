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
    // Pre-auth: return the snapshot without touching the network.
    //
    // Two of the three loaders in `useChatManagement` fire before the async
    // token refresh resolves — the mount-once effect runs before even
    // `myself.userId` has hydrated. `api()` would throw `UNAUTHENTICATED`
    // before issuing any request, so the call cannot do anything except
    // fail. That is an expected boot state, not a failure worth reporting,
    // and reporting it anyway put a red error in the console on every single
    // boot — which is worse than useless: it trains everyone to ignore the
    // one log that actually matters below.
    //
    // The real load is the token-landing re-fire in `useChatManagement`.
    if (channelService.hasAccessToken()) {
        try {
            // `listChannels` is a pure REST GET — it doesn't auto-upsert.
            // `ingestChannels` lands the whole list in one pass (single
            // store notify + single IDB transaction) so a routine list
            // refresh doesn't fan out N per-channel notifies to every
            // store subscriber the way per-row `handleChannelCreated`
            // calls did.
            const fresh = await channelService.listChannels();
            channelService.ingestChannels(fresh);
            // The upsert above only ADDS. Drop anything the server no longer
            // lists, or a channel that disappeared without a live
            // `channel.member_removed` event stays in the sidebar forever —
            // deleting a project soft-deletes its PM channel via a Django
            // signal that emits nothing, leaving a chat that 404s on every
            // sync. Inside the try on purpose: this needs an authoritative
            // full list, and a failed call must never evict anything.
            channelService.reconcileChannelList(fresh);
            // The list payload carries `members` for DM/MDM rows — seed them
            // into the snapshot so DM partner names/avatars (and MDM member
            // avatars) resolve on the FIRST chat-list render, instead of only
            // after the channel is opened (which lazily fetches members).
            channelService.ingestListMembers(fresh);
        } catch (e) {
            // Falling back to the snapshot (a prior boot's IDB hydration) is
            // deliberate — offline should still render the cached list. But
            // this MUST be loud: swallowing it silently is what let a frozen
            // chat list look like a rendering bug for days. Anything that
            // reaches here is a genuine failure — a token exists, so it's the
            // network or the server, not the boot-time race above.
            console.error(
                "[loadV3Chats] listChannels failed — rendering the cached channel list, " +
                    "which will be missing anything created since the last successful load:",
                e
            );
        }
    }
    const snapshot = channelService.getSnapshot();
    return v3ChannelsToLegacyChats({
        channels: snapshot.channels.values(),
        pinByChannelId: snapshot.pinByChannelId,
        membersByChannel: snapshot.membersByChannel,
        currentUserId,
    });
}
