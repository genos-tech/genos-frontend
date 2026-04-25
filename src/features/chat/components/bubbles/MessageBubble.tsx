import { useEffect, useRef, useState } from "react";
import { Box, Sheet, Stack } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";
import { Socket } from "socket.io-client";

import { BnChatPreview } from "../../../../components/editors/bnChatPreview";
import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { EmojiPicker } from "../../../../components/ui/emoji/EmojiPicker";
import { EmojiReaction } from "../../../../components/ui/emoji/EmojiReaction";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../../types/chat";
import { ReactionProps } from "../../../../types/common";
import { TaskProps } from "../../../../types/tasks";
import { extractYYYYMMDDHHMM, getLocalCurrentTimestamp } from "../../../../utils/dateUtils";
import { loadSpecificTaskByThreadId } from "../../../tasks/services/loadSpecificTaskByThreadId";
import { loadSpecificThreadMessages } from "../../services/loadSpecificThreadMessages";
import { BubbleAttachmentSheet } from "./BubbleAttachmentSheet";
import { BubbleMoreMenu } from "./BubbleMoreMenu";
import { BubbleUnderBar } from "./BubbleUnderBar";
import { BubbleUserName } from "./BubbleUserName";

// Color schemes for sent/received bubbles - improved for better text contrast
const BUBBLE_COLORS = {
    sent: {
        dark: { bg: "#312e81", border: "#4338ca", text: "#e0e7ff" },
        light: { bg: "#eef2ff", border: "#c7d2fe", text: "#1e1b4b" },
    },
    received: {
        dark: { bg: "#1f2937", border: "#374151", text: "#f3f4f6" },
        light: { bg: "#ffffff", border: "#e5e7eb", text: "#111827" },
    },
    focused: {
        dark: { bg: "#14532d", border: "#22c55e", text: "#dcfce7" },
        light: { bg: "#dcfce7", border: "#22c55e", text: "#14532d" },
    },
    threadActive: {
        dark: { bg: "#1e1b4b", border: "#6366f1", text: "#e0e7ff" },
        light: { bg: "#eef2ff", border: "#818cf8", text: "#1e1b4b" },
    },
} as const;

type MessageBubbleProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    variant: "sent" | "received";
    chat: ChatProps;
    message: MessageProps;
    isScrolling: boolean;
    isFocused: "focused" | "threadActive" | false;
    isSimpleBubble: boolean;
    socket: Socket | null;
    useUISM: UIStateManagementState;
    usePM: ProjectManagementState;
    setIsInEdit: (value: boolean) => void;
    setEditTargetMessage: (value: MessageProps) => void;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
};

