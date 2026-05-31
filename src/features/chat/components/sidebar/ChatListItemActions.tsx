import React from "react";
import ChecklistIcon from "@mui/icons-material/Checklist";
import CircleIcon from "@mui/icons-material/Circle";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import PushPinIcon from "@mui/icons-material/PushPin";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import SplitscreenIcon from "@mui/icons-material/Splitscreen";
import {
    Badge,
    Dropdown,
    IconButton,
    Menu,
    MenuButton,
    MenuItem,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";
import { extractYYYYMMDDHHMM } from "../../../../utils/dateUtils";

interface ChatListItemActionsProps {
    chat: AllChatProps;
    myself: UserProps;
    incompleteTodoCount: number;
    isPinned: boolean;
    onPinClick: (event: React.MouseEvent) => void;
    onSplitClick: (event: React.MouseEvent) => void;
    onAddMembersClick?: (event: React.MouseEvent) => void;
    setIsToDoVisible: (value: boolean) => void;
    isToDoVisible: boolean;
}

export const ChatListItemActions: React.FC<ChatListItemActionsProps> = ({
    chat,
    myself,
    incompleteTodoCount,
    isPinned,
    onPinClick,
    onSplitClick,
    onAddMembersClick,
    setIsToDoVisible,
    isToDoVisible,
}) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    // Show add members option for DM and MDM chats (chatType 1 and 4)
    const showAddMembers = (chat.chatType === 1 || chat.chatType === 4) && onAddMembersClick;

    return (
        <Stack alignItems="center" direction="row">
            <Typography
                level="body-xs"
                sx={{ display: { xs: "none", md: "block" }, mt: 0.6, mr: 1 }}
                noWrap
            >
                {chat.latestMessage ? extractYYYYMMDDHHMM(chat.latestMessage.tsSent) : ""}
            </Typography>

            {/* To-Do Button */}
            {chat.dmPartnerUser.userId === myself.userId &&
                (isToDoVisible ? (
                    <AppTooltip size="sm" title={t.chat.listItem.backToChat}>
                        <IconButton
                            color="neutral"
                            component="a"
                            size="sm"
                            sx={{ mr: -1, mt: 0.6 }}
                            variant="plain"
                            onClick={() => setIsToDoVisible(false)}
                        >
                            <QuestionAnswerRoundedIcon />
                        </IconButton>
                    </AppTooltip>
                ) : (
                    <AppTooltip size="sm" title={t.chat.listItem.openTodo}>
                        <Badge
                            anchorOrigin={{ vertical: "top", horizontal: "right" }}
                            badgeContent={incompleteTodoCount}
                            color="primary"
                            size="sm"
                            sx={{ "& .JoyBadge-badge": { zIndex: 1 }, mt: 0.6 }}
                        >
                            <IconButton
                                color="neutral"
                                component="a"
                                size="sm"
                                sx={{ mr: -1 }}
                                variant="plain"
                                onClick={() => setIsToDoVisible(true)}
                            >
                                <ChecklistIcon />
                            </IconButton>
                        </Badge>
                    </AppTooltip>
                ))}

            {/* Pin Button */}
            <AppTooltip
                size="sm"
                title={chat.isPinned ? t.chat.listItem.unpinChat : t.chat.listItem.pinChat}
            >
                <IconButton
                    color={chat.isPinned ? "danger" : "neutral"}
                    component="a"
                    sx={{ mr: -1, mt: 0.6 }}
                    onClick={onPinClick}
                >
                    <PushPinIcon sx={{ fontSize: isPinned ? 18 : 16 }} />
                </IconButton>
            </AppTooltip>

            {/* Unread Indicator */}
            {/* PUNCH LIST (v3 chatId migration): `lastReadMessageId` is */}
            {/* `string` post-flip; `messageId` is still `number`. */}
            {/* Round-trip via `Number(... || "0")` — UUID-shaped cursors */}
            {/* NaN-compare to false (no false-positive unread dot). */}
            {chat.latestMessage &&
                Number(chat.lastReadMessageId || "0") < chat.latestMessage?.messageId && (
                    <CircleIcon color="primary" sx={{ mr: 0.5, fontSize: 12, mt: 0.5 }} />
                )}

            {/* More Options Menu */}
            <Dropdown>
                <MenuButton
                    slots={{ root: IconButton }}
                    slotProps={{
                        root: {
                            size: "sm",
                            variant: "plain",
                            color: "neutral",
                            sx: {
                                mt: 0.6,
                                borderRadius: "8px",
                                "&:hover": {
                                    background: isDark
                                        ? "rgba(255,255,255,0.08)"
                                        : "rgba(0,0,0,0.06)",
                                },
                            },
                        },
                    }}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                    <MoreHorizRoundedIcon sx={{ fontSize: 18 }} />
                </MenuButton>
                <Menu
                    placement="bottom-end"
                    size="sm"
                    sx={{
                        zIndex: 10010,
                        borderRadius: "10px",
                        minWidth: 160,
                        boxShadow: isDark
                            ? "0 8px 24px rgba(0,0,0,0.5)"
                            : "0 8px 24px rgba(0,0,0,0.12)",
                        background: isDark
                            ? "rgba(30, 30, 40, 0.98)"
                            : "rgba(255, 255, 255, 0.98)",
                        border: "1px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                    }}
                >
                    {/* Add Members Option (for DM and MDM chats) */}
                    {showAddMembers && (
                        <MenuItem
                            sx={{
                                borderRadius: "6px",
                                mx: 0.5,
                                gap: 1.5,
                                fontSize: "0.85rem",
                                py: 1,
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onAddMembersClick?.(e as unknown as React.MouseEvent);
                            }}
                        >
                            <PersonAddRoundedIcon
                                sx={{ fontSize: 18, color: isDark ? "#a78bfa" : "#7c3aed" }}
                            />
                            {t.chat.listItem.addMembersMenu}
                        </MenuItem>
                    )}

                    {/* Split View Option */}
                    <MenuItem
                        sx={{
                            borderRadius: "6px",
                            mx: 0.5,
                            gap: 1.5,
                            fontSize: "0.85rem",
                            py: 1,
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onSplitClick(e as unknown as React.MouseEvent);
                        }}
                    >
                        <SplitscreenIcon
                            sx={{ fontSize: 18, color: isDark ? "#a78bfa" : "#7c3aed" }}
                        />
                        {t.chat.listItem.openInSplitView}
                    </MenuItem>
                </Menu>
            </Dropdown>
        </Stack>
    );
};
