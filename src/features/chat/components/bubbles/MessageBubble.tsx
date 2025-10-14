import { useEffect, useState } from "react";
import { Box, Sheet, Stack } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnChatPreview } from "../../../../components/blockNote/bnChatPreview";
import { AvatarWithStatus } from "../../../../components/common/avatarWithStatus";
import { EmojiPicker } from "../../../../components/emojiInput/EmojiPicker";
import { EmojiReaction } from "../../../../components/emojiInput/EmojiReaction";
import { useAuth } from "../../../../context/AuthContext";
import { UserProps } from "../../../../types/admin";
import {
    ChatProps,
    FlaggedMessageProps,
    MessageProps,
    ThreadMessageProps,
    ThreadProps,
} from "../../../../types/chat";
import { ReactionProps } from "../../../../types/common";
import { ProjectProps, TaskProps } from "../../../../types/tasks";
import { extractYYYYMMDDHHMM, getLocalCurrentTimestamp } from "../../../../utils/dateUtils";
import { loadSpecificTaskByThreadId } from "../../../tasks/services/loadSpecificTaskByThreadId";
import { loadSpecificThreadMessages } from "../../services/loadSpecificThreadMessages";
import { BubbleAttachmentSheet } from "./BubbleAttachmentSheet";
import { BubbleDeleteButton } from "./BubbleDeleteButton";
import { BubbleEditButton } from "./BubbleEditButton";
import { BubbleFlagButton } from "./BubbleFlagButton";
import { BubbleOpenTaskButton } from "./BubbleOpenTaskButton";
import { BubbleReplyButton } from "./BubbleReplyButton";
import { BubbleUnderBar } from "./BubbleUnderBar";
import { BubbleUserName } from "./BubbleUserName";

type MessageBubbleProps = {
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    variant: "sent" | "received";
    chat: ChatProps;
    message: MessageProps;
    isScrolling: boolean;
    isFocused: boolean;
    isSimpleBubble: boolean;
    socket: Socket | null;
    setIsMainChatVisible: (value: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
    setCurrentThreadChat: (value: ThreadProps) => void;
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };
    setIsCreatingTask: (value: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    }) => void;
    setIsTaskPreviewVisible: (value: boolean) => void;
    setCurrentPreviewTask: (value: TaskProps | undefined) => void;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentPreviewTaskId: (value: number) => void;
    setCurrentProject: (value: ProjectProps) => void;
    setIsInEdit: (value: boolean) => void;
    setEditTargetMessage: (value: MessageProps) => void;
    currentMessageIndex: number;
    flaggedMessages: FlaggedMessageProps[];
    setFlaggedMessages: (value: FlaggedMessageProps[]) => void;
};

