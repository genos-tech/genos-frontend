/**
 * `loadV3SpecificThreadMessages` — load thread replies for a specific
 * thread root via the v3 channelService.
 *
 * Replaces the legacy `loadSpecificThreadMessages` / `loadSpecificThreadMessagesByTaskId`
 * chain that hit `/api/v2/{dm,gm,pm,mdm}/threadMessagesById/?thread_id=N`
 * with integer chat + thread ids. The v3 model puts thread replies in
 * the same `messagesByChannel` array as top-level messages, distinguished
 * by `isThreadReply=true` + `parentId === <root UUID>`.
 *
 * Lifecycle: the caller is expected to have mounted
 * `useChannelServiceBootstrap` (so the socket + IDB hydration are in
 * flight). `syncChannel` pulls both top-level messages AND thread
 * replies for the channel; we then filter to the one thread.
 */

import { channelService } from "../../../services/channel/channelService";
import type { Message } from "../../../types/channel";
import type { ThreadMessageProps } from "../../../types/chat";
import { v3ThreadMessagesToLegacy } from "../adapters/v3ToLegacy";

/**
 * Synchronously read a thread's replies from the in-memory snapshot and
 * adapt them to the legacy `ThreadMessageProps[]` shape — WITHOUT any
 * network round-trip. The thread sibling of `readV3CachedMessages`.
 *
 * This is the hot path for opening a thread (e.g. from an activity click):
 * a channel previously synced this session (or hydrated from IDB on boot)
 * already has its thread replies in `messagesByChannel`, so the caller can
 * paint the thread pane instantly and kick off a background
 * `channelService.syncChannel()` to revalidate. The `useChatManagement`
 * thread live-update subscription (keyed on the open thread's channel +
 * root) patches the fresh slice into `currentThreadChat.messages` once that
 * sync resolves — so callers should NOT await before setting the thread.
 *
 * Returns `[]` for a channel/thread that's never been cached (first-ever
 * open); the background sync then populates it via the subscription. The
 * legacy thread pane renders a neutral blank for `[]`, so the empty paint
 * is benign.
 */
export function readV3CachedThreadMessages(
    channelUuid: string,
    threadRootUuid: string,
    chatType: number
): ThreadMessageProps[] {
    const snapshot = channelService.getSnapshot();
    const messages: readonly Message[] = snapshot.messagesByChannel.get(channelUuid) ?? [];
    return v3ThreadMessagesToLegacy({
        channelId: channelUuid,
        chatType,
        flaggedMessageIds: snapshot.flagByMessageId,
        messages,
        threadRootUuid,
    });
}

/**
 * Fetch the thread reply list for one `(channelUuid, threadRootUuid)`
 * pair via v3, adapt to legacy `ThreadMessageProps[]`.
 *
 * Returns an empty array on failure (mirrors the legacy chain's
 * silent-failure contract).
 */
export async function loadV3SpecificThreadMessages(
    channelUuid: string,
    threadRootUuid: string,
    chatType: number
): Promise<ThreadMessageProps[]> {
    try {
        // `syncChannel` covers both top-level AND thread replies, and
        // is idempotent (replays no-op via the by-id upsert). Calling
        // it here also covers the case where the user opens a thread
        // for a channel they haven't synced this session yet.
        await channelService.syncChannel(channelUuid);
    } catch {
        // Fall through to whatever the snapshot already had cached.
    }
    const snapshot = channelService.getSnapshot();
    const messages: readonly Message[] = snapshot.messagesByChannel.get(channelUuid) ?? [];
    return v3ThreadMessagesToLegacy({
        channelId: channelUuid,
        chatType,
        flaggedMessageIds: snapshot.flagByMessageId,
        messages,
        threadRootUuid,
    });
}
