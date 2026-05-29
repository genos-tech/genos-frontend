/*
 * PUNCH LIST (v3 chatId migration):
 * This legacy "create MDM" path runs against the legacy `/` socket and
 * legacy REST (`createMDMChat`, `loadMDMHistory`). Those still operate
 * on integer `mdm_id` / `chat_id` keys. The v3-flipped `ChatProps.chatId`
 * is `string`, so we bridge with `String(...)` at the boundary —
 * comparisons and construction sites. Numeric callbacks (the socket
 * `joiningCGId`, the legacy services) keep receiving the original
 * `number`. This whole file is dead code once the v3 `channel.create`
 * path replaces it.
 */
import { Socket } from "socket.io-client";

import { ChatService } from "../../../db/services/chat.service";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { getMessages } from "../../../i18n";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps, MDMMemberProps, MessageProps } from "../../../types/chat";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { addChat } from "./addChat";
import { addMessage } from "./addMessage";
import { defaultDmPartner } from "./constants";
import { createMDMChat } from "./createMDMChat";
import { loadMDMHistory } from "./loadMDMHistory";
import { popSpecificMessages } from "./popSpecificMessages";

const getMdmCreatedMessage = () => getMessages().chat.system.startedConversation;
// Keys sorted alphabetically (case-insensitive) per `sort-keys`.
const getCreateMDMMessage = () => [
    {
        content: [{ styles: {}, text: getMdmCreatedMessage(), type: "text" }],
        type: "paragraph",
    },
    { content: [{ styles: {}, text: "", type: "text" }], type: "paragraph" },
];

