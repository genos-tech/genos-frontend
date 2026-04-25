import { addChat } from "../../../features/chat/services/addChat";
import { popSpecificMessages } from "../../../features/chat/services/popSpecificMessages";
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

    const newChat: AllChatProps = {
        chatType: currentChat.chatType,
        chatId: currentChat.chatId,
        chatName: currentChat.chatName,
        systemUserId: currentChat.systemUserId || existingChat?.systemUserId,
        dmPartnerUser: currentChat.dmPartnerUser || existingChat?.dmPartnerUser,
        lastReadMessageId: currentChat.lastReadMessageId || existingChat?.lastReadMessageId || -1,
        latestMessage: newChatMessage,
        latestMessageText: newChatMessage.contentText,
        TSLastMessage: newChatMessage.tsSent,
        project: currentChat.project || existingChat?.project,
        isPrivate: currentChat.isPrivate || existingChat?.isPrivate,
        profileImagePath: currentChat.profileImagePath || existingChat?.profileImagePath,
        isPinned: currentChat.isPinned || existingChat?.isPinned,
        tsLastAllReadActivity:
            currentChat.tsLastAllReadActivity || existingChat?.tsLastAllReadActivity,
    };

    if (newChat) {
        await addChat(newChat, currentChat.chatType);
        funcSetAllChats();
    }
};

export const makeDMUpdatedChat = async (
    newMessage: NewMessageProps,
    myself: any
): Promise<ChatProps> => {
    const updatedChat = await popSpecificMessages(newMessage.chatId, newMessage.chatType);
    let _chatName: string;
    let _dmPartnerUser: any;

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
        chatId: newMessage.chatId,
        chatName: _chatName,
        systemUserId: newMessage.systemUserId,
        chatType: newMessage.chatType,
        dmPartnerUser: _dmPartnerUser,
        lastReadMessageId: newMessage.lastReadMessageId,
        messages: updatedChat,
        latestMessage: newMessage,
        latestMessageText: newMessage.contentText,
        TSLastMessage: newMessage.tsSent,
        project: newMessage.project,
        notMove: true,
    };
};

export const makeGMUpdatedChat = async (
    newMessage: NewMessageProps,
    allChats: AllChatProps[]
): Promise<ChatProps> => {
    const updatedChat = await popSpecificMessages(newMessage.chatId, newMessage.chatType);
    const existingChat = allChats.find(
        (c) => c.chatId === newMessage.chatId && c.chatType === newMessage.chatType
    );
    return {
        chatId: newMessage.chatId,
        chatName: newMessage.chatName,
        systemUserId: newMessage.systemUserId,
        chatType: newMessage.chatType,
        dmPartnerUser: emptyDmPartnerUser,
        lastReadMessageId: newMessage.lastReadMessageId,
        messages: updatedChat,
        latestMessage: newMessage,
        latestMessageText: newMessage.contentText,
        TSLastMessage: newMessage.tsSent,
        project: newMessage.project,
        notMove: true,
        isPrivate: newMessage.isPrivate,
        profileImagePath: existingChat?.profileImagePath,
    };
};

export const makePMUpdatedChat = async (
    newMessage: NewMessageProps,
    allChats: AllChatProps[]
): Promise<ChatProps> => {
    const updatedChat = await popSpecificMessages(newMessage.chatId, newMessage.chatType);
    const existingChat = allChats.find(
        (c) => c.chatId === newMessage.chatId && c.chatType === newMessage.chatType
    );
    return {
        chatId: newMessage.chatId,
        chatName: newMessage.chatName,
        systemUserId: newMessage.systemUserId,
        chatType: newMessage.chatType,
        dmPartnerUser: emptyDmPartnerUser,
        lastReadMessageId: newMessage.lastReadMessageId,
        messages: updatedChat,
        latestMessage: newMessage,
        latestMessageText: newMessage.contentText,
        TSLastMessage: newMessage.tsSent,
        project: newMessage.project,
        notMove: true,
        profileImagePath: existingChat?.profileImagePath,
    };
};

export const makeMDMUpdatedChat = async (
    newMessage: NewMessageProps
): Promise<ChatProps> => {
    const updatedChat = await popSpecificMessages(newMessage.chatId, newMessage.chatType);
    return {
        chatId: newMessage.chatId,
        chatName: newMessage.chatName,
        systemUserId: newMessage.systemUserId,
        chatType: newMessage.chatType,
        dmPartnerUser: emptyDmPartnerUser,
        lastReadMessageId: newMessage.lastReadMessageId,
        messages: updatedChat,
        latestMessage: newMessage,
        latestMessageText: newMessage.contentText,
        TSLastMessage: newMessage.tsSent,
        notMove: true,
    };
};
