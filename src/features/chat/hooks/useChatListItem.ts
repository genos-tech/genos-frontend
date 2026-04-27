import { useState } from "react";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps, MessageProps } from "../../../types/chat";
import { toggleMessagesPane } from "../../../utils/sidebarUtils";
import { addChat } from "../services/addChat";
import { loadMDMHistory } from "../services/loadMDMHistory";
import { popSpecificMessages } from "../services/popSpecificMessages";
import { updatePinnedChats } from "../services/updatePinnedChats";
import { ChatService } from "../../../db/services/chat.service";
import { addMessage } from "../services/addMessage";

interface UseChatListItemProps {
    chat: AllChatProps;
    myself: UserProps;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    isPinnedChat: boolean;
    accessToken: string;
}

export const useChatListItem = ({
    chat,
    myself,
    useCM,
    useTM,
    isPinnedChat,
    accessToken,
}: UseChatListItemProps) => {
    const [isPinned, setIsPinned] = useState(chat.isPinned);

    const selected =
        `${useCM.currentMainChat?.chatType}-${useCM.currentMainChat?.chatName}-${useCM.currentMainChat?.chatId}` ===
            `${chat.chatType}-${chat.chatName}-${chat.chatId}` ||
        (useCM.isSubChatVisible &&
            `${useCM.currentSubChat?.chatType}-${useCM.currentSubChat?.chatName}-${useCM.currentSubChat?.chatId}` ===
                `${chat.chatType}-${chat.chatName}-${chat.chatId}`);

    const isYou = myself.userId === chat.dmPartnerUser.userId;

    const defineNewChat = (messages: any): ChatProps => {
        const lastMsg = messages.length > 0 ? messages[messages.length - 1] : chat.latestMessage;
        return {
            chatId: chat.chatId,
            chatName: chat.chatName,
            chatType: chat.chatType,
            dmPartnerUser: chat.dmPartnerUser,
            lastReadMessageId: lastMsg?.messageId ?? -1,
            messages: messages,
            latestMessage: chat.latestMessage,
            latestMessageText: chat.latestMessageText,
            TSLastMessage: chat.TSLastMessage,
            systemUserId: chat.systemUserId,
            project: chat.project,
            isPrivate: chat.isPrivate,
            profileImagePath: chat.profileImagePath,
            isPinned: chat.isPinned,
        };
    };

    const loadMDMMessagesFromBackend = async (chatId: number): Promise<MessageProps[]> => {
        try {
            const data = await loadMDMHistory(
                myself.teamId, myself.teamName, myself.userId, accessToken, chatId
            );
            const mdmChat = data?.chat_history?.[0];
            if (mdmChat?.messages?.length > 0) {
                const sorted = [...mdmChat.messages].sort(
                    (a: MessageProps, b: MessageProps) => a.messageId - b.messageId
                );
                for (const msg of sorted) {
                    await addMessage(msg, 4);
                }
                return sorted;
            }
        } catch (e) {
            console.error("Failed to load MDM messages from backend:", e);
        }
        return [];
    };

    const onClickHandler = (useCM: ChatManagementState) => {
        if (
            useCM.isSubChatVisible === false ||
            `${useCM.currentSubChat?.chatType}-${useCM.currentSubChat?.chatId}-${useCM.currentSubChat?.chatName}` !==
                `${chat.chatType}-${chat.chatId}-${chat.chatName}`
        ) {
            toggleMessagesPane();
            popSpecificMessages(chat.chatId, chat.chatType)
                .then(async (messages) => {
                    let finalMessages = messages;

                    if (chat.chatType === 4 && finalMessages.length === 0) {
                        finalMessages = await loadMDMMessagesFromBackend(chat.chatId);
                    }

                    const newChat: ChatProps = defineNewChat(finalMessages);
                    useCM.setCurrentMainChat(newChat);

                    const chatForIDB: AllChatProps = {
                        ...chat,
                        lastReadMessageId: newChat.lastReadMessageId,
                        latestMessage: newChat.latestMessage,
                        latestMessageText: newChat.latestMessageText,
                        TSLastMessage: newChat.TSLastMessage,
                    };
                    addChat(chatForIDB, chat.chatType);

                    useCM.setIsMainChatVisible(true);

                    if (useTM.isCreatingTask.flag === true || useTM.isTaskPreviewVisible) {
                        useCM.setIsThreadVisible(false);
                    }
                })
                .catch((error) => console.error(error));

            if (isPinnedChat) {
                localStorage.setItem("lastChatType", "4");
                localStorage.setItem("lastPinnedChatId", chat.chatId.toString() || "");
                localStorage.setItem("lastPinnedChatType", chat.chatType.toString() || "");
            }
        }
    };

    const splitOpenHandler = (useCM: ChatManagementState) => {
        if (
            `${useCM.currentMainChat?.chatType}-${useCM.currentMainChat?.chatId}-${useCM.currentMainChat?.chatName}` !==
            `${chat.chatType}-${chat.chatId}-${chat.chatName}`
        ) {
            toggleMessagesPane();
            popSpecificMessages(chat.chatId, chat.chatType)
                .then((messages) => {
                    useCM.setCurrentSubChat(defineNewChat(messages));
                    useCM.setIsMainChatVisible(true);
                    if (useTM.isCreatingTask.flag === true || useTM.isTaskPreviewVisible) {
                        useCM.setIsThreadVisible(false);
                    }
                })
                .catch((error) => console.error(error));
            useCM.setIsSubChatVisible(true);
        }
    };

    const pinChatHandler = async (
        chatId: number,
        chatType: number,
        funcSetAllChats: () => Promise<void>
    ) => {
        await updatePinnedChats(accessToken, myself, {
            chat_type: chatType,
            chat_id: chatId,
        });
        await addChat({ ...chat, isPinned: !chat.isPinned }, chatType);
        funcSetAllChats();
    };

    return {
        isPinned,
        setIsPinned,
        selected,
        isYou,
        onClickHandler,
        splitOpenHandler,
        pinChatHandler,
    };
};
