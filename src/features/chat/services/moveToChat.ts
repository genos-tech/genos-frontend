import { Socket } from "socket.io-client";

import { defaultDmPartner } from "./constants";
import { defineNewChat } from "../services/defineNewChat";
import { checkKnownChat } from "../services/checkKnownChat";
import { addChat } from "../services/addChat";
import { addMessage } from "../services/addMessage";
import { popSpecificMessages } from "../services/popSpecificMessages";
import { getCurrentTimestamp } from "../../../utils/dateUtils";
import { UserProps } from "../../../types/admin";
import { MessageProps, AllChatProps, ChatProps } from "../../../types/chat";

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
            isDm: true,
            dmPartnerUserId: dmPartnerUser.userId,
        });
    }

    const fetchedMessages: MessageProps[] = await popSpecificMessages(chatId, true);
    if (fetchedMessages) {
        setCurrentMainChat(defineNewChat(chatId, chatName, true, dmPartnerUser, fetchedMessages));
    } else {
        console.error("Failed to fetch thread DM fetchedMessages:", fetchedMessages);
    }
};

export const moveToGMChat = async (
    chatId: number,
    chatName: string,
    setCurrentMainChat: (chat: ChatProps) => void
) => {
    const fetchedMessages: MessageProps[] = await popSpecificMessages(chatId, false);
    if (fetchedMessages) {
        setCurrentMainChat(
            defineNewChat(chatId, chatName, false, defaultDmPartner, fetchedMessages)
        );
    } else {
        console.error("Failed to fetch thread GM fetchedMessages:", fetchedMessages);
    }
};

const joinedMessage = [
    { type: "paragraph", content: [{ type: "text", text: "Joined", styles: {} }] },
    { type: "paragraph", content: [{ type: "text", text: "", styles: {} }] },
];

export const moveToSelectedChat = async (
    myself: UserProps,
    socket: Socket,
    chatId: number,
    chatName: string,
    isDm: boolean,
    dmPartnerUser: UserProps,
    allChats: AllChatProps[],
    setCurrentMainChat: (value: ChatProps) => void,
    setAllChats: (value: AllChatProps[]) => void,
    setOpenSearchBox: (value: boolean) => void
) => {
    try {
        const isKnownChat: boolean = await checkKnownChat(chatId, isDm);
        setOpenSearchBox(false);

        if (!isKnownChat && socket !== null) {
            socket.emit(
                "message",
                {
                    message: joinedMessage,
                    destCGName: chatName,
                    destCGId: chatId,
                    isDm: isDm,
                    dmPartnerUserId: dmPartnerUser.userId,
                },
                async (ack: any) => {
                    const message: MessageProps = {
                        messageIdWithChatId: `${chatId}-1`,
                        chatId: chatId,
                        messageId: 1,
                        content: joinedMessage,
                        contentText: "joined",
                        sender: myself,
                        tsSent: getCurrentTimestamp(),
                        numReplies: 0,
                    };
                    const chat: AllChatProps = {
                        chatId: chatId,
                        chatName: chatName,
                        isDm: isDm,
                        dmPartnerUser: dmPartnerUser,
                        unread: true,
                        latestMessage: message,
                        latestMessageText: "joined",
                        TSLastMessage: getCurrentTimestamp(),
                    };

                    await addChat(chat, chat.isDm);
                    await addMessage(message, chat.isDm);

                    setCurrentMainChat({ ...chat, messages: [message] });
                    setAllChats([...allChats, chat]);
                }
            );
        } else {
            if (isDm) {
                moveToDMChat(socket, chatId, chatName, dmPartnerUser, setCurrentMainChat);
            } else {
                moveToGMChat(chatId, chatName, setCurrentMainChat);
            }
        }
    } catch (error) {
        console.error("Worker error:", error);
    }
};
