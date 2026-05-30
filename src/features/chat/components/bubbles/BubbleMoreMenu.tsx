// `simple-import-sort` and the prettier import-sort plugin disagree on
// the order of `react` vs `@mui/...`. Prettier wins (it reformats on
// save); disable simple-import-sort.
/* eslint-disable simple-import-sort/imports */
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import ReplyRoundedIcon from "@mui/icons-material/ReplyRounded";
import WrapTextIcon from "@mui/icons-material/WrapText";
import { Box } from "@mui/joy";
import { Socket } from "socket.io-client";

import { MoreMenu, MoreMenuItem } from "../../../../components/ui/MoreMenu";
import { FlaggedService } from "../../../../db/services/flagged.service";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { channelService } from "../../../../services/channel/channelService";
import { UserProps } from "../../../../types/admin";
import { ChatProps, FlaggedMessageProps, MessageProps } from "../../../../types/chat";
import { addFlaggedMessage } from "../../services/addFlaggedMessage";
import { addMessage } from "../../services/addMessage";
import { getFirstLine } from "../../utils/common";
import { ModalDeleteMessage } from "../modals/ModalDeleteMessage";

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
        // `unwrapCode` / `setUnwrapCode` are still on the prop shape
        // (the wrap-code toggle menu item is commented out pending UX
        // review). They are intentionally not destructured here.
    } = props;

    const { t } = useTranslation();
    const [openDeleteMessage, setOpenDeleteMessage] = useState(false);
    const [isFlagged, setIsFlagged] = useState(message.isFlagged || false);

    useEffect(() => {
        setIsFlagged(message.isFlagged || false);
    }, [message]);

    const handleFlagClick = () => {
        setCurrentChat({
            ...chat,
            messages: chat.messages.map((m) => ({
                ...m,
                isFlagged: m.messageId === message.messageId ? !m.isFlagged : m.isFlagged,
            })),
        });
        addMessage({ ...message, isFlagged: !isFlagged } as MessageProps, chat.chatType);

        if (!isFlagged) {
            // PUNCH LIST (v3 chatId migration): `FlaggedMessageProps.chatId`
            // is still `number` (the persistence layer + the legacy
            // `/chat/flagged-update/` endpoint key by integer ids).
            // `chat.chatId` is `string` post-v3 flip — bridge via the
            // `unknown` cast. Same runtime gap as `useHistoryTracker`:
            // v3-shaped UUID chatIds round-trip as string-disguised-as-
            // number through the flagged store. Fix properly by flipping
            // `FlaggedMessageProps.chatId` to string in a follow-on.
            // Keys sorted alphabetically per `sort-keys`.
            const flaggedRow = {
                chatId: chat.chatId,
                chatName: chat.chatName,
                chatType: chat.chatType,
                contentText: getFirstLine(message.content[0]),
                dmPartnerUser: chat.dmPartnerUser,
                flaggedMessageId: `${chat.chatType}-${chat.chatId}-${0}-${message.messageId}`,
                messageId: message.messageId,
                project: chat.project,
                sender: message.sender,
                taskId: 0,
                threadId: 0,
                tsSent: message.tsSent,
            } as unknown as FlaggedMessageProps;
            addFlaggedMessage(flaggedRow);

            // Functional updater reads the latest list at call time — required
            // for the parent bubble's React.memo to remain safe (we no longer
            // close over `flaggedMessages` at render time).
            setFlaggedMessages((prev) => [...prev, flaggedRow]);
        } else {
            const flaggedService = new FlaggedService();
            flaggedService.deleteFlaggedMessage(
                `${chat.chatType}-${chat.chatId}-${0}-${message.messageId}`
            );

            // Functional updater — see the spread case above for why.
            setFlaggedMessages((prev) =>
                prev.filter(
                    (_message) =>
                        _message.flaggedMessageId !==
                        `${chat.chatType}-${chat.chatId}-${0}-${message.messageId}`
                )
            );
        }

        // v3 flag persistence routes through channelService — the v3
        // backend's `Flag` model keys by the message UUID. Optimistic
        // state above already toggled; broadcast to other tabs +
        // persist via `flag.add` / `flag.remove`. The optimistic
        // `_upsertFlag` inside channelService deduplicates against
        // the server's `flag.added` echo, so re-receiving our own
        // emit is a no-op.
        const v3MessageId = message.messageIdWithChatId;
        if (v3MessageId) {
            if (!isFlagged) {
                void channelService
                    .flagMessage(v3MessageId)
                    .catch((e) => console.error("[BubbleMoreMenu] flag failed:", e));
            } else {
                void channelService
                    .unflagMessage(v3MessageId)
                    .catch((e) => console.error("[BubbleMoreMenu] unflag failed:", e));
            }
        } else {
            console.warn("[BubbleMoreMenu] missing v3 messageUuid — flag not persisted");
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
            <MoreMenu items={items} placement={isSent ? "bottom-end" : "bottom-start"} />

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
        </Box>
    );
};
