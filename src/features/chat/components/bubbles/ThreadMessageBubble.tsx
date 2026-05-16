import { useEffect, useRef, useState } from "react";
import { Box, Sheet, Stack } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";
import { Socket } from "socket.io-client";

import { BnChatPreview } from "../../../../components/editors/bnChatPreview";
import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { EmojiPicker } from "../../../../components/ui/emoji/EmojiPicker";
import { EmojiReaction } from "../../../../components/ui/emoji/EmojiReaction";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { useBubbleStylePreference } from "../../../../hooks/common/useBubbleStylePreference";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { MessageProps, ThreadMessageProps, ThreadProps } from "../../../../types/chat";
import { ReactionProps } from "../../../../types/common";
import { TaskCommentProps } from "../../../../types/tasks";
import { extractYYYYMMDDHHMM, getLocalCurrentTimestamp } from "../../../../utils/dateUtils";
import { BubbleAttachmentSheet } from "./BubbleAttachmentSheet";
import { BUBBLE_COLORS, COMPACT_BODY_INDENT, COMPACT_TOOLBAR_OFFSET } from "./bubbleStyleTokens";
import { BubbleThreadMoreMenu } from "./BubbleThreadMoreMenu";
import { BubbleUnderBar } from "./BubbleUnderBar";
import { BubbleUserName } from "./BubbleUserName";

type threadMessageBubbleProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    thread: ThreadProps;
    variant: "sent" | "received";
    message: ThreadMessageProps;
    isScrolling: boolean;
    isFocused: "focused" | "threadActive" | false;
    isSimpleBubble: boolean;
    useUISM: UIStateManagementState;
    setIsInEdit: (value: boolean) => void;
    setEditTargetMessage: (value: ThreadMessageProps) => void;
    currentMessageIndex: number;
    setTargetMessageIndex: (value: number) => void;
    useCM: ChatManagementState;
    setTodoFromMessageBubble: (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => void;
};

