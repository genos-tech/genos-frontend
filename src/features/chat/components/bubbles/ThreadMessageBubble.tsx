import { useEffect, useRef, useState } from "react";
import { Box, Sheet, Stack } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { BnChatPreview } from "../../../../components/editors/bnChatPreview";
import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { EmojiPicker } from "../../../../components/ui/emoji/EmojiPicker";
import { EmojiReaction } from "../../../../components/ui/emoji/EmojiReaction";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { ThreadMessageProps, ThreadProps } from "../../../../types/chat";
import { ReactionProps } from "../../../../types/common";
import { extractYYYYMMDDHHMM, getLocalCurrentTimestamp } from "../../../../utils/dateUtils";
import { BubbleAttachmentSheet } from "./BubbleAttachmentSheet";
import { BubbleDeleteButton } from "./BubbleDeleteButton";
import { BubbleFlagButton } from "./BubbleFlagButton";
import { BubbleThreadEditButton } from "./BubbleThreadEditButton";
import { BubbleUnderBar } from "./BubbleUnderBar";
import { BubbleUserName } from "./BubbleUserName";

// Color schemes for sent/received bubbles - improved for better text contrast
const BUBBLE_COLORS = {
    sent: {
        dark: { bg: "#3b0764", border: "#7c3aed", text: "#f3e8ff" },
        light: { bg: "#f5f3ff", border: "#c4b5fd", text: "#3b0764" },
    },
    received: {
        dark: { bg: "#1f2937", border: "#374151", text: "#f3f4f6" },
        light: { bg: "#ffffff", border: "#e5e7eb", text: "#111827" },
    },
    focused: {
        dark: { bg: "#14532d", border: "#22c55e", text: "#dcfce7" },
        light: { bg: "#dcfce7", border: "#22c55e", text: "#14532d" },
    },
} as const;

type threadMessageBubbleProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    thread: ThreadProps;
    variant: "sent" | "received";
    message: ThreadMessageProps;
    isScrolling: boolean;
    isFocused: boolean;
    isSimpleBubble: boolean;
    useUISM: UIStateManagementState;
    setIsInEdit: (value: boolean) => void;
    setEditTargetMessage: (value: ThreadMessageProps) => void;
    currentMessageIndex: number;
    setTargetMessageIndex: (value: number) => void;
    useCM: ChatManagementState;
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
    } = props;

    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { accessToken } = useAuth();
    const isSent = variant === "sent";
    const dtSent = extractYYYYMMDDHHMM(message.tsSent);

    // Get bubble colors based on variant and theme
    const bubbleColors = isSent ? BUBBLE_COLORS.sent : BUBBLE_COLORS.received;
    const colors = isDark ? bubbleColors.dark : bubbleColors.light;
    const focusedColors = isDark ? BUBBLE_COLORS.focused.dark : BUBBLE_COLORS.focused.light;

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

    // Thread bubble action buttons
    const BubbleActions = () => (
        <Stack
            direction="row"
            spacing={0.25}
            sx={{
                opacity: showUnderBarOption ? 1 : 0,
                transition: "opacity 0.15s ease",
            }}
        >
            <Box sx={{ textAlign: "right", pl: "8px" }}>
                {isScrolling !== true && (
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
                        showUnderBarOption={showUnderBarOption}
                        socket={socket}
                        setUniqueReactionEmojiCount={setUniqueReactionEmojiCount}
                    />
                )}
            </Box>

            <BubbleFlagButton
                accessToken={accessToken}
                currentThreadChat={thread}
                flaggedMessages={useCM.flaggedMessages}
                message={message}
                myself={myself}
                setCurrentThreadChat={useCM.setCurrentThreadChat}
                setFlaggedMessages={useCM.setFlaggedMessages}
                threadId={thread.threadId}
            />

            {message.sender.userId === myself.userId && (
                <BubbleThreadEditButton
                    currentMessageIndex={currentMessageIndex}
                    message={message}
                    setEditTargetMessage={setEditTargetMessage}
                    setIsInEdit={setIsInEdit}
                    setTargetMessageIndex={setTargetMessageIndex}
                />
            )}

            {message.messageId !== 1 && message.sender.userId === myself.userId && (
                <BubbleDeleteButton
                    accessToken={accessToken}
                    currentThreadChat={thread}
                    isThread={true}
                    message={message}
                    setCurrentThreadChat={useCM.setCurrentThreadChat}
                    socket={socket}
                />
            )}
        </Stack>
    );

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
                                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                    {message.sender.isSystemUser !== true && (
                                        <Box sx={{ flexShrink: 0 }}>
                                            <AvatarWithStatus
                                                useCM={useCM}
                                                isForBubble={true}
                                                isYou={isSent}
                                                myself={myself}
                                                setMyself={setMyself}
                                                socket={socket}
                                                thread={thread}
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
                                        <Stack direction="row" alignItems="center">
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
