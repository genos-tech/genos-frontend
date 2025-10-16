import { Socket } from "socket.io-client";

import { STORES } from "../../../db/conf";
import { deleteData } from "../../../db/crud";
import { addMessage } from "../../../features/chat/services/addMessage";
import { addThreadMessage } from "../../../features/chat/services/addThreadMessage";
import { loadSpecificThreadMessages } from "../../../features/chat/services/loadSpecificThreadMessages";
import { UserProps } from "../../../types/admin";
import {
    MessageProps,
    NewMessageProps,
    NewThreadMessageProps,
    ThreadMessageProps,
    ThreadProps,
} from "../../../types/chat";
import { ChatManagementState } from "../../chats/useChatManagement";
import {
    makeDMUpdatedChat,
    makeGMUpdatedChat,
    makePMUpdatedChat,
    updateAllChat,
} from "../utils/chat-updaters";
import { analyzeMessageContext } from "../utils/message-context";

export const handleThreadMessage = async (
    newMessage: NewThreadMessageProps,
    myself: UserProps,
    accessToken: string | null,
    CM: ChatManagementState
) => {
    const newThreadMessage: ThreadMessageProps = {
        chatType: newMessage.chatType,
        systemUserId: newMessage.systemUserId,
        messageIdWithChatIdAndThreadId:
            newMessage.chatType === 3
                ? `${newMessage.chatId}-${newMessage.threadId}-${newMessage.messageId}`
                : `${newMessage.chatId}-${newMessage.taskId}-${newMessage.messageId}`,
        chatId: newMessage.chatId,
        threadId: newMessage.threadId,
        messageId: newMessage.messageId,
        content: newMessage.content,
        contentText: newMessage.contentText,
        reactions: newMessage.reactions,
        sender: newMessage.sender,
        tsSent: newMessage.tsSent,
        tsUpdated: newMessage.tsUpdated,
        taskId: newMessage.taskId,
    };

    const context = analyzeMessageContext(newMessage as any, myself);

    if (newMessage.isDeleted) {
        if (
            CM.currentThreadChat &&
            newMessage.chatType === CM.currentThreadChat.chatType &&
            newMessage.chatId === CM.currentThreadChat.chatId &&
            newMessage.threadId === CM.currentThreadChat.threadId
        ) {
            CM.setCurrentThreadChat({
                ...CM.currentThreadChat,
                messages: CM.currentThreadChat.messages.filter(
                    (m) => m.messageId !== newMessage.messageId
                ),
                notMove: true,
            });
        }
        return;
    }

    if (newMessage.isEdited) {
        if (context.fromMe || context.toMe) {
            await addThreadMessage(newThreadMessage, newMessage.chatType);
            if (
                CM.currentThreadChat &&
                newMessage.chatId === CM.currentThreadChat.chatId &&
                newMessage.threadId === CM.currentThreadChat.threadId
            ) {
                const updatedMessages = await loadSpecificThreadMessages(
                    myself,
                    CM.currentThreadChat.chatType,
                    CM.currentThreadChat.chatId,
                    CM.currentThreadChat.threadId,
                    accessToken
                );
                CM.setCurrentThreadChat({
                    ...CM.currentThreadChat,
                    messages: updatedMessages,
                    notMove: true,
                });
            }
        }
        return;
    }

    // Handle new thread message
    if (!context.fromMe && context.toMe) {
        await addThreadMessage(newThreadMessage, newMessage.chatType);

        if (
            CM.currentThreadChat &&
            newMessage.chatId === CM.currentThreadChat.chatId &&
            newMessage.threadId === CM.currentThreadChat.threadId
        ) {
            const updatedThreadChat: ThreadProps = {
                chatId: newMessage.chatId,
                chatName:
                    newMessage.chatType === 1 ? newMessage.sender.userName : newMessage.chatName,
                systemUserId: newMessage.systemUserId,
                threadId: newThreadMessage.threadId,
                chatType: newMessage.chatType,
                dmPartnerUser: newMessage.sender,
                taskId: newThreadMessage.taskId,
                messages: CM.currentThreadChat
                    ? [...CM.currentThreadChat.messages, newThreadMessage]
                    : [newThreadMessage],
                TSLastMessage: newThreadMessage.tsSent,
                notMove: true,
            };
            CM.setCurrentThreadChat(updatedThreadChat);
        }
    }
};

export const handleRegularMessage = async (
    newMessage: NewMessageProps,
    myself: UserProps,
    currentProject: any,
    currentPreviewTaskId: number,
    setIsTaskUpdatedBySomeone: (value: boolean) => void,
    CM: ChatManagementState,
    socket: Socket
) => {
    const newChatMessage: MessageProps = {
        chatType: newMessage.chatType,
        systemUserId: newMessage.systemUserId,
        messageIdWithChatId:
            newMessage.chatType === 3
                ? `${newMessage.chatId}-${newMessage.taskId}`
                : `${newMessage.chatId}-${newMessage.messageId}`,
        chatId: newMessage.chatId,
        messageId: newMessage.messageId,
        content: newMessage.content,
        contentText: newMessage.contentText,
        reactions: newMessage.reactions,
        sender: newMessage.sender,
        numReplies: newMessage.numReplies,
        tsSent: newMessage.tsSent,
        tsUpdated: newMessage.tsUpdated,
        taskId: newMessage.taskId,
        taskStatus: newMessage.taskStatus,
    };

    const context = analyzeMessageContext(newMessage, myself);

    if (newMessage.isDeleted) {
        await handleMessageDeletion(newMessage, CM);
        return;
    }

    await addMessage(newChatMessage, newMessage.chatType);

    if (newMessage.chatType === 1) {
        await handleDMMessage(newMessage, newChatMessage, context, myself, CM, socket);
    } else if (newMessage.chatType === 2) {
        await handleGMMessage(newMessage, newChatMessage, context, CM);
    } else if (newMessage.chatType === 3) {
        await handlePMMessage(
            newMessage,
            newChatMessage,
            context,
            currentProject,
            currentPreviewTaskId,
            setIsTaskUpdatedBySomeone,
            CM
        );
    }
};

