import { memo, useEffect, useRef, useState } from "react";
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
import { useDoubleClickTodoPreference } from "../../../../hooks/common/useDoubleClickTodoPreference";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { MessageProps, ThreadMessageProps, ThreadProps } from "../../../../types/chat";
import { ReactionProps } from "../../../../types/common";
import { TaskCommentProps } from "../../../../types/tasks";
import { extractYYYYMMDDHHMM, getLocalCurrentTimestamp } from "../../../../utils/dateUtils";
import { BubbleAttachmentSheet } from "./BubbleAttachmentSheet";
import {
    BUBBLE_COLORS,
    COMPACT_BODY_INDENT,
    COMPACT_FOCUSED_BG,
    COMPACT_TOOLBAR_OFFSET,
} from "./bubbleStyleTokens";
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

const ThreadMessageBubbleImpl = (props: threadMessageBubbleProps) => {
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
    const { enabled: doubleClickTodoEnabled } = useDoubleClickTodoPreference();
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

            // Update currentThreadChat's moveToSpecificIndex to focus on this
            // message. Format: {chatId}-{threadId}-{messageId} to match
            // messageIdWithChatIdAndThreadId.
            //
            // Uses the functional updater so the latest `currentThreadChat`
            // is read at call time — required for downstream React.memo on
            // this bubble to be safe (we no longer close over the value at
            // render time).
            const newMoveIndex = `${thread.chatId}-${threadId}-${message.messageId}`;
            useCM.setCurrentThreadChat((prev) => {
                if (!prev || prev.moveToSpecificIndex === newMoveIndex) return prev;
                return { ...prev, moveToSpecificIndex: newMoveIndex };
            });
        }
    };

    // Reaction handling
    const [showUnderBarOption, setShowUnderBarOption] = useState(false);
    const [reactions, setReactions] = useState<ReactionProps[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [selectedEmoji, setSelectedEmoji] = useState<any>(null);
    const [uniqueReactionEmojiCount, setUniqueReactionEmojiCount] = useState<number>(0);
    // Per-bubble wrap toggles. Same pattern as `MessageBubble`.
    const [unwrapAll, setUnwrapAll] = useState<boolean>(false);
    const [unwrapCode, setUnwrapCode] = useState<boolean>(false);
    const previewWrapClassName = [unwrapAll && "bn-unwrap-all", unwrapCode && "bn-unwrap-code"]
        .filter(Boolean)
        .join(" ");

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

        // Viewport-clamped fixed positioning, used in both bubble and
        // compact modes. Anchors to the floating toolbar when present
        // (compact mode), otherwise to the bubble container (bubble
        // mode). The picker's right edge aligns with the anchor's right
        // edge, then clamps to viewport so it never falls off-screen.
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
    }, [showEmojiPicker]);

    useEffect(() => {
        setReactions(message.reactions || []);
    }, [message]);

    useEffect(() => {
        if (selectedEmoji !== null) {
            // Backend's reaction handler skips its 8-way Django refetch when this
            // is present (see backend/socketio_events/message_reaction_handlers.py).
            const emptyUser = {
                userName: "",
                userId: "",
                avatarImgPath: "",
                tsLastSeen: "",
                tsJoined: "",
                customStatus: "",
            };
            const messageSnapshot = {
                sender: message.sender,
                receiver:
                    thread.chatType === 1
                        ? message.sender.userId === myself.userId
                            ? thread.dmPartnerUser
                            : myself
                        : emptyUser,
                dmPartnerUser: thread.chatType === 1 ? thread.dmPartnerUser : emptyUser,
                taskId: message.taskId,
                content: message.content,
                // Parent thread carries the human-readable task id
                // (the same value the bubble's existing
                // `displayId={thread.displayId}` plumbing uses). The
                // reaction handler echoes this back on the derived
                // activity broadcast so the chat activity sidebar shows
                // "<code>-<n>" instead of "#<taskId>".
                displayId: thread.displayId,
                tsSent: message.tsSent,
                tsUpdated: message.tsUpdated,
            };

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
                        messageSnapshot,
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
                            messageSnapshot,
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
                        messageSnapshot,
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
                            messageSnapshot,
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
                unwrapAll={unwrapAll}
                setUnwrapAll={setUnwrapAll}
                unwrapCode={unwrapCode}
                setUnwrapCode={setUnwrapCode}
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
                className={previewWrapClassName || undefined}
                sx={{ mt: isSimpleBubble ? 0 : 0.25 }}
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
                    py: 0.25,
                    pl: 2,
                    pr: 2,
                    cursor: "pointer",
                    borderLeft: "3px solid",
                    borderLeftColor: focusAccent,
                    borderTop: isSimpleBubble ? "none" : "1px solid",
                    borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                    backgroundColor:
                        isFocused === "focused"
                            ? COMPACT_FOCUSED_BG.focused[isDark ? "dark" : "light"]
                            : isFocused === "threadActive"
                              ? COMPACT_FOCUSED_BG.threadActive[isDark ? "dark" : "light"]
                              : showUnderBarOption
                                ? isDark
                                    ? "rgba(255,255,255,0.03)"
                                    : "rgba(0,0,0,0.025)"
                                : "transparent",
                    transition: "background-color 0.15s ease",
                }}
                onClick={handleMessageClick}
                onDoubleClick={
                    doubleClickTodoEnabled
                        ? () => {
                              setTodoFromMessageBubble(message);
                          }
                        : undefined
                }
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
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
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
                                displayId={thread.displayId}
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
                            pickerTopPosition={pickerTopPosition}
                            setSelectedEmoji={setSelectedEmoji}
                            setShowEmojiPicker={setShowEmojiPicker}
                            showEmojiPicker={showEmojiPicker}
                            useFixedPosition={true}
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
                        onDoubleClick={
                            doubleClickTodoEnabled
                                ? () => {
                                      setTodoFromMessageBubble(message);
                                  }
                                : undefined
                        }
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
                                        displayId={thread.displayId}
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
                                                displayId={thread.displayId}
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
                                <Box
                                    className={previewWrapClassName || undefined}
                                    sx={{ mt: isSimpleBubble ? 0 : 0.5 }}
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

// Memoized export. See MessageBubble.tsx for the rationale on which props
// the comparator considers — same reasoning applies here. `thread` plays
// the role of `chat` for thread context; the rest mirrors MessageBubble.
const areEqual = (prev: threadMessageBubbleProps, next: threadMessageBubbleProps): boolean =>
    prev.message === next.message &&
    prev.thread === next.thread &&
    prev.variant === next.variant &&
    prev.isFocused === next.isFocused &&
    prev.isScrolling === next.isScrolling &&
    prev.isSimpleBubble === next.isSimpleBubble &&
    prev.currentMessageIndex === next.currentMessageIndex &&
    prev.myself.userId === next.myself.userId;

export const ThreadMessageBubble = memo(ThreadMessageBubbleImpl, areEqual);
