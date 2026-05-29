/*
 * PUNCH LIST (v3 chatId migration):
 * This legacy "create GM" path talks to the legacy `/` socket and
 * legacy REST (`createGMChat`, `/gm/join/`). Those still issue
 * integer `chatId` (it's the auto-incrementing `gm_id`). The v3-
 * flipped `AllChatProps.chatId` / `ChatProps.chatId` are `string`, so
 * we bridge with `String(...)` at the construction sites and cast
 * numeric `chatId` args to legacy services accordingly. The socket
 * `joiningCGId` and legacy `/gm/join/` payload keep the original
 * `number` (those endpoints would reject UUIDs anyway). Whole file
 * is dead code once the v3 `channel.create` path replaces it.
 */
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps, CreateGMResponse, MessageProps } from "../../../types/chat";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { emptyDmPartnerUser } from "../../../utils/defaultProps";
import { addChat } from "./addChat";
import { addMessage } from "./addMessage";
import { defaultDmPartner } from "./constants";
import { createGMChat } from "./createGMChat";
import { popSpecificMessages } from "./popSpecificMessages";

const getGmCreatedMessage = () => getMessages().chat.system.hasCreatedGroup;
// Keys sorted alphabetically (case-insensitive) per `sort-keys`.
const getCreateGroupMessage = () => [
    {
        content: [{ styles: {}, text: getGmCreatedMessage(), type: "text" }],
        type: "paragraph",
    },
    { content: [{ styles: {}, text: "", type: "text" }], type: "paragraph" },
];

const moveToGMChat = async (
    chat: AllChatProps,
    isPrivate: boolean,
    useCM: ChatManagementState
) => {
    // `chat.chatId` is v3 string; `popSpecificMessages(chatId: number, ...)`
    // is still the legacy service — see file-header note.
    const fetchedMessages: MessageProps[] = await popSpecificMessages(
        chat.chatId as unknown as number,
        2
    );
    if (fetchedMessages && fetchedMessages.length !== 0) {
        const last = fetchedMessages[fetchedMessages.length - 1];
        // Keys sorted alphabetically per `sort-keys`. `lastReadMessageId`
        // is v3 string; stringify the legacy numeric `messageId`.
        const newChat: ChatProps = {
            chatId: chat.chatId,
            chatName: chat.chatName,
            chatType: 2,
            dmPartnerUser: defaultDmPartner,
            isPrivate: isPrivate,
            lastReadMessageId: String(last.messageId),
            latestMessage: last,
            latestMessageText: last.contentText,
            messages: fetchedMessages,
            profileImagePath: chat.profileImagePath,
            TSLastMessage: last.tsSent,
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
    const gmCreatedMessage = getGmCreatedMessage();
    const createGroupMessage = getCreateGroupMessage();
    // `MessageProps.chatId` is still `number`, so the legacy numeric
    // `data.chatId` flows through unchanged here. Keys sorted
    // alphabetically per `sort-keys`.
    const newMessage: MessageProps = {
        chatId: data.chatId,
        chatType: 3,
        content: createGroupMessage,
        contentText: gmCreatedMessage,
        messageId: 1,
        messageIdWithChatId: `${data.chatId}-1`,
        numReplies: 0,
        sender: myself,
        taskId: null,
        taskStatus: null,
        tsSent: getLocalCurrentTimestamp(),
        tsUpdated: getLocalCurrentTimestamp(),
    };

    // `AllChatProps.chatId / lastReadMessageId` are `string` post-flip.
    // `""` is the v3-flipped "no last-read" sentinel.
    const newChat: AllChatProps = {
        chatId: String(data.chatId),
        chatName: data.chatName,
        chatType: 2,
        dmPartnerUser: defaultDmPartner,
        isPrivate: isPrivate,
        lastReadMessageId: "",
        latestMessage: newMessage,
        latestMessageText: gmCreatedMessage,
        TSLastMessage: getLocalCurrentTimestamp(),
    };

    await addChat(newChat, 2);
    await addMessage(newMessage, 2);

    // The append-to-allChats duplicate of `newChat` mirrors the legacy
    // pattern. With AllChatProps now fully typed, just spread the row
    // (the `newChat.chatId` is already the v3 string). Sorted keys.
    useCM.setAllChats([
        ...useCM.allChats,
        {
            chatId: newChat.chatId,
            chatName: newChat.chatName,
            chatType: 2,
            dmPartnerUser: defaultDmPartner,
            isPrivate: isPrivate,
            lastReadMessageId: "",
            latestMessage: newChat.latestMessage,
            latestMessageText: newChat.latestMessageText,
            TSLastMessage: getLocalCurrentTimestamp(),
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
    isPrivate: boolean,
    selectedMemberIds: string[] = []
) => {
    const gmCreatedMessage = getGmCreatedMessage();
    const createGroupMessage = getCreateGroupMessage();
    const data: CreateGMResponse = await createGMChat(
        accessToken,
        myself,
        chatName,
        isPrivate,
        setCreateCGErrorMessage
    );

    if (data && socket !== null) {
        // Socket emit payloads with keys sorted alphabetically per
        // `sort-keys`. The join ack is fired-and-forgotten — chain
        // the first message emit after the join completes.
        socket.emit(
            "join",
            {
                chatType: 2,
                dmPartnerUser: emptyDmPartnerUser,
                joiningCGId: data.chatId, // gm_id
                joiningCGName: data.chatName, // gm_name
            },
            () => {
                socket.emit("message", {
                    chatType: 2,
                    destCGId: data.chatId,
                    destCGName: chatName,
                    dmPartnerUserId: emptyDmPartnerUser.userId,
                    isPrivate: isPrivate,
                    message: createGroupMessage,
                    messageIdForPut: null,
                    methodType: "POST",
                    systemUserId: null,
                    taskId: null,
                    taskStatus: null,
                });
            }
        );

        for (const memberId of selectedMemberIds) {
            try {
                const api = authApi(accessToken);
                if (api) {
                    await api.post("/gm/join/", {
                        attendee_id: memberId,
                        gm_id: data.chatId,
                    });
                }
            } catch (error) {
                console.error(`Failed to add member ${memberId} to GM:`, error);
            }
        }

        // After the DB records exist, notify each newly-added member's live
        // socket so their client (a) shows the new GM in the sidebar and
        // (b) joins the `gm-{id}` socket room immediately — without this,
        // members only see the GM after a reconnect because the room
        // membership is reconstructed from `gm/ids/` on connect.
        if (selectedMemberIds.length > 0) {
            const tsNow = getLocalCurrentTimestamp();
            socket.emit("gm_members_added", {
                gmId: data.chatId,
                gmName: data.chatName,
                isPrivate: isPrivate,
                joinMessage: {
                    content: createGroupMessage,
                    contentText: gmCreatedMessage,
                    messageId: 1,
                    sender: myself,
                    tsSent: tsNow,
                    tsUpdated: tsNow,
                },
                memberIds: selectedMemberIds,
                sender: myself,
            });
        }

        addGMChatAndMessage(myself, data, isPrivate, useCM);
        setOpen(false);
        setCreateCGErrorMessage("");
        setGroupName("");
        return data;
    }
};
