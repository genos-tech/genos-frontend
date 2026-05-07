import * as React from "react";
import { memo, useState } from "react";
import { Box, ListItem, Stack } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";

import { useAuth } from "../../../../context/AuthContext";
import { useChatListItem } from "../../hooks/useChatListItem";
import { ModalAddMembers } from "../modals/ModalAddMembers";
import { ChatListItemProps } from "./ChatListItem.types";
import { ChatListItemActions } from "./ChatListItemActions";
import { ChatListItemAvatar } from "./ChatListItemAvatar";
import { ChatListItemMessage } from "./ChatListItemMessage";
import { ChatListItemTitle } from "./ChatListItemTitle";

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
        useTM,
    } = props;

    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const [isHovered, setIsHovered] = useState(false);
    const [openAddMembers, setOpenAddMembers] = useState(false);

    const {
        isPinned,
        setIsPinned,
        selected,
        isYou,
        onClickHandler,
        splitOpenHandler,
        pinChatHandler,
    } = useChatListItem({
        chat,
        myself,
        useCM,
        useTM,
        isPinnedChat,
        accessToken: accessToken || "",
    });

    const handlePinClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        pinChatHandler(chat.chatId, chat.chatType, useCM.funcSetAllChats);
        setIsPinned(!isPinned);
    };

    const handleSplitClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        splitOpenHandler(useCM);
    };

    const handleAddMembersClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        setOpenAddMembers(true);
    };

    // Check if there are unread messages
    const hasUnread = chat.latestMessage && chat.lastReadMessageId < chat.latestMessage.messageId;

    return (
        <ListItem
            sx={{
                width: "100%",
                p: 0.5,
                px: 1,
            }}
        >
            <ListItemButton
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                color="neutral"
                selected={selected}
                sx={{
                    borderRadius: "12px",
                    p: 1.25,
                    gap: 1,
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    background: selected
                        ? isDark
                            ? "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)"
                            : "linear-gradient(135deg, rgba(79,70,229,0.1) 0%, rgba(124,58,237,0.06) 100%)"
                        : isHovered
                          ? isDark
                              ? "rgba(255,255,255,0.04)"
                              : "rgba(0,0,0,0.03)"
                          : "transparent",
                    border: "1px solid",
                    borderColor: selected
                        ? isDark
                            ? "rgba(139,92,246,0.2)"
                            : "rgba(124,58,237,0.12)"
                        : "transparent",
                    position: "relative",
                    overflow: "hidden",
                    "&:hover": {
                        background: selected
                            ? isDark
                                ? "linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.12) 100%)"
                                : "linear-gradient(135deg, rgba(79,70,229,0.12) 0%, rgba(124,58,237,0.08) 100%)"
                            : isDark
                              ? "rgba(255,255,255,0.05)"
                              : "rgba(0,0,0,0.04)",
                    },
                    "&.Mui-selected": {
                        background: isDark
                            ? "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)"
                            : "linear-gradient(135deg, rgba(79,70,229,0.1) 0%, rgba(124,58,237,0.06) 100%)",
                    },
                }}
                onClick={() => {
                    onClickHandler(useCM);
                }}
            >
                {/* Unread indicator line */}
                {hasUnread && (
                    <Box
                        sx={{
                            position: "absolute",
                            left: 0,
                            top: "50%",
                            transform: "translateY(-50%)",
                            width: 3,
                            height: "60%",
                            borderRadius: "0 4px 4px 0",
                            background: isDark
                                ? "linear-gradient(180deg, #6366f1 0%, #8b5cf6 100%)"
                                : "linear-gradient(180deg, #4f46e5 0%, #7c3aed 100%)",
                        }}
                    />
                )}

                <Stack direction="column" spacing={0.75} sx={{ width: "100%" }}>
                    <Stack
                        alignItems="center"
                        direction="row"
                        justifyContent="space-between"
                        spacing={1}
                    >
                        <Stack
                            direction="row"
                            spacing={1.25}
                            alignItems="center"
                            sx={{ flex: 1, minWidth: 0 }}
                        >
                            <Box sx={{ flexShrink: 0 }}>
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
                            </Box>

                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                <ChatListItemTitle
                                    chat={chat}
                                    isYou={isYou}
                                    myself={myself}
                                    useTEM={useTEM}
                                />
                            </Box>
                        </Stack>

                        <Box
                            sx={{
                                opacity: isHovered || selected ? 1 : 0.5,
                                transition: "opacity 0.15s ease",
                                flexShrink: 0,
                            }}
                        >
                            <ChatListItemActions
                                chat={chat}
                                incompleteTodoCount={incompleteTodoCount}
                                isPinned={isPinned || false}
                                myself={myself}
                                onPinClick={handlePinClick}
                                onSplitClick={handleSplitClick}
                                onAddMembersClick={handleAddMembersClick}
                                setIsToDoVisible={setIsToDoVisible}
                                isToDoVisible={isToDoVisible}
                            />
                        </Box>
                    </Stack>

                    <ChatListItemMessage chat={chat} />
                </Stack>
            </ListItemButton>

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
        </ListItem>
    );
});
