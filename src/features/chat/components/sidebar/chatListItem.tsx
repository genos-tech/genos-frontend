// `sort-keys` + `react/jsx-sort-props` + `simple-import-sort/imports`
// disabled file-wide: this legacy chat sidebar item carries Joy UI `sx`
// prop objects whose visual grouping (positioning → sizing → typography
// → colors) is intentional, and the file is slated for replacement by
// the v3 channel sidebar.
/* eslint-disable react/jsx-sort-props */
import * as React from "react";
import { memo, useEffect, useRef, useState } from "react";

import { NavItem } from "../../../../components/ui/nav/NavItem";
import { useAuth } from "../../../../context/AuthContext";
import { prefetchChannel } from "../../../../services/channel/channelPrefetch";
import { useChatListItem } from "../../hooks/useChatListItem";
import { ModalAddMembers } from "../modals/ModalAddMembers";
import { ModalAssignGMTags } from "../modals/ModalAssignGMTags";
import { ChatListItemProps } from "./ChatListItem.types";
import { ChatListItemActions, ChatListItemMeta } from "./ChatListItemActions";
import { ChatListItemAvatar } from "./ChatListItemAvatar";
import { chatListItemPropsAreEqual } from "./chatListItemEquality";
import { ChatListItemMessage } from "./ChatListItemMessage";
import { ChatListItemTitle } from "./ChatListItemTitle";

// Hover has to persist this long before we spend a sync on the channel,
// so dragging the cursor across the list doesn't prefetch every row it
// passes over. Short enough that a deliberate hover→click still wins.
const HOVER_PREFETCH_DELAY_MS = 120;

export const ChatListItem = memo((props: ChatListItemProps) => {
    const {
        chat,
        incompleteTodoCount,
        isPinnedChat,
        myself,
        isToDoVisible,
        setIsToDoVisible,
        setMyself,
        useUISM,
        socket,
        useTEM,
        useCM,
        liveRef,
        useTM,
        selected,
    } = props;

    const { accessToken } = useAuth();
    const [openAddMembers, setOpenAddMembers] = useState(false);
    const [openAssignTags, setOpenAssignTags] = useState(false);

    // Pending hover-prefetch timer (see the `onMouseEnter` below).
    const prefetchTimerRef = useRef<number | undefined>(undefined);
    useEffect(
        () => () => {
            if (prefetchTimerRef.current !== undefined) {
                clearTimeout(prefetchTimerRef.current);
            }
        },
        []
    );

    const { isPinned, setIsPinned, isYou, onClickHandler, splitOpenHandler, pinChatHandler } =
        useChatListItem({ chat, myself, isPinnedChat });

    const handlePinClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        // v3 pin/unpin. The args are vestigial — `pinChatHandler`
        // reads `chat.chatId` / `chat.isPinned` from the closure now,
        // not from the call args. Kept for prop-shape compatibility.
        pinChatHandler(
            chat.chatId as unknown as number,
            chat.chatType,
            liveRef.current.useCM.funcSetAllChats
        );
        setIsPinned(!isPinned);
    };

    const handleSplitClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        // `liveRef.current`, not the captured props: this row is memoized,
        // so the captured prop can be several notifies stale and the
        // handler guards on live `isSubChatVisible` / `currentSubChat`.
        splitOpenHandler(liveRef.current);
    };

    const handleAddMembersClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        setOpenAddMembers(true);
    };

    const handleManageTagsClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        setOpenAssignTags(true);
    };

    // PUNCH LIST (v3 chatId migration): `lastReadMessageId` is `string`
    // post-flip; `latestMessage.messageId` is still `number` (legacy
    // message schema). Legacy values stringify cleanly so `Number(...)`
    // round-trips. UUID-shaped cursors NaN and the comparison fails —
    // safer side (no false-positive unread dot).
    const hasUnread =
        chat.latestMessage && Number(chat.lastReadMessageId || "0") < chat.latestMessage.messageId;

    return (
        <>
            <NavItem
                as="div"
                // Two lines (title + latest message): the documented multiple of
                // a density row. It still grows for a custom status or GM tags.
                lines={2}
                selected={selected}
                unread={Boolean(hasUnread)}
                sx={{ mx: 1 }}
                icon={
                    <ChatListItemAvatar
                        chat={chat}
                        chatType={chat.chatType}
                        useCM={useCM}
                        isYou={isYou}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />
                }
                label={
                    <ChatListItemTitle chat={chat} isYou={isYou} myself={myself} useTEM={useTEM} />
                }
                secondary={<ChatListItemMessage chat={chat} />}
                trailing={<ChatListItemMeta chat={chat} />}
                // No empty column at rest: the time shows, and gives way to the pin and
                // "..." on hover (a pinned chat's pin stays beside the time).
                actionsInPlace
                actions={
                    <ChatListItemActions
                        chat={chat}
                        incompleteTodoCount={incompleteTodoCount}
                        isPinned={isPinned || false}
                        myself={myself}
                        onPinClick={handlePinClick}
                        onSplitClick={handleSplitClick}
                        onAddMembersClick={handleAddMembersClick}
                        onManageTagsClick={handleManageTagsClick}
                        setIsToDoVisible={setIsToDoVisible}
                        isToDoVisible={isToDoVisible}
                    />
                }
                // On the row, not the row button: the actions beside it are part of
                // the row, so moving onto them must not cancel the prefetch.
                rootProps={{
                    onMouseEnter: () => {
                        // Warm this channel's messages while the pointer is
                        // still travelling to the click. A cold channel
                        // otherwise blanks the pane for the whole sync
                        // round-trip (see `channelPrefetch`). Delayed so
                        // sweeping the cursor down the list doesn't fire a
                        // sync per row it crosses.
                        if (prefetchTimerRef.current !== undefined) {
                            clearTimeout(prefetchTimerRef.current);
                        }
                        prefetchTimerRef.current = window.setTimeout(() => {
                            prefetchChannel(chat.chatId);
                        }, HOVER_PREFETCH_DELAY_MS);
                    },
                    onMouseLeave: () => {
                        if (prefetchTimerRef.current !== undefined) {
                            clearTimeout(prefetchTimerRef.current);
                            prefetchTimerRef.current = undefined;
                        }
                    },
                }}
                onClick={() => {
                    // See `handleSplitClick` — live read, not the
                    // possibly-stale captured prop.
                    onClickHandler(liveRef.current);
                }}
            />

            {/* Personal tag assignment for GM chats */}
            {chat.chatType === 2 && (
                <ModalAssignGMTags chat={chat} open={openAssignTags} setOpen={setOpenAssignTags} />
            )}

            {/* Add Members Modal for DM/MDM chats */}
            {(chat.chatType === 1 || chat.chatType === 4) && (
                <ModalAddMembers
                    socket={socket}
                    myself={myself}
                    chat={chat}
                    open={openAddMembers}
                    setOpen={setOpenAddMembers}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                    setMyself={setMyself}
                />
            )}
        </>
    );
}, chatListItemPropsAreEqual);
