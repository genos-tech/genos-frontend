import { useState } from "react";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { channelService } from "../../../services/channel/channelService";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps, MessageProps } from "../../../types/chat";
import { toggleMessagesPane } from "../../../utils/sidebarUtils";
import { readV3CachedMessages } from "../services/loadV3SpecificMessages";

interface UseChatListItemProps {
    chat: AllChatProps;
    myself: UserProps;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    isPinnedChat: boolean;
}

export const useChatListItem = ({
    chat,
    myself,
    useCM,
    useTM,
    isPinnedChat,
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
            // Switch INSTANTLY from the in-memory snapshot — no network
            // wait. Previously this awaited `loadV3SpecificMessages`
            // (which awaits `syncChannel`) before calling
            // `setCurrentMainChat`, so the pane sat blank for the full
            // REST round-trip (~1s) on every switch. Now we paint the
            // cached messages immediately and revalidate in the
            // background: the `useChatManagement` live-update
            // subscription (keyed on the open chat id) patches the fresh
            // slice into `currentMainChat.messages` once the sync below
            // resolves, and drops a late sync for a chat we've left.
            const newChat: ChatProps = defineNewChat(
                readV3CachedMessages(v3ChannelId, chat.chatType)
            );
            useCM.setCurrentMainChat(newChat);
            useCM.setIsMainChatVisible(true);

            if (useTM.isCreatingTask.flag === true || useTM.isTaskPreviewVisible) {
                useCM.setIsThreadVisible(false);
            }

            // Background revalidate. `syncChannel` is idempotent and
            // per-channel mutexed; the subscription above applies the
            // result. First-ever open of a never-cached channel paints
            // empty here, then fills in when this resolves.
            void channelService
                .syncChannel(v3ChannelId)
                .catch((error) =>
                    console.error("[useChatListItem] background syncChannel failed:", error)
                );

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
            // Instant switch from cache (mirrors `onClickHandler`); the
            // sub-pane live-update subscription in `useChatManagement`
            // patches the fresh slice once the background sync resolves.
            useCM.setCurrentSubChat(
                defineNewChat(readV3CachedMessages(v3ChannelId, chat.chatType))
            );
            useCM.setIsMainChatVisible(true);
            if (useTM.isCreatingTask.flag === true || useTM.isTaskPreviewVisible) {
                useCM.setIsThreadVisible(false);
            }
            useCM.setIsSubChatVisible(true);
            void channelService
                .syncChannel(v3ChannelId)
                .catch((error) =>
                    console.error("[useChatListItem] background syncChannel failed:", error)
                );
        }
    };

    const pinChatHandler = async (
        _chatId: number,
        _chatType: number,
        _funcSetAllChats: () => Promise<void>
    ) => {
        // v3 pin/unpin. The v3 subscription in `useChatManagement`
        // re-derives `allChats` (with `isPinned` annotated by
        // `channelToLegacyChat`) on the `pin.added` / `pin.removed`
        // broadcast — no manual `funcSetAllChats` call needed.
        try {
            if (chat.isPinned) {
                await channelService.unpinChannel(chat.chatId);
            } else {
                await channelService.pinChannel(chat.chatId);
            }
        } catch (e) {
            console.error("[useChatListItem] pin toggle failed:", e);
        }
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
