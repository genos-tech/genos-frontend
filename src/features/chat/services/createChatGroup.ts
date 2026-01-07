import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps, CreateGMResponse, MessageProps } from "../../../types/chat";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { emptyDmPartnerUser } from "../../../utils/defaultProps";
import { addChat } from "./addChat";
import { addMessage } from "./addMessage";
import { defaultDmPartner } from "./constants";
import { createGMChat } from "./createGMChat";
import { popSpecificMessages } from "./popSpecificMessages";

const gmCreatedMessage = "Has created this group";

const createGroupMessage = [
    {
        type: "paragraph",
        content: [{ type: "text", text: gmCreatedMessage, styles: {} }],
    },
    { type: "paragraph", content: [{ type: "text", text: "", styles: {} }] },
];

const moveToGMChat = async (
    chat: AllChatProps,
    isPrivate: boolean,
    useCM: ChatManagementState
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
        useCM.setCurrentMainChat(newChat);
    } else {
        console.error("Failed to fetch thread GM fetchedMessages:", fetchedMessages);
    }
};

const addGMChatAndMessage = async (
    myself: UserProps,
    data: CreateGMResponse,
    isPrivate: boolean,
    useCM: ChatManagementState
) => {
    const newMessage: MessageProps = {
        chatType: 3,
        messageIdWithChatId: `${data.chatId}-1`,
        chatId: data.chatId,
        messageId: 1,
        content: createGroupMessage,
        contentText: gmCreatedMessage,
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
        latestMessageText: gmCreatedMessage,
        TSLastMessage: getLocalCurrentTimestamp(),
        isPrivate: isPrivate,
    };

    await addChat(newChat, 2);
    await addMessage(newMessage, 2);

    useCM.setAllChats([
        ...useCM.allChats,
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

    moveToGMChat(newChat, isPrivate, useCM);
};

export const createChatGroup = async (
    myself: UserProps,
    chatName: string,
    useCM: ChatManagementState,
    socket: Socket | null,
    setCreateCGErrorMessage: (msg: string) => void,
    setOpen: (e: boolean) => void,
    setGroupName: (e: string) => void,
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

        addGMChatAndMessage(myself, data, isPrivate, useCM);
        setOpen(false);
        setCreateCGErrorMessage("");
        setGroupName("");
        return data;
    }
};
