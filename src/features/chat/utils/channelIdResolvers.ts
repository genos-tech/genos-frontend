/**
 * v3 ↔ legacy chat-id resolvers backed by the `channelService` snapshot.
 *
 * Many surfaces still call legacy `/api/v2/...` endpoints (profile
 * modals, image upload, leave / transfer-owner) that bind their
 * `gm_id` / `project_id` / `mdm_id` / `dm_id` URL params to integer
 * Django fields. Post-v3 flip `ChatProps.chatId` is the UUID, so a
 * direct `as unknown as number` cast 500s at the backend with
 * `ValueError: Field 'gm_id' expected a number but got '<uuid>'`.
 *
 * Each channel row carries its backfilled `legacyChatId` (added by the
 * Track D ChannelSerializer change). Look it up at the boundary.
 */

import { channelService } from "../../../services/channel/channelService";

/**
 * UUID → legacy integer chat id. Returns null when:
 *   - The channel isn't in the snapshot (REST refresh pending).
 *   - The channel has no legacy mirror (v3-native, post-cutover).
 * Callers should refuse the legacy API call in either case.
 */
export function resolveLegacyChatId(channelUuid: string): number | null {
    const ch = channelService.getSnapshot().channels.get(channelUuid);
    return ch?.legacyChatId ?? null;
}

/**
 * Legacy integer chat id → v3 channel UUID by scanning the cached
 * channel list. Returns null when no v3 mirror exists for the legacy
 * row (the backfill hasn't reached it, or the channel was created
 * legacy-side without dual-write).
 *
 * Pass the `chatType` so the lookup disambiguates DM 3 from GM 3.
 */
export function resolveV3ChannelId(legacyChatId: number, chatType: number): string | null {
    const snapshot = channelService.getSnapshot();
    for (const ch of snapshot.channels.values()) {
        if (ch.legacyChatId === legacyChatId && (ch.kind as number) === chatType) {
            return ch.id;
        }
    }
    return null;
}

/**
 * Legacy thread-id → v3 parent-message UUID.
 *
 * The legacy `threadId` semantics differ by chat type:
 *   - DM/GM/MDM: the parent message's per-channel integer `seq`.
 *   - PM: the `TaskMaster.task_id` integer (every PM thread is rooted
 *     on a task-card header message; the legacy code keys threads by
 *     task id rather than seq).
 *
 * v3 stores both the parent UUID (`Message.parentId`) and the per-task
 * `Message.taskId`, so we can look the right top-level row up either
 * way and return its `id` to use as the thread root.
 *
 * Returns null if the parent isn't in the snapshot (the chat hasn't
 * been synced this session, or the row was hard-deleted). Callers
 * should treat that as "thread can't open" rather than 500ing.
 */
export function resolveV3ThreadRootUuid(
    channelUuid: string,
    threadIdOrTaskId: number,
    isPm: boolean
): string | null {
    const messages = channelService.getSnapshot().messagesByChannel.get(channelUuid);
    if (!messages) return null;
    for (const m of messages) {
        if (m.isThreadReply) continue;
        if (isPm) {
            if (m.taskId === threadIdOrTaskId) return m.id;
        } else {
            if (m.seq === threadIdOrTaskId) return m.id;
        }
    }
    return null;
}

/**
 * Legacy per-channel integer `seq` → v3 message UUID. Used by
 * URL routing + scroll-to-message paths that historically built
 * `moveToSpecificIndex` as `${chatId}-${messageId}` (where messageId
 * was the legacy `seq`). The bubble's `messageIdWithChatId` slot now
 * carries the v3 UUID, so the focus highlight needs the UUID format
 * to match. Resolve seq → UUID via the cached snapshot.
 *
 * For PM channels, the URL `messageId` segment is actually the task
 * id (legacy convention — see `MessageBubble.handleMessageClick`).
 * `isPm=true` triggers a task-id lookup instead of a seq lookup so
 * PM URLs roundtrip correctly.
 *
 * Returns null if the row isn't in the snapshot — callers should
 * fall back to leaving `moveToSpecificIndex` unset rather than
 * synthesizing a key that won't match anything.
 */
export function resolveV3MessageUuid(
    channelUuid: string,
    messageIdOrTaskId: number,
    isPm: boolean
): string | null {
    const messages = channelService.getSnapshot().messagesByChannel.get(channelUuid);
    if (!messages) return null;
    for (const m of messages) {
        if (m.isThreadReply) continue;
        if (isPm) {
            if (m.taskId === messageIdOrTaskId) return m.id;
        } else {
            if (m.seq === messageIdOrTaskId) return m.id;
        }
    }
    return null;
}
