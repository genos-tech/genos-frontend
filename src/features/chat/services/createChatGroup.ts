import { Socket } from "socket.io-client";

import { defaultDmPartner } from './constants';
import { addChat } from "./addChat";
import { addMessage } from "./addMessage";
import { popSpecificMessages } from "./popSpecificMessages";
import { createGMChat } from "./createGMChat";
import { UserProps } from '../../../types/admin';
import {
    AllChatProps,
    ChatProps,
    MessageProps
} from '../../../types/chat';
import { CreateGMResponse } from '../../../types/chat';
import { getCurrentTimestamp } from '../../../utils/dateUtils';

const createGroupMessage = [
    { type: "paragraph", content: [{ type: "text", text: "Created this group", styles: {} }] },
    { type: "paragraph", content: [{ type: "text", text: "", styles: {} }] }
]

const moveToGMChat = async (
    chatId: number,
    chatName: string,
    setCurrentMainChat: (chat: ChatProps) => void
) => {
    const fetchedMessages: MessageProps[] = await popSpecificMessages(chatId, false);
    if (fetchedMessages && fetchedMessages.length !== 0) {
        const newChat: ChatProps = {
            chatId: chatId,
            chatName: chatName,
            isDm: false,
            dmPartnerUser: defaultDmPartner,
            unread: false,
            messages: fetchedMessages,
            latestMessage: fetchedMessages[fetchedMessages.length - 1],
            latestMessageText: fetchedMessages[fetchedMessages.length - 1].contentText,
            TSLastMessage: fetchedMessages[fetchedMessages.length - 1].tsSent,
        };
        setCurrentMainChat(newChat)
    } else {
        console.error("Failed to fetch thread GM fetchedMessages:", fetchedMessages)
    }
};

const addGMChatAndMessage = async (
    myself: UserProps,
    data: CreateGMResponse,
    allChats: AllChatProps[],
    setAllChats: (chat: AllChatProps[]) => void,
    setCurrentMainChat: (chat: ChatProps) => void,
) => {
    const newMessage: MessageProps = {
        messageIdWithChatId: `${data.chatId}-1`,
        chatId: data.chatId,
        messageId: 1,
        content: createGroupMessage,
        contentText: "Created this group",
        sender: myself,
        tsSent: getCurrentTimestamp(),
        numReplies: 0
    }

    const newChat: AllChatProps = {
        chatId: data.chatId,
        chatName: data.chatName,
        isDm: false,
        dmPartnerUser: defaultDmPartner,
        unread: false,
        latestMessage: newMessage,
        latestMessageText: "Created this group",
        TSLastMessage: getCurrentTimestamp(),
    }

    await addChat(newChat, false);
    await addMessage(newMessage, false);

    setAllChats([...allChats, {
        chatId: newChat.chatId,
        chatName: newChat.chatName,
        unread: false,
        isDm: false,
        dmPartnerUser: defaultDmPartner,
        latestMessage: newChat.latestMessage,
        latestMessageText: newChat.latestMessageText,
        TSLastMessage: getCurrentTimestamp()
    }]);

    moveToGMChat(newChat.chatId, newChat.chatName, setCurrentMainChat);

};

export const createChatGroup = async (
    myself: UserProps,
    chatName: string,
    allChats: AllChatProps[],
    socket: Socket | null,
    setCreateCGErrorMessage: (msg: string) => void,
    setOpen: (e: boolean) => void,
    setGroupName: (e: string) => void,
    setAllChats: (chat: AllChatProps[]) => void,
    setCurrentMainChat: (chat: ChatProps) => void,
    accessToken: string,
) => {
    const data: CreateGMResponse = await createGMChat(
        accessToken, myself, chatName, setCreateCGErrorMessage
    );

    if (data && socket !== null) {
        socket.emit("join", {
            joiningCGId: data.chatId, // gm_id
            joiningCGName: data.chatName, // gm_name
            isDm: false,
            dmPartnerUser: null,
        }, (ack: any) => {
            socket.emit("message", {
                message: createGroupMessage,
                destCGName: chatName,
                destCGId: data.chatId,
                isDm: false,
                dmPartnerUser: null,
            });
        });

        addGMChatAndMessage(myself, data, allChats, setAllChats, setCurrentMainChat)
        setOpen(false);
        setCreateCGErrorMessage("");
        setGroupName("");
        return data;
    }
}

