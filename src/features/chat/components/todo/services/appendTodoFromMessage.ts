import { PartialBlock } from "@blocknote/core";

import { getMessages } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { TodoItemProps } from "../../../../../types/chat";
import { getLocalCurrentDate } from "../../../../../utils/dateUtils";
import { createTodoItem } from "./todoItems";

interface MessageSource {
    chatType: number;
    chatId: number;
    threadId: number | null;
    messageId: number;
    isThread: boolean;
    messageText: string;
    /** A task comment: it is linked on the TASK page, not through a chat (MIP-1436). */
    taskComment?: { projectId: number; taskId: number; commentId: number };
    /** A project-chat message that is a task's card: linked to the task (MIP-1436). */
    task?: { projectId: number; taskId: number };
}

const buildSourceLink = ({
    chatType,
    chatId,
    threadId,
    messageId,
    isThread,
    taskComment,
    task,
}: MessageSource): { href: string; fromText: string } | null => {
    const strings = getMessages().chat.todoPane;
    const origin = window.location.origin;
    // A task comment is addressed by project, task and comment id on the task page. The old
    // link put the numeric project id where a chat URL now carries the channel's UUID, so
    // it opened "No conversation selected" (MIP-1436).
    if (taskComment) {
        return {
            href: `${origin}/workspace/tasks/project/${taskComment.projectId}/task/${taskComment.taskId}/comment/${taskComment.commentId}`,
            fromText: strings.sourceTaskComment,
        };
    }
    if (chatType === 1) {
        if (isThread && threadId) {
            return {
                href: `${origin}/workspace/chat/dm/${chatId}/thread/${threadId}/message/${messageId}`,
                fromText: strings.sourceDmThread,
            };
        }
        return {
            href: `${origin}/workspace/chat/dm/${chatId}/message/${messageId}`,
            fromText: strings.sourceDm,
        };
    }
    if (chatType === 2) {
        if (isThread && threadId) {
            return {
                href: `${origin}/workspace/chat/gm/${chatId}/thread/${threadId}/message/${messageId}`,
                fromText: strings.sourceGmThread,
            };
        }
        return {
            href: `${origin}/workspace/chat/gm/${chatId}/message/${messageId}`,
            fromText: strings.sourceGm,
        };
    }
    if (chatType === 3 && !isThread) {
        // A project-chat message: the task's own card links to the task; any other message
        // to itself in the project chat. It returned no link at all before, so "Add to
        // To-Do" on one did nothing.
        if (task) {
            return {
                href: `${origin}/workspace/tasks/project/${task.projectId}/task/${task.taskId}`,
                fromText: strings.sourceTask,
            };
        }
        return {
            href: `${origin}/workspace/chat/pm/${chatId}/message/${messageId}`,
            fromText: strings.sourceProjectChat,
        };
    }
    if (chatType === 3 && threadId) {
        return {
            href: `${origin}/workspace/chat/pm/${chatId}/thread/${threadId}/comment/${messageId}`,
            fromText: strings.sourceTaskComment,
        };
    }
    if (chatType === 4) {
        if (isThread && threadId) {
            return {
                href: `${origin}/workspace/chat/mdm/${chatId}/thread/${threadId}/message/${messageId}`,
                fromText: strings.sourceMdmThread,
            };
        }
        return {
            href: `${origin}/workspace/chat/mdm/${chatId}/message/${messageId}`,
            fromText: strings.sourceMdm,
        };
    }
    return null;
};

const buildNotesDoc = (fromText: string, href: string): PartialBlock[] => [
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [
            { text: `${fromText}: `, type: "text", styles: { italic: true } },
            {
                href,
                type: "link",
                content: [{ text: href, type: "text", styles: {} }],
            },
        ],
        children: [],
    },
];

export const appendTodoFromMessage = async (
    accessToken: string | null,
    myself: UserProps,
    source: MessageSource
): Promise<TodoItemProps | undefined> => {
    const link = buildSourceLink(source);
    if (!link) return;

    const title =
        (source.messageText || "").trim().slice(0, 200) || getMessages().chat.todoPane.untitled;
    const notes = buildNotesDoc(link.fromText, link.href);

    return createTodoItem(accessToken, myself, {
        localDate: getLocalCurrentDate(),
        title,
        notes,
    });
};
