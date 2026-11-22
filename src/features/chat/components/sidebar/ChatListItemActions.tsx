import React, { useState } from "react";
import ChecklistIcon from "@mui/icons-material/Checklist";
import CircleIcon from "@mui/icons-material/Circle";
import DeleteForeverRoundedIcon from "@mui/icons-material/DeleteForeverRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import PushPinIcon from "@mui/icons-material/PushPin";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import SplitscreenIcon from "@mui/icons-material/Splitscreen";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { Badge, Dropdown, IconButton, MenuButton, Stack, Typography } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { toast } from "../../../../components/ui/feedback/toastStore";
import { ForceDeleteDialog } from "../../../../components/ui/modal/ForceDeleteDialog";
import { MenuRow, MenuSurface } from "../../../../components/ui/MoreMenu";
import {
    NAV_HIDE_ON_ACTIONS_CLASS,
    NAV_KEEP_CLASS,
} from "../../../../components/ui/nav/navStyles";
import { anchoredTallHitAreaSx } from "../../../../components/ui/touchTargets";
import { useOptionalAccessToken } from "../../../../context/AuthContext";
import { useTranslation } from "../../../../i18n";
import { channelService } from "../../../../services/channel/channelService";
import { forceDeleteAllMyMessages } from "../../../../services/forceDelete";
import { g } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";
import { extractYYYYMMDDHHMM } from "../../../../utils/dateUtils";

// The pin and "..." are 32px buttons side by side: on a touch screen each is a 44px-tall tap,
// invisible and exactly as wide as the button, so the two never cover each other (MIP-1455).
const TOUCH_ACTION_SX = anchoredTallHitAreaSx("&");

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
    const accessToken = useOptionalAccessToken();
    const [openForceDelete, setOpenForceDelete] = useState(false);
    // "Delete all my messages" (MIP-1584): a DM or a multi-person DM only. Each person deletes
    // their own side; the other person's messages and the chat stay.
    const showDeleteMine = chat.chatType === 1 || chat.chatType === 4;

    // "Remove from sidebar" (MIP-1414): hides the chat for this person only, deletes nothing, and
    // a new message brings it back. The row leaves the list at once; a refusal puts it back.
    const removeFromSidebar = async () => {
        try {
            await channelService.hideChannel(String(chat.chatId));
            toast.success(t.chat.listItem.removedFromSidebar);
        } catch {
            toast.error(t.chat.listItem.removeFromSidebarFailed);
        }
    };

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
                    sx={{ borderRadius: g.radius.sm, ...TOUCH_ACTION_SX }}
                    variant="plain"
                    onClick={onPinClick}
                >
                    <PushPinIcon sx={{ fontSize: isPinned ? 18 : 16 }} />
                </IconButton>
            </AppTooltip>

            {/* More Options Menu */}
            <Dropdown>
                <MenuButton
                    aria-label={t.common.ui.moreMenu.ariaLabel}
                    slots={{ root: IconButton }}
                    slotProps={{
                        root: {
                            size: "sm",
                            variant: "plain",
                            color: "neutral",
                            sx: {
                                borderRadius: g.radius.sm,
                                ...TOUCH_ACTION_SX,
                            },
                        },
                    }}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                    <MoreHorizRoundedIcon sx={{ fontSize: 18 }} />
                </MenuButton>
                <MenuSurface placement="bottom-end" zIndex={10010}>
                    {/* Split View Option — opening leads (moreMenuOrder.ts). Members and
                        Tags below never both show, so their relative order is moot. */}
                    <MenuRow
                        icon={<SplitscreenIcon />}
                        onClick={(e) => onSplitClick(e as unknown as React.MouseEvent)}
                    >
                        {t.chat.listItem.openInSplitView}
                    </MenuRow>

                    {/* Add Members Option (for DM and MDM chats) */}
                    {showAddMembers && (
                        <MenuRow
                            icon={<PersonAddRoundedIcon />}
                            onClick={(e) => onAddMembersClick?.(e as unknown as React.MouseEvent)}
                        >
                            {t.chat.listItem.addMembersMenu}
                        </MenuRow>
                    )}

                    {showDeleteMine && (
                        <MenuRow
                            icon={<VisibilityOffOutlinedIcon />}
                            title={t.chat.listItem.removeFromSidebarHint}
                            onClick={(e) => {
                                e.stopPropagation();
                                void removeFromSidebar();
                            }}
                        >
                            {t.chat.listItem.removeFromSidebar}
                        </MenuRow>
                    )}

                    {showDeleteMine && (
                        <MenuRow
                            icon={<DeleteForeverRoundedIcon />}
                            danger
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpenForceDelete(true);
                            }}
                        >
                            {t.common.forceDelete.myMessagesMenu}
                        </MenuRow>
                    )}

                    {/* Personal Tags Option (GM chats only) */}
                    {showManageTags && (
                        <MenuRow
                            icon={<SellOutlinedIcon />}
                            onClick={(e) => onManageTagsClick?.(e as unknown as React.MouseEvent)}
                        >
                            {t.chat.listItem.manageTagsMenu}
                        </MenuRow>
                    )}
                </MenuSurface>
            </Dropdown>
            {showDeleteMine && (
                <ForceDeleteDialog
                    description={t.common.forceDelete.myMessagesDescription}
                    open={openForceDelete}
                    title={t.common.forceDelete.myMessagesTitle}
                    zIndex={10020}
                    onClose={() => setOpenForceDelete(false)}
                    onConfirm={async () => {
                        await forceDeleteAllMyMessages(accessToken, String(chat.chatId));
                        try {
                            await channelService.hideChannel(String(chat.chatId));
                            toast.success(t.common.forceDelete.myMessagesDone);
                        } catch {
                            // The messages ARE gone; only the removal failed, so do not
                            // reject (the dialog would claim the delete failed).
                            toast.error(t.chat.listItem.deletedButNotRemoved);
                        }
                    }}
                />
            )}
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
                    className={NAV_HIDE_ON_ACTIONS_CLASS}
                    level="body-xs"
                    // The time stays on a phone too: when a message came is core to a chat row (MIP-1177).
                    sx={{ color: g.text.tertiary }}
                    noWrap
                >
                    {time}
                </Typography>
            )}
            {hasUnread && <CircleIcon color="primary" sx={{ fontSize: 10 }} />}
        </Stack>
    );
};
