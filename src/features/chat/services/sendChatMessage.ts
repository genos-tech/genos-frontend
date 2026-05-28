import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps, MessageProps } from "../../../types/chat";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { getFirstLine } from "../utils/common";
import { addChat } from "./addChat";
import { addMessage } from "./addMessage";

/**
 * Emit a chat "message" POST over the socket AND apply the sender's
 * optimistic local update. Centralized so callers outside the BlockNote
 * editor (e.g. Quick Meet's share-link modal) get the same in-pane
 * append + IDB persistence + chat-list refresh behavior — the live
 * receive path skips `context.fromMe` for GM/PM/MDM and post-1 DM
 * messages, so without this the sender's own message never renders.
 *
 * `content` is a BlockNote document (array of blocks). `setCurrentChat`
 * is the setter for the pane that owns this chat (main vs sub) so the
 * append lands on the right pane.
 */
export const sendChatMessage = ({
    socket,
    chat,
    content,
    myself,
    useCM,
    setCurrentChat,
}: {
    socket: Socket;
    chat: ChatProps;
    content: any[];
    myself: UserProps;
    useCM: ChatManagementState;
    setCurrentChat: (chat: ChatProps) => void;
}): Promise<void> => {
    return new Promise((resolve) => {
        const contentText = getFirstLine(content[0]);
        const nextMessageId = Number(chat.latestMessage?.messageId) + 1;
        const timestamp = getLocalCurrentTimestamp();

        socket.emit(
            "message",
            {
                methodType: "POST",
                message: content,
                destCGName: chat.chatName,
                destCGId: chat.chatId,
                chatType: chat.chatType,
                dmPartnerUserId: chat.dmPartnerUser.userId,
                taskId: null,
                taskStatus: null,
                systemUserId: null,
                messageIdForPut: null,
            },
            async () => {
                const newMessage: MessageProps = {
                    chatType: chat.chatType,
                    systemUserId: chat.systemUserId,
                    messageIdWithChatId: `${chat.chatId}-${String(nextMessageId)}`,
                    chatId: chat.chatId,
                    messageId: nextMessageId,
                    content,
                    contentText,
                    sender: myself,
                    tsSent: timestamp,
                    tsUpdated: timestamp,
                    numReplies: 0,
                    taskId: null,
                    taskStatus: null,
                };

                const updatedChat: ChatProps = {
                    chatId: chat.chatId,
                    chatName: chat.chatName,
                    chatType: chat.chatType,
                    systemUserId: chat.systemUserId,
                    dmPartnerUser: chat.dmPartnerUser,
                    lastReadMessageId: chat.lastReadMessageId + 1,
                    messages: [...chat.messages, newMessage],
                    latestMessage: newMessage,
                    latestMessageText: contentText,
                    TSLastMessage: timestamp,
                    profileImagePath: chat.profileImagePath,
                };
                setCurrentChat(updatedChat);

                const existingAllChat = useCM.allChats.find(
                    (c) => c.chatId === chat.chatId && c.chatType === chat.chatType
                );
                const newAllChat: AllChatProps = {
                    chatId: chat.chatId,
                    chatName: chat.chatName,
                    systemUserId: chat.systemUserId,
                    chatType: chat.chatType,
                    dmPartnerUser: chat.dmPartnerUser,
                    lastReadMessageId: chat.messages[chat.messages.length - 1].messageId + 1,
                    latestMessage: newMessage,
                    latestMessageText: contentText,
                    TSLastMessage: timestamp,
                    profileImagePath: chat.profileImagePath,
                    mdmMembers: existingAllChat?.mdmMembers,
                };

                await addMessage(newMessage, newAllChat.chatType);
                await addChat(newAllChat, newAllChat.chatType);
                await useCM.funcSetAllChats();
                resolve();
            }
        );
    });
};
