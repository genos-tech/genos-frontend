import { Socket } from "socket.io-client";

import { ChatService } from "../../../db/services/chat.service";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps, MessageProps } from "../../../types/chat";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { addChat } from "../services/addChat";
import { addMessage } from "../services/addMessage";
import { checkKnownChat } from "../services/checkKnownChat";
import { defineNewChat } from "../services/defineNewChat";
import { popSpecificMessages } from "../services/popSpecificMessages";
import { defaultDmPartner } from "./constants";
import { loadSpecificGM } from "./loadSpecificGM";

export const moveToDMChat = async (
    socket: Socket | null,
    chatId: number,
    chatName: string,
    dmPartnerUser: UserProps,
    useCM: ChatManagementState
) => {
    if (chatId === -1 && socket !== null) {
        socket.emit("join", {
            joiningCGId: -1, // dm_id or gm_id
            joiningCGName: chatName, // dm_name or gm_name
            chatType: 1,
            dmPartnerUserId: dmPartnerUser.userId,
        });
    }

    const fetchedMessages: MessageProps[] = await popSpecificMessages(chatId, 1);
    if (fetchedMessages) {
        useCM.setCurrentMainChat(
            defineNewChat(chatId, chatName, 1, dmPartnerUser, fetchedMessages, false)
        );
    } else {
        console.error("Failed to fetch thread DM fetchedMessages:", fetchedMessages);
    }
};

export const moveToGMChat = async (
    chatId: number,
    chatName: string,
    isPrivate: boolean,
    useCM: ChatManagementState
) => {
    const existingChat = useCM.allChats?.find((c) => c.chatId === chatId);
    const fetchedMessages: MessageProps[] = await popSpecificMessages(chatId, 2);
    if (fetchedMessages) {
        useCM.setCurrentMainChat(
            defineNewChat(
                chatId,
                chatName,
                2,
                defaultDmPartner,
                fetchedMessages,
                isPrivate,
                existingChat?.profileImagePath
            )
        );
    } else {
        console.error("Failed to fetch thread GM fetchedMessages:", fetchedMessages);
    }
};

const joinedMessage = [
    {
        type: "paragraph",
        content: [{ type: "text", text: "Has joined", styles: {} }],
    },
    { type: "paragraph", content: [{ type: "text", text: "", styles: {} }] },
];

export const moveToSelectedChat = async (
    myself: UserProps,
    accessToken: string | null,
    socket: Socket,
    chatId: number,
    chatName: string,
    chatType: number,
    isPrivate: boolean,
    dmPartnerUser: UserProps,
    useCM: ChatManagementState,
    setOpenSearchBox: (value: boolean) => void
) => {
    try {
        // Check if the chat is known / already joined.
        const isKnownChat: boolean = await checkKnownChat(chatId, chatType);
        setOpenSearchBox(false);

        if (!isKnownChat && socket !== null && (chatType === 1 || chatType === 2)) {
            // If the chat is not known, send a message to the chat to join it.
            socket.emit(
                "message",
                {
                    methodType: "POST",
                    message: joinedMessage,
                    destCGName: chatName,
                    destCGId: chatId,
                    chatType: chatType,
                    dmPartnerUserId: chatType === 1 ? dmPartnerUser.userId : null,
                    taskId: null,
                    systemUserId: null,
                    taskStatus: null,
                    messageIdForPut: null,
                },
                async (ack: any) => {
                    // For DM
                    if (chatType === 1) {
                        const message: MessageProps = {
                            chatType: chatType,
                            messageIdWithChatId: `${chatId}-1`,
                            chatId: chatId,
                            messageId: 1,
                            content: joinedMessage,
                            contentText: "Has joined",
                            sender: myself,
                            tsSent: getLocalCurrentTimestamp(),
                            tsUpdated: getLocalCurrentTimestamp(),
                            numReplies: 0,
                            taskId: null,
                            taskStatus: null,
                        };
                        const chat: AllChatProps = {
                            chatId: chatId,
                            chatName: chatName,
                            chatType: chatType,
                            dmPartnerUser: dmPartnerUser,
                            lastReadMessageId: -1,
                            latestMessage: message,
                            latestMessageText: "Has joined",
                            TSLastMessage: getLocalCurrentTimestamp(),
                            isPrivate: false,
                        };

                        await addChat(chat, chat.chatType);
                        await addMessage(message, chat.chatType);

                        useCM.setCurrentMainChat({ ...chat, messages: [message] });
                        useCM.setAllChats([chat, ...useCM.allChats]);
                    }

                    // For GM
                    if (chatType === 2) {
                        const loadedData = await loadSpecificGM(
                            myself.teamId,
                            myself.teamName,
                            myself.userId,
                            chatId,
                            accessToken
                        );

                        const gmChat: ChatProps | undefined =
                            loadedData?.chat_history?.[0];

                        if (gmChat) {
                            const sortedMessages = gmChat.messages.sort(
                                (a, b) => a.messageId - b.messageId
                            );
                            const newChat: AllChatProps = {
                                chatType: chatType,
                                chatId: gmChat.chatId,
                                chatName: gmChat.chatName,
                                lastReadMessageId: gmChat.lastReadMessageId,
                                dmPartnerUser: gmChat.dmPartnerUser,
                                latestMessage: gmChat.latestMessage,
                                latestMessageText: gmChat.latestMessageText,
                                TSLastMessage: gmChat.TSLastMessage,
                                isPrivate: gmChat.isPrivate,
                                profileImagePath: gmChat.profileImagePath,
                                isPinned: gmChat.isPinned,
                                tsLastAllReadActivity: gmChat.tsLastAllReadActivity,
                            };
                            await addChat(newChat, newChat.chatType);
                            await new ChatService().batchInsertGMMessages(sortedMessages);

                            useCM.setCurrentMainChat({ ...newChat, messages: sortedMessages });
                            useCM.setAllChats([newChat, ...useCM.allChats]);
                        }
                    }
                }
            );
        } else {
            // If the chat is known, move to the chat.
            if (chatType === 1) {
                moveToDMChat(socket, chatId, chatName, dmPartnerUser, useCM);
            } else {
                moveToGMChat(chatId, chatName, isPrivate, useCM);
            }
        }

        useCM.setCurrentChatPaneType(chatType);
    } catch (error) {
        console.error("Worker error:", error);
    }
};
