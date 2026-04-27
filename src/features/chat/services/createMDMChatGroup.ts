import { Socket } from "socket.io-client";

import { ChatService } from "../../../db/services/chat.service";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps, MDMMemberProps, MessageProps } from "../../../types/chat";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { addChat } from "./addChat";
import { addMessage } from "./addMessage";
import { defaultDmPartner } from "./constants";
import { createMDMChat } from "./createMDMChat";
import { loadMDMHistory } from "./loadMDMHistory";
import { popSpecificMessages } from "./popSpecificMessages";

const mdmCreatedMessage = "Started this conversation";

const createMDMMessage = [
    {
        type: "paragraph",
        content: [{ type: "text", text: mdmCreatedMessage, styles: {} }],
    },
    { type: "paragraph", content: [{ type: "text", text: "", styles: {} }] },
];

const addMDMChatAndMessage = async (
    myself: UserProps,
    chatId: number,
    chatName: string,
    useCM: ChatManagementState,
    mdmMembers?: MDMMemberProps[]
) => {
    const ts = getLocalCurrentTimestamp();

    const newMessage: MessageProps = {
        chatType: 4,
        messageIdWithChatId: `${chatId}-1`,
        chatId: chatId,
        messageId: 1,
        content: createMDMMessage,
        contentText: mdmCreatedMessage,
        sender: myself,
        tsSent: ts,
        tsUpdated: ts,
        numReplies: 0,
        taskId: null,
        taskStatus: null,
    };

    const newAllChat: AllChatProps = {
        chatId: chatId,
        chatName: chatName,
        chatType: 4,
        dmPartnerUser: defaultDmPartner,
        lastReadMessageId: -1,
        latestMessage: newMessage,
        latestMessageText: mdmCreatedMessage,
        TSLastMessage: ts,
        mdmMembers: mdmMembers,
    };

    await addChat(newAllChat, 4);
    await addMessage(newMessage, 4);

    const newChat: ChatProps = {
        chatId: chatId,
        chatName: chatName,
        chatType: 4,
        dmPartnerUser: defaultDmPartner,
        lastReadMessageId: 1,
        messages: [newMessage],
        latestMessage: newMessage,
        latestMessageText: mdmCreatedMessage,
        TSLastMessage: ts,
    };

    useCM.setCurrentMainChat(newChat);
    useCM.setAllChats((prev: AllChatProps[]) => {
        const exists = prev.some((c) => c.chatId === chatId && c.chatType === 4);
        if (exists) return prev;
        return [newAllChat, ...prev];
    });
};

const openExistingMDM = async (
    myself: UserProps,
    mdmId: number,
    useCM: ChatManagementState,
    socket: Socket | null,
    accessToken: string
) => {
    const existingAllChat = useCM.allChats.find(
        (c) => c.chatType === 4 && c.chatId === mdmId
    );

    if (existingAllChat) {
        const messages = await popSpecificMessages(mdmId, 4);
        const existingChat: ChatProps = {
            chatId: existingAllChat.chatId,
            chatName: existingAllChat.chatName,
            chatType: 4,
            dmPartnerUser: existingAllChat.dmPartnerUser,
            lastReadMessageId: messages.length > 0 ? messages[messages.length - 1].messageId : -1,
            messages: messages,
            latestMessage: existingAllChat.latestMessage,
            latestMessageText: existingAllChat.latestMessageText,
            TSLastMessage: existingAllChat.TSLastMessage,
        };
        useCM.setCurrentMainChat(existingChat);
        return;
    }

    const loadedData = await loadMDMHistory(
        myself.teamId,
        myself.teamName,
        myself.userId,
        accessToken,
        mdmId
    );

    const mdmChat: ChatProps | undefined = loadedData?.chat_history?.[0];
    if (mdmChat) {
        const sortedMessages = mdmChat.messages.sort(
            (a: MessageProps, b: MessageProps) => a.messageId - b.messageId
        );
        const newAllChat: AllChatProps = {
            chatType: 4,
            chatId: mdmChat.chatId,
            chatName: mdmChat.chatName,
            lastReadMessageId: mdmChat.lastReadMessageId,
            dmPartnerUser: defaultDmPartner,
            latestMessage: mdmChat.latestMessage,
            latestMessageText: mdmChat.latestMessageText,
            TSLastMessage: mdmChat.TSLastMessage,
            mdmMembers: (mdmChat as any).mdmMembers,
        };

        await addChat(newAllChat, 4);
        await new ChatService().batchInsertMDMMessages(sortedMessages);

        useCM.setCurrentMainChat({ ...newAllChat, messages: sortedMessages });
        useCM.setAllChats((prev: AllChatProps[]) => {
            const exists = prev.some((c) => c.chatId === mdmId && c.chatType === 4);
            if (exists) return prev;
            return [newAllChat, ...prev];
        });

        if (socket) {
            socket.emit("join", {
                joiningCGId: mdmId,
                joiningCGName: mdmChat.chatName,
                chatType: 4,
                dmPartnerUser: defaultDmPartner,
            });
        }
    }
};

export const createMDMChatGroup = async (
    myself: UserProps,
    memberIds: string[],
    useCM: ChatManagementState,
    socket: Socket | null,
    setErrorMessage: (msg: string) => void,
    setOpen: (e: boolean) => void,
    accessToken: string,
    selectedMembers?: UserProps[]
) => {
    const data = await createMDMChat(
        accessToken,
        myself,
        memberIds,
        undefined,
        setErrorMessage
    );

    if (!data) return;

    if (data.mdm_exists) {
        const mdmId = data.mdm_id;
        await openExistingMDM(myself, mdmId, useCM, socket, accessToken);
        useCM.setCurrentChatPaneType(1);
        useCM.setIsMainChatVisible(true);
        setOpen(false);
        setErrorMessage("");
        return data;
    }

    const chatId = data.chatId || data.mdm_id;
    const chatName = data.chatName;

    if (socket !== null) {
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
    }

    const allMembers: MDMMemberProps[] = [
        {
            userId: myself.userId,
            userName: myself.userName,
            userEmail: myself.userEmail,
            avatarImgPath: myself.avatarImgPath,
            teamId: myself.teamId,
            teamName: myself.teamName,
        },
        ...(selectedMembers || []).map((m) => ({
            userId: m.userId,
            userName: m.userName,
            userEmail: m.userEmail,
            avatarImgPath: m.avatarImgPath,
            teamId: m.teamId,
            teamName: m.teamName,
        })),
    ];
    await addMDMChatAndMessage(myself, chatId, chatName, useCM, allMembers);
    useCM.setCurrentChatPaneType(1);
    useCM.setIsMainChatVisible(true);
    setOpen(false);
    setErrorMessage("");
    return data;
};
