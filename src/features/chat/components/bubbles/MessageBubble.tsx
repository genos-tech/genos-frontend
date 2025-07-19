import * as React from "react";
import { Box, Stack, Sheet } from "@mui/joy";
import { Socket } from "socket.io-client";

import { addThreadMessage } from "../../services/addThreadMessage";
import { popSpecificThreadMessages } from "../../services/popSpecificThreadMessages";
import { BubbleReactionButton } from "./BubbleReactionButton";
import { BubbleOpenTaskButton } from "./BubbleOpenTaskButton";
import { BubbleUserName } from "./BubbleUserName";
import { BubbleReplyButton } from "./BubbleReplyButton";
import { BubbleAttachmentSheet } from "./BubbleAttachmentSheet";
import { loadSpecificTaskByThreadId } from "../../../tasks/services/loadSpecificTaskByThreadId";
import { extractHHMM, getCurrentTimestamp } from "../../../../utils/dateUtils";
import { UserProps } from "../../../../types/admin";
import { ChatProps, MessageProps, ThreadProps, ThreadMessageProps } from "../../../../types/chat";
import { TaskProps } from "../../../../types/tasks";
import { useAuth } from "../../../../context/AuthContext";
import { BnPreview } from "../../../../components/blockNote/bnPreview";
import { AvatarWithStatus } from "../../../../components/utils/avatarWithStatus";

type MessageBubbleProps = MessageProps & {
    myself: UserProps;
    variant: "sent" | "received";
    chat: ChatProps;
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
};