const handleMessageDeletion = async (newMessage: NewMessageProps, CM: ChatManagementState) => {
    const storeName =
        newMessage.chatType === 1
            ? STORES.DM_MESSAGES
            : newMessage.chatType === 2
              ? STORES.GM_MESSAGES
              : STORES.PM_MESSAGES;

    const key =
        newMessage.chatType === 3
            ? `${newMessage.chatId}-${newMessage.taskId}-${newMessage.messageId}`
            : `${newMessage.chatId}-${newMessage.messageId}`;

    await deleteData({ storeName, key });

    // Update current chat if it matches
    if (
        CM.currentMainChat &&
        newMessage.chatType === CM.currentMainChat.chatType &&
        newMessage.chatId === CM.currentMainChat.chatId
    ) {
        CM.setCurrentMainChat({
            ...CM.currentMainChat,
            messages: CM.currentMainChat.messages.filter(
                (m) => m.messageId !== newMessage.messageId
            ),
            notMove: true,
        });
    } else if (
        CM.currentSubChat &&
        newMessage.chatType === CM.currentSubChat.chatType &&
        newMessage.chatId === CM.currentSubChat.chatId
    ) {
        CM.setCurrentSubChat({
            ...CM.currentSubChat,
            messages: CM.currentSubChat.messages.filter(
                (m) => m.messageId !== newMessage.messageId
            ),
            notMove: true,
        });
    }
};

const handleDMMessage = async (
    newMessage: NewMessageProps,
    newChatMessage: MessageProps,
    context: any,
    myself: UserProps,
    CM: ChatManagementState,
    socket: Socket
) => {
    const updatedChat = await makeDMUpdatedChat(newMessage, myself);

    if (newMessage.isEdited) {
        if (context.fromMe || context.toMe) {
            updateCurrentChat(updatedChat, CM);
        }
    } else {
        if (!context.fromMe && context.toMe) {
            if (!newMessage.isReactionUpdated) {
                await updateAllChat(updatedChat, newChatMessage, CM.allChats, CM.funcSetAllChats);
            }
            updateCurrentChat(updatedChat, CM);

            if (newMessage.messageId === 1 && updatedChat.dmPartnerUser) {
                socket.emit("join", {
                    joiningCGId: updatedChat.chatId,
                    joiningCGName: updatedChat.chatName,
                    chatType: 1,
                    dmPartnerUserId: updatedChat.dmPartnerUser.userId,
                });
            }
        } else if (context.fromMe && newMessage.messageId === 1) {
            const newDMChat = await makeDMUpdatedChat(
                {
                    ...newMessage,
                    lastReadMessageId: newMessage.lastReadMessageId + 1,
                },
                myself
            );

            if (!newMessage.isReactionUpdated) {
                await updateAllChat(newDMChat, newChatMessage, CM.allChats, CM.funcSetAllChats);
            }
            CM.setCurrentMainChat(newDMChat);

            if (newDMChat.dmPartnerUser) {
                socket.emit("join", {
                    joiningCGId: newDMChat.chatId,
                    joiningCGName: newDMChat.chatName,
                    chatType: 1,
                    dmPartnerUserId: newDMChat.dmPartnerUser.userId,
                });
            }
        }
    }
};

const handleGMMessage = async (
    newMessage: NewMessageProps,
    newChatMessage: MessageProps,
    context: any,
    CM: ChatManagementState
) => {
    const updatedChat = await makeGMUpdatedChat(newMessage);

    if (newMessage.isEdited) {
        updateCurrentChat(updatedChat, CM);
    } else if (!context.fromMe) {
        if (CM.allChats.length > 0 && !newMessage.isReactionUpdated) {
            await updateAllChat(updatedChat, newChatMessage, CM.allChats, CM.funcSetAllChats);
        }
        updateCurrentChat(updatedChat, CM);
    }
};

const handlePMMessage = async (
    newMessage: NewMessageProps,
    newChatMessage: MessageProps,
    context: any,
    currentProject: any,
    currentPreviewTaskId: number,
    setIsTaskUpdatedBySomeone: (value: boolean) => void,
    CM: ChatManagementState
) => {
    if (
        currentProject &&
        currentProject.projectId === newMessage.project?.projectId &&
        currentPreviewTaskId === newMessage.taskId
    ) {
        setIsTaskUpdatedBySomeone(true);
    }

    const updatedChat = await makePMUpdatedChat(newMessage);

    if (newMessage.isEdited) {
        updateCurrentChat(updatedChat, CM);
    } else if (!context.fromMe) {
        if (CM.allChats.length > 0 && !newMessage.isReactionUpdated) {
            await updateAllChat(updatedChat, newChatMessage, CM.allChats, CM.funcSetAllChats);
        }
        updateCurrentChat(updatedChat, CM);
    }
};

const updateCurrentChat = (updatedChat: any, CM: ChatManagementState) => {
    if (CM.currentMainChat && updatedChat.chatId === CM.currentMainChat.chatId) {
        CM.setCurrentMainChat(updatedChat);
    } else if (CM.currentSubChat && updatedChat.chatId === CM.currentSubChat.chatId) {
        CM.setCurrentSubChat(updatedChat);
    }
};
