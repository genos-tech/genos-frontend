/**
 * Tells whether a chat / message / thread id looks like a legacy
 * numeric id (pre-v3 IntegerField PK) vs a v3 UUID.
 *
 * PUNCH LIST (v3 chatId migration): many legacy endpoints
 * (`/api/v2/{dm,gm,pm,mdm}/...`, `/chat/master/`, `/task/...`) bind
 * their `chat_id` / `mdm_id` / `thread_id` params to a Django
 * `IntegerField`. Post-flip, `ChatProps.chatId` is a UUID string at
 * the type level — callers cast `string → number` to satisfy TS but
 * the UUID value rides through to the HTTP call, and Django answers
 * with `ValueError: Field 'chat_id' expected a number but got '...'`.
 *
 * Until each legacy endpoint is rewritten (or callers are routed
 * through `channelService` for v3 channels), guard the request with
 * this helper and short-circuit when the id isn't a pure digit string.
 */
export const isLegacyNumericId = (value: string | number | undefined | null): boolean => {
    if (value === null || value === undefined) return false;
    return /^\d+$/.test(String(value));
};
