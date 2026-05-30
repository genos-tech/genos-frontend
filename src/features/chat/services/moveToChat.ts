/*
 * PUNCH LIST (v3 chatId migration):
 * This legacy "move-to-chat" helper takes integer `chatId` params
 * (callers are Spotlight / sidebar surfaces that still drive by
 * `gm_id` / `dm_id`). v3 `AllChatProps.chatId` is `string` now, so
 * comparisons and construction sites bridge with `String(...)`.
 * Numeric services downstream (`popSpecificMessages`, `loadMDMHistory`,
 * `loadSpecificGM`, the socket `joiningCGId` / `destCGId`) keep
 * receiving the original integer. File is dead code once the v3
 * channel-open + channel.create paths replace it.
 */
import { Socket } from "socket.io-client";

import { ChatService } from "../../../db/services/chat.service";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { getMessages } from "../../../i18n";
import { channelService } from "../../../services/channel/channelService";
import { UserProps } from "../../../types/admin";
import { ChannelKind } from "../../../types/channel";
import { AllChatProps, ChatProps, MessageProps } from "../../../types/chat";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { v3MessagesToLegacy } from "../adapters/v3ToLegacy";
import { addChat } from "../services/addChat";
import { addMessage } from "../services/addMessage";
import { checkKnownChat } from "../services/checkKnownChat";
import { defineNewChat } from "../services/defineNewChat";
import { loadV3SpecificMessages } from "../services/loadV3SpecificMessages";
import { resolveV3ChannelId } from "../utils/channelIdResolvers";
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
            chatType: 1,
            dmPartnerUserId: dmPartnerUser.userId,
            joiningCGId: -1, // dm_id or gm_id
            joiningCGName: chatName, // dm_name or gm_name
        });
        return;
    }

    // v3 cutover: was `popSpecificMessages` → legacy worker IDB pop
    // + `defineNewChat(legacyChatId, ...)` which set
    // `currentMainChat.chatId` to the legacy integer. Any subsequent
    // `channelService.send` against that chat then 404'd at the
    // `<uuid:channel_id>` Django URL pattern.
    //
    // Resolve the v3 UUID via `legacyChatId === N` against the
    // cached channel list, then drive the open path through the v3
    // message loader. The adapter inside `loadV3SpecificMessages`
    // bridges back to legacy `MessageProps[]` so `defineNewChat`
    // (which builds the legacy `ChatProps` shape consumed by the UI)
    // keeps working unchanged.
    const v3ChannelId = resolveV3ChannelId(chatId, 1);
    if (!v3ChannelId) {
        console.warn(`[moveToDMChat] no v3 mirror for legacy dmId=${chatId}; run backfill.`);
        return;
    }
    const fetchedMessages: MessageProps[] = await loadV3SpecificMessages(v3ChannelId, 1);
    useCM.setCurrentMainChat(
        defineNewChat(v3ChannelId, chatName, 1, dmPartnerUser, fetchedMessages, false)
    );
};

export const moveToGMChat = async (
    chatId: number,
    chatName: string,
    isPrivate: boolean,
    useCM: ChatManagementState
) => {
    // Same v3 lookup pattern as `moveToDMChat`. See that function for
    // the rationale on why the legacy `popSpecificMessages` path
    // leaked legacy integer chatIds into `currentMainChat`.
    const v3ChannelId = resolveV3ChannelId(chatId, 2);
    if (!v3ChannelId) {
        console.warn(`[moveToGMChat] no v3 mirror for legacy gmId=${chatId}; run backfill.`);
        return;
    }
    const existingChat = useCM.allChats?.find((c) => c.chatId === v3ChannelId && c.chatType === 2);
    const fetchedMessages: MessageProps[] = await loadV3SpecificMessages(v3ChannelId, 2);
    useCM.setCurrentMainChat(
        defineNewChat(
            v3ChannelId,
            chatName,
            2,
            defaultDmPartner,
            fetchedMessages,
            isPrivate,
            existingChat?.profileImagePath
        )
    );
};

