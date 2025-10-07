import { Socket } from "socket.io-client";

import { defaultDmPartner } from "./constants";
import { addChat } from "./addChat";
import { addMessage } from "./addMessage";
import { popSpecificMessages } from "./popSpecificMessages";
import { createGMChat } from "./createGMChat";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps, MessageProps } from "../../../types/chat";
import { CreateGMResponse } from "../../../types/chat";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { emptyDmPartnerUser } from "../../../utils/defaultProps";

const createGroupMessage = [
    { type: "paragraph", content: [{ type: "text", text: "Has created", styles: {} }] },
    { type: "paragraph", content: [{ type: "text", text: "", styles: {} }] },
];

const moveToGMChat = async (
    chat: AllChatProps,
    isPrivate: boolean,
    setCurrentMainChat: (chat: ChatProps) => void
) => {
    const fetchedMessages: MessageProps[] = await popSpecificMessages(chat.chatId, 2);
    if (fetchedMessages && fetchedMessages.length !== 0) {
        const newChat: ChatProps = {
            chatId: chat.chatId,
            chatName: chat.chatName,
            chatType: 2,
            dmPartnerUser: defaultDmPartner,
            lastReadMessageId: fetchedMessages[fetchedMessages.length - 1].messageId,
            messages: fetchedMessages,
            latestMessage: fetchedMessages[fetchedMessages.length - 1],
            latestMessageText: fetchedMessages[fetchedMessages.length - 1].contentText,
            TSLastMessage: fetchedMessages[fetchedMessages.length - 1].tsSent,
            isPrivate: isPrivate,
            profileImagePath: chat.profileImagePath,
        };
        setCurrentMainChat(newChat);
    } else {
        console.error("Failed to fetch thread GM fetchedMessages:", fetchedMessages);
    }
};

const addGMChatAndMessage = async (
    myself: UserProps,
    data: CreateGMResponse,
    allChats: AllChatProps[],
    isPrivate: boolean,
    setAllChats: (chat: AllChatProps[]) => void,
    setCurrentMainChat: (chat: ChatProps) => void
) => {
    const newMessage: MessageProps = {
        chatType: 3,
        messageIdWithChatId: `${data.chatId}-1`,
        chatId: data.chatId,
        messageId: 1,
        content: createGroupMessage,
        contentText: "Has created",
        sender: myself,
        tsSent: getLocalCurrentTimestamp(),
        tsUpdated: getLocalCurrentTimestamp(),
        numReplies: 0,
        taskId: null,
        taskStatus: null,
    };

    const newChat: AllChatProps = {
        chatId: data.chatId,
        chatName: data.chatName,
        chatType: 2,
        dmPartnerUser: defaultDmPartner,
        lastReadMessageId: -1,
        latestMessage: newMessage,
        latestMessageText: "Has created",
        TSLastMessage: getLocalCurrentTimestamp(),
        isPrivate: isPrivate,
    };

    await addChat(newChat, 2);
    await addMessage(newMessage, 2);

    setAllChats([
        ...allChats,
        {
            chatId: newChat.chatId,
            chatName: newChat.chatName,
            lastReadMessageId: -1,
            chatType: 2,
            dmPartnerUser: defaultDmPartner,
            latestMessage: newChat.latestMessage,
            latestMessageText: newChat.latestMessageText,
            TSLastMessage: getLocalCurrentTimestamp(),
            isPrivate: isPrivate,
        },
    ]);

    moveToGMChat(newChat, isPrivate, setCurrentMainChat);
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
    isPrivate: boolean
) => {
    const data: CreateGMResponse = await createGMChat(
        accessToken,
        myself,
        chatName,
        isPrivate,
        setCreateCGErrorMessage
    );

    if (data && socket !== null) {
        socket.emit(
            "join",
            {
                joiningCGId: data.chatId, // gm_id
                joiningCGName: data.chatName, // gm_name
                chatType: 2,
                dmPartnerUser: emptyDmPartnerUser,
            },
            (ack: any) => {
                socket.emit("message", {
                    methodType: "POST",
                    message: createGroupMessage,
                    destCGName: chatName,
                    destCGId: data.chatId,
                    chatType: 2,
                    dmPartnerUserId: emptyDmPartnerUser.userId,
                    taskId: null,
                    taskStatus: null,
                    systemUserId: null,
                    messageIdForPut: null,
                    isPrivate: isPrivate,
                });
            }
        );

        addGMChatAndMessage(myself, data, allChats, isPrivate, setAllChats, setCurrentMainChat);
        setOpen(false);
        setCreateCGErrorMessage("");
        setGroupName("");
        return data;
    }
};
