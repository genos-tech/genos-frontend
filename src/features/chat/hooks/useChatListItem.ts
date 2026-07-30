import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { useIsMobile } from "../../../hooks/common/useIsMobile";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { channelService } from "../../../services/channel/channelService";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps, MessageProps } from "../../../types/chat";
import { toggleMessagesPane } from "../../../utils/sidebarUtils";
import { readV3CachedMessages } from "../services/loadV3SpecificMessages";
import { buildChatPath, CHAT_TYPE_REVERSE_MAP } from "../utils/chatPaths";

/**
 * The manager state a click handler reads LIVE, handed in at call time.
 *
 * The row is memoized (see `chatListItemEquality.ts`), so anything these
 * handlers capture from the render closure can be several channelService
 * notifies out of date. They guard on `isSubChatVisible` /
 * `currentSubChat` / `isCreatingTask` — a stale read there makes a
 * legitimate click silently do nothing. So the caller passes the current
 * managers through a ref at click time rather than the handlers closing
 * over them.
 *
 * Setters are exempt from this concern (stable identity), but they ride
 * along in the same object for simplicity.
 */
export type ChatListItemLive = {
    useCM: ChatManagementState;
    useTM: TaskManagementState;
};

interface UseChatListItemProps {
    chat: AllChatProps;
    myself: UserProps;
    isPinnedChat: boolean;
}

export const useChatListItem = ({ chat, myself, isPinnedChat }: UseChatListItemProps) => {
    const [isPinned, setIsPinned] = useState(chat.isPinned);
    const navigate = useNavigate();
    const isMobile = useIsMobile();

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

    const onClickHandler = ({ useCM, useTM }: ChatListItemLive) => {
        // Mobile is a single-pane stack where the URL — not
        // `currentMainChat` — decides which pane is on screen (see
        // `MobileChatHome`), so opening a chat has to move the URL.
        //
        // Selection is otherwise state-first: nothing here navigates, and
        // `useChatRouting`'s state→URL effect catches up. But that effect is
        // keyed on the chat's IDENTITY, so re-selecting the chat that is
        // already `currentMainChat` writes the same id, fires no effect, and
        // never navigates. Both of these leave exactly that state — a chat
        // still selected while the URL sits at the list:
        //
        //   1. Mobile back (header arrow, browser Back, swipe-back) drops
        //      the `:chatId` segment but keeps the selection.
        //   2. Boot restores `lastChatId` into `currentMainChat`
        //      (`loadInitialData`) while the URL is still `/workspace/chat/:type`.
        //
        // In both, tapping THAT chat did nothing while tapping any other
        // chat worked — which is what made the failure look intermittent.
        // Driving the URL from the tap removes the dependency on the
        // identity changing at all. Desktop is untouched: it renders panes
        // from state and deliberately keeps selection state-first.
        //
        // Skipped when the URL already points here: `navigate` to an
        // identical path still PUSHES, and a duplicate entry costs the user
        // two Back presses to leave the chat.
        if (isMobile) {
            const typePath = CHAT_TYPE_REVERSE_MAP[chat.chatType];
            const target = typePath ? buildChatPath(typePath, chat.chatId) : null;
            if (target !== null && window.location.pathname !== target) {
                navigate(target);
            }
        }
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

    const splitOpenHandler = ({ useCM, useTM }: ChatListItemLive) => {
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

    // Keys sorted alphabetically per `sort-keys`. `selected` is no longer
    // returned — it derives from live `useCM` state and is computed by
    // the list instead, so the row can be memoized. See
    // `ChatListItemProps.selected`.
    return {
        isPinned,
        isYou,
        onClickHandler,
        pinChatHandler,
        setIsPinned,
        splitOpenHandler,
    };
};