export const MessageBubble = (props: MessageBubbleProps) => {
    const {
        myself,
        variant,
        chat,
        socket,
        content,
        messageId,
        tsSent,
        attachment = undefined,
        sender,
        numReplies,
        taskId,
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
    } = props;
    const isSent = variant === "sent";
    const [isLiked, setIsLiked] = React.useState<boolean>(false);
    const _tsSent = extractHHMM(tsSent);
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
            } else {
                setCurrentPreviewTask(undefined);
            }
        })();
    };

    const replayHandler = () => {
        loadTask(messageId);

        // Show thread pane on the right side.
        setIsMainChatVisible(true);
        setIsThreadVisible(true);
        setIsTaskPreviewVisible(false);
        setIsTaskCreationVisible(false);

        if (socket !== null) {
            socket.emit(
                "thread_message",
                {
                    isInit: true,
                    rootMessageTSSent: tsSent,
                    rootMessageSenderId: sender.userId,
                    rootMessageReceiverId:
                        myself.userId === sender.userId
                            ? chat.dmPartnerUser === null
                                ? null
                                : chat.dmPartnerUser.userId
                            : myself.userId,
                    threadId: messageId,
                    threadMessage: content,
                    isDm: chat.isDm,
                    chatType: chat.chatType,
                    dmPartnerUserId:
                        chat.dmPartnerUser === null ? null : chat.dmPartnerUser.userId,
                    senderId: myself.userId,
                    senderName: myself.userName,
                    destCGName: chat.chatName,
                    destCGId: chat.chatId,
                    systemUserId: null,
                    taskId: null,
                },
                async (ack: any) => {
                    const newThreadMessage: ThreadMessageProps = {
                        chatType: chat.chatType,
                        messageIdWithChatIdAndThreadId: `${chat.chatId}-${messageId}-1`,
                        chatId: chat.chatId,
                        threadId: messageId,
                        messageId: 1,
                        content: content,
                        contentText: "Need to add",
                        sender:
                            chat.chatType === 1
                                ? myself.userId === sender.userId
                                    ? myself
                                    : chat.dmPartnerUser || myself
                                : sender,
                        taskId: null,
                        tsSent: tsSent,
                    };

                    if (newThreadMessage) {
                        if (chat.isDm) {
                            await addThreadMessage(newThreadMessage, chat.chatType);
                            const threadMessages: ThreadMessageProps[] =
                                await popSpecificThreadMessages(
                                    newThreadMessage.chatId,
                                    newThreadMessage.threadId,
                                    chat.chatType
                                );
                            if (threadMessages) {
                                const newThread: ThreadProps = {
                                    chatId: newThreadMessage.chatId,
                                    chatName: chat.chatName,
                                    threadId: newThreadMessage.threadId,
                                    isDm: true,
                                    chatType: chat.chatType,
                                    dmPartnerUser: chat.dmPartnerUser,
                                    taskId: null,
                                    unread: false,
                                    messages: threadMessages,
                                    TSLastMessage: getCurrentTimestamp(),
                                };
                                if (newThread) {
                                    setCurrentThreadChat(newThread);
                                }
                            }
                        } else {
                            await addThreadMessage(newThreadMessage, chat.chatType);
                            const threadMessages: ThreadMessageProps[] =
                                await popSpecificThreadMessages(
                                    newThreadMessage.chatId,
                                    newThreadMessage.threadId,
                                    chat.chatType
                                );
                            if (threadMessages) {
                                const newThread: ThreadProps = {
                                    chatId: newThreadMessage.chatId,
                                    chatName: chat.chatName,
                                    threadId: newThreadMessage.threadId,
                                    isDm: false,
                                    chatType: chat.chatType,
                                    dmPartnerUser: chat.dmPartnerUser,
                                    taskId: null,
                                    unread: false,
                                    messages: threadMessages,
                                    TSLastMessage: getCurrentTimestamp(),
                                };
                                if (newThread) {
                                    setCurrentThreadChat(newThread);
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
            {attachment ? (
                <BubbleAttachmentSheet
                    fileName={attachment.fileName}
                    fileSize={attachment.size}
                    isSent={isSent}
                />
            ) : (
                <Box sx={{ position: "relative" }}>
                    <Sheet
                        color={isSent ? "neutral" : "neutral"}
                        variant={isSent ? "solid" : "soft"}
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
                                {!(chat.chatType === 3 && sender.isSystemUser === true) && (
                                    <Box sx={{ flex: 1 }}>
                                        <AvatarWithStatus
                                            userProfile={isSent ? myself : sender}
                                            socket={socket}
                                            chat={chat}
                                            online={sender.online}
                                            setOpeningService={setOpeningService}
                                            setCurrentMainChat={setCurrentMainChat}
                                        />
                                    </Box>
                                )}
                                <Box sx={{ flex: 20 }}>
                                    <Stack direction="row" spacing={1}>
                                        <BubbleUserName
                                            sender={sender}
                                            chatType={chat.chatType}
                                            userName={sender.userName}
                                            isSent={isSent}
                                            tsSent={_tsSent}
                                        />
                                        <BubbleReactionButton
                                            sender={sender}
                                            chatType={chat.chatType}
                                            isLiked={isLiked}
                                            setIsLiked={setIsLiked}
                                            isSent={isSent}
                                            replayHandler={replayHandler}
                                        />
                                        {chat.chatType === 3 && sender.isSystemUser === true && (
                                            <BubbleOpenTaskButton
                                                taskId={taskId}
                                                setIsMainChatVisible={setIsMainChatVisible}
                                                setIsThreadVisible={setIsThreadVisible}
                                                setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                                setIsTaskCreationVisible={setIsTaskCreationVisible}
                                                setIsOpeningTask={setIsOpeningTask}
                                                setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                            />
                                        )}
                                    </Stack>
                                </Box>
                            </Stack>

                            {content.length > 0 && (
                                <BnPreview
                                    key={`${chat.chatId}-${messageId}-${chat.isDm}-${tsSent}`}
                                    content={content}
                                    isSent={isSent}
                                />
                            )}
                        </Stack>

                        {numReplies > 0 ? (
                            <BubbleReplyButton
                                numReplies={numReplies}
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
