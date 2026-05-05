import { useEffect, useRef, useState } from "react";
import EditIcon from "@mui/icons-material/Edit";
import { Box, Card, IconButton, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { BnChatPreview } from "../../../../../../components/editors/bnChatPreview";
import { UserAvatar } from "../../../../../../components/ui/avatars/UserAvatar";
import { EmojiPicker } from "../../../../../../components/ui/emoji/EmojiPicker";
import { ReactionTaskCommentEmojiDisplay } from "../../../../../../components/ui/emoji/ReactionTaskCommentEmojiDisplay";
import { ChatManagementState } from "../../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../../../types/admin";
import { ReactionProps } from "../../../../../../types/common";
import { TaskCommentProps } from "../../../../../../types/tasks";
import {
    extractMMDDHHMMSSs,
    extractYYYYMMDDHHMM,
    getLocalCurrentTimestamp,
} from "../../../../../../utils/dateUtils";

// Color scheme for task comment bubbles. The `focused` palette is
// applied when the bubble matches the URL's `comment/:commentId`
// segment (deep-link target) and mirrors the green focus tint used by
// `ThreadMessageBubble.BUBBLE_COLORS.focused` so the visual language is
// consistent across thread bubbles and task comments.
const COMMENT_COLORS = {
    dark: {
        bg: "#1e1b4b",
        border: "#3730a3",
        text: "#e0e7ff",
        secondaryText: "rgba(224, 231, 255, 0.6)",
    },
    light: {
        bg: "#ffffff",
        border: "#e5e7eb",
        text: "#111827",
        secondaryText: "rgba(17, 24, 39, 0.55)",
    },
    focused: {
        dark: {
            bg: "#14532d",
            border: "#22c55e",
            text: "#dcfce7",
            secondaryText: "rgba(220, 252, 231, 0.7)",
        },
        light: {
            bg: "#dcfce7",
            border: "#22c55e",
            text: "#14532d",
            secondaryText: "rgba(20, 83, 45, 0.7)",
        },
    },
} as const;

type TaskCommentBubbleProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    comment: TaskCommentProps;
    currentProjectId?: number;
    currentProjectName?: string;
    setIsInEdit: (value: boolean) => void;
    setEditTargetComment: (value: TaskCommentProps) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    /** When true, render the bubble with the green focus palette so the
     * deep-link target stands out after navigation. Owned by
     * `TaskCommentList`, which derives it from the URL's `commentId`. */
    isFocused?: boolean;
    /** Click handler that updates the URL with this comment's deep
     * link. Optional so callers that don't wire routing (none today,
     * but keeps the bubble reusable) get the original non-clickable
     * behaviour. */
    onCommentClick?: () => void;
};

