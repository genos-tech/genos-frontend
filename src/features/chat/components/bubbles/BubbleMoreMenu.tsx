import { useEffect, useState } from "react";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import ReplyRoundedIcon from "@mui/icons-material/ReplyRounded";
import { Box } from "@mui/joy";
import { Socket } from "socket.io-client";

import { MoreMenu, MoreMenuItem } from "../../../../components/ui/MoreMenu";
import { FlaggedService } from "../../../../db/services/flagged.service";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ChatProps, FlaggedMessageProps, MessageProps } from "../../../../types/chat";
import { addFlaggedMessage } from "../../services/addFlaggedMessage";
import { addMessage } from "../../services/addMessage";
import { updateFlagMessage } from "../../services/updateFlagMessage";
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
    setFlaggedMessages: (messages: FlaggedMessageProps[]) => void;
    setIsInEdit: (value: boolean) => void;
    socket: Socket | null;
    useCM: ChatManagementState;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    isSent: boolean;
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
    } = props;

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
            addFlaggedMessage({
                flaggedMessageId: `${chat.chatType}-${chat.chatId}-${0}-${message.messageId}`,
                chatType: chat.chatType,
                chatId: chat.chatId,
                threadId: 0,
                messageId: message.messageId,
                contentText: getFirstLine(message.content[0]),
                sender: message.sender,
                dmPartnerUser: chat.dmPartnerUser,
                project: chat.project,
                taskId: 0,
                tsSent: message.tsSent,
            } as FlaggedMessageProps);

            setFlaggedMessages([
                ...flaggedMessages,
                {
                    flaggedMessageId: `${chat.chatType}-${chat.chatId}-${0}-${message.messageId}`,
                    chatType: chat.chatType,
                    chatName: chat.chatName,
                    chatId: chat.chatId,
                    threadId: 0,
                    messageId: message.messageId,
                    contentText: getFirstLine(message.content[0]),
                    sender: message.sender,
                    dmPartnerUser: chat.dmPartnerUser,
                    project: chat.project,
                    taskId: 0,
                    tsSent: message.tsSent,
                },
            ]);
        } else {
            const flaggedService = new FlaggedService();
            flaggedService.deleteFlaggedMessage(
                `${chat.chatType}-${chat.chatId}-${0}-${message.messageId}`
            );

            setFlaggedMessages(
                flaggedMessages.filter(
                    (_message) =>
                        _message.flaggedMessageId !==
                        `${chat.chatType}-${chat.chatId}-${0}-${message.messageId}`
                )
            );
        }

        updateFlagMessage(accessToken, myself, {
            chat_type: chat.chatType,
            chat_id: chat.chatId,
            thread_id: 0,
            message_id: message.messageId,
        });

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
            const messageUrl = `${window.location.origin}/home/chat/${typePath}/${chat.chatId}/message/${message.messageId}`;
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

    const items: MoreMenuItem[] = [
        {
            id: "openTask",
            label: "Open task",
            icon: <OpenInNewRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleOpenTaskClick,
            visible: isProjectChat && isSystemMessage && message.taskId !== null,
        },
        {
            id: "reply",
            label: isProjectChat ? "Add comment to task" : "Reply in thread",
            icon: <ReplyRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleReplyClick,
        },
        {
            id: "flag",
            label: isFlagged ? "Remove flag" : "Flag for later",
            icon: <FlagRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleFlagClick,
            active: isFlagged,
        },
        {
            id: "copyLink",
            label: "Copy message link",
            icon: <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleCopyLinkClick,
        },
        {
            id: "edit",
            label: "Edit message",
            icon: <EditRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleEditClick,
            visible: isOwnMessage,
        },
        {
            id: "delete",
            label: "Delete message",
            icon: <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleDeleteClick,
            visible: canDelete,
            danger: true,
        },
    ];

    return (
        <Box sx={{ position: "relative" }}>
            <MoreMenu items={items} placement={isSent ? "bottom-end" : "bottom-start"} />

            <ModalDeleteMessage
                accessToken={accessToken}
                currentChat={chat}
                isThread={false}
                message={message}
                openDeleteMessage={openDeleteMessage}
                setCurrentChat={setCurrentChat}
                setOpenDeleteMessage={setOpenDeleteMessage}
                socket={socket}
                flaggedMessages={flaggedMessages}
                setFlaggedMessages={setFlaggedMessages}
            />
        </Box>
    );
};
