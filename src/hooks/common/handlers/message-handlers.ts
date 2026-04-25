import { Socket } from "socket.io-client";

import { ChatService } from "../../../db/services/chat.service";
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
    useCM: ChatManagementState
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
            useCM.currentThreadChat &&
            newMessage.chatType === useCM.currentThreadChat.chatType &&
            newMessage.chatId === useCM.currentThreadChat.chatId &&
            newMessage.threadId === useCM.currentThreadChat.threadId
        ) {
            useCM.setCurrentThreadChat({
                ...useCM.currentThreadChat,
                messages: useCM.currentThreadChat.messages.filter(
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
                useCM.currentThreadChat &&
                newMessage.chatId === useCM.currentThreadChat.chatId &&
                newMessage.threadId === useCM.currentThreadChat.threadId
            ) {
                const updatedMessages = await loadSpecificThreadMessages(
                    myself,
                    useCM.currentThreadChat.chatType,
                    useCM.currentThreadChat.chatId,
                    useCM.currentThreadChat.threadId,
                    accessToken
                );
                useCM.setCurrentThreadChat({
                    ...useCM.currentThreadChat,
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
            useCM.currentThreadChat &&
            newMessage.chatId === useCM.currentThreadChat.chatId &&
            newMessage.threadId === useCM.currentThreadChat.threadId
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
                messages: useCM.currentThreadChat
                    ? [...useCM.currentThreadChat.messages, newThreadMessage]
                    : [newThreadMessage],
                TSLastMessage: newThreadMessage.tsSent,
                notMove: true,
            };
            useCM.setCurrentThreadChat(updatedThreadChat);
        }
    }
};

export const handleRegularMessage = async (
    newMessage: NewMessageProps,
    myself: UserProps,
    currentProject: any,
    currentPreviewTaskId: number,
    setIsTaskUpdatedBySomeone: (value: boolean) => void,
    useCM: ChatManagementState,
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
        await handleMessageDeletion(newMessage, useCM);
        return;
    }

    await addMessage(newChatMessage, newMessage.chatType);

    if (newMessage.chatType === 1) {
        await handleDMMessage(newMessage, newChatMessage, context, myself, useCM, socket);
    } else if (newMessage.chatType === 2) {
        await handleGMMessage(newMessage, newChatMessage, context, useCM);
    } else if (newMessage.chatType === 3) {
        await handlePMMessage(
            newMessage,
            newChatMessage,
            context,
            currentProject,
            currentPreviewTaskId,
            setIsTaskUpdatedBySomeone,
            useCM
        );
    }
};

const handleMessageDeletion = async (newMessage: NewMessageProps, useCM: ChatManagementState) => {
    const chatService = new ChatService();

    // Delete message from indexedDB based on chat type
    if (newMessage.chatType === 1) {
        await chatService.deleteDMMessage(newMessage.chatId, newMessage.messageId);
    } else if (newMessage.chatType === 2) {
        await chatService.deleteGMMessage(newMessage.chatId, newMessage.messageId);
    } else if (newMessage.chatType === 3) {
        await chatService.deletePMMessage(
            newMessage.chatId,
            newMessage.messageId,
            newMessage.taskId || undefined
        );
    }

    // Update current chat if it matches
    if (
        useCM.currentMainChat &&
        newMessage.chatType === useCM.currentMainChat.chatType &&
        newMessage.chatId === useCM.currentMainChat.chatId
    ) {
        useCM.setCurrentMainChat({
            ...useCM.currentMainChat,
            messages: useCM.currentMainChat.messages.filter(
                (m) => m.messageId !== newMessage.messageId
            ),
            notMove: true,
        });
    } else if (
        useCM.currentSubChat &&
        newMessage.chatType === useCM.currentSubChat.chatType &&
        newMessage.chatId === useCM.currentSubChat.chatId
    ) {
        useCM.setCurrentSubChat({
            ...useCM.currentSubChat,
            messages: useCM.currentSubChat.messages.filter(
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
    useCM: ChatManagementState,
    socket: Socket
) => {
    const updatedChat = await makeDMUpdatedChat(newMessage, myself);

    if (newMessage.isEdited) {
        if (context.fromMe || context.toMe) {
            updateCurrentChat(updatedChat, useCM);
        }
    } else {
        if (!context.fromMe && context.toMe) {
            if (!newMessage.isReactionUpdated) {
                await updateAllChat(
                    updatedChat,
                    newChatMessage,
                    useCM.allChats,
                    useCM.funcSetAllChats
                );
            }
            updateCurrentChat(updatedChat, useCM);

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
                await updateAllChat(
                    newDMChat,
                    newChatMessage,
                    useCM.allChats,
                    useCM.funcSetAllChats
                );
            }
            useCM.setCurrentMainChat(newDMChat);

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
    useCM: ChatManagementState
) => {
    const updatedChat = await makeGMUpdatedChat(newMessage, useCM.allChats);

    if (newMessage.isEdited) {
        updateCurrentChat(updatedChat, useCM);
    } else if (!context.fromMe) {
        if (useCM.allChats.length > 0 && !newMessage.isReactionUpdated) {
            await updateAllChat(
                updatedChat,
                newChatMessage,
                useCM.allChats,
                useCM.funcSetAllChats
            );
        }
        updateCurrentChat(updatedChat, useCM);
    }
};

const handlePMMessage = async (
    newMessage: NewMessageProps,
    newChatMessage: MessageProps,
    context: any,
    currentProject: any,
    currentPreviewTaskId: number,
    setIsTaskUpdatedBySomeone: (value: boolean) => void,
    useCM: ChatManagementState
) => {
    if (
        currentProject &&
        currentProject.projectId === newMessage.project?.projectId &&
        currentPreviewTaskId === newMessage.taskId
    ) {
        setIsTaskUpdatedBySomeone(true);
    }

    const updatedChat = await makePMUpdatedChat(newMessage, useCM.allChats);

    if (newMessage.isEdited) {
        updateCurrentChat(updatedChat, useCM);
    } else if (!context.fromMe) {
        if (useCM.allChats.length > 0 && !newMessage.isReactionUpdated) {
            await updateAllChat(
                updatedChat,
                newChatMessage,
                useCM.allChats,
                useCM.funcSetAllChats
            );
        }
        updateCurrentChat(updatedChat, useCM);
    }
};

const updateCurrentChat = (updatedChat: any, useCM: ChatManagementState) => {
    if (useCM.currentMainChat && updatedChat.chatId === useCM.currentMainChat.chatId) {
        useCM.setCurrentMainChat(updatedChat);
    } else if (useCM.currentSubChat && updatedChat.chatId === useCM.currentSubChat.chatId) {
        useCM.setCurrentSubChat(updatedChat);
    }
};
