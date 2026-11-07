import React from "react";
import ChecklistIcon from "@mui/icons-material/Checklist";
import CircleIcon from "@mui/icons-material/Circle";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import PushPinIcon from "@mui/icons-material/PushPin";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
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

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { NAV_KEEP_CLASS } from "../../../../components/ui/nav/navStyles";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
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
    onManageTagsClick?: (event: React.MouseEvent) => void;
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
    onManageTagsClick,
    setIsToDoVisible,
    isToDoVisible,
}) => {
    const { t } = useTranslation();

    // Show add members option for DM and MDM chats (chatType 1 and 4)
    const showAddMembers = (chat.chatType === 1 || chat.chatType === 4) && onAddMembersClick;
    // Personal tags are a GM-only surface (chatType 2)
    const showManageTags = chat.chatType === 2 && onManageTagsClick;

    return (
        <>
            {/* To-Do Button */}
            {chat.dmPartnerUser.userId === myself.userId &&
                (isToDoVisible ? (
                    <AppTooltip size="sm" title={t.chat.listItem.backToChat}>
                        <IconButton
                            className={NAV_KEEP_CLASS}
                            color="neutral"
                            size="sm"
                            variant="plain"
                            onClick={() => setIsToDoVisible(false)}
                        >
                            <QuestionAnswerRoundedIcon />
                        </IconButton>
                    </AppTooltip>
                ) : (
                    <AppTooltip size="sm" title={t.chat.listItem.openTodo}>
                        <Badge
                            // The open to-do count is state, like a pin: it stays showing.
                            anchorOrigin={{ vertical: "top", horizontal: "right" }}
                            badgeContent={incompleteTodoCount}
                            className={incompleteTodoCount > 0 ? NAV_KEEP_CLASS : undefined}
                            color="primary"
                            size="sm"
                            sx={{ "& .JoyBadge-badge": { zIndex: 1 } }}
                        >
                            <IconButton
                                color="neutral"
                                size="sm"
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
                    // A pinned chat keeps its pin showing (state, not just an action).
                    className={chat.isPinned ? NAV_KEEP_CLASS : undefined}
                    color={chat.isPinned ? "danger" : "neutral"}
                    size="sm"
                    // AppTooltip's own surface style (a 1px border) reaches its child;
                    // the pin is a plain icon button.
                    sx={{ border: "none", borderRadius: g.radius.sm }}
                    variant="plain"
                    onClick={onPinClick}
                >
                    <PushPinIcon sx={{ fontSize: isPinned ? 18 : 16 }} />
                </IconButton>
            </AppTooltip>

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
                                borderRadius: g.radius.sm,
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
                        borderRadius: g.radius.md,
                        minWidth: 160,
                        boxShadow: g.shadow.md,
                        background: g.surface.raised,
                        border: `1px solid ${g.border.subtle}`,
                    }}
                >
                    {/* Split View Option — opening leads (moreMenuOrder.ts). Members and
                        Tags below never both show, so their relative order is moot. */}
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
                            sx={{
                                fontSize: 18,
                                color: g.accent.text,
                            }}
                        />
                        {t.chat.listItem.openInSplitView}
                    </MenuItem>

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
                                sx={{
                                    fontSize: 18,
                                    color: g.accent.text,
                                }}
                            />
                            {t.chat.listItem.addMembersMenu}
                        </MenuItem>
                    )}

                    {/* Personal Tags Option (GM chats only) */}
                    {showManageTags && (
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
                                onManageTagsClick?.(e as unknown as React.MouseEvent);
                            }}
                        >
                            <SellOutlinedIcon
                                sx={{
                                    fontSize: 18,
                                    color: g.accent.text,
                                }}
                            />
                            {t.chat.listItem.manageTagsMenu}
                        </MenuItem>
                    )}
                </Menu>
            </Dropdown>
        </>
    );
};

/**
 * What a chat row always shows at its end, whatever the pointer does: the time
 * of the latest message (wide screens) and the unread dot. Not an action, so it
 * lives in the row's `trailing` slot and is never hidden.
 */
export const ChatListItemMeta: React.FC<{ chat: AllChatProps }> = ({ chat }) => {
    // PUNCH LIST (v3 chatId migration): `lastReadMessageId` is `string`
    // post-flip; `messageId` is still `number`. Round-trip via
    // `Number(... || "0")` — UUID-shaped cursors NaN-compare to false
    // (no false-positive unread dot).
    const hasUnread =
        chat.latestMessage && Number(chat.lastReadMessageId || "0") < chat.latestMessage.messageId;
    const time = chat.latestMessage ? extractYYYYMMDDHHMM(chat.latestMessage.tsSent) : "";
    return (
        <Stack alignItems="center" direction="row" spacing={0.75}>
            {time && (
                <Typography
                    level="body-xs"
                    sx={{ display: { xs: "none", md: "block" }, color: g.text.tertiary }}
                    noWrap
                >
                    {time}
                </Typography>
            )}
            {hasUnread && <CircleIcon color="primary" sx={{ fontSize: 10 }} />}
        </Stack>
    );
};