export const ThreadMessageBubble = (props: threadMessageBubbleProps) => {
    const {
        useTEM,
        myself,
        setMyself,
        socket,
        thread,
        variant,
        message,
        isScrolling,
        isFocused,
        isSimpleBubble,
        useUISM,
        setIsInEdit,
        setEditTargetMessage,
        currentMessageIndex,
        setTargetMessageIndex,
        useCM,
        setTodoFromMessageBubble,
    } = props;

    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { accessToken } = useAuth();
    const navigate = useNavigate();
    const isSent = variant === "sent";
    const dtSent = extractYYYYMMDDHHMM(message.tsSent);
    const { style } = useBubbleStylePreference();
    const isCompact = style === "compact";
    const isSystemUser = message.sender.isSystemUser === true;

    // Get bubble colors based on variant and theme
    const bubbleColors = isSent ? BUBBLE_COLORS.sent : BUBBLE_COLORS.received;
    const colors = isDark ? bubbleColors.dark : bubbleColors.light;
    const focusedColors = isDark ? BUBBLE_COLORS.focused.dark : BUBBLE_COLORS.focused.light;

    // Chat type to URL path mapping
    const CHAT_TYPE_PATH: Record<number, string> = {
        1: "dm",
        2: "gm",
        3: "pm",
    };

    // Handle thread message click to update URL and focus
    const handleMessageClick = () => {
        const typePath = CHAT_TYPE_PATH[thread.chatType];
        if (typePath) {
            // Update URL
            const threadId =
                thread.chatType === 3 && thread.taskId ? thread.taskId : thread.threadId;
            navigate(
                `/workspace/chat/${typePath}/${thread.chatId}/thread/${threadId}/message/${message.messageId}`
            );

            // Update currentThreadChat's moveToSpecificIndex to focus on this message
            // Format: {chatId}-{threadId}-{messageId} to match messageIdWithChatIdAndThreadId
            const newMoveIndex = `${thread.chatId}-${threadId}-${message.messageId}`;
            if (
                useCM.currentThreadChat &&
                useCM.currentThreadChat.moveToSpecificIndex !== newMoveIndex
            ) {
                useCM.setCurrentThreadChat({
                    ...useCM.currentThreadChat,
                    moveToSpecificIndex: newMoveIndex,
                });
            }
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
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [pickerBottomPosition, setPickerBottomPosition] = useState<number>(40);
    const [pickerTopPosition, setPickerTopPosition] = useState<number | string>("auto");
    const [pickerRightPosition, setPickerRightPosition] = useState<number | string>(
        isSent ? 0 : "auto"
    );
    const [pickerLeftPosition, setPickerLeftPosition] = useState<number | string>(
        isSent ? "auto" : 0
    );
    const [emojiPickerPositionCalculated, setEmojiPickerPositionCalculated] =
        useState<boolean>(false);

    useEffect(() => {
        if (!showEmojiPicker) {
            setEmojiPickerPositionCalculated(false);
            return;
        }

        if (isCompact) {
            const anchor = toolbarRef.current ?? bubbleRef.current;
            if (!anchor) return;
            const rect = anchor.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const pickerHeight = 435;
            const pickerWidth = 352;

            if (viewportHeight - rect.bottom > pickerHeight + 20) {
                setPickerTopPosition(rect.bottom + 10);
            } else if (rect.top > pickerHeight + 20) {
                setPickerTopPosition(rect.top - pickerHeight - 10);
            } else {
                setPickerTopPosition(20);
            }
            setPickerBottomPosition(0);

            const desiredLeft = rect.right - pickerWidth;
            const leftPos = Math.max(20, Math.min(desiredLeft, viewportWidth - pickerWidth - 20));
            setPickerLeftPosition(leftPos);
            setPickerRightPosition("auto");
            setEmojiPickerPositionCalculated(true);
            return;
        }

        if (!bubbleRef.current) return;
        const rect = bubbleRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const pickerHeight = 435;

        setPickerTopPosition("auto");
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
    }, [showEmojiPicker, isSent, isCompact]);

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
                        chat_type: thread.chatType,
                        chat_name: thread.chatName,
                        chat_id: message.chatId,
                        thread_id: message.threadId,
                        message_id: message.messageId,
                        message_body: message.content,
                        message_sender: message.sender,
                        dm_partner_user_id:
                            message.sender.userId === myself.userId
                                ? thread.dmPartnerUser.userId
                                : myself.userId,
                        is_thread_binary: 1,
                        reaction_emoji: selectedEmoji,
                        current_emojis: reactions,
                    });

                    if (message.messageId === 1 && thread.chatType !== 3) {
                        socket.emit("message_reaction", {
                            method_type: "DELETE",
                            team_id: myself.teamId,
                            chat_type: thread.chatType,
                            chat_name: thread.chatName,
                            chat_id: message.chatId,
                            thread_id: 0,
                            message_id: message.threadId,
                            message_body: message.content,
                            message_sender: message.sender,
                            dm_partner_user_id:
                                message.sender.userId === myself.userId
                                    ? thread.dmPartnerUser.userId
                                    : myself.userId,
                            is_thread_binary: 0,
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
                        chat_type: thread.chatType,
                        chat_name: thread.chatName,
                        chat_id: message.chatId,
                        thread_id: message.threadId,
                        message_id: message.messageId,
                        message_body: message.content,
                        message_sender: message.sender,
                        dm_partner_user_id:
                            message.sender.userId === myself.userId
                                ? thread.dmPartnerUser.userId
                                : myself.userId,
                        is_thread_binary: 1,
                        reaction_emoji: selectedEmoji,
                        current_emojis: reactions,
                    });

                    if (message.messageId === 1 && thread.chatType !== 3) {
                        socket.emit("message_reaction", {
                            method_type: "POST",
                            team_id: myself.teamId,
                            chat_type: thread.chatType,
                            chat_name: thread.chatName,
                            chat_id: message.chatId,
                            thread_id: 0,
                            message_id: message.threadId,
                            message_body: message.content,
                            message_sender: message.sender,
                            dm_partner_user_id:
                                message.sender.userId === myself.userId
                                    ? thread.dmPartnerUser.userId
                                    : myself.userId,
                            is_thread_binary: 0,
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

    // Thread bubble action buttons - consolidated into a single "More" menu
    const BubbleActions = () => (
        <Stack
            alignItems="center"
            direction="row"
            spacing={0.5}
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
                        chatName={thread.chatName}
                        chatType={thread.chatType}
                        dmPartnerUser={thread.dmPartnerUser}
                        isThread={true}
                        message={message}
                        myself={myself}
                        numReplies={0}
                        reactions={reactions}
                        setReactions={setReactions}
                        setShowEmojiPicker={setShowEmojiPicker}
                        setUniqueReactionEmojiCount={setUniqueReactionEmojiCount}
                        showUnderBarOption={showUnderBarOption}
                        socket={socket}
                    />
                </Box>
            )}

            {/* Consolidated "More" menu with all other actions */}
            <BubbleThreadMoreMenu
                accessToken={accessToken}
                currentMessageIndex={currentMessageIndex}
                flaggedMessages={useCM.flaggedMessages}
                isSent={isSent}
                message={message}
                myself={myself}
                setCurrentThreadChat={useCM.setCurrentThreadChat}
                setEditTargetMessage={setEditTargetMessage}
                setFlaggedMessages={useCM.setFlaggedMessages}
                setIsInEdit={setIsInEdit}
                setTargetMessageIndex={setTargetMessageIndex}
                socket={socket}
                thread={thread}
                useCM={useCM}
            />
        </Stack>
    );

    if (isCompact) {
        const focusAccent =
            isFocused === "focused"
                ? BUBBLE_COLORS.focused[isDark ? "dark" : "light"].border
                : isFocused === "threadActive"
                  ? BUBBLE_COLORS.threadActive[isDark ? "dark" : "light"].border
                  : "transparent";

        const messageBody = message.content.length > 0 && (
            <Box
                sx={{
                    cursor: "pointer",
                    mt: isSimpleBubble ? 0 : 0.25,
                }}
                onClick={handleMessageClick}
                onDoubleClick={() => {
                    setTodoFromMessageBubble(message);
                }}
            >
                <BnChatPreview
                    key={`${thread.chatId}-${thread.threadId}-${message.messageId}-${thread.chatType}-${message.tsUpdated}`}
                    content={message.content}
                    isSent={isSent}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            </Box>
        );

        return (
            <Box
                ref={bubbleRef}
                sx={{
                    width: "100%",
                    position: "relative",
                    py: 0.5,
                    pl: 1,
                    pr: 1,
                    borderLeft: "3px solid",
                    borderLeftColor: focusAccent,
                    backgroundColor: showUnderBarOption
                        ? isDark
                            ? "rgba(255,255,255,0.03)"
                            : "rgba(0,0,0,0.025)"
                        : "transparent",
                    transition: "background-color 0.15s ease",
                }}
                onMouseEnter={() => setShowUnderBarOption(true)}
                onMouseLeave={() => setShowUnderBarOption(false)}
            >
                {emojiPickerPositionCalculated === true && (
                    <EmojiPicker
                        pickerBottomPosition={pickerBottomPosition}
                        pickerLeftPosition={pickerLeftPosition}
                        pickerRightPosition={pickerRightPosition}
                        pickerTopPosition={pickerTopPosition}
                        setSelectedEmoji={setSelectedEmoji}
                        setShowEmojiPicker={setShowEmojiPicker}
                        showEmojiPicker={showEmojiPicker}
                        useFixedPosition={true}
                    />
                )}

                {showUnderBarOption === true && (
                    <Box
                        ref={toolbarRef}
                        sx={{
                            position: "absolute",
                            top: COMPACT_TOOLBAR_OFFSET.top,
                            right: COMPACT_TOOLBAR_OFFSET.right,
                            zIndex: 2,
                            backgroundColor: isDark ? "#1f2937" : "#ffffff",
                            border: "1px solid",
                            borderColor: isDark ? "#374151" : "#e5e7eb",
                            borderRadius: "8px",
                            px: 0.5,
                            boxShadow: isDark
                                ? "0 2px 8px rgba(0,0,0,0.4)"
                                : "0 2px 8px rgba(0,0,0,0.1)",
                        }}
                    >
                        <BubbleActions />
                    </Box>
                )}

                <Stack alignItems="flex-start" direction="row" spacing={1.5}>
                    {!isSystemUser &&
                        (isSimpleBubble ? (
                            <Box sx={{ flexShrink: 0, width: COMPACT_BODY_INDENT - 12 }} />
                        ) : (
                            <Box sx={{ flexShrink: 0 }}>
                                <UserAvatar
                                    userId={isSent ? myself.userId : message.sender.userId}
                                />
                            </Box>
                        ))}

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        {!isSimpleBubble && (
                            <BubbleUserName
                                chatType={thread.chatType}
                                dtSent={dtSent}
                                isSent={isSent}
                                isSimpleBubble={false}
                                isThread={true}
                                sender={message.sender}
                                taskId={thread.taskId}
                                taskStatus={null}
                                tsSent={message.tsSent}
                                tsUpdated={message.tsUpdated}
                                userName={message.sender.userName}
                            />
                        )}

                        {message.attachment ? (
                            <Box sx={{ mt: isSimpleBubble ? 0 : 0.5 }}>
                                <BubbleAttachmentSheet
                                    fileName={message.attachment.fileName}
                                    fileSize={message.attachment.size}
                                    isSent={isSent}
                                />
                            </Box>
                        ) : (
                            messageBody
                        )}

                        <BubbleUnderBar
                            chatName={thread.chatName}
                            chatType={thread.chatType}
                            dmPartnerUser={thread.dmPartnerUser}
                            isThread={true}
                            message={message}
                            myself={myself}
                            numReplies={0}
                            reactions={reactions}
                            setReactions={setReactions}
                            setShowEmojiPicker={setShowEmojiPicker}
                            setUniqueReactionEmojiCount={setUniqueReactionEmojiCount}
                            showUnderBarOption={showUnderBarOption}
                            socket={socket}
                        />
                    </Box>
                </Stack>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                maxWidth: "90%",
                minWidth:
                    (isSimpleBubble ? 100 : 200) +
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
                            background: isFocused ? focusedColors.bg : colors.bg,
                            // Text color for proper contrast
                            color: isFocused ? focusedColors.text : colors.text,
                            // Border styling
                            border: "1px solid",
                            borderColor: isFocused ? focusedColors.border : colors.border,
                            // Shadow for depth
                            boxShadow: isFocused
                                ? isDark
                                    ? `0 4px 20px rgba(34,197,94,0.2), inset 0 1px 0 rgba(255,255,255,0.05)`
                                    : `0 4px 20px rgba(22,163,74,0.15)`
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
                        onClick={handleMessageClick}
                        onMouseEnter={() => setShowUnderBarOption(true)}
                        onMouseLeave={() => setShowUnderBarOption(false)}
                        onDoubleClick={() => {
                            setTodoFromMessageBubble(message);
                        }}
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
                                    alignItems="center"
                                    direction="row"
                                    spacing={0}
                                    sx={{ mb: 0.5 }}
                                >
                                    <BubbleUserName
                                        chatType={thread.chatType}
                                        dtSent={dtSent}
                                        isSent={isSent}
                                        isSimpleBubble={isSimpleBubble}
                                        isThread={true}
                                        sender={message.sender}
                                        taskId={thread.taskId}
                                        taskStatus={null}
                                        tsSent={message.tsSent}
                                        tsUpdated={message.tsUpdated}
                                        userName={message.sender.userName}
                                    />
                                    <BubbleActions />
                                </Stack>
                            )}

                            {isSimpleBubble === false && (
                                <Stack alignItems="flex-start" direction="row" spacing={1.5}>
                                    {message.sender.isSystemUser !== true && (
                                        <Box sx={{ flexShrink: 0 }}>
                                            <UserAvatar
                                                userId={
                                                    isSent ? myself.userId : message.sender.userId
                                                }
                                            />
                                        </Box>
                                    )}
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Stack alignItems="center" direction="row">
                                            <BubbleUserName
                                                chatType={thread.chatType}
                                                dtSent={dtSent}
                                                isSent={isSent}
                                                isSimpleBubble={isSimpleBubble}
                                                isThread={true}
                                                sender={message.sender}
                                                taskId={thread.taskId}
                                                taskStatus={null}
                                                tsSent={message.tsSent}
                                                tsUpdated={message.tsUpdated}
                                                userName={message.sender.userName}
                                            />
                                            {showUnderBarOption === true && <BubbleActions />}
                                        </Stack>
                                    </Box>
                                </Stack>
                            )}

                            {message.content.length > 0 && (
                                <Box sx={{ mt: isSimpleBubble ? 0 : 0.5 }}>
                                    <BnChatPreview
                                        key={`${thread.chatId}-${thread.threadId}-${message.messageId}-${thread.chatType}-${message.tsUpdated}`}
                                        content={message.content}
                                        isSent={isSent}
                                        myself={myself}
                                        setMyself={setMyself}
                                        socket={socket}
                                        useCM={useCM}
                                        useTEM={useTEM}
                                        useUISM={useUISM}
                                    />
                                </Box>
                            )}
                        </Stack>

                        <BubbleUnderBar
                            chatName={thread.chatName}
                            chatType={thread.chatType}
                            dmPartnerUser={thread.dmPartnerUser}
                            isThread={true}
                            message={message}
                            myself={myself}
                            numReplies={0}
                            reactions={reactions}
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
