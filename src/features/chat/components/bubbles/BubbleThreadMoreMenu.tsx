import { Dispatch, SetStateAction, useEffect, useState } from "react";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import CodeIcon from "@mui/icons-material/Code";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import WrapTextIcon from "@mui/icons-material/WrapText";
import { Box } from "@mui/joy";
import { Socket } from "socket.io-client";

import { MoreMenu } from "../../../../components/ui/MoreMenu";
import { MoreMenuKind } from "../../../../components/ui/moreMenuOrder";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import {
    PinnableBubbleAction,
    useBubbleActionsPreference,
} from "../../../../hooks/common/useBubbleActionsPreference";
import { fmt, useTranslation } from "../../../../i18n";
import { channelService } from "../../../../services/channel/channelService";
import { UserProps } from "../../../../types/admin";
import { FlaggedMessageProps, ThreadMessageProps, ThreadProps } from "../../../../types/chat";
import { useMessageReminder } from "../../hooks/useMessageReminder";
import { formatReminderTime } from "../../utils/reminderPresets";
import { ModalDeleteMessage } from "../modals/ModalDeleteMessage";
import { ModalRemindMe } from "../modals/ModalRemindMe";
import { BubblePinnedActions, PinnedBubbleAction, splitPinned } from "./BubblePinnedActions";
import { MARK_DONE_ACTION, pinnedForFlagState, withMarkDone } from "./markDoneAction";

type BubbleThreadMoreMenuProps = {
    accessToken: string | null;
    currentMessageIndex: number;
    flaggedMessages: FlaggedMessageProps[];
    message: ThreadMessageProps;
    myself: UserProps;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    setEditTargetMessage: (value: ThreadMessageProps) => void;
    setFlaggedMessages: Dispatch<SetStateAction<FlaggedMessageProps[]>>;
    setIsInEdit: (value: boolean) => void;
    setTargetMessageIndex: (value: number) => void;
    socket: Socket | null;
    thread: ThreadProps;
    useCM: ChatManagementState;
    isSent: boolean;
    // Per-bubble wrap toggles owned by the parent thread-bubble.
    unwrapAll: boolean;
    setUnwrapAll: (value: boolean) => void;
    unwrapCode: boolean;
    setUnwrapCode: (value: boolean) => void;
    /** Notified while this menu owns something on screen — the menu itself
     *  or a dialog opened from it. The parent keeps the hover toolbar
     *  mounted for as long as this is `true`; see `overlayOpen` below. */
    onMenuOpenChange?: (open: boolean) => void;
};

type MenuItemConfig = {
    id: string;
    kind: MoreMenuKind;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    visible: boolean;
    danger?: boolean;
    active?: boolean;
};

