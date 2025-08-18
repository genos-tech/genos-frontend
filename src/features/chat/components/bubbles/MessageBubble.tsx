import { useState, useEffect } from "react";
import { Box, Stack, Sheet } from "@mui/joy";
import { Socket } from "socket.io-client";

import { loadSpecificThreadMessages } from "../../services/loadSpecificThreadMessages";
import { BubbleEditButton } from "./BubbleEditButton";
import { BubbleOpenTaskButton } from "./BubbleOpenTaskButton";
import { BubbleUserName } from "./BubbleUserName";
import { BubbleReplyButton } from "./BubbleReplyButton";
import { BubbleUnderBar } from "./BubbleUnderBar";
import { BubbleAttachmentSheet } from "./BubbleAttachmentSheet";
import { loadSpecificTaskByThreadId } from "../../../tasks/services/loadSpecificTaskByThreadId";
import { extractHHMM, getCurrentTimestamp } from "../../../../utils/dateUtils";
import { UserProps } from "../../../../types/admin";
import { ChatProps, MessageProps, ThreadProps, ThreadMessageProps } from "../../../../types/chat";
import { TaskProps, ProjectProps } from "../../../../types/tasks";
import { ReactionProps } from "../../../../types/common";
import { useAuth } from "../../../../context/AuthContext";
import { BnChatPreview } from "../../../../components/blockNote/bnChatPreview";
import { AvatarWithStatus } from "../../../../components/utils/avatarWithStatus";
import { EmojiPicker } from "../../../../components/emojiInput/EmojiPicker";

