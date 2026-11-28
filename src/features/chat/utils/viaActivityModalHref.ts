/**
 * Where an ordinary Activity card whose change was made through an AI app (`viaAi`) opens in the
 * chat's preview modal (MIP-1755). An AI-app notice has its own rule (`aiAppModalTarget`).
 * Null means the modal cannot show it, and the card does what it always did.
 */

import type { ActivityMessageProps, AllChatProps } from "../../../types/chat";
import type { ChatNoteProps, MyNoteProps, TaskNoteProps } from "../../../types/notes";
import { resolveV3ThreadRootUuid } from "./channelIdResolvers";

const CHAT_SLUGS: Record<number, string> = { 1: "dm", 2: "gm", 3: "pm", 4: "mdm" };

const taskHref = (projectId: number, taskId: number, commentId?: number): string =>
    `/workspace/tasks/project/${projectId}/task/${taskId}` +
    (commentId ? `/comment/${commentId}` : "");

/** A task body, a task comment, a chat message or a thread reply. Notes need the note itself:
 *  see `noteModalHref`. */
export function viaActivityModalHref(
    activity: ActivityMessageProps,
    allChats: AllChatProps[]
): string | null {
    // The task's own description (surface 5): no chat behind it.
    if (activity.chatType === 5) {
        return activity.projectId && activity.taskId
            ? taskHref(activity.projectId, activity.taskId)
            : null;
    }
    // chatType 4 is dual-purpose: with a taskId it is a task comment in the project chat, without
    // one a multi-person DM.
    const legacyTaskComment = activity.chatType === 4 && !!activity.taskId;
    const chatType = legacyTaskComment ? 3 : activity.chatType;
    const slug = CHAT_SLUGS[chatType];
    if (!slug) return null;
    const chatId = String(activity.chatId);
    const chat = allChats.find((c) => c.chatType === chatType && c.chatId === chatId);

    // A task comment, and a task's card in the project chat (assigned, mentioned), open the task.
    const projectId = chat?.project?.projectId ?? activity.projectId;
    if (chatType === 3 && activity.taskId && projectId) {
        if (activity.taskCommentId) {
            return taskHref(projectId, activity.taskId, activity.taskCommentId);
        }
        if (legacyTaskComment) return taskHref(projectId, activity.taskId, activity.messageId);
        if (!activity.isThread) return taskHref(projectId, activity.taskId);
    }

    // The chat modal reads the member's own chat list: a chat that is not in it cannot be shown.
    if (!chat) return null;
    const base = `/workspace/chat/${slug}/${chatId}`;
    // `messageUniqueKey` is the message's v3 id, the key the pane focuses on.
    const message = `/message/${activity.messageUniqueKey}`;
    if (!activity.isThread) return base + message;
    const root =
        chatType === 3
            ? resolveV3ThreadRootUuid(chatId, activity.taskId, true)
            : String(activity.threadId || "");
    return root ? `${base}/thread/${root}${message}` : null;
}

/** The note a note mention points at, once it is loaded. */
export function noteModalHref(
    noteType: 1 | 2 | 3,
    noteId: number,
    note: MyNoteProps | TaskNoteProps | ChatNoteProps,
    bucket: "my" | "shared" | "team"
): string | null {
    if (noteType === 1) return `/workspace/notes/${bucket}/${noteId}`;
    if (noteType === 2) {
        const { projectId, taskId } = note as TaskNoteProps;
        return projectId && taskId
            ? `/workspace/notes/task/project/${projectId}/task/${taskId}/note/${noteId}`
            : null;
    }
    const { chatType, chatId, threadId } = note as ChatNoteProps;
    const slug = CHAT_SLUGS[chatType];
    return slug && chatId && threadId !== undefined
        ? `/workspace/notes/chat/${slug}/${chatId}/thread/${threadId || 0}/note/${noteId}`
        : null;
}
