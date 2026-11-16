import { inAppPath } from "../../features/chat/utils/aiAppNotice";
import { NotificationIntent } from "./types";

/**
 * Where a click on a notification opens (MIP-1659).
 *
 * One pure function, so every kind of notification can be checked against it, and `openIntent` in
 * `App.tsx` only carries the destination out. In order:
 *
 *   1. `onOpen`: the intent reopens its own surface (an agent run's answer).
 *   2. `url`: the event names its page exactly (an AI app's change, a task comment, an inbox item,
 *      a reminder). An in-app path only.
 *   3. a note surface (6/7/8): open that note.
 *   4. a task with its project: the task.
 *   5. a chat (with its thread): the chat.
 *   6. an inbox item with no page of its own: the inbox.
 *   7. otherwise: the chat page, the old last resort. A known kind must never get here; the tests
 *      say which do not.
 */
export type IntentDestination =
    | { kind: "callback"; open: () => void }
    | { kind: "path"; path: string }
    | { kind: "note"; noteType: number; noteId: number | undefined }
    | { kind: "chat"; chatType: number; chatId: string; threadId: number | string }
    | { kind: "fallback"; path: "/workspace/chat" };

export const taskPath = (projectId: number, taskId: number, commentId?: number): string =>
    `/workspace/tasks/project/${projectId}/task/${taskId}` +
    (commentId !== undefined && commentId > 0 ? `/comment/${commentId}` : "");

export const intentDestination = (intent: NotificationIntent): IntentDestination => {
    if (intent.onOpen) return { kind: "callback", open: intent.onOpen };

    const path = inAppPath(intent.url);
    if (path) return { kind: "path", path };

    const src = intent.source;
    if (intent.category === "inbox" || !src) return { kind: "path", path: "/workspace/inbox" };

    // Note surfaces first: a task-note mention carries a task and a project too, and a chat-note
    // one its parent chat, and both must open the NOTE.
    if (src.surfaceType === 6 || src.surfaceType === 7 || src.surfaceType === 8) {
        return { kind: "note", noteType: src.surfaceType - 5, noteId: src.noteId };
    }
    if (src.taskId !== undefined && src.projectId !== undefined) {
        return { kind: "path", path: taskPath(src.projectId, src.taskId) };
    }
    if (src.chatType !== undefined && src.chatId !== undefined) {
        return {
            kind: "chat",
            chatType: src.chatType,
            chatId: src.chatId,
            threadId: src.threadId ?? 0,
        };
    }
    return { kind: "fallback", path: "/workspace/chat" };
};
