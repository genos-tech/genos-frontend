/**
 * Chat URL vocabulary: the kind ⇄ path-segment maps and the path builder
 * that is `parseChatRoute`'s inverse.
 *
 * These live in `utils/` rather than inside `useChatRouting` so a caller
 * that only needs to BUILD a chat path (e.g. the chat-list tap, which
 * drives the URL on mobile) doesn't import a hook module — and with it
 * channelService, the v3 message loaders and AuthContext — to get two
 * constants. `useChatRouting` re-exports them for existing consumers.
 */

// Keys sorted alphabetically per `sort-keys` (the integer values are
// still the canonical kind codes — DM=1, GM=2, PM=3, MDM=4, activity=5,
// flagged=6 — and don't depend on key declaration order).
export const CHAT_TYPE_MAP: Record<string, number> = {
    activity: 5,
    dm: 1,
    flagged: 6,
    gm: 2,
    mdm: 4,
    pm: 3,
};

export const CHAT_TYPE_REVERSE_MAP: Record<number, string> = {
    1: "dm",
    2: "gm",
    3: "pm",
    4: "mdm",
    5: "activity",
    6: "flagged",
};

// `messageId` and `commentId` are mutually exclusive — either one focuses
// a thread message bubble (the existing flow) or one focuses a task
// comment in the PM thread's "Comments" tab. If both are passed,
// `commentId` wins (caller's choice was a deeper-link target).
export const buildChatPath = (
    typePath: string,
    // `chatId` widened to `string | number` for the v3 migration —
    // post-flip the runtime value is the UUID string from
    // `ChatProps.chatId`. Numeric callers (legacy code paths in
    // services still building integer-keyed URLs) keep working via
    // the template literal coercion.
    chatId?: string | number,
    // Widened alongside `chatId`: a DM/GM/MDM thread segment is the
    // thread-root UUID (string), PM keeps the numeric task id. See
    // `parseChatRoute`, which parses the segment back type-awarely.
    threadId?: number | string,
    messageId?: number,
    commentId?: number
): string => {
    let path = `/workspace/chat/${typePath}`;
    if (chatId !== undefined) path += `/${chatId}`;
    if (threadId !== undefined) path += `/thread/${threadId}`;
    if (commentId !== undefined) {
        path += `/comment/${commentId}`;
    } else if (messageId !== undefined) {
        path += `/message/${messageId}`;
    }
    return path;
};
