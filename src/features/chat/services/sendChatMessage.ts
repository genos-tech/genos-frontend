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
    // `any[]` matches the existing call-site (BlockNote editor passes
    // its raw block array); tightening to `PartialBlock[]` cascades
    // into the editor wrapper. Re-tightened during the unified
    // messaging rewrite.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any[];
    myself: UserProps;
    useCM: ChatManagementState;
    setCurrentChat: (chat: ChatProps) => void;
}): Promise<void> => {
    return new Promise((resolve) => {
        const contentText = getFirstLine(content[0]);
        const nextMessageId = Number(chat.latestMessage?.messageId) + 1;
        const timestamp = getLocalCurrentTimestamp();

        // PUNCH LIST (v3 chatId migration): `ChatProps.chatId` /
        // `lastReadMessageId` are `string` post-flip; `MessageProps.chatId`
        // is still `number` (legacy message schema). Cast once at the
        // boundary. `lastReadMessageId` is the just-sent message id
        // stringified — the previous code did `chat.lastReadMessageId + 1`
        // (now string concat → `"12" + 1 === "121"`) and
        // `messages[last].messageId + 1` (number + 1, wrong final type).
        // Both branches converge to `String(nextMessageId)`.
        const legacyChatId = chat.chatId as unknown as number;
        const nextMessageIdStr = String(nextMessageId);

        socket.emit(
            "message",
            {
                chatType: chat.chatType,
                destCGId: chat.chatId,
                destCGName: chat.chatName,
                dmPartnerUserId: chat.dmPartnerUser.userId,
                message: content,
                messageIdForPut: null,
                methodType: "POST",
                systemUserId: null,
                taskId: null,
                taskStatus: null,
            },
            async () => {
                const newMessage: MessageProps = {
                    chatId: legacyChatId,
                    chatType: chat.chatType,
                    content,
                    contentText,
                    messageId: nextMessageId,
                    messageIdWithChatId: `${chat.chatId}-${nextMessageIdStr}`,
                    numReplies: 0,
                    sender: myself,
                    systemUserId: chat.systemUserId,
                    taskId: null,
                    taskStatus: null,
                    tsSent: timestamp,
                    tsUpdated: timestamp,
                };

                const updatedChat: ChatProps = {
                    chatId: chat.chatId,
                    chatName: chat.chatName,
                    chatType: chat.chatType,
                    dmPartnerUser: chat.dmPartnerUser,
                    lastReadMessageId: nextMessageIdStr,
                    latestMessage: newMessage,
                    latestMessageText: contentText,
                    messages: [...chat.messages, newMessage],
                    profileImagePath: chat.profileImagePath,
                    systemUserId: chat.systemUserId,
                    TSLastMessage: timestamp,
                };
                setCurrentChat(updatedChat);

                const existingAllChat = useCM.allChats.find(
                    (c) => c.chatId === chat.chatId && c.chatType === chat.chatType
                );
                const newAllChat: AllChatProps = {
                    chatId: chat.chatId,
                    chatName: chat.chatName,
                    chatType: chat.chatType,
                    dmPartnerUser: chat.dmPartnerUser,
                    lastReadMessageId: nextMessageIdStr,
                    latestMessage: newMessage,
                    latestMessageText: contentText,
                    mdmMembers: existingAllChat?.mdmMembers,
                    profileImagePath: chat.profileImagePath,
                    systemUserId: chat.systemUserId,
                    TSLastMessage: timestamp,
                };

                await addMessage(newMessage, newAllChat.chatType);
                await addChat(newAllChat, newAllChat.chatType);
                await useCM.funcSetAllChats();
                resolve();
            }
        );
    });
};