type MessageBubbleProps = {
    myself: UserProps;
    variant: "sent" | "received";
    chat: ChatProps;
    message: MessageProps;
    isFocused: boolean;
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
        isFocused,
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
                        reactions: message.reactions,
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

    // Reaction handling
    const [showUnderBarOption, setShowUnderBarOption] = useState(false);
    const [reactions, setReactions] = useState<ReactionProps[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [selectedEmoji, setSelectedEmoji] = useState<any>(null);
    const [uniqueReactionEmojiCount, setUniqueReactionEmojiCount] = useState<number>(0);
    useEffect(() => {
        if (message.reactions) {
            setReactions(message.reactions.allReactions);
        }
    }, []);

    useEffect(() => {
        if (message.reactions) {
            setReactions(message.reactions.allReactions);
        }
    }, [message]);

    useEffect(() => {
        if (selectedEmoji !== null) {
            const existingIndex = reactions.findIndex(
                (r) => r.emoji === selectedEmoji && r.sender.userId === myself.userId
            );
            if (existingIndex !== -1) {
                // Emoji already exists, remove it
                const updatedReactions = reactions.filter((_, idx) => idx !== existingIndex);
                setReactions(updatedReactions);
                if (socket) {
                    socket.emit("message_reaction", {
                        method_type: "DELETE",
                        team_id: myself.teamId,
                        chat_type: chat.chatType,
                        chat_name: chat.chatName,
                        chat_id: message.chatId,
                        thread_id: message.threadId,
                        message_id: message.messageId,
                        message_body: message.content,
                        dm_partner_user_id:
                            message.sender.userId === myself.userId
                                ? chat.dmPartnerUser?.userId
                                : myself.userId,
                        is_thread_binary: 0,
                        reaction_emoji: selectedEmoji,
                        current_emojis: message.reactions?.allReactions || [],
                    });

                    // If the reaction is for the first message in the thread,
                    // delete the reaction from the parent message as well
                    if (message.messageId === 1) {
                        socket.emit("message_reaction", {
                            method_type: "DELETE",
                            team_id: myself.teamId,
                            chat_type: chat.chatType,
                            chat_name: chat.chatName,
                            chat_id: message.chatId,
                            thread_id: -1,
                            message_id: message.threadId,
                            message_body: message.content,
                            dm_partner_user_id:
                                message.sender.userId === myself.userId
                                    ? chat.dmPartnerUser?.userId
                                    : myself.userId,
                            is_thread_binary: 0,
                            reaction_emoji: selectedEmoji,
                            current_emojis: message.reactions?.allReactions || [],
                        });
                    }

                    // Update the first thread message as well
                    if (message.numReplies > 0) {
                        socket.emit("message_reaction", {
                            method_type: "DELETE",
                            team_id: myself.teamId,
                            chat_type: chat.chatType,
                            chat_name: chat.chatName,
                            chat_id: message.chatId,
                            thread_id: message.messageId,
                            message_id: 1,
                            message_body: message.content,
                            dm_partner_user_id:
                                message.sender.userId === myself.userId
                                    ? chat.dmPartnerUser?.userId
                                    : myself.userId,
                            is_thread_binary: 1,
                            reaction_emoji: selectedEmoji,
                            current_emojis: message.reactions?.allReactions || [],
                        });
                    }
                }
            } else {
                // Emoji not in reactions, add it
                setReactions([
                    ...reactions,
                    {
                        id: -1,
                        emoji: selectedEmoji,
                        sender: myself,
                        tsSent: getCurrentTimestamp(),
                    },
                ]);
                if (socket) {
                    socket.emit("message_reaction", {
                        method_type: "POST",
                        team_id: myself.teamId,
                        chat_type: chat.chatType,
                        chat_name: chat.chatName,
                        chat_id: message.chatId,
                        thread_id: message.threadId,
                        message_id: message.messageId,
                        message_body: message.content,
                        dm_partner_user_id:
                            message.sender.userId === myself.userId
                                ? chat.dmPartnerUser?.userId
                                : myself.userId,
                        is_thread_binary: 0,
                        reaction_emoji: selectedEmoji,
                        current_emojis: message.reactions?.allReactions || [],
                    });

                    // Update the parent message as well if it's the first thread message
                    if (message.messageId === 1) {
                        socket.emit("message_reaction", {
                            method_type: "POST",
                            team_id: myself.teamId,
                            chat_type: chat.chatType,
                            chat_name: chat.chatName,
                            chat_id: message.chatId,
                            message_id: message.threadId,
                            message_body: message.content,
                            dm_partner_user_id:
                                message.sender.userId === myself.userId
                                    ? chat.dmPartnerUser?.userId
                                    : myself.userId,
                            is_thread_binary: 0,
                            reaction_emoji: selectedEmoji,
                            current_emojis: message.reactions?.allReactions || [],
                        });
                    }

                    // Update the first thread message as well
                    if (message.numReplies > 0) {
                        socket.emit("message_reaction", {
                            method_type: "POST",
                            team_id: myself.teamId,
                            chat_type: chat.chatType,
                            chat_name: chat.chatName,
                            chat_id: message.chatId,
                            thread_id: message.messageId,
                            message_id: 1,
                            message_body: message.content,
                            dm_partner_user_id:
                                message.sender.userId === myself.userId
                                    ? chat.dmPartnerUser?.userId
                                    : myself.userId,
                            is_thread_binary: 1,
                            reaction_emoji: selectedEmoji,
                            current_emojis: message.reactions?.allReactions || [],
                        });
                    }
                }
            }
            setSelectedEmoji(null);
        }
    }, [selectedEmoji]);

    return (
        <Box
            sx={{
                maxWidth: "90%",
                minWidth:
                    250 + (uniqueReactionEmojiCount < 10 ? uniqueReactionEmojiCount * 20 : 310),
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
                    <EmojiPicker
                        showEmojiPicker={showEmojiPicker}
                        setShowEmojiPicker={setShowEmojiPicker}
                        setSelectedEmoji={setSelectedEmoji}
                        pickerBottomPosition={10}
                        pickerRightPosition={isSent ? 0 : -40}
                    />
                    <Sheet
                        color={"neutral"}
                        variant={"soft"}
                        onMouseEnter={() => setShowUnderBarOption(true)}
                        onMouseLeave={() => setShowUnderBarOption(false)}
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
                            isFocused
                                ? {
                                      background: "#1cb15dff",
                                  }
                                : {
                                      background: "",
                                  },
                        ]}
                    >
                        <Stack direction="column" spacing={1.5}>
                            <Stack direction="row" spacing={1.5}>
                                {!(
                                    (chat.chatType === 3 || chat.chatType === 4) &&
                                    message.sender.isSystemUser === true
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
                                        {message.sender.userId === myself.userId && (
                                            <BubbleEditButton
                                                message={message}
                                                setIsInEdit={setIsInEdit}
                                                setEditTargetMessage={setEditTargetMessage}
                                                currentMessageIndex={currentMessageIndex}
                                                setTargetMessageIndex={setTargetMessageIndex}
                                            />
                                        )}
                                        {(chat.chatType === 3 || chat.chatType === 4) &&
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

                            {message.content && message.content.length > 0 && (
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

                        <BubbleUnderBar
                            socket={socket}
                            myself={myself}
                            chatType={chat.chatType}
                            chatName={chat.chatName}
                            dmPartnerUser={chat.dmPartnerUser}
                            message={message}
                            numReplies={message.numReplies}
                            isThread={false}
                            isSent={isSent}
                            showUnderBarOption={showUnderBarOption}
                            reactions={reactions}
                            setReactions={setReactions}
                            setUniqueReactionEmojiCount={setUniqueReactionEmojiCount}
                            setShowEmojiPicker={setShowEmojiPicker}
                            replayHandler={replayHandler}
                        />
                    </Sheet>
                </Box>
            )}
        </Box>
    );
};
