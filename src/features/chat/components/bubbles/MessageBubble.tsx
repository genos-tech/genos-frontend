import * as React from "react";
import { Box, Stack, Sheet } from "@mui/joy";
import { Socket } from "socket.io-client";

import { loadSpecificThreadMessages } from "../../services/loadSpecificThreadMessages";
import { BubbleEditButton } from "./BubbleEditButton";
import { BubbleOpenTaskButton } from "./BubbleOpenTaskButton";
import { BubbleUserName } from "./BubbleUserName";
import { BubbleReplyButton } from "./BubbleReplyButton";
import { BubbleReplyCounterButton } from "./BubbleReplyCounterButton";
import { BubbleAttachmentSheet } from "./BubbleAttachmentSheet";
import { loadSpecificTaskByThreadId } from "../../../tasks/services/loadSpecificTaskByThreadId";
import { extractHHMM, getCurrentTimestamp } from "../../../../utils/dateUtils";
import { UserProps } from "../../../../types/admin";
import { ChatProps, MessageProps, ThreadProps, ThreadMessageProps } from "../../../../types/chat";
import { TaskProps, ProjectProps } from "../../../../types/tasks";
import { useAuth } from "../../../../context/AuthContext";
import { BnChatPreview } from "../../../../components/blockNote/bnChatPreview";
import { AvatarWithStatus } from "../../../../components/utils/avatarWithStatus";

