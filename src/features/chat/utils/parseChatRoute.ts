// Pure parser for `/workspace/chat/...` pathnames → the addressable route
// parts. Extracted from `useChatRouting` so it can be unit-tested without
// mounting the hook (which pulls in react-router + channelService).
//
// Expected formats:
//   /workspace/chat/:chatType/:chatId?/thread/:threadId?/message/:messageId?
//   /workspace/chat/:chatType/:chatId?/thread/:threadId?/comment/:commentId?
// The `comment/...` shape is the PM thread "Comments" tab deep link,
// added alongside the existing `message/...` shape.

export type ParsedRoute = {
    chatType: string | undefined;
    // `chatId` is the URL chunk verbatim post-v3 flip — `ChatProps.chatId`
    // is `string` (UUID), and `Number()`-coercing a UUID would NaN. The
    // parser stores the raw chunk; callers that still need a numeric legacy
    // chat id cast at the call boundary.
    chatId: string | undefined;
    // `number` for PM (numeric task_id) or `string` for DM/GM/MDM (the
    // thread-root UUID). See `parseRouteId` — `Number()`-coercing the UUID
    // NaN'd it and broke thread deep-links / cold-reloads.
    threadId: number | string | undefined;
    messageId: number | undefined;
    // PM thread "Comments" tab deep-link target (task comment id).
    // Mutually exclusive with `messageId` at the URL level — the path
    // contains either `…/message/:id` or `…/comment/:id`, never both.
    commentId: number | undefined;
};

export const EMPTY_ROUTE: ParsedRoute = {
    chatId: undefined,
    chatType: undefined,
    commentId: undefined,
    messageId: undefined,
    threadId: undefined,
};

// Parse a thread URL segment type-awarely. Post-v3, a DM/GM/MDM thread
// segment is the thread-root UUID (a string), while PM keeps the numeric
// `task_id`. A digits-only segment becomes a number (PM's
// `resolveV3ThreadRootUuid` does a seq/task-id lookup that needs it);
// anything else (a UUID) stays a string and is passed straight through.
// The old blanket `Number()` NaN'd every UUID — `shouldLoadThread` then
// never fired, so deep-linking / cold-reloading a thread never reopened
// it. A blanket string passthrough is just as wrong: it would feed PM's
// "123" into the UUID branch.
const parseRouteId = (raw: string | undefined): number | string | undefined => {
    if (!raw) return undefined;
    return /^\d+$/.test(raw) ? Number(raw) : raw;
};

export const parseChatRoute = (pathname: string): ParsedRoute => {
    const pathParts = pathname.split("/").filter(Boolean);

    const chatIndex = pathParts.indexOf("chat");
    if (chatIndex === -1) return EMPTY_ROUTE;

    const chatType = pathParts[chatIndex + 1];
    const chatIdStr = pathParts[chatIndex + 2];
    const threadIndex = pathParts.indexOf("thread");
    const messageIndex = pathParts.indexOf("message");
    const commentIndex = pathParts.indexOf("comment");

    // Keys sorted alphabetically per `sort-keys`.
    return {
        chatId: chatIdStr || undefined,
        chatType,
        commentId:
            commentIndex !== -1 && pathParts[commentIndex + 1]
                ? Number(pathParts[commentIndex + 1])
                : undefined,
        messageId:
            messageIndex !== -1 && pathParts[messageIndex + 1]
                ? Number(pathParts[messageIndex + 1])
                : undefined,
        threadId: threadIndex !== -1 ? parseRouteId(pathParts[threadIndex + 1]) : undefined,
    };
};
