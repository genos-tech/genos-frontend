import { useState } from "react";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../context/AuthContext";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps } from "../../../types/chat";
import { toggleMessagesPane } from "../../../utils";
import { addChat } from "../services/addChat";
import { popSpecificMessages } from "../services/popSpecificMessages";
import { updatePinnedChats } from "../services/updatePinnedChats";

interface UseChatListItemProps {
    chat: AllChatProps;
    myself: UserProps;
    currentMainChat?: ChatProps;
    currentSubChat?: ChatProps;
    isSubChatVisible: boolean;
    isTaskPreviewVisible: boolean;
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };
    isPinnedChat: boolean;
    accessToken: string;
}

export const useChatListItem = ({
    chat,
    myself,
    currentMainChat,
    currentSubChat,
    isSubChatVisible,
    isTaskPreviewVisible,
    isCreatingTask,
    isPinnedChat,
    accessToken,
}: UseChatListItemProps) => {
    const [isPinned, setIsPinned] = useState(chat.isPinned);

    const selected =
        `${currentMainChat?.chatName}-${currentMainChat?.chatId}` ===
            `${chat.chatName}-${chat.chatId}` ||
        (isSubChatVisible &&
            `${currentSubChat?.chatName}-${currentSubChat?.chatId}` ===
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

    const onClickHandler = (
        setCurrentMainChat: (chat: ChatProps) => void,
        setIsMainChatVisible: (value: boolean) => void,
        setIsThreadVisible: (value: boolean) => void
    ) => {
        if (
            isSubChatVisible === false ||
            `${currentSubChat?.chatId}-${currentSubChat?.chatName}` !==
                `${chat.chatId}-${chat.chatName}`
        ) {
            toggleMessagesPane();
            popSpecificMessages(chat.chatId, chat.chatType)
                .then((messages) => {
                    const newChat: ChatProps = defineNewChat(messages);
                    setCurrentMainChat(newChat);
                    addChat(newChat, chat.chatType);

                    setIsMainChatVisible(true);

                    if (isCreatingTask.flag === true || isTaskPreviewVisible) {
                        setIsThreadVisible(false);
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

    const splitOpenHandler = (
        setCurrentSubChat: (chat: ChatProps) => void,
        setIsMainChatVisible: (value: boolean) => void,
        setIsThreadVisible: (value: boolean) => void,
        setIsSubChatVisible: (value: boolean) => void
    ) => {
        if (
            `${currentMainChat?.chatId}-${currentMainChat?.chatName}` !==
            `${chat.chatId}-${chat.chatName}`
        ) {
            toggleMessagesPane();
            popSpecificMessages(chat.chatId, chat.chatType)
                .then((messages) => {
                    setCurrentSubChat(defineNewChat(messages));
                    setIsMainChatVisible(true);
                    if (isCreatingTask.flag === true || isTaskPreviewVisible) {
                        setIsThreadVisible(false);
                    }
                })
                .catch((error) => console.error(error));
            setIsSubChatVisible(true);
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