type MessageBubbleProps = {
    myself: UserProps;
    variant: "sent" | "received";
    chat: ChatProps;
    message: MessageProps;
    socket: Socket | null;
    setIsMainChatVisible: (value: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
    setCurrentThreadChat: (value: ThreadProps) => void;
    setIsTaskCreationVisible: (value: boolean) => void;
    setIsTaskPreviewVisible: (value: boolean) => void;
    setCurrentPreviewTask: (value: TaskProps | undefined) => void;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    setIsOpeningTask: (value: boolean) => void;
    setCurrentPreviewTaskId: (value: number) => void;
    setCurrentProject: (value: ProjectProps) => void;
    setIsInEdit: (value: boolean) => void;
    setEditTargetMessage: (value: MessageProps) => void;
    currentMessageIndex: number;
    setTargetMessageIndex: (value: number) => void;
};

export const MessageBubble = (props: MessageBubbleProps) => {
    const {
        myself,
        variant,
        chat,
        message,
        socket,
        setIsMainChatVisible,
        setIsThreadVisible,
        setCurrentPreviewTask,
        setIsTaskPreviewVisible,
        setIsTaskCreationVisible,
        setCurrentThreadChat,
        setOpeningService,
        setCurrentMainChat,
        setIsOpeningTask,
        setCurrentPreviewTaskId,
        setCurrentProject,
        setIsInEdit,
        setEditTargetMessage,
        currentMessageIndex,
        setTargetMessageIndex,
    } = props;
    const isSent = variant === "sent";
    const [isLiked, setIsLiked] = React.useState<boolean>(false);
    const dtSent = extractHHMM(message.tsSent);
    const { accessToken } = useAuth();

    // Load the thread task if exists
    const loadTask = (threadId: number) => {
        (async () => {
            const loadedTask: TaskProps[] = await loadSpecificTaskByThreadId(
                myself,
                chat.chatType,
                chat.chatId,
                threadId,
                accessToken
            );
            if (loadedTask.length > 0) {
                setCurrentPreviewTask(loadedTask[0]);
            }
        })();
    };

    const replayHandler = () => {
        loadTask(message.messageId);

        // Show thread pane on the right side.
        setIsMainChatVisible(true);
        setIsThreadVisible(true);
        setIsTaskPreviewVisible(false);
        setIsTaskCreationVisible(false);

        if (message.taskId) {
            setCurrentPreviewTaskId(message.taskId);
        } else {
            setCurrentPreviewTaskId(-1);
        }

        if (socket !== null) {
            socket.emit(
                "thread_message",
                {
                    methodType: "POST",
                    isInit: true,
                    rootMessageTSSent: message.tsSent,
                    rootMessageSenderId: message.sender.userId,
                    rootMessageReceiverId:
                        myself.userId === message.sender.userId
                            ? chat.dmPartnerUser === null
                                ? null
                                : chat.dmPartnerUser.userId
                            : myself.userId,
                    threadId: message.messageId,
                    threadMessage: message.content,
                    isDm: chat.isDm,
                    chatType: chat.chatType,
                    dmPartnerUserId:
                        chat.dmPartnerUser === null ? null : chat.dmPartnerUser.userId,
                    senderId: myself.userId,
                    senderName: myself.userName,
                    destCGName: chat.chatName,
                    destCGId: chat.chatId,
                    systemUserId: null,
                    taskId: message.taskId || null,
                    messageIdForPut: null,
                },
                async (ack: any) => {
                    const newThreadMessage: ThreadMessageProps = {
                        chatType: chat.chatType,
                        messageIdWithChatIdAndThreadId: `${chat.chatId}-${message.messageId}-1`,
                        chatId: chat.chatId,
                        threadId: message.messageId,
                        messageId: 1,
                        content: message.content,
                        contentText: "Need to add",
                        sender:
                            chat.chatType === 1
                                ? myself.userId === message.sender.userId
                                    ? myself
                                    : chat.dmPartnerUser || myself
                                : message.sender,
                        taskId: message.taskId || null,
                        tsSent: message.tsSent,
                        tsUpdated: message.tsSent,
                    };

                    if (newThreadMessage) {
                        const threadMessages: ThreadMessageProps[] =
                            await loadSpecificThreadMessages(
                                myself,
                                chat.chatType,
                                newThreadMessage.chatId,
                                newThreadMessage.threadId,
                                accessToken
                            );
                        if (threadMessages && threadMessages.length > 0) {
                            const newThread: ThreadProps = {
                                chatId: newThreadMessage.chatId,
                                chatName: chat.chatName,
                                threadId: newThreadMessage.threadId,
                                isDm: chat.isDm,
                                chatType: chat.chatType,
                                dmPartnerUser: chat.dmPartnerUser,
                                taskId: message.taskId || null,
                                unread: false,
                                messages: threadMessages,
                                project: message.project,
                                TSLastMessage: getCurrentTimestamp(),
                                taskExist: threadMessages[0].taskExist,
                            };
                            if (message.project) {
                                setCurrentProject(message.project);
                            }
                            if (newThread) {
                                setCurrentThreadChat(newThread);
                                if (newThread.taskExist === true && threadMessages[0].taskId) {
                                    setCurrentPreviewTaskId(threadMessages[0].taskId);
                                }
                            }
                        }
                    }
                }
            );
        }
    };

    return (
        <Box
            sx={{
                maxWidth: "90%",
                minWidth: "auto",
                whiteSpace: "normal",
                wordBreak: "break-word",
            }}
        >
            {message.attachment ? (
                <BubbleAttachmentSheet
                    fileName={message.attachment.fileName}
                    fileSize={message.attachment.size}
                    isSent={isSent}
                />
            ) : (
                <Box sx={{ position: "relative" }}>
                    <Sheet
                        color={"neutral"}
                        variant={"soft"}
                        sx={[
                            {
                                p: 1,
                                borderRadius: "lg",
                            },
                            isSent
                                ? {
                                      borderTopRightRadius: 0,
                                  }
                                : {
                                      borderTopRightRadius: "lg",
                                  },
                            isSent
                                ? {
                                      borderTopLeftRadius: "lg",
                                  }
                                : {
                                      borderTopLeftRadius: 0,
                                  },
                            isSent
                                ? {
                                      backgroundColor: "neutral.plainColor",
                                  }
                                : {
                                      backgroundColor: "neutral.outlinedBorder",
                                  },
                        ]}
                    >
                        <Stack direction="column" spacing={1.5}>
                            <Stack direction="row" spacing={1.5}>
                                {!(
                                    chat.chatType === 3 && message.sender.isSystemUser === true
                                ) && (
                                    <Box sx={{ flex: 1 }}>
                                        <AvatarWithStatus
                                            userProfile={isSent ? myself : message.sender}
                                            socket={socket}
                                            chat={chat}
                                            online={message.sender.online}
                                            setOpeningService={setOpeningService}
                                            setCurrentMainChat={setCurrentMainChat}
                                        />
                                    </Box>
                                )}
                                <Box sx={{ flex: 20 }}>
                                    <Stack direction="row" spacing={1}>
                                        <BubbleUserName
                                            sender={message.sender}
                                            chatType={chat.chatType}
                                            taskId={message.taskId}
                                            taskStatus={message.taskStatus}
                                            userName={message.sender.userName}
                                            isSent={isSent}
                                            dtSent={dtSent}
                                            tsSent={message.tsSent}
                                            tsUpdated={message.tsUpdated}
                                            isThread={false}
                                        />
                                        <BubbleReplyButton replayHandler={replayHandler} />
                                        {message.sender.isSystemUser !== true && (
                                            <BubbleEditButton
                                                message={message}
                                                setIsInEdit={setIsInEdit}
                                                setEditTargetMessage={setEditTargetMessage}
                                                currentMessageIndex={currentMessageIndex}
                                                setTargetMessageIndex={setTargetMessageIndex}
                                            />
                                        )}
                                        {chat.chatType === 3 &&
                                            message.sender.isSystemUser === true && (
                                                <BubbleOpenTaskButton
                                                    taskId={message.taskId}
                                                    setIsMainChatVisible={setIsMainChatVisible}
                                                    setIsThreadVisible={setIsThreadVisible}
                                                    setIsTaskPreviewVisible={
                                                        setIsTaskPreviewVisible
                                                    }
                                                    setIsTaskCreationVisible={
                                                        setIsTaskCreationVisible
                                                    }
                                                    setIsOpeningTask={setIsOpeningTask}
                                                    setCurrentPreviewTaskId={
                                                        setCurrentPreviewTaskId
                                                    }
                                                />
                                            )}
                                    </Stack>
                                </Box>
                            </Stack>

                            {message.content.length > 0 && (
                                <BnChatPreview
                                    myself={myself}
                                    socket={socket}
                                    key={`${chat.chatId}-${message.messageId}-${chat.chatType}-${message.tsUpdated}`}
                                    content={message.content}
                                    isSent={isSent}
                                    setCurrentChat={setCurrentMainChat}
                                    setOpeningService={setOpeningService}
                                />
                            )}
                        </Stack>

                        {message.numReplies > 0 ? (
                            <BubbleReplyCounterButton
                                numReplies={message.numReplies}
                                isSent={isSent}
                                replayHandler={replayHandler}
                            />
                        ) : (
                            ""
                        )}
                    </Sheet>
                </Box>
            )}
        </Box>
    );
};
