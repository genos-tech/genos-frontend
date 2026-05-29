/*
 * PUNCH LIST (v3 chatId migration):
 * Legacy WS events carry numeric `chatId` / `lastReadMessageId` on
 * `NewMessageProps`, but `AllChatProps` / `ChatProps` now use `string`
 * for both. We bridge with `String(...)` at the boundary so the
 * compiler is happy; at runtime the legacy `/` socket never carries
 * v3 UUIDs, so the resulting "chat row" will never match a v3 channel.
 * This file is dead code once the v3 socket router replaces the
 * legacy `/` namespace handlers.
 */
import { addChat } from "../../../features/chat/services/addChat";
import { popSpecificMessages } from "../../../features/chat/services/popSpecificMessages";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps, MessageProps, NewMessageProps } from "../../../types/chat";
import { emptyDmPartnerUser } from "../../../utils/defaultProps";

export const updateAllChat = async (
    currentChat: ChatProps,
    newChatMessage: MessageProps,
    allChats: AllChatProps[],
    funcSetAllChats: () => void
) => {
    const existingChat = allChats.find(
        (chat) => chat.chatId === currentChat.chatId && chat.chatType === currentChat.chatType
    );

    // Keys sorted alphabetically (case-insensitive) per `sort-keys`.
    // `lastReadMessageId || existingChat?.lastReadMessageId || ""`:
    // the `""` is the v3-flipped "no last-read" sentinel (replaces
    // legacy `-1`).
    const newChat: AllChatProps = {
        chatId: currentChat.chatId,
        chatName: currentChat.chatName,
        chatType: currentChat.chatType,
        dmPartnerUser: currentChat.dmPartnerUser || existingChat?.dmPartnerUser,
        isPinned: currentChat.isPinned || existingChat?.isPinned,
        isPrivate: currentChat.isPrivate || existingChat?.isPrivate,
        lastReadMessageId: currentChat.lastReadMessageId || existingChat?.lastReadMessageId || "",
        latestMessage: newChatMessage,
        latestMessageText: newChatMessage.contentText,
        profileImagePath: currentChat.profileImagePath || existingChat?.profileImagePath,
        project: currentChat.project || existingChat?.project,
        systemUserId: currentChat.systemUserId || existingChat?.systemUserId,
        tsLastAllReadActivity:
            currentChat.tsLastAllReadActivity || existingChat?.tsLastAllReadActivity,
        TSLastMessage: newChatMessage.tsSent,
    };

    if (newChat) {
        await addChat(newChat, currentChat.chatType);
        funcSetAllChats();
    }
};

export const makeDMUpdatedChat = async (
    newMessage: NewMessageProps,
    myself: UserProps
): Promise<ChatProps> => {
    const updatedChat = await popSpecificMessages(newMessage.chatId, newMessage.chatType);
    let _chatName: string;
    let _dmPartnerUser: UserProps;

    if (myself.userId === newMessage.sender.userId) {
        // If the new DM message is from myself, the chat name will be the dm partner's name.
        _chatName = newMessage.dmPartnerUser.userName;
        _dmPartnerUser = newMessage.dmPartnerUser;
    } else {
        // If the new DM message is from someone else, the chat name will be the sender's name.
        _chatName = newMessage.sender.userName;
        _dmPartnerUser = newMessage.sender;
    }
    return {
        chatId: String(newMessage.chatId),
        chatName: _chatName,
        chatType: newMessage.chatType,
        dmPartnerUser: _dmPartnerUser,
        lastReadMessageId: String(newMessage.lastReadMessageId),
        latestMessage: newMessage,
        latestMessageText: newMessage.contentText,
        messages: updatedChat,
        notMove: true,
        project: newMessage.project,
        systemUserId: newMessage.systemUserId,
        TSLastMessage: newMessage.tsSent,
    };
};

export const makeGMUpdatedChat = async (
    newMessage: NewMessageProps,
    allChats: AllChatProps[]
): Promise<ChatProps> => {
    const updatedChat = await popSpecificMessages(newMessage.chatId, newMessage.chatType);
    const existingChat = allChats.find(
        (c) => c.chatId === String(newMessage.chatId) && c.chatType === newMessage.chatType
    );
    return {
        chatId: String(newMessage.chatId),
        chatName: newMessage.chatName,
        chatType: newMessage.chatType,
        dmPartnerUser: emptyDmPartnerUser,
        isPrivate: newMessage.isPrivate,
        lastReadMessageId: String(newMessage.lastReadMessageId),
        latestMessage: newMessage,
        latestMessageText: newMessage.contentText,
        messages: updatedChat,
        notMove: true,
        profileImagePath: existingChat?.profileImagePath,
        project: newMessage.project,
        systemUserId: newMessage.systemUserId,
        TSLastMessage: newMessage.tsSent,
    };
};

export const makePMUpdatedChat = async (
    newMessage: NewMessageProps,
    allChats: AllChatProps[]
): Promise<ChatProps> => {
    const updatedChat = await popSpecificMessages(newMessage.chatId, newMessage.chatType);
    const existingChat = allChats.find(
        (c) => c.chatId === String(newMessage.chatId) && c.chatType === newMessage.chatType
    );
    return {
        chatId: String(newMessage.chatId),
        chatName: newMessage.chatName,
        chatType: newMessage.chatType,
        dmPartnerUser: emptyDmPartnerUser,
        lastReadMessageId: String(newMessage.lastReadMessageId),
        latestMessage: newMessage,
        latestMessageText: newMessage.contentText,
        messages: updatedChat,
        notMove: true,
        profileImagePath: existingChat?.profileImagePath,
        project: newMessage.project,
        systemUserId: newMessage.systemUserId,
        TSLastMessage: newMessage.tsSent,
    };
};

export const makeMDMUpdatedChat = async (newMessage: NewMessageProps): Promise<ChatProps> => {
    const updatedChat = await popSpecificMessages(newMessage.chatId, newMessage.chatType);
    return {
        chatId: String(newMessage.chatId),
        chatName: newMessage.chatName,
        chatType: newMessage.chatType,
        dmPartnerUser: emptyDmPartnerUser,
        lastReadMessageId: String(newMessage.lastReadMessageId),
        latestMessage: newMessage,
        latestMessageText: newMessage.contentText,
        messages: updatedChat,
        notMove: true,
        systemUserId: newMessage.systemUserId,
        TSLastMessage: newMessage.tsSent,
    };
};
