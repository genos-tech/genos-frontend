// `simple-import-sort` and the prettier import-sort plugin disagree on
// the order of `react` vs `@mui/...`. Prettier wins (it reformats on
// save); disable simple-import-sort.

import { Dispatch, SetStateAction, useEffect, useState } from "react";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import ReplyRoundedIcon from "@mui/icons-material/ReplyRounded";
import WrapTextIcon from "@mui/icons-material/WrapText";
import { Box } from "@mui/joy";
import { Socket } from "socket.io-client";

import { MoreMenu, MoreMenuItem } from "../../../../components/ui/MoreMenu";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { channelService } from "../../../../services/channel/channelService";
import { UserProps } from "../../../../types/admin";
import { ChatProps, FlaggedMessageProps, MessageProps } from "../../../../types/chat";
import { useMessageReminder } from "../../hooks/useMessageReminder";
import { formatReminderTime } from "../../utils/reminderPresets";
import { ModalDeleteMessage } from "../modals/ModalDeleteMessage";
import { ModalRemindMe } from "../modals/ModalRemindMe";

type BubbleMoreMenuProps = {
    accessToken: string | null;
    chat: ChatProps;
    flaggedMessages: FlaggedMessageProps[];
    message: MessageProps;
    myself: UserProps;
    replyHandler: (e?: React.MouseEvent) => void;
    setCurrentChat: (chat: ChatProps) => void;
    setEditTargetMessage: (value: MessageProps) => void;
    setFlaggedMessages: Dispatch<SetStateAction<FlaggedMessageProps[]>>;
    setIsInEdit: (value: boolean) => void;
    socket: Socket | null;
    useCM: ChatManagementState;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    isSent: boolean;
    // Per-bubble wrap toggles owned by the parent bubble. Adding/
    // removing the `bn-unwrap-all` / `bn-unwrap-code` class on the
    // bubble's preview wrapper triggers the same CSS rules used by
    // the editor toolbars.
    unwrapAll: boolean;
    setUnwrapAll: (value: boolean) => void;
    unwrapCode: boolean;
    setUnwrapCode: (value: boolean) => void;
    /** Notified when the embedded More menu opens/closes. */
    onMenuOpenChange?: (open: boolean) => void;
};

// Chat type to URL path mapping
const CHAT_TYPE_PATH: Record<number, string> = {
    1: "dm",
    2: "gm",
    3: "pm",
    4: "mdm",
};

