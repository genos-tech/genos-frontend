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
    const newChat: AllChatProps = {
        chatType: currentChat.chatType,
        chatId: currentChat.chatId,
        chatName: currentChat.chatName,
        systemUserId:
            currentChat.systemUserId ||
            allChats.find((chat) => chat.chatId === currentChat.chatId)?.systemUserId,
        dmPartnerUser:
            currentChat.dmPartnerUser ||
            allChats.find((chat) => chat.chatId === currentChat.chatId)?.dmPartnerUser,
        lastReadMessageId:
            currentChat.lastReadMessageId ||
            allChats.find((chat) => chat.chatId === currentChat.chatId)?.lastReadMessageId ||
            -1,
        latestMessage: newChatMessage,
        latestMessageText: newChatMessage.contentText,
        TSLastMessage: newChatMessage.tsSent,
        project:
            currentChat.project ||
            allChats.find((chat) => chat.chatId === currentChat.chatId)?.project,
        isPrivate:
            currentChat.isPrivate ||
            allChats.find((chat) => chat.chatId === currentChat.chatId)?.isPrivate,
        profileImagePath:
            currentChat.profileImagePath ||
            allChats.find((chat) => chat.chatId === currentChat.chatId)?.profileImagePath,
        isPinned:
            currentChat.isPinned ||
            allChats.find((chat) => chat.chatId === currentChat.chatId)?.isPinned,
        tsLastAllReadActivity:
            currentChat.tsLastAllReadActivity ||
            allChats.find((chat) => chat.chatId === currentChat.chatId)?.tsLastAllReadActivity,
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
    const existingChat = allChats.find((c) => c.chatId === newMessage.chatId);
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
    const existingChat = allChats.find((c) => c.chatId === newMessage.chatId);
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
