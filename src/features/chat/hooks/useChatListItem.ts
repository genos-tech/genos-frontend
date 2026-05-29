import { useState } from "react";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps, MessageProps } from "../../../types/chat";
import { toggleMessagesPane } from "../../../utils/sidebarUtils";
import { addChat } from "../services/addChat";
import { loadV3SpecificMessages } from "../services/loadV3SpecificMessages";
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
        `${useCM.currentMainChat?.chatType}-${useCM.currentMainChat?.chatName}-${useCM.currentMainChat?.chatId}` ===
            `${chat.chatType}-${chat.chatName}-${chat.chatId}` ||
        (useCM.isSubChatVisible &&
            `${useCM.currentSubChat?.chatType}-${useCM.currentSubChat?.chatName}-${useCM.currentSubChat?.chatId}` ===
                `${chat.chatType}-${chat.chatName}-${chat.chatId}`);

    const isYou = myself.userId === chat.dmPartnerUser.userId;

    // `chat.chatId` is the v3 UUID string. `lastReadMessageId` is
    // stringified to match the v3 `ChatProps.lastReadMessageId: string`
    // shape; `""` is the new "no last-read" sentinel (replaces legacy
    // `-1`).
    const v3ChannelId = chat.chatId;

    // Keys sorted alphabetically per `sort-keys`.
    const defineNewChat = (messages: MessageProps[]): ChatProps => {
        const lastMsg = messages.length > 0 ? messages[messages.length - 1] : chat.latestMessage;
        return {
            chatId: chat.chatId,
            chatName: chat.chatName,
            chatType: chat.chatType,
            dmPartnerUser: chat.dmPartnerUser,
            isPinned: chat.isPinned,
            isPrivate: chat.isPrivate,
            lastReadMessageId: lastMsg?.messageId != null ? String(lastMsg.messageId) : "",
            latestMessage: chat.latestMessage,
            latestMessageText: chat.latestMessageText,
            messages: messages,
            profileImagePath: chat.profileImagePath,
            project: chat.project,
            systemUserId: chat.systemUserId,
            TSLastMessage: chat.TSLastMessage,
        };
    };

    const onClickHandler = (useCM: ChatManagementState) => {
        if (
            useCM.isSubChatVisible === false ||
            `${useCM.currentSubChat?.chatType}-${useCM.currentSubChat?.chatId}-${useCM.currentSubChat?.chatName}` !==
                `${chat.chatType}-${chat.chatId}-${chat.chatName}`
        ) {
            toggleMessagesPane();
            // v3 cutover: was `popSpecificMessages(chatIdLegacy, chatType)`
            // (legacy worker IDB pop with `chat.chatId as unknown as number`,
            // which NaN'd for UUIDs and returned `[]` — leaving the open
            // chat empty). The legacy MDM `/history/` fallback for empty
            // results is also gone; `loadV3SpecificMessages` handles every
            // kind uniformly through channelService.
            loadV3SpecificMessages(v3ChannelId, chat.chatType)
                .then(async (messages) => {
                    const finalMessages = messages;

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
            loadV3SpecificMessages(v3ChannelId, chat.chatType)
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

    // Keys sorted alphabetically per `sort-keys`.
    return {
        isPinned,
        isYou,
        onClickHandler,
        pinChatHandler,
        selected,
        setIsPinned,
        splitOpenHandler,
    };
};