const addMDMChatAndMessage = async (
    myself: UserProps,
    chatId: number,
    chatName: string,
    useCM: ChatManagementState,
    mdmMembers?: MDMMemberProps[]
) => {
    const mdmCreatedMessage = getMdmCreatedMessage();
    const createMDMMessage = getCreateMDMMessage();
    const ts = getLocalCurrentTimestamp();

    // MessageProps.chatId is still `number`; no cast needed here.
    // Keys sorted alphabetically (case-insensitive) per `sort-keys`.
    const newMessage: MessageProps = {
        chatId: chatId,
        chatType: 4,
        content: createMDMMessage,
        contentText: mdmCreatedMessage,
        messageId: 1,
        messageIdWithChatId: `${chatId}-1`,
        numReplies: 0,
        sender: myself,
        taskId: null,
        taskStatus: null,
        tsSent: ts,
        tsUpdated: ts,
    };

    // `AllChatProps.chatId` and `lastReadMessageId` are `string` post-flip.
    // `""` is the v3-flipped "no last-read" sentinel.
    const newAllChat: AllChatProps = {
        chatId: String(chatId),
        chatName: chatName,
        chatType: 4,
        dmPartnerUser: defaultDmPartner,
        lastReadMessageId: "",
        latestMessage: newMessage,
        latestMessageText: mdmCreatedMessage,
        mdmMembers: mdmMembers,
        TSLastMessage: ts,
    };

    await addChat(newAllChat, 4);
    await addMessage(newMessage, 4);

    // Same string-shape for `ChatProps.chatId / lastReadMessageId`.
    const newChat: ChatProps = {
        chatId: String(chatId),
        chatName: chatName,
        chatType: 4,
        dmPartnerUser: defaultDmPartner,
        lastReadMessageId: "1",
        latestMessage: newMessage,
        latestMessageText: mdmCreatedMessage,
        messages: [newMessage],
        TSLastMessage: ts,
    };

    useCM.setCurrentMainChat(newChat);
    useCM.setAllChats((prev: AllChatProps[]) => {
        const exists = prev.some((c) => c.chatId === String(chatId) && c.chatType === 4);
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
        (c) => c.chatType === 4 && c.chatId === String(mdmId)
    );

    if (existingAllChat) {
        const messages = await popSpecificMessages(mdmId, 4);
        // `lastReadMessageId` is `string` post-flip; `""` is the
        // "no messages yet" sentinel (replaces legacy `-1`). Keys
        // sorted alphabetically per `sort-keys`.
        const existingChat: ChatProps = {
            chatId: existingAllChat.chatId,
            chatName: existingAllChat.chatName,
            chatType: 4,
            dmPartnerUser: existingAllChat.dmPartnerUser,
            lastReadMessageId:
                messages.length > 0 ? String(messages[messages.length - 1].messageId) : "",
            latestMessage: existingAllChat.latestMessage,
            latestMessageText: existingAllChat.latestMessageText,
            messages: messages,
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
        // Keys sorted alphabetically per `sort-keys`. The
        // `mdmMembers` cast bridges a legacy quirk: `ChatProps` doesn't
        // declare `mdmMembers`, but `loadMDMHistory` includes it on
        // the wire payload because the same row also flows through
        // `AllChatProps`. Reading via the intersection cast preserves
        // the field without widening `ChatProps`.
        const newAllChat: AllChatProps = {
            chatId: mdmChat.chatId,
            chatName: mdmChat.chatName,
            chatType: 4,
            dmPartnerUser: defaultDmPartner,
            lastReadMessageId: mdmChat.lastReadMessageId,
            latestMessage: mdmChat.latestMessage,
            latestMessageText: mdmChat.latestMessageText,
            mdmMembers: (mdmChat as ChatProps & { mdmMembers?: MDMMemberProps[] }).mdmMembers,
            TSLastMessage: mdmChat.TSLastMessage,
        };

        await addChat(newAllChat, 4);
        await new ChatService().batchInsertMDMMessages(sortedMessages);

        useCM.setCurrentMainChat({ ...newAllChat, messages: sortedMessages });
        useCM.setAllChats((prev: AllChatProps[]) => {
            const exists = prev.some((c) => c.chatId === String(mdmId) && c.chatType === 4);
            if (exists) return prev;
            return [newAllChat, ...prev];
        });

        if (socket) {
            socket.emit("join", {
                chatType: 4,
                dmPartnerUser: defaultDmPartner,
                joiningCGId: mdmId,
                joiningCGName: mdmChat.chatName,
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
    const createMDMMessage = getCreateMDMMessage();
    const data = await createMDMChat(accessToken, myself, memberIds, undefined, setErrorMessage);

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
        // Keys sorted alphabetically (case-insensitive) per `sort-keys`.
        // The join ack is fired-and-forgotten — we just chain the
        // first message emit after the join completes.
        socket.emit(
            "join",
            {
                chatType: 4,
                dmPartnerUser: defaultDmPartner,
                joiningCGId: chatId,
                joiningCGName: chatName,
            },
            () => {
                socket.emit("message", {
                    chatType: 4,
                    destCGId: chatId,
                    destCGName: chatName,
                    dmPartnerUserId: null,
                    message: createMDMMessage,
                    messageIdForPut: null,
                    methodType: "POST",
                    systemUserId: null,
                    taskId: null,
                    taskStatus: null,
                });
            }
        );
    }

    // Keys sorted alphabetically per `sort-keys`.
    const allMembers: MDMMemberProps[] = [
        {
            avatarImgPath: myself.avatarImgPath,
            teamId: myself.teamId,
            teamName: myself.teamName,
            userEmail: myself.userEmail,
            userId: myself.userId,
            userName: myself.userName,
        },
        ...(selectedMembers || []).map((m) => ({
            avatarImgPath: m.avatarImgPath,
            teamId: m.teamId,
            teamName: m.teamName,
            userEmail: m.userEmail,
            userId: m.userId,
            userName: m.userName,
        })),
    ];
    await addMDMChatAndMessage(myself, chatId, chatName, useCM, allMembers);
    useCM.setCurrentChatPaneType(1);
    useCM.setIsMainChatVisible(true);
    setOpen(false);
    setErrorMessage("");
    return data;
};