// Keys sorted alphabetically per `sort-keys`.
const getJoinedMessage = () => {
    const msgs = getMessages();
    return [
        {
            content: [{ styles: {}, text: msgs.chat.system.hasJoined, type: "text" }],
            type: "paragraph",
        },
        { content: [{ styles: {}, text: "", type: "text" }], type: "paragraph" },
    ];
};

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
    const msgs = getMessages();
    const joinedMessage = getJoinedMessage();
    try {
        // Check if the chat is known / already joined.
        const isKnownChat: boolean = await checkKnownChat(chatId, chatType);
        setOpenSearchBox(false);

        if (!isKnownChat && socket !== null && (chatType === 1 || chatType === 2)) {
            // If the chat is not known, send a message to the chat to join it.
            // Socket emit payloads + the join ack callback. Keys
            // sorted per `sort-keys`. The ack is not used — the work
            // just runs in the next microtask after the server
            // confirms the join.
            socket.emit(
                "message",
                {
                    chatType: chatType,
                    destCGId: chatId,
                    destCGName: chatName,
                    dmPartnerUserId: chatType === 1 ? dmPartnerUser.userId : null,
                    message: joinedMessage,
                    messageIdForPut: null,
                    methodType: "POST",
                    systemUserId: null,
                    taskId: null,
                    taskStatus: null,
                },
                async () => {
                    // For DM
                    if (chatType === 1) {
                        const message: MessageProps = {
                            chatId: chatId,
                            chatType: chatType,
                            content: joinedMessage,
                            contentText: msgs.chat.system.hasJoined,
                            messageId: 1,
                            messageIdWithChatId: `${chatId}-1`,
                            numReplies: 0,
                            sender: myself,
                            taskId: null,
                            taskStatus: null,
                            tsSent: getLocalCurrentTimestamp(),
                            tsUpdated: getLocalCurrentTimestamp(),
                        };
                        // `AllChatProps.chatId / lastReadMessageId` are
                        // `string` post-v3 flip; `""` is the new "no
                        // last-read" sentinel. Keys sorted per `sort-keys`.
                        const chat: AllChatProps = {
                            chatId: String(chatId),
                            chatName: chatName,
                            chatType: chatType,
                            dmPartnerUser: dmPartnerUser,
                            isPrivate: false,
                            lastReadMessageId: "",
                            latestMessage: message,
                            latestMessageText: msgs.chat.system.hasJoined,
                            TSLastMessage: getLocalCurrentTimestamp(),
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

                        const gmChat: ChatProps | undefined = loadedData?.chat_history?.[0];

                        if (gmChat) {
                            const sortedMessages = gmChat.messages.sort(
                                (a, b) => a.messageId - b.messageId
                            );
                            // Keys sorted per `sort-keys`.
                            const newChat: AllChatProps = {
                                chatId: gmChat.chatId,
                                chatName: gmChat.chatName,
                                chatType: chatType,
                                dmPartnerUser: gmChat.dmPartnerUser,
                                isPinned: gmChat.isPinned,
                                isPrivate: gmChat.isPrivate,
                                lastReadMessageId: gmChat.lastReadMessageId,
                                latestMessage: gmChat.latestMessage,
                                latestMessageText: gmChat.latestMessageText,
                                profileImagePath: gmChat.profileImagePath,
                                tsLastAllReadActivity: gmChat.tsLastAllReadActivity,
                                TSLastMessage: gmChat.TSLastMessage,
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
            } else if (chatType === 4) {
                const existingChat = useCM.allChats?.find(
                    (c) => c.chatId === String(chatId) && c.chatType === 4
                );
                // v3 source. `chatId` carries the v3 channel UUID via
                // the legacy `number` slot (chat-open routes through
                // useCM.allChats which is v3-sourced). loadV3-pop
                // hits `syncChannel` (REST + cache) and returns the
                // legacy-shape MessageProps[] from the snapshot.
                const fetchedMessages: MessageProps[] = await loadV3SpecificMessages(
                    chatId as unknown as string,
                    4
                );
                useCM.setCurrentMainChat(
                    defineNewChat(
                        chatId,
                        chatName,
                        4,
                        defaultDmPartner,
                        fetchedMessages,
                        false,
                        existingChat?.profileImagePath
                    )
                );
            } else {
                moveToGMChat(chatId, chatName, isPrivate, useCM);
            }
        }

        useCM.setCurrentChatPaneType(chatType === 4 ? 1 : chatType);
    } catch (error) {
        console.error("Worker error:", error);
    }
};