export const MessageBubble = (props: MessageBubbleProps) => {
    const {
        chat,
        isFocused,
        isScrolling,
        isSimpleBubble,
        message,
        myself,
        usePM,
        setEditTargetMessage,
        setIsInEdit,
        setMyself,
        useUISM,
        socket,
        useTEM,
        variant,
        useCM,
        useTM,
    } = props;

    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const isSent = variant === "sent";
    const dtSent = extractYYYYMMDDHHMM(message.tsSent);
    const { accessToken } = useAuth();
    const navigate = useNavigate();

    // Get bubble colors based on variant and theme
    const bubbleColors = isSent ? BUBBLE_COLORS.sent : BUBBLE_COLORS.received;
    const colors = isDark ? bubbleColors.dark : bubbleColors.light;
    const focusedColors = isDark ? BUBBLE_COLORS.focused.dark : BUBBLE_COLORS.focused.light;
    const threadActiveColors = isDark ? BUBBLE_COLORS.threadActive.dark : BUBBLE_COLORS.threadActive.light;
    const highlightColors = isFocused === "threadActive" ? threadActiveColors : focusedColors;

    // Chat type to URL path mapping
    const CHAT_TYPE_PATH: Record<number, string> = {
        1: "dm",
        2: "gm",
        3: "pm",
        4: "mdm",
    };

    // Handle message click to update URL
    const handleMessageClick = () => {
        const typePath = CHAT_TYPE_PATH[chat.chatType];
        if (typePath) {
            // For PM (chatType 3), use taskId instead of messageId to match the indexMap key format
            // The indexMap for PM uses messageIdWithChatId = `${chatId}-${taskId}`
            const messageIdentifier =
                chat.chatType === 3 && message.taskId ? message.taskId : message.messageId;
            navigate(`/Home/chat/${typePath}/${chat.chatId}/message/${messageIdentifier}`);
        }
    };

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
                useTM.setCurrentPreviewTask(loadedTask[0]);
            }
        })();
    };

    const replayHandler = (e?: React.MouseEvent) => {
        // Stop propagation to prevent handleMessageClick from being called
        e?.stopPropagation();

        loadTask(message.messageId);

        // Show thread pane on the right side.
        useCM.setIsMainChatVisible(true);
        useCM.setIsThreadVisible(true);
        // useTM.setIsTaskPreviewVisible(false);
        useTM.setIsCreatingTask({ ...useTM.isCreatingTask, flag: false });

        if (message.taskId) {
            useTM.setCurrentPreviewTaskId(message.taskId);
        } else {
            useTM.setCurrentPreviewTaskId(-1);
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
                                usePM.setCurrentProject(message.project);
                            }
                            if (newThread) {
                                useCM.setCurrentThreadChat(newThread);
                                if (newThread.taskExist === true && threadMessages[0].taskId) {
                                    useTM.setCurrentPreviewTaskId(threadMessages[0].taskId);
                                }

                                // Navigate to thread URL for consistency with URL routing
                                const typePath = CHAT_TYPE_PATH[chat.chatType];
                                if (typePath) {
                                    // For PM (chatType 3), use taskId as thread identifier to match indexMap key format
                                    const threadIdentifier =
                                        chat.chatType === 3 && message.taskId ? message.taskId : message.messageId;
                                    navigate(`/Home/chat/${typePath}/${chat.chatId}/thread/${threadIdentifier}`);
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

    // Dynamic positioning for emoji picker
    const bubbleRef = useRef<HTMLDivElement>(null);
    const [pickerBottomPosition, setPickerBottomPosition] = useState<number>(40);
    const [pickerRightPosition, setPickerRightPosition] = useState<number | string>(
        isSent ? 0 : "auto"
    );
    const [pickerLeftPosition, setPickerLeftPosition] = useState<number | string>(
        isSent ? "auto" : 0
    );
    const [emojiPickerPositionCalculated, setEmojiPickerPositionCalculated] =
        useState<boolean>(false);

    useEffect(() => {
        if (showEmojiPicker && bubbleRef.current) {
            const rect = bubbleRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const pickerHeight = 435;

            if (rect.top > pickerHeight + 20) {
                setPickerBottomPosition(40);
            } else if (viewportHeight - rect.bottom > pickerHeight + 20) {
                setPickerBottomPosition(-pickerHeight - 20);
            } else {
                setPickerBottomPosition(40);
            }

            if (isSent) {
                setPickerRightPosition(0);
                setPickerLeftPosition("auto");
            } else {
                setPickerLeftPosition(0);
                setPickerRightPosition("auto");
            }
            setEmojiPickerPositionCalculated(true);
        }
        if (showEmojiPicker === false) {
            setEmojiPickerPositionCalculated(false);
        }
    }, [showEmojiPicker, isSent]);

    useEffect(() => {
        setReactions(message.reactions || []);
    }, [message]);

    useEffect(() => {
        if (selectedEmoji !== null) {
            const existingIndex = reactions.findIndex(
                (r) => r.emoji === selectedEmoji && r.sender.userId === myself.userId
            );
            if (existingIndex !== -1) {
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

    // Bubble action buttons component - consolidated into a single "More" menu
    const BubbleActions = () => (
        <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            sx={{
                opacity: showUnderBarOption ? 1 : 0,
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                transform: showUnderBarOption ? "translateX(0)" : "translateX(-4px)",
                pl: 1,
            }}
        >
            {/* Quick emoji reaction - kept visible for fast access */}
            {isScrolling !== true && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                    }}
                >
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
                        setUniqueReactionEmojiCount={setUniqueReactionEmojiCount}
                    />
                </Box>
            )}

            {/* Consolidated "More" menu with all other actions */}
            <BubbleMoreMenu
                accessToken={accessToken}
                chat={chat}
                flaggedMessages={useCM.flaggedMessages}
                message={message}
                myself={myself}
                replyHandler={replayHandler}
                setCurrentChat={useCM.setCurrentMainChat}
                setEditTargetMessage={setEditTargetMessage}
                setFlaggedMessages={useCM.setFlaggedMessages}
                setIsInEdit={setIsInEdit}
                socket={socket}
                useCM={useCM}
                usePM={usePM}
                useTM={useTM}
                isSent={isSent}
            />
        </Stack>
    );

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
                <Box ref={bubbleRef} sx={{ position: "relative" }}>
                    {emojiPickerPositionCalculated === true && (
                        <EmojiPicker
                            pickerBottomPosition={pickerBottomPosition}
                            pickerLeftPosition={pickerLeftPosition}
                            pickerRightPosition={pickerRightPosition}
                            setSelectedEmoji={setSelectedEmoji}
                            setShowEmojiPicker={setShowEmojiPicker}
                            showEmojiPicker={showEmojiPicker}
                        />
                    )}
                    <Sheet
                        onClick={handleMessageClick}
                        sx={{
                            p: 1.25,
                            borderRadius: "16px",
                            position: "relative",
                            overflow: "hidden",
                            cursor: "pointer",
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            // Variant-specific border radius
                            ...(isSent
                                ? { borderTopRightRadius: "4px", borderTopLeftRadius: "16px" }
                                : { borderTopRightRadius: "16px", borderTopLeftRadius: "4px" }),
                            // Background styling - solid colors for better text contrast
                            background: isFocused ? highlightColors.bg : colors.bg,
                            // Text color for proper contrast
                            color: isFocused ? highlightColors.text : colors.text,
                            // Border styling
                            border: "1px solid",
                            borderColor: isFocused ? highlightColors.border : colors.border,
                            // Shadow for depth
                            boxShadow: isFocused
                                ? isFocused === "focused"
                                    ? isDark
                                        ? `0 4px 20px rgba(34,197,94,0.2), inset 0 1px 0 rgba(255,255,255,0.05)`
                                        : `0 4px 20px rgba(22,163,74,0.15)`
                                    : isDark
                                        ? `0 4px 20px rgba(99,102,241,0.2), inset 0 1px 0 rgba(255,255,255,0.05)`
                                        : `0 4px 20px rgba(99,102,241,0.15)`
                                : isDark
                                  ? "0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)"
                                  : "0 2px 8px rgba(0,0,0,0.06)",
                            // Hover effect
                            "&:hover": {
                                boxShadow: isDark
                                    ? "0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                                    : "0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
                            },
                        }}
                        onMouseEnter={() => setShowUnderBarOption(true)}
                        onMouseLeave={() => setShowUnderBarOption(false)}
                    >
                        {/* Subtle highlight for sent messages */}
                        {isSent && !isFocused && (
                            <Box
                                sx={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: "1px",
                                    background: isDark
                                        ? "rgba(255,255,255,0.08)"
                                        : "rgba(255,255,255,0.5)",
                                    pointerEvents: "none",
                                }}
                            />
                        )}

                        <Stack direction="column" sx={{ position: "relative", zIndex: 1 }}>
                            {showUnderBarOption === true && isSimpleBubble === true && (
                                <Stack
                                    direction="row"
                                    spacing={0}
                                    alignItems="center"
                                    sx={{ mb: 0.5 }}
                                >
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
                                    <BubbleActions />
                                </Stack>
                            )}

                            {isSimpleBubble === false && (
                                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                    {!(
                                        (chat.chatType === 3 || chat.chatType === 4) &&
                                        message.sender.isSystemUser === true
                                    ) && (
                                        <Box sx={{ flexShrink: 0 }}>
                                            <AvatarWithStatus
                                                chat={chat}
                                                useCM={useCM}
                                                isForBubble={true}
                                                isYou={isSent}
                                                myself={myself}
                                                setMyself={setMyself}
                                                socket={socket}
                                                useUISM={useUISM}
                                                avatarUser={
                                                    isSent
                                                        ? useTEM.teamMemberProfiles[myself.userId]
                                                        : useTEM.teamMemberProfiles[
                                                              message.sender.userId
                                                          ]
                                                }
                                            />
                                        </Box>
                                    )}
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Stack direction="row" spacing={0} alignItems="center">
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
                                            {showUnderBarOption === true && <BubbleActions />}
                                        </Stack>
                                    </Box>
                                </Stack>
                            )}

                            {message.content && message.content.length > 0 && (
                                <Box
                                    onClick={() => {
                                        if (message.taskId !== null) {
                                            useCM.setIsMainChatVisible(true);
                                            useCM.setIsThreadVisible(false);
                                            useTM.setIsTaskPreviewVisible(true);
                                            useTM.setIsCreatingTask({
                                                ...useTM.isCreatingTask,
                                                flag: false,
                                            });
                                            useTM.setCurrentPreviewTaskId(message.taskId);
                                        }
                                    }}
                                    sx={{
                                        mt: isSimpleBubble ? 0 : 0.5,
                                        cursor: message.taskId ? "pointer" : "default",
                                    }}
                                >
                                    <BnChatPreview
                                        key={`${chat.chatId}-${message.messageId}-${chat.chatType}-${message.tsUpdated}`}
                                        useCM={useCM}
                                        content={message.content}
                                        isSent={isSent}
                                        myself={myself}
                                        setMyself={setMyself}
                                        socket={socket}
                                        useTEM={useTEM}
                                        useUISM={useUISM}
                                    />
                                </Box>
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