export const BubbleMoreMenu = (props: BubbleMoreMenuProps) => {
    const {
        accessToken,
        chat,
        flaggedMessages,
        message,
        myself,
        replyHandler,
        setCurrentChat,
        setEditTargetMessage,
        setFlaggedMessages,
        setIsInEdit,
        socket,
        useCM,
        usePM,
        useTM,
        isSent,
        unwrapAll,
        setUnwrapAll,
        onMenuOpenChange,
        // `unwrapCode` / `setUnwrapCode` are still on the prop shape
        // (the wrap-code toggle menu item is commented out pending UX
        // review). They are intentionally not destructured here.
    } = props;

    const { t, locale } = useTranslation();
    const [openDeleteMessage, setOpenDeleteMessage] = useState(false);
    const [openRemindMe, setOpenRemindMe] = useState(false);
    const [isFlagged, setIsFlagged] = useState(message.isFlagged || false);
    const reminder = useMessageReminder(message.messageIdWithChatId);

    useEffect(() => {
        setIsFlagged(message.isFlagged || false);
    }, [message]);

    const handleFlagClick = () => {
        // v3 owns the flag state end-to-end. `channelService.flagMessage`
        // optimistically writes to `_flagByMessageId`, fires a notify,
        // and the existing v3 subscriptions in `useChatManagement`
        // re-derive `flaggedMessages` and re-adapt the current chat's
        // bubble `isFlagged` flags. No legacy IDB / sidebar plumbing
        // needed here.
        const v3MessageId = message.messageIdWithChatId;
        if (!v3MessageId) {
            return;
        }
        if (!isFlagged) {
            void channelService
                .flagMessage(v3MessageId)
                .catch((e) => console.error("[BubbleMoreMenu] flag failed:", e));
        } else {
            void channelService
                .unflagMessage(v3MessageId)
                .catch((e) => console.error("[BubbleMoreMenu] unflag failed:", e));
        }
        setIsFlagged(!isFlagged);
    };

    const handleReplyClick = () => {
        replyHandler();
    };

    const handleEditClick = () => {
        setIsInEdit(true);
        setEditTargetMessage(message);
    };

    const handleOpenTaskClick = () => {
        if (message.taskId !== null) {
            useCM.setIsMainChatVisible(true);
            useCM.setIsThreadVisible(false);
            useTM.setIsTaskPreviewVisible(true);
            useTM.setIsCreatingTask({ ...useTM.isCreatingTask, flag: false });
            useTM.setCurrentPreviewTaskId(message.taskId);

            if (message.project && message.project.projectId) {
                usePM.setCurrentProject(message.project);
            }
        }
    };

    const handleDeleteClick = () => {
        setOpenDeleteMessage(true);
    };

    const handleCopyLinkClick = async () => {
        const typePath = CHAT_TYPE_PATH[chat.chatType];
        if (typePath) {
            const messageUrl = `${window.location.origin}/workspace/chat/${typePath}/${chat.chatId}/message/${message.messageId}`;
            try {
                await navigator.clipboard.writeText(messageUrl);
            } catch (err) {
                console.error("Failed to copy link:", err);
            }
        }
    };

    const isOwnMessage = message.sender.userId === myself.userId;
    const isSystemMessage = message.sender.isSystemUser === true;
    const isProjectChat = chat.chatType === 3;
    const canDelete = message.numReplies < 2 && isOwnMessage;

    // Keys sorted alphabetically (case-insensitive) per `sort-keys`.
    const items: MoreMenuItem[] = [
        {
            icon: <OpenInNewRoundedIcon sx={{ fontSize: 18 }} />,
            id: "openTask",
            label: t.chat.messageActions.openTask,
            onClick: handleOpenTaskClick,
            visible: isProjectChat && isSystemMessage && message.taskId !== null,
        },
        {
            icon: <ReplyRoundedIcon sx={{ fontSize: 18 }} />,
            id: "reply",
            label: isProjectChat
                ? t.chat.messageActions.addCommentToTask
                : t.chat.messageActions.replyInThread,
            onClick: handleReplyClick,
        },
        {
            active: isFlagged,
            icon: <FlagRoundedIcon sx={{ fontSize: 18 }} />,
            id: "flag",
            label: isFlagged
                ? t.chat.messageActions.removeFlag
                : t.chat.messageActions.flagForLater,
            onClick: handleFlagClick,
        },
        {
            // Sits right below the flag: it IS the flag, with a time on it.
            // A set reminder shows the time in the label rather than a
            // generic "Remind me", so the menu answers "when?" without
            // making the user open the picker to find out.
            active: reminder !== null,
            icon: <NotificationsActiveRoundedIcon sx={{ fontSize: 18 }} />,
            id: "remindMe",
            label: reminder
                ? fmt(t.chat.messageActions.reminderSetFor, {
                      time: formatReminderTime(new Date(reminder.remindAt), locale),
                  })
                : t.chat.messageActions.remindMe,
            onClick: () => setOpenRemindMe(true),
            // A reminder is keyed by the v3 message id; without one there is
            // nothing to hand back to the user later. Same condition that
            // gates the dialog below, so the item can't open an empty modal.
            visible: Boolean(message.messageIdWithChatId),
        },
        {
            icon: <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />,
            id: "copyLink",
            label: t.chat.messageActions.copyMessageLink,
            onClick: handleCopyLinkClick,
        },
        {
            active: unwrapAll,
            icon: <WrapTextIcon sx={{ fontSize: 18 }} />,
            id: "unwrapAll",
            label: unwrapAll ? t.chat.messageActions.wrapAll : t.chat.messageActions.unwrapAll,
            onClick: () => setUnwrapAll(!unwrapAll),
        },
        // {
        //     id: "unwrapCode",
        //     label: unwrapCode ? t.chat.messageActions.wrapCode : t.chat.messageActions.unwrapCode,
        //     icon: <CodeIcon sx={{ fontSize: 18 }} />,
        //     onClick: () => setUnwrapCode(!unwrapCode),
        //     active: unwrapCode,
        // },
        {
            icon: <EditRoundedIcon sx={{ fontSize: 18 }} />,
            id: "edit",
            label: t.chat.messageActions.editMessage,
            onClick: handleEditClick,
            visible: isOwnMessage,
        },
        {
            danger: true,
            icon: <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />,
            id: "delete",
            label: t.chat.messageActions.deleteMessage,
            onClick: handleDeleteClick,
            visible: canDelete,
        },
    ];

    return (
        <Box sx={{ position: "relative" }}>
            <MoreMenu
                items={items}
                placement={isSent ? "bottom-end" : "bottom-start"}
                onOpenChange={onMenuOpenChange}
            />

            <ModalDeleteMessage
                accessToken={accessToken}
                currentChat={chat}
                flaggedMessages={flaggedMessages}
                isThread={false}
                message={message}
                openDeleteMessage={openDeleteMessage}
                setCurrentChat={setCurrentChat}
                setFlaggedMessages={setFlaggedMessages}
                setOpenDeleteMessage={setOpenDeleteMessage}
                socket={socket}
            />

            {message.messageIdWithChatId && (
                <ModalRemindMe
                    messageId={message.messageIdWithChatId}
                    open={openRemindMe}
                    reminder={reminder}
                    onClose={() => setOpenRemindMe(false)}
                />
            )}
        </Box>
    );
};