export const MessageBubble = (props: MessageBubbleProps) => {
    const {
        teamMemberProfiles,
        myself,
        setMyself,
        variant,
        chat,
        message,
        isScrolling,
        isFocused,
        isSimpleBubble,
        socket,
        setIsMainChatVisible,
        setIsThreadVisible,
        setCurrentPreviewTask,
        setIsTaskPreviewVisible,
        isCreatingTask,
        setIsCreatingTask,
        setCurrentThreadChat,
        setOpeningService,
        setCurrentMainChat,
        setCurrentPreviewTaskId,
        setCurrentProject,
        setIsInEdit,
        setEditTargetMessage,
        currentMessageIndex,
        flaggedMessages,
        setFlaggedMessages,
    } = props;
    const isSent = variant === "sent";
    const dtSent = extractYYYYMMDDHHMM(message.tsSent);
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
        setIsCreatingTask({ ...isCreatingTask, flag: false });

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
                            ? chat.dmPartnerUser.userId === ""
                                ? null
                                : chat.dmPartnerUser.userId
                            : myself.userId,
                    threadId: message.messageId,
                    threadMessage: message.content,
                    chatType: chat.chatType,
                    dmPartnerUserId:
                        chat.dmPartnerUser.userId === "" ? null : chat.dmPartnerUser.userId,
                    senderId: myself.userId,
                    senderName: myself.userName,
                    destCGName: chat.chatName,
                    destCGId: chat.chatId,
                    systemUserId: null,
                    taskId: message.taskId || null,
                    messageIdForPut: null,
                    sendActivity: false,
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
                                    : chat.dmPartnerUser
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
                                messages: threadMessages,
                                project: message.project,
                                TSLastMessage: getLocalCurrentTimestamp(),
                                taskExist: threadMessages[0].taskExist,
                            };
                            if (message.project && message.project.projectId) {
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
            setReactions(message.reactions);
        }
    }, []);

    useEffect(() => {
        if (message.reactions) {
            setReactions(message.reactions);
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
                        thread_id: 0,
                        message_id: message.messageId,
                        message_body: message.content,
                        message_sender: message.sender,
                        dm_partner_user_id:
                            message.sender.userId === myself.userId
                                ? chat.dmPartnerUser.userId
                                : myself.userId,
                        is_thread_binary: 0,
                        reaction_emoji: selectedEmoji,
                        current_emojis: reactions,
                    });

                    // If the reaction is for the first message in the thread,
                    // delete the reaction from the parent message as well.
                    // But not doing this for PM thead.
                    if (message.messageId === 1 && chat.chatType !== 3) {
                        socket.emit("message_reaction", {
                            method_type: "DELETE",
                            team_id: myself.teamId,
                            chat_type: chat.chatType,
                            chat_name: chat.chatName,
                            chat_id: message.chatId,
                            thread_id: 0,
                            message_id: message.threadId,
                            message_body: message.content,
                            message_sender: message.sender,
                            dm_partner_user_id:
                                message.sender.userId === myself.userId
                                    ? chat.dmPartnerUser.userId
                                    : myself.userId,
                            is_thread_binary: 0,
                            reaction_emoji: selectedEmoji,
                            current_emojis: reactions,
                        });
                    }

                    // Update the first thread message as well
                    // But not doing this for PM thead.
                    if (message.numReplies > 0 && chat.chatType !== 3) {
                        socket.emit("message_reaction", {
                            method_type: "DELETE",
                            team_id: myself.teamId,
                            chat_type: chat.chatType,
                            chat_name: chat.chatName,
                            chat_id: message.chatId,
                            thread_id: message.messageId,
                            message_id: 1,
                            message_body: message.content,
                            message_sender: message.sender,
                            dm_partner_user_id:
                                message.sender.userId === myself.userId
                                    ? chat.dmPartnerUser.userId
                                    : myself.userId,
                            is_thread_binary: 1,
                            reaction_emoji: selectedEmoji,
                            current_emojis: reactions,
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
                        tsSent: getLocalCurrentTimestamp(),
                    },
                ]);
                if (socket) {
                    socket.emit("message_reaction", {
                        method_type: "POST",
                        team_id: myself.teamId,
                        chat_type: chat.chatType,
                        chat_name: chat.chatName,
                        chat_id: message.chatId,
                        thread_id: 0,
                        message_id: message.messageId,
                        message_body: message.content,
                        message_sender: message.sender,
                        dm_partner_user_id:
                            message.sender.userId === myself.userId
                                ? chat.dmPartnerUser.userId
                                : myself.userId,
                        is_thread_binary: 0,
                        reaction_emoji: selectedEmoji,
                        current_emojis: reactions,
                    });

                    // Update the parent message as well if it's the first thread message
                    // But not doing this for PM thead.
                    if (message.messageId === 1 && chat.chatType !== 3) {
                        socket.emit("message_reaction", {
                            method_type: "POST",
                            team_id: myself.teamId,
                            chat_type: chat.chatType,
                            chat_name: chat.chatName,
                            chat_id: message.chatId,
                            thread_id: 0,
                            message_id: message.threadId,
                            message_body: message.content,
                            message_sender: message.sender,
                            dm_partner_user_id:
                                message.sender.userId === myself.userId
                                    ? chat.dmPartnerUser.userId
                                    : myself.userId,
                            is_thread_binary: 0,
                            reaction_emoji: selectedEmoji,
                            current_emojis: reactions,
                            send_activity: false,
                        });
                    }

                    // Update the first thread message as well
                    if (chat.chatType !== 3 && message.numReplies > 0) {
                        socket.emit("message_reaction", {
                            method_type: "POST",
                            team_id: myself.teamId,
                            chat_type: chat.chatType,
                            chat_name: chat.chatName,
                            chat_id: message.chatId,
                            thread_id: message.messageId,
                            message_id: 1,
                            message_body: message.content,
                            message_sender: message.sender,
                            dm_partner_user_id:
                                message.sender.userId === myself.userId
                                    ? chat.dmPartnerUser.userId
                                    : myself.userId,
                            is_thread_binary: 1,
                            reaction_emoji: selectedEmoji,
                            current_emojis: reactions,
                            send_activity: false,
                        });
                    }
                }
            }
            setSelectedEmoji(null);
        }
    }, [selectedEmoji]);

    let numRepliesWithoutFirstMessage: number;
    if (chat.chatType !== 3) {
        numRepliesWithoutFirstMessage = message.numReplies - 1;
    } else {
        numRepliesWithoutFirstMessage = message.numReplies;
    }

    return (
        <Box
            sx={{
                maxWidth: "90%",
                minWidth:
                    (isSimpleBubble ? (numRepliesWithoutFirstMessage > 0 ? 150 : 100) : 200) +
                    (uniqueReactionEmojiCount < 10 ? uniqueReactionEmojiCount * 20 : 310),
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
                        pickerBottomPosition={10}
                        pickerRightPosition={isSent ? 0 : -40}
                        setSelectedEmoji={setSelectedEmoji}
                        setShowEmojiPicker={setShowEmojiPicker}
                        showEmojiPicker={showEmojiPicker}
                    />
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
                                      borderTopLeftRadius: "lg",
                                      backgroundColor: "neutral.plainColor",
                                  }
                                : {
                                      borderTopRightRadius: "lg",
                                      borderTopLeftRadius: 0,
                                      backgroundColor: "neutral.outlinedBorder",
                                  },
                            isFocused
                                ? {
                                      background: "#24c165d0",
                                  }
                                : {
                                      background: "",
                                  },
                        ]}
                        onMouseEnter={() => setShowUnderBarOption(true)}
                        onMouseLeave={() => setShowUnderBarOption(false)}
                    >
                        <Stack direction="column">
                            {showUnderBarOption === true && isSimpleBubble === true && (
                                <Stack direction="row" spacing={0}>
                                    <BubbleUserName
                                        chatType={chat.chatType}
                                        dtSent={dtSent}
                                        isSent={isSent}
                                        isSimpleBubble={isSimpleBubble}
                                        isThread={false}
                                        sender={message.sender}
                                        taskId={message.taskId}
                                        taskStatus={message.taskStatus}
                                        tsSent={message.tsSent}
                                        tsUpdated={message.tsUpdated}
                                        userName={message.sender.userName}
                                    />

                                    <Box sx={{ textAlign: "right", pl: "10px" }}>
                                        {isScrolling !== true && (
                                            <EmojiReaction
                                                chatName={chat.chatName}
                                                chatType={chat.chatType}
                                                dmPartnerUser={chat.dmPartnerUser}
                                                isThread={false}
                                                message={message}
                                                myself={myself}
                                                numReplies={message.numReplies}
                                                reactions={reactions}
                                                setReactions={setReactions}
                                                setShowEmojiPicker={setShowEmojiPicker}
                                                showUnderBarOption={showUnderBarOption}
                                                socket={socket}
                                                setUniqueReactionEmojiCount={
                                                    setUniqueReactionEmojiCount
                                                }
                                            />
                                        )}
                                    </Box>

                                    <BubbleFlagButton
                                        accessToken={accessToken}
                                        currentChat={chat}
                                        flaggedMessages={flaggedMessages}
                                        message={message}
                                        myself={myself}
                                        setCurrentChat={setCurrentMainChat}
                                        setFlaggedMessages={setFlaggedMessages}
                                        threadId={0}
                                    />

                                    <BubbleReplyButton replayHandler={replayHandler} />

                                    {message.sender.userId === myself.userId && (
                                        <BubbleEditButton
                                            message={message}
                                            setEditTargetMessage={setEditTargetMessage}
                                            setIsInEdit={setIsInEdit}
                                        />
                                    )}

                                    {(chat.chatType === 3 || chat.chatType === 4) &&
                                        message.sender.isSystemUser === true && (
                                            <BubbleOpenTaskButton
                                                isCreatingTask={isCreatingTask}
                                                message={message}
                                                setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                                setCurrentProject={setCurrentProject}
                                                setIsCreatingTask={setIsCreatingTask}
                                                setIsMainChatVisible={setIsMainChatVisible}
                                                setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                                setIsThreadVisible={setIsThreadVisible}
                                                taskId={message.taskId}
                                            />
                                        )}

                                    {message.numReplies < 2 &&
                                        message.sender.userId === myself.userId && (
                                            <BubbleDeleteButton
                                                accessToken={accessToken}
                                                currentChat={chat}
                                                isThread={false}
                                                message={message}
                                                setCurrentChat={setCurrentMainChat}
                                                socket={socket}
                                            />
                                        )}
                                </Stack>
                            )}

                            {isSimpleBubble === false && (
                                <Stack direction="row" spacing={1.5}>
                                    {!(
                                        (chat.chatType === 3 || chat.chatType === 4) &&
                                        message.sender.isSystemUser === true
                                    ) && (
                                        <Box sx={{ flex: 1 }}>
                                            <AvatarWithStatus
                                                chat={chat}
                                                isForBubble={true}
                                                isYou={isSent}
                                                myself={myself}
                                                setCurrentMainChat={setCurrentMainChat}
                                                setMyself={setMyself}
                                                setOpeningService={setOpeningService}
                                                socket={socket}
                                                avatarUser={
                                                    isSent
                                                        ? teamMemberProfiles[myself.userId]
                                                        : teamMemberProfiles[message.sender.userId]
                                                }
                                            />
                                        </Box>
                                    )}
                                    <Box sx={{ flex: 50 }}>
                                        <Stack direction="row" spacing={0}>
                                            <BubbleUserName
                                                chatType={chat.chatType}
                                                dtSent={dtSent}
                                                isSent={isSent}
                                                isSimpleBubble={isSimpleBubble}
                                                isThread={false}
                                                sender={message.sender}
                                                taskId={message.taskId}
                                                taskStatus={message.taskStatus}
                                                tsSent={message.tsSent}
                                                tsUpdated={message.tsUpdated}
                                                userName={message.sender.userName}
                                            />

                                            {showUnderBarOption === true && (
                                                <>
                                                    <Box sx={{ textAlign: "right", pl: "10px" }}>
                                                        {isScrolling !== true && (
                                                            <EmojiReaction
                                                                chatName={chat.chatName}
                                                                chatType={chat.chatType}
                                                                dmPartnerUser={chat.dmPartnerUser}
                                                                isThread={false}
                                                                message={message}
                                                                myself={myself}
                                                                numReplies={message.numReplies}
                                                                reactions={reactions}
                                                                setReactions={setReactions}
                                                                socket={socket}
                                                                setShowEmojiPicker={
                                                                    setShowEmojiPicker
                                                                }
                                                                setUniqueReactionEmojiCount={
                                                                    setUniqueReactionEmojiCount
                                                                }
                                                                showUnderBarOption={
                                                                    showUnderBarOption
                                                                }
                                                            />
                                                        )}
                                                    </Box>

                                                    <BubbleFlagButton
                                                        accessToken={accessToken}
                                                        currentChat={chat}
                                                        flaggedMessages={flaggedMessages}
                                                        message={message}
                                                        myself={myself}
                                                        setCurrentChat={setCurrentMainChat}
                                                        setFlaggedMessages={setFlaggedMessages}
                                                        threadId={0}
                                                    />

                                                    <BubbleReplyButton
                                                        replayHandler={replayHandler}
                                                    />

                                                    {message.sender.userId === myself.userId && (
                                                        <BubbleEditButton
                                                            message={message}
                                                            setIsInEdit={setIsInEdit}
                                                            setEditTargetMessage={
                                                                setEditTargetMessage
                                                            }
                                                        />
                                                    )}

                                                    {(chat.chatType === 3 ||
                                                        chat.chatType === 4) &&
                                                        message.sender.isSystemUser === true && (
                                                            <BubbleOpenTaskButton
                                                                isCreatingTask={isCreatingTask}
                                                                message={message}
                                                                taskId={message.taskId}
                                                                setCurrentPreviewTaskId={
                                                                    setCurrentPreviewTaskId
                                                                }
                                                                setCurrentProject={
                                                                    setCurrentProject
                                                                }
                                                                setIsCreatingTask={
                                                                    setIsCreatingTask
                                                                }
                                                                setIsMainChatVisible={
                                                                    setIsMainChatVisible
                                                                }
                                                                setIsTaskPreviewVisible={
                                                                    setIsTaskPreviewVisible
                                                                }
                                                                setIsThreadVisible={
                                                                    setIsThreadVisible
                                                                }
                                                            />
                                                        )}

                                                    {message.numReplies < 2 &&
                                                        message.sender.userId ===
                                                            myself.userId && (
                                                            <BubbleDeleteButton
                                                                accessToken={accessToken}
                                                                currentChat={chat}
                                                                isThread={false}
                                                                message={message}
                                                                setCurrentChat={setCurrentMainChat}
                                                                socket={socket}
                                                            />
                                                        )}
                                                </>
                                            )}
                                        </Stack>
                                    </Box>
                                </Stack>
                            )}

                            {message.content && message.content.length > 0 && (
                                <BnChatPreview
                                    key={`${chat.chatId}-${message.messageId}-${chat.chatType}-${message.tsUpdated}`}
                                    content={message.content}
                                    isSent={isSent}
                                    myself={myself}
                                    setCurrentChat={setCurrentMainChat}
                                    setMyself={setMyself}
                                    setOpeningService={setOpeningService}
                                    socket={socket}
                                    teamMemberProfiles={teamMemberProfiles}
                                />
                            )}
                        </Stack>

                        <BubbleUnderBar
                            chatName={chat.chatName}
                            chatType={chat.chatType}
                            dmPartnerUser={chat.dmPartnerUser}
                            isThread={false}
                            message={message}
                            myself={myself}
                            numReplies={message.numReplies}
                            reactions={reactions}
                            replayHandler={replayHandler}
                            setReactions={setReactions}
                            setShowEmojiPicker={setShowEmojiPicker}
                            setUniqueReactionEmojiCount={setUniqueReactionEmojiCount}
                            showUnderBarOption={showUnderBarOption}
                            socket={socket}
                        />
                    </Sheet>
                </Box>
            )}
        </Box>
    );
};