export const BubbleThreadMoreMenu = (props: BubbleThreadMoreMenuProps) => {
    const {
        accessToken,
        currentMessageIndex,
        flaggedMessages,
        message,
        myself,
        setCurrentThreadChat,
        setEditTargetMessage,
        setFlaggedMessages,
        setIsInEdit,
        setTargetMessageIndex,
        socket,
        thread,
        useCM,
        isSent,
        unwrapAll,
        setUnwrapAll,
        unwrapCode,
        setUnwrapCode,
        onMenuOpenChange,
    } = props;

    const { t, locale } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [openDeleteMessage, setOpenDeleteMessage] = useState(false);
    const [openRemindMe, setOpenRemindMe] = useState(false);
    const [isFlagged, setIsFlagged] = useState(message.isFlagged || false);
    const reminder = useMessageReminder(message.messageIdWithChatIdAndThreadId);
    const { pinned } = useBubbleActionsPreference();

    useEffect(() => {
        setIsFlagged(message.isFlagged || false);
    }, [message]);

    // Same reasoning as `BubbleMoreMenu.overlayOpen`: this menu and its
    // dialogs sit inside a toolbar the parent unmounts the moment the
    // cursor leaves the bubble, and a dialog outlives the menu that opened
    // it. Without this the reminder dialog vanished as soon as the user
    // moved the mouse towards the date picker.
    const overlayOpen = isOpen || openRemindMe || openDeleteMessage;
    useEffect(() => {
        onMenuOpenChange?.(overlayOpen);
    }, [overlayOpen, onMenuOpenChange]);

    const handleFlagClick = () => {
        // v3 owns the flag state end-to-end. Same pattern as
        // BubbleMoreMenu — thread message UUID lives on
        // `messageIdWithChatIdAndThreadId` (set by
        // `v3ThreadMessageToLegacy`). channelService notify drives the
        // v3 subscriptions in useChatManagement which re-derive the
        // thread chat's `isFlagged` bubble flags and the sidebar
        // `flaggedMessages` list automatically.
        const v3MessageId = message.messageIdWithChatIdAndThreadId;
        if (!v3MessageId) return;
        if (!isFlagged) {
            void channelService
                .flagMessage(v3MessageId)
                .catch((e) => console.error("[BubbleThreadMoreMenu] flag failed:", e));
        } else {
            void channelService
                .unflagMessage(v3MessageId)
                .catch((e) => console.error("[BubbleThreadMoreMenu] unflag failed:", e));
        }
        setIsFlagged(!isFlagged);
    };

    // Finish the flag (MIP-1423): the same call as the Flagged list's Mark done.
    const handleMarkDoneClick = () => {
        const v3MessageId = message.messageIdWithChatIdAndThreadId;
        if (!v3MessageId) return;
        void channelService
            .completeFlag(v3MessageId)
            .catch((e) => console.error("[BubbleThreadMoreMenu] mark done failed:", e));
        setIsFlagged(false);
    };

    const handleEditClick = () => {
        setIsInEdit(true);
        setEditTargetMessage(message);
        setTargetMessageIndex(currentMessageIndex);
    };

    const handleDeleteClick = () => {
        setOpenDeleteMessage(true);
    };

    // Chat type to URL path mapping
    const CHAT_TYPE_PATH: Record<number, string> = {
        1: "dm",
        2: "gm",
        3: "pm",
        4: "mdm",
    };

    const handleCopyLinkClick = async () => {
        const typePath = CHAT_TYPE_PATH[thread.chatType];
        if (typePath) {
            const threadId =
                thread.chatType === 3 && thread.taskId ? thread.taskId : thread.threadId;
            const messageUrl = `${window.location.origin}/workspace/chat/${typePath}/${thread.chatId}/thread/${threadId}/message/${message.messageId}`;
            try {
                await navigator.clipboard.writeText(messageUrl);
            } catch (err) {
                console.error("Failed to copy link:", err);
            }
        }
    };

    // Check conditions for showing each menu item
    const isOwnMessage = message.sender.userId === myself.userId;
    const canDelete = message.messageId !== 1 && isOwnMessage;

    // Display order comes from `kind` (via `splitPinned`), not from this array.
    const menuItems: MenuItemConfig[] = [
        {
            id: "copyLink",
            kind: "copyLink",
            label: t.chat.messageActions.copyMessageLink,
            icon: <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleCopyLinkClick,
            visible: true,
        },
        {
            id: "unwrapAll",
            kind: "unwrapAll",
            label: unwrapAll ? t.chat.messageActions.wrapAll : t.chat.messageActions.unwrapAll,
            icon: <WrapTextIcon sx={{ fontSize: 18 }} />,
            onClick: () => setUnwrapAll(!unwrapAll),
            visible: true,
            active: unwrapAll,
        },
        {
            id: "unwrapCode",
            kind: "unwrapCode",
            label: unwrapCode ? t.chat.messageActions.wrapCode : t.chat.messageActions.unwrapCode,
            icon: <CodeIcon sx={{ fontSize: 18 }} />,
            onClick: () => setUnwrapCode(!unwrapCode),
            visible: true,
            active: unwrapCode,
        },
        {
            id: "flag",
            kind: "flag",
            label: isFlagged
                ? t.chat.messageActions.removeFlag
                : t.chat.messageActions.flagForLater,
            icon: <FlagRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleFlagClick,
            visible: true,
            active: isFlagged,
        },
        {
            // The flag with a time on it, so it sits with the flag. Amber
            // like an unset flag when there's nothing scheduled; violet
            // once something is, because then it is a promise the app has
            // made rather than an action on offer.
            id: "remindMe",
            kind: "remindMe",
            label: reminder
                ? fmt(t.chat.messageActions.reminderSetFor, {
                      time: formatReminderTime(new Date(reminder.remindAt), locale),
                  })
                : t.chat.messageActions.remindMe,
            icon: <NotificationsActiveRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: () => setOpenRemindMe(true),
            // Same condition that gates the dialog below, so the item can't
            // open an empty modal.
            visible: Boolean(message.messageIdWithChatIdAndThreadId),
            active: reminder !== null,
        },
        {
            id: "edit",
            kind: "edit",
            label: t.chat.messageActions.editMessage,
            icon: <EditRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleEditClick,
            visible: isOwnMessage,
        },
        {
            id: "delete",
            kind: "delete",
            label: t.chat.messageActions.deleteMessage,
            icon: <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleDeleteClick,
            visible: canDelete,
            danger: true,
        },
    ];

    // Actions the user pinned (Settings → Chat) sit on the toolbar beside the
    // "…"; the dropdown, and arrow-key navigation through it, keep the rest.
    // While the message is flagged, Mark done takes the flag's toolbar slot and the flag
    // ("Remove flag") stays in the menu, whatever was pinned (MIP-1423).
    const { pinnedItems, menuItems: dropdownItems } = splitPinned(
        menuItems,
        pinnedForFlagState(pinned, isFlagged)
    );

    // A pinned action keeps this menu's own handler (and the dialogs below).
    const markDone: PinnedBubbleAction | null =
        isFlagged && message.messageIdWithChatIdAndThreadId
            ? {
                  icon: <CheckCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />,
                  id: MARK_DONE_ACTION,
                  label: t.chat.listItem.completeFlag,
                  onClick: handleMarkDoneClick,
              }
            : null;
    const pinnedActions = withMarkDone(
        pinnedItems.map((item) => ({
            active: item.active,
            danger: item.danger,
            icon: item.icon,
            id: item.id as PinnableBubbleAction,
            label: item.label,
            onClick: item.onClick,
        })),
        markDone
    );

    return (
        <Box sx={{ position: "relative", display: "flex", alignItems: "center", gap: 0.5 }}>
            <BubblePinnedActions actions={pinnedActions} />
            {/* The "…" menu: the shared MoreMenu (surface, rows, keyboard, layer).
                Always there while something is left in it (Unwrap code can't be
                pinned, so on a thread reply that holds). */}
            {dropdownItems.length > 0 && (
                <MoreMenu
                    items={dropdownItems}
                    placement={isSent ? "bottom-end" : "bottom-start"}
                    onOpenChange={setIsOpen}
                />
            )}

            {/* Delete Confirmation Modal */}
            <ModalDeleteMessage
                accessToken={accessToken}
                currentThreadChat={thread}
                flaggedMessages={flaggedMessages}
                isThread={true}
                message={message}
                openDeleteMessage={openDeleteMessage}
                setCurrentThreadChat={useCM.setCurrentThreadChat}
                setFlaggedMessages={setFlaggedMessages}
                setOpenDeleteMessage={setOpenDeleteMessage}
                socket={socket}
            />

            {message.messageIdWithChatIdAndThreadId && (
                <ModalRemindMe
                    open={openRemindMe}
                    remindAt={reminder?.remindAt}
                    onClose={() => setOpenRemindMe(false)}
                    onCommit={(at) =>
                        channelService.setReminder(message.messageIdWithChatIdAndThreadId!, at)
                    }
                    onRemove={() =>
                        channelService.cancelReminder(message.messageIdWithChatIdAndThreadId!)
                    }
                />
            )}
        </Box>
    );
};
