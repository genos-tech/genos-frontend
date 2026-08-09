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
}

const buildSourceLink = ({
    chatType,
    chatId,
    threadId,
    messageId,
    isThread,
}: MessageSource): { href: string; fromText: string } | null => {
    const strings = getMessages().chat.todoPane;
    const origin = window.location.origin;
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
