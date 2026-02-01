import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps, MessageProps } from "../../../types/chat";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { addChat } from "./addChat";
import { addMessage } from "./addMessage";
import { defaultDmPartner } from "./constants";
import { createMDMChat } from "./createMDMChat";
import { popSpecificMessages } from "./popSpecificMessages";

const mdmCreatedMessage = "Started this conversation";

const createMDMMessage = [
    {
        type: "paragraph",
        content: [{ type: "text", text: mdmCreatedMessage, styles: {} }],
    },
    { type: "paragraph", content: [{ type: "text", text: "", styles: {} }] },
];

const moveToMDMChat = async (
    chat: AllChatProps,
    useCM: ChatManagementState
) => {
    const fetchedMessages: MessageProps[] = await popSpecificMessages(chat.chatId, 4);
    if (fetchedMessages && fetchedMessages.length !== 0) {
        const newChat: ChatProps = {
            chatId: chat.chatId,
            chatName: chat.chatName,
            chatType: 4,
            dmPartnerUser: defaultDmPartner,
            lastReadMessageId: fetchedMessages[fetchedMessages.length - 1].messageId,
            messages: fetchedMessages,
            latestMessage: fetchedMessages[fetchedMessages.length - 1],
            latestMessageText: fetchedMessages[fetchedMessages.length - 1].contentText || "",
            TSLastMessage: fetchedMessages[fetchedMessages.length - 1].tsSent,
        };
        useCM.setCurrentMainChat(newChat);
    } else {
        console.error("Failed to fetch MDM messages:", fetchedMessages);
    }
};

const addMDMChatAndMessage = async (
    myself: UserProps,
    chatId: number,
    chatName: string,
    useCM: ChatManagementState
) => {
    const newMessage: MessageProps = {
        chatType: 4,
        messageIdWithChatId: `${chatId}-1`,
        chatId: chatId,
        messageId: 1,
        content: createMDMMessage,
        contentText: mdmCreatedMessage,
        sender: myself,
        tsSent: getLocalCurrentTimestamp(),
        tsUpdated: getLocalCurrentTimestamp(),
        numReplies: 0,
        taskId: null,
        taskStatus: null,
    };

    const newChat: AllChatProps = {
        chatId: chatId,
        chatName: chatName,
        chatType: 4,
        dmPartnerUser: defaultDmPartner,
        lastReadMessageId: -1,
        latestMessage: newMessage,
        latestMessageText: mdmCreatedMessage,
        TSLastMessage: getLocalCurrentTimestamp(),
    };

    await addChat(newChat, 4);
    await addMessage(newMessage, 4);

    useCM.setAllChats([
        ...useCM.allChats,
        {
            chatId: newChat.chatId,
            chatName: newChat.chatName,
            lastReadMessageId: -1,
            chatType: 4,
            dmPartnerUser: defaultDmPartner,
            latestMessage: newChat.latestMessage,
            latestMessageText: newChat.latestMessageText,
            TSLastMessage: getLocalCurrentTimestamp(),
        },
    ]);

    moveToMDMChat(newChat, useCM);
};

export const createMDMChatGroup = async (
    myself: UserProps,
    memberIds: string[],
    useCM: ChatManagementState,
    socket: Socket | null,
    setErrorMessage: (msg: string) => void,
    setOpen: (e: boolean) => void,
    accessToken: string
) => {
    const data = await createMDMChat(
        accessToken,
        myself,
        memberIds,
        undefined,
        setErrorMessage
    );

    if (data && socket !== null) {
        const chatId = data.chatId || data.mdm_id;
        const chatName = data.chatName;

        socket.emit(
            "join",
            {
                joiningCGId: chatId,
                joiningCGName: chatName,
                chatType: 4,
                dmPartnerUser: defaultDmPartner,
            },
            (ack: any) => {
                socket.emit("message", {
                    methodType: "POST",
                    message: createMDMMessage,
                    destCGName: chatName,
                    destCGId: chatId,
                    chatType: 4,
                    dmPartnerUserId: null,
                    taskId: null,
                    taskStatus: null,
                    systemUserId: null,
                    messageIdForPut: null,
                });
            }
        );

        await addMDMChatAndMessage(myself, chatId, chatName, useCM);
        // Set to DM pane type (1) since MDM is now displayed within DM section
        useCM.setCurrentChatPaneType(1);
        useCM.setIsMainChatVisible(true);
        setOpen(false);
        setErrorMessage("");
        return data;
    } else if (data && socket === null) {
        // Handle case where socket is not available
        const chatId = data.chatId || data.mdm_id;
        const chatName = data.chatName;
        await addMDMChatAndMessage(myself, chatId, chatName, useCM);
        // Set to DM pane type (1) since MDM is now displayed within DM section
        useCM.setCurrentChatPaneType(1);
        useCM.setIsMainChatVisible(true);
        setOpen(false);
        setErrorMessage("");
        return data;
    }
};
