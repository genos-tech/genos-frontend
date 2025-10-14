import { Socket } from "socket.io-client";

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
    setCurrentMainChat: (chat: ChatProps) => void
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
        setCurrentMainChat(
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
    setCurrentMainChat: (chat: ChatProps) => void
) => {
    const fetchedMessages: MessageProps[] = await popSpecificMessages(chatId, 2);
    if (fetchedMessages) {
        console.log("move to gm:", fetchedMessages[fetchedMessages.length - 1]);
        setCurrentMainChat(
            defineNewChat(chatId, chatName, 2, defaultDmPartner, fetchedMessages, isPrivate)
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
    allChats: AllChatProps[],
    setCurrentMainChat: (value: ChatProps) => void,
    setAllChats: (value: AllChatProps[]) => void,
    setOpenSearchBox: (value: boolean) => void,
    setCurrentChatPaneType: (value: number) => void
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

                        setCurrentMainChat({ ...chat, messages: [message] });
                        setAllChats([chat, ...allChats]);
                    }

                    // For GM
                    if (chatType === 2) {
                        let loadedChat: ChatProps[] | undefined;
                        // Load the existing messages in the chat.
                        loadedChat = await loadSpecificGM(
                            myself.teamId,
                            myself.teamName,
                            myself.userId,
                            chatId,
                            accessToken
                        );

                        if (loadedChat) {
                            const sortedMessages = loadedChat[0].messages.sort(
                                (a, b) => a.messageId - b.messageId
                            );
                            const newChat: AllChatProps = {
                                chatType: chatType,
                                chatId: loadedChat[0].chatId,
                                chatName: loadedChat[0].chatName,
                                lastReadMessageId: loadedChat[0].lastReadMessageId,
                                dmPartnerUser: loadedChat[0].dmPartnerUser,
                                latestMessage: loadedChat[0].latestMessage,
                                latestMessageText: loadedChat[0].latestMessageText,
                                TSLastMessage: loadedChat[0].TSLastMessage,
                                isPrivate: loadedChat[0].isPrivate,
                                profileImagePath: loadedChat[0].profileImagePath,
                                isPinned: loadedChat[0].isPinned,
                                tsLastAllReadActivity: loadedChat[0].tsLastAllReadActivity,
                            };
                            await addChat(newChat, newChat.chatType);
                            await addMessage(newChat.latestMessage, newChat.chatType);

                            setCurrentMainChat({ ...newChat, messages: sortedMessages });
                            setAllChats([newChat, ...allChats]);
                        }
                    }
                }
            );
        } else {
            // If the chat is known, move to the chat.
            if (chatType === 1) {
                moveToDMChat(socket, chatId, chatName, dmPartnerUser, setCurrentMainChat);
            } else {
                moveToGMChat(chatId, chatName, isPrivate, setCurrentMainChat);
            }
        }

        setCurrentChatPaneType(chatType);
    } catch (error) {
        console.error("Worker error:", error);
    }
};
