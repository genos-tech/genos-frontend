import { useState } from "react";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps } from "../../../types/chat";
import { toggleMessagesPane } from "../../../utils/sidebarUtils";
import { addChat } from "../services/addChat";
import { popSpecificMessages } from "../services/popSpecificMessages";
import { updatePinnedChats } from "../services/updatePinnedChats";

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
        `${useCM.currentMainChat?.chatName}-${useCM.currentMainChat?.chatId}` ===
            `${chat.chatName}-${chat.chatId}` ||
        (useCM.isSubChatVisible &&
            `${useCM.currentSubChat?.chatName}-${useCM.currentSubChat?.chatId}` ===
                `${chat.chatName}-${chat.chatId}`);

    const isYou = myself.userId === chat.dmPartnerUser.userId;

    const defineNewChat = (messages: any): ChatProps => {
        return {
            chatId: chat.chatId,
            chatName: chat.chatName,
            chatType: chat.chatType,
            dmPartnerUser: chat.dmPartnerUser,
            lastReadMessageId: messages[messages.length - 1].messageId,
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

    const onClickHandler = (useCM: ChatManagementState) => {
        if (
            useCM.isSubChatVisible === false ||
            `${useCM.currentSubChat?.chatId}-${useCM.currentSubChat?.chatName}` !==
                `${chat.chatId}-${chat.chatName}`
        ) {
            toggleMessagesPane();
            popSpecificMessages(chat.chatId, chat.chatType)
                .then((messages) => {
                    const newChat: ChatProps = defineNewChat(messages);
                    useCM.setCurrentMainChat(newChat);
                    addChat(newChat, chat.chatType);

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
            `${useCM.currentMainChat?.chatId}-${useCM.currentMainChat?.chatName}` !==
            `${chat.chatId}-${chat.chatName}`
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