export const TaskCommentBubble = (props: TaskCommentBubbleProps) => {
    const {
        useTEM,
        socket,
        myself,
        setMyself,
        comment,
        currentProjectId,
        currentProjectName,
        setIsInEdit,
        setEditTargetComment,
        useCM,
        useUISM,
        isFocused = false,
        onCommentClick,
    } = props;

    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const baseColors = isDark ? COMMENT_COLORS.dark : COMMENT_COLORS.light;
    const focusedColors = isDark ? COMMENT_COLORS.focused.dark : COMMENT_COLORS.focused.light;
    const colors = isFocused ? focusedColors : baseColors;

    const isEdited = extractMMDDHHMMSSs(comment.tsSent) !== extractMMDDHHMMSSs(comment.tsUpdated);

    // Reaction handling
    const [showUnderBarOption, setShowUnderBarOption] = useState(false);
    const [reactions, setReactions] = useState<ReactionProps[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [selectedEmoji, setSelectedEmoji] = useState<any>(null);

    useEffect(() => {
        if (comment.reactions) {
            setReactions(comment.reactions);
        }
    }, []);

    useEffect(() => {
        if (comment.reactions) {
            setReactions(comment.reactions);
        }
    }, [comment]);

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
                    socket.emit("task_comment_reaction", {
                        method_type: "DELETE",
                        team_id: myself.teamId,
                        project_id: currentProjectId,
                        project_name: currentProjectName,
                        task_id: comment.taskId,
                        comment_id: comment.commentId,
                        comment_body: comment.commentBody,
                        comment_sender_id: comment.senderId,
                        comment_sender_name: comment.senderName,
                        reaction_emoji: selectedEmoji,
                    });
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
                    socket.emit("task_comment_reaction", {
                        method_type: "POST",
                        team_id: myself.teamId,
                        project_id: currentProjectId,
                        project_name: currentProjectName,
                        task_id: comment.taskId,
                        comment_id: comment.commentId,
                        comment_body: comment.commentBody,
                        comment_sender_id: comment.senderId,
                        comment_sender_name: comment.senderName,
                        reaction_emoji: selectedEmoji,
                    });
                }
            }
            setSelectedEmoji(null);
        }
    }, [selectedEmoji]);

    const boxRef = useRef<HTMLDivElement>(null);
    const [pickerTopPosition, setPickerTopPosition] = useState<number | string>("auto");
    const [pickerBottomPosition, setPickerBottomPosition] = useState<number | string>("auto");
    const [pickerRightPosition, setPickerRightPosition] = useState<number | string>("auto");
    const [pickerLeftPosition, setPickerLeftPosition] = useState<number | string>("auto");
    const [emojiPickerPositionCalculated, setEmojiPickerPositionCalculated] =
        useState<boolean>(false);

    useEffect(() => {
        if (showEmojiPicker && boxRef.current) {
            const rect = boxRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const pickerHeight = 435;
            const pickerWidth = 352;

            if (viewportHeight - rect.bottom > pickerHeight + 20) {
                setPickerTopPosition(rect.bottom + 10);
                setPickerBottomPosition("auto");
            } else if (rect.top > pickerHeight + 20) {
                setPickerTopPosition(rect.top - pickerHeight - 10);
                setPickerBottomPosition("auto");
            } else {
                setPickerTopPosition(20);
                setPickerBottomPosition("auto");
            }

            // Anchor the picker to the RIGHT edge of the comment bubble:
            // its right edge should align with rect.right, so its left coordinate
            // is rect.right - pickerWidth. Then clamp to keep it inside the viewport.
            const desiredLeft = rect.right - pickerWidth;
            const leftPos = Math.max(20, Math.min(desiredLeft, viewportWidth - pickerWidth - 20));
            setPickerLeftPosition(leftPos);
            setPickerRightPosition("auto");
            setEmojiPickerPositionCalculated(true);
        }

        if (showEmojiPicker === false) {
            setEmojiPickerPositionCalculated(false);
        }
    }, [showEmojiPicker]);

    return (
        <Box ref={boxRef} sx={{ py: 0.5 }}>
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

            {comment.commentBody[0].content.length > 0 && (
                <Box
                    key={`${comment.commentId}-${comment.tsUpdated}`}
                    onMouseEnter={() => setShowUnderBarOption(true)}
                    onMouseLeave={() => setShowUnderBarOption(false)}
                    onClick={onCommentClick}
                    sx={{ cursor: onCommentClick ? "pointer" : "default" }}
                >
                    <Card
                        sx={{
                            borderRadius: "16px",
                            position: "relative",
                            overflow: "hidden",
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            background: colors.bg,
                            color: colors.text,
                            border: "1px solid",
                            borderColor: colors.border,
                            boxShadow: isDark
                                ? "0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)"
                                : "0 2px 8px rgba(0,0,0,0.06)",
                            "&:hover": {
                                boxShadow: isDark
                                    ? "0 4px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)"
                                    : "0 4px 16px rgba(0,0,0,0.1)",
                                borderColor: isDark
                                    ? "rgba(99, 102, 241, 0.4)"
                                    : "rgba(99, 102, 241, 0.25)",
                            },
                        }}
                    >
                        {/* Subtle top highlight */}
                        <Box
                            sx={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                height: "1px",
                                background: isDark
                                    ? "rgba(255,255,255,0.06)"
                                    : "rgba(255,255,255,0.8)",
                                pointerEvents: "none",
                            }}
                        />

                        {/* Header with avatar, name, and timestamp */}
                        <Stack alignItems="center" direction="row" spacing={1.5}>
                            <UserAvatar userId={comment.senderId} />
                            <Typography
                                level="title-md"
                                sx={{
                                    fontWeight: 600,
                                    fontSize: "0.9rem",
                                    color: colors.text,
                                    letterSpacing: "-0.01em",
                                }}
                            >
                                {comment.senderName}
                            </Typography>
                            <Typography
                                level="body-xs"
                                sx={{
                                    fontWeight: 500,
                                    fontSize: "0.7rem",
                                    color: colors.secondaryText,
                                    letterSpacing: "0.02em",
                                    fontFamily: "inherit",
                                }}
                            >
                                {isEdited
                                    ? `${extractYYYYMMDDHHMM(comment.tsSent)} Edited`
                                    : extractYYYYMMDDHHMM(comment.tsSent)}
                            </Typography>
                        </Stack>

                        {/* Reactions display */}
                        <Box
                            onClick={(e) => e.stopPropagation()}
                            sx={{
                                position: "absolute",
                                bottom: -12,
                                right: 10,
                            }}
                        >
                            <ReactionTaskCommentEmojiDisplay
                                comment={comment}
                                myself={myself}
                                projectId={currentProjectId}
                                projectName={currentProjectName}
                                reactions={reactions}
                                setReactions={setReactions}
                                setShowEmojiPicker={setShowEmojiPicker}
                                showUnderBarOption={showUnderBarOption}
                                socket={socket}
                            />
                        </Box>

                        {/* Edit button */}
                        <Tooltip
                            size="sm"
                            title="Edit"
                            placement="top"
                            sx={{
                                borderRadius: "8px",
                                fontSize: "0.75rem",
                            }}
                        >
                            <IconButton
                                size="sm"
                                onClick={(e) => {
                                    // Don't let the edit button doubly
                                    // trigger the bubble-level click
                                    // handler (which would navigate to
                                    // the deep-link URL).
                                    e.stopPropagation();
                                    setIsInEdit(true);
                                    setEditTargetComment(comment);
                                }}
                                sx={{
                                    position: "absolute",
                                    top: 8,
                                    right: 8,
                                    width: 28,
                                    height: 28,
                                    borderRadius: "8px",
                                    transition: "all 0.15s ease",
                                    opacity: showUnderBarOption ? 1 : 0,
                                    color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
                                    background: "transparent",
                                    "&:hover": {
                                        background: isDark
                                            ? "rgba(251,191,36,0.15)"
                                            : "rgba(245,158,11,0.1)",
                                        color: isDark ? "#fbbf24" : "#f59e0b",
                                        transform: "scale(1.05)",
                                    },
                                    "&:active": {
                                        transform: "scale(0.95)",
                                    },
                                }}
                            >
                                <EditIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </Tooltip>

                        {/* Comment content */}
                        <Box sx={{ mt: 0.5 }}>
                            <BnChatPreview
                                key={`${comment.taskId}-${comment.commentId}-${comment.tsSent}`}
                                useCM={useCM}
                                content={comment.commentBody}
                                customClassName="task-comment-preview"
                                isSent={true}
                                myself={myself}
                                setMyself={setMyself}
                                socket={socket}
                                useTEM={useTEM}
                                useUISM={useUISM}
                            />
                        </Box>
                    </Card>
                </Box>
            )}
        </Box>
    );
};
