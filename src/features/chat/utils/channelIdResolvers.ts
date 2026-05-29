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
