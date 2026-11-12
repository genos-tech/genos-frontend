import { useEffect } from "react";

import { appendTodoFromMessage } from "./services/appendTodoFromMessage";

import { toast } from "../../../../components/ui/feedback/toastStore";
import { UseTodoGroupsState } from "../../../../hooks/useTodoGroups";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";
import { getFirstLine } from "../../utils/common";
import { setTodoFromMessageBubble, TodoSource, useTodoFromMessageBubble } from "./addToTodoStore";

/** The Toast's own duration for "Added to To-Do". */
const ADDED_TOAST_MS = 2000;

/**
 * Handles the requests made through `setTodoFromMessageBubble` (MIP-1434): makes the to-do from
 * the message, refreshes the To-Do list and says so. Renders nothing; mount it once, in App.
 * It was ChatHome's `handleAppendTodo`, moved here so a request from any page is handled.
 */
export const AddToTodoHost = ({
    accessToken,
    allChats,
    myself,
    useTG,
}: {
    accessToken: string | null;
    allChats: AllChatProps[];
    myself: UserProps;
    useTG: Pick<UseTodoGroupsState, "refresh">;
}) => {
    const { t } = useTranslation();
    const request = useTodoFromMessageBubble();

    useEffect(() => {
        if (!request) return;
        // Clear first: a second request for the same message must not be swallowed.
        setTodoFromMessageBubble(null);
        void (async () => {
            const created = await createFrom(request, accessToken, myself, allChats);
            if (!created) return;
            // `appendTodoFromMessage` bypassed the hook's optimistic mutator, so re-pull
            // the groups for an authoritative view.
            await useTG.refresh();
            toast.success(t.chat.feedback.todoAddedFromMessage, { duration: ADDED_TOAST_MS });
        })();
        // Only a new request should run this, not a new `useTG` or `allChats` identity.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [request]);

    return null;
};

/** The to-do for one message, thread reply or task comment; `undefined` when it has no link. */
const createFrom = (
    source: TodoSource,
    accessToken: string | null,
    myself: UserProps,
    allChats: AllChatProps[]
) => {
    // Keys sorted alphabetically per `sort-keys`.
    if ("messageIdWithChatIdAndThreadId" in source) {
        return appendTodoFromMessage(accessToken, myself, {
            chatId: source.chatId,
            chatType: source.chatType,
            isThread: true,
            messageId: source.messageId,
            messageText: getFirstLine(source.content[0]),
            threadId: source.threadId,
        });
    }
    if ("messageIdWithChatId" in source) {
        return appendTodoFromMessage(accessToken, myself, {
            chatId: source.chatId,
            chatType: source.chatType,
            isThread: false,
            messageId: source.messageId,
            messageText: getFirstLine(source.content[0]),
            // A project chat's message is usually a task's card: link the task. The card
            // carries the task id; the project is the chat's (the message has none).
            task: (() => {
                if (source.chatType !== 3 || !source.taskId) return undefined;
                const projectId =
                    source.project?.projectId ??
                    allChats.find((c) => c.chatType === 3 && c.chatId === String(source.chatId))
                        ?.project?.projectId;
                return projectId ? { projectId, taskId: source.taskId } : undefined;
            })(),
            threadId: null,
        });
    }
    if ("commentId" in source) {
        if (!source.projectId) return Promise.resolve(undefined);
        return appendTodoFromMessage(accessToken, myself, {
            chatId: source.projectId,
            chatType: 3,
            isThread: true,
            messageId: source.commentId,
            messageText: getFirstLine(source.commentBody[0]),
            taskComment: {
                commentId: source.commentId,
                projectId: source.projectId,
                taskId: source.taskId,
            },
            threadId: source.taskId,
        });
    }
    return Promise.resolve(undefined);
};
