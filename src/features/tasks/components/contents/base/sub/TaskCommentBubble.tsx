import { useEffect, useRef, useState } from "react";
import CodeIcon from "@mui/icons-material/Code";
import EditIcon from "@mui/icons-material/Edit";
import WrapTextIcon from "@mui/icons-material/WrapText";
import { Box, IconButton, Sheet, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { BnChatPreview } from "../../../../../../components/editors/bnChatPreview";
import { AppTooltip } from "../../../../../../components/ui/AppTooltip";
import { UserAvatar } from "../../../../../../components/ui/avatars/UserAvatar";
import { EmojiPicker } from "../../../../../../components/ui/emoji/EmojiPicker";
import { ReactionTaskCommentEmojiDisplay } from "../../../../../../components/ui/emoji/ReactionTaskCommentEmojiDisplay";
import { ChatManagementState } from "../../../../../../hooks/chats/useChatManagement";
import { useBubbleStylePreference } from "../../../../../../hooks/common/useBubbleStylePreference";
import { useDoubleClickTodoPreference } from "../../../../../../hooks/common/useDoubleClickTodoPreference";
import { TeamManagementState } from "../../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../../../../../i18n";
import { UserProps } from "../../../../../../types/admin";
import { MessageProps, ThreadMessageProps } from "../../../../../../types/chat";
import { ReactionProps } from "../../../../../../types/common";
import { TaskCommentProps } from "../../../../../../types/tasks";
import {
    extractMMDDHHMMSSs,
    extractYYYYMMDDHHMM,
    getLocalCurrentTimestamp,
} from "../../../../../../utils/dateUtils";
import {
    BUBBLE_COLORS,
    COMPACT_BODY_INDENT,
    COMPACT_FOCUSED_BG,
    COMPACT_TOOLBAR_OFFSET,
} from "../../../../../chat/components/bubbles/bubbleStyleTokens";

type TaskCommentBubbleProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    comment: TaskCommentProps;
    currentProjectId?: number;
    currentProjectName?: string;
    /** Parent task's human-readable id ("<code>-<n>"), threaded down
     *  to the reaction emits so their derived activity broadcasts can
     *  stamp it onto the chat-activity-sidebar entry. Without this the
     *  activity item for a reaction falls back to "#<taskId>". */
    currentTaskDisplayId?: string | null;
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
    setTodoFromMessageBubble?: (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => void;
};

export const TaskCommentBubble = (props: TaskCommentBubbleProps) => {
    const {
        socket,
        myself,
        setMyself,
        comment,
        currentProjectId,
        currentProjectName,
        currentTaskDisplayId,
        setIsInEdit,
        setEditTargetComment,
        useCM,
        useTEM,
        useUISM,
        isFocused = false,
        onCommentClick,
        setTodoFromMessageBubble,
    } = props;

    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();
    const { style } = useBubbleStylePreference();
    const isCompact = style === "compact";
    const { enabled: doubleClickTodoEnabled } = useDoubleClickTodoPreference();
    const isSent = comment.senderId === myself.userId;

    // Palette harmonised with MessageBubble: sent → purple, received →
    // neutral, focused → green deep-link tint.
    const variantColors = isSent
        ? isDark
            ? BUBBLE_COLORS.sent.dark
            : BUBBLE_COLORS.sent.light
        : isDark
          ? BUBBLE_COLORS.received.dark
          : BUBBLE_COLORS.received.light;
    const focusedColors = isDark ? BUBBLE_COLORS.focused.dark : BUBBLE_COLORS.focused.light;
    const colors = isFocused ? focusedColors : variantColors;
    const secondaryText = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)";

    const isEdited = extractMMDDHHMMSSs(comment.tsSent) !== extractMMDDHHMMSSs(comment.tsUpdated);

    // Reaction handling
    const [showUnderBarOption, setShowUnderBarOption] = useState(false);
    const [reactions, setReactions] = useState<ReactionProps[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [selectedEmoji, setSelectedEmoji] = useState<any>(null);
    // Per-bubble wrap toggles. Same CSS-class approach as the chat
    // message bubbles — class lives on a wrapper Box around the
    // preview, App.css drives the actual wrap/scroll behaviour.
    const [unwrapAll, setUnwrapAll] = useState<boolean>(false);
    const [unwrapCode, setUnwrapCode] = useState<boolean>(false);
    const previewWrapClassName = [unwrapAll && "bn-unwrap-all", unwrapCode && "bn-unwrap-code"]
        .filter(Boolean)
        .join(" ");

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
                const updatedReactions = reactions.filter((_, idx) => idx !== existingIndex);
                setReactions(updatedReactions);
                if (socket) {
                    socket.emit("task_comment_reaction", {
                        method_type: "DELETE",
                        team_id: myself.teamId,
                        project_id: currentProjectId,
                        project_name: currentProjectName,
                        task_id: comment.taskId,
                        display_id: currentTaskDisplayId,
                        comment_id: comment.commentId,
                        comment_body: comment.commentBody,
                        comment_sender_id: comment.senderId,
                        comment_sender_name: comment.senderName,
                        reaction_emoji: selectedEmoji,
                    });
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
                    socket.emit("task_comment_reaction", {
                        method_type: "POST",
                        team_id: myself.teamId,
                        project_id: currentProjectId,
                        project_name: currentProjectName,
                        task_id: comment.taskId,
                        display_id: currentTaskDisplayId,
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
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [pickerTopPosition, setPickerTopPosition] = useState<number | string>("auto");
    const [pickerBottomPosition, setPickerBottomPosition] = useState<number | string>("auto");
    const [pickerRightPosition, setPickerRightPosition] = useState<number | string>("auto");
    const [pickerLeftPosition, setPickerLeftPosition] = useState<number | string>("auto");
    const [emojiPickerPositionCalculated, setEmojiPickerPositionCalculated] =
        useState<boolean>(false);

    useEffect(() => {
        if (showEmojiPicker) {
            const anchor = isCompact && toolbarRef.current ? toolbarRef.current : boxRef.current;
            if (!anchor) return;
            const rect = anchor.getBoundingClientRect();
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

            const desiredLeft = rect.right - pickerWidth;
            const leftPos = Math.max(20, Math.min(desiredLeft, viewportWidth - pickerWidth - 20));
            setPickerLeftPosition(leftPos);
            setPickerRightPosition("auto");
            setEmojiPickerPositionCalculated(true);
        }

        if (showEmojiPicker === false) {
            setEmojiPickerPositionCalculated(false);
        }
    }, [showEmojiPicker, isCompact]);

    if (comment.commentBody[0].content.length === 0) {
        return null;
    }

    // Shared button styling for the top-right cluster (wrap toggles +
    // edit). Off = transparent neutral; on = accent-tinted background
    // (matches the editor toolbars' `isSelected` styling for wrap).
    const toggleButtonSx = (active: boolean) => ({
        width: 28,
        height: 28,
        borderRadius: "8px",
        transition: "all 0.15s ease",
        color: active
            ? isDark
                ? "#a5b4fc"
                : "#6366f1"
            : isDark
              ? "rgba(255,255,255,0.7)"
              : "rgba(0,0,0,0.55)",
        background: active
            ? isDark
                ? "rgba(99,102,241,0.20)"
                : "rgba(99,102,241,0.10)"
            : "transparent",
        "&:hover": {
            background: isDark ? "rgba(99,102,241,0.28)" : "rgba(99,102,241,0.15)",
            color: isDark ? "#a5b4fc" : "#6366f1",
        },
    });

    const wrapToggleButtons = (
        <>
            <AppTooltip title={unwrapAll ? "Wrap all content" : "Unwrap all content"}>
                <IconButton
                    size="sm"
                    sx={toggleButtonSx(unwrapAll)}
                    onClick={(e) => {
                        e.stopPropagation();
                        setUnwrapAll(!unwrapAll);
                    }}
                >
                    <WrapTextIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </AppTooltip>
            <AppTooltip title={unwrapCode ? "Wrap code blocks" : "Unwrap code blocks"}>
                <IconButton
                    size="sm"
                    sx={toggleButtonSx(unwrapCode)}
                    onClick={(e) => {
                        e.stopPropagation();
                        setUnwrapCode(!unwrapCode);
                    }}
                >
                    <CodeIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </AppTooltip>
        </>
    );

    const editButton = (
        <AppTooltip title={t.tasks.comment.editTooltip}>
            <IconButton
                size="sm"
                sx={{
                    width: 28,
                    height: 28,
                    borderRadius: "8px",
                    transition: "all 0.15s ease",
                    color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.55)",
                    background: "transparent",
                    "&:hover": {
                        background: isDark ? "rgba(251,191,36,0.15)" : "rgba(245,158,11,0.1)",
                        color: isDark ? "#fbbf24" : "#f59e0b",
                    },
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    setIsInEdit(true);
                    setEditTargetComment(comment);
                }}
            >
                <EditIcon sx={{ fontSize: 16 }} />
            </IconButton>
        </AppTooltip>
    );

    const reactionsDisplay = (
        <Box onClick={(e) => e.stopPropagation()}>
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
                taskDisplayId={currentTaskDisplayId}
            />
        </Box>
    );

    const commentBody = (
        <Box className={previewWrapClassName || undefined}>
            <BnChatPreview
                key={`${comment.taskId}-${comment.commentId}-${comment.tsSent}`}
                content={comment.commentBody}
                customClassName="task-comment-preview"
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

    if (isCompact) {
        const focusAccent = isFocused
            ? BUBBLE_COLORS.focused[isDark ? "dark" : "light"].border
            : "transparent";

        return (
            <Box
                ref={boxRef}
                sx={{
                    width: "100%",
                    position: "relative",
                    py: 0.25,
                    pl: 2,
                    pr: 2,
                    cursor: onCommentClick ? "pointer" : "default",
                    borderLeft: "3px solid",
                    borderLeftColor: focusAccent,
                    borderTop: "1px solid",
                    borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                    backgroundColor: isFocused
                        ? COMPACT_FOCUSED_BG.focused[isDark ? "dark" : "light"]
                        : showUnderBarOption
                          ? isDark
                              ? "rgba(255,255,255,0.03)"
                              : "rgba(0,0,0,0.025)"
                          : "transparent",
                    transition: "background-color 0.15s ease",
                }}
                onClick={onCommentClick}
                onMouseEnter={() => setShowUnderBarOption(true)}
                onMouseLeave={() => setShowUnderBarOption(false)}
                onDoubleClick={
                    doubleClickTodoEnabled
                        ? () => {
                              if (setTodoFromMessageBubble) {
                                  setTodoFromMessageBubble({
                                      ...comment,
                                      projectId: currentProjectId ?? null,
                                  });
                              }
                          }
                        : undefined
                }
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
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                    >
                        <Stack alignItems="center" direction="row" spacing={0.25}>
                            {wrapToggleButtons}
                            {editButton}
                        </Stack>
                    </Box>
                )}

                <Stack alignItems="flex-start" direction="row" spacing={1.5}>
                    <Box sx={{ flexShrink: 0 }}>
                        <UserAvatar userId={comment.senderId} />
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <Typography
                                level="title-sm"
                                sx={{
                                    fontWeight: 600,
                                    fontSize: "0.85rem",
                                    color: isDark ? "#f1f5f9" : "#0f172a",
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
                                    color: secondaryText,
                                    letterSpacing: "0.02em",
                                }}
                            >
                                {isEdited
                                    ? `${extractYYYYMMDDHHMM(comment.tsSent)} Edited`
                                    : extractYYYYMMDDHHMM(comment.tsSent)}
                            </Typography>
                        </Stack>

                        <Box sx={{ mt: 0.25 }}>{commentBody}</Box>

                        <Box sx={{ mt: 0.5 }}>{reactionsDisplay}</Box>
                    </Box>
                </Stack>
            </Box>
        );
    }

    // Bubble variant — sent/received palette mirroring MessageBubble.
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

            <Box
                key={`${comment.commentId}-${comment.tsUpdated}`}
                sx={{ cursor: onCommentClick ? "pointer" : "default" }}
                onClick={onCommentClick}
                onMouseEnter={() => setShowUnderBarOption(true)}
                onMouseLeave={() => setShowUnderBarOption(false)}
                onDoubleClick={
                    doubleClickTodoEnabled
                        ? () => {
                              if (setTodoFromMessageBubble) {
                                  setTodoFromMessageBubble({
                                      ...comment,
                                      projectId: currentProjectId ?? null,
                                  });
                              }
                          }
                        : undefined
                }
            >
                <Sheet
                    sx={{
                        p: 1.25,
                        borderRadius: "16px",
                        position: "relative",
                        overflow: "hidden",
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        ...(isSent
                            ? { borderTopRightRadius: "4px", borderTopLeftRadius: "16px" }
                            : { borderTopRightRadius: "16px", borderTopLeftRadius: "4px" }),
                        background: colors.bg,
                        color: colors.text,
                        border: "1px solid",
                        borderColor: colors.border,
                        boxShadow: isFocused
                            ? isDark
                                ? `0 4px 20px rgba(34,197,94,0.2), inset 0 1px 0 rgba(255,255,255,0.05)`
                                : `0 4px 20px rgba(22,163,74,0.15)`
                            : isDark
                              ? "0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)"
                              : "0 2px 8px rgba(0,0,0,0.06)",
                        "&:hover": {
                            boxShadow: isDark
                                ? "0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                                : "0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
                        },
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

                    <Stack alignItems="flex-start" direction="row" spacing={1.5}>
                        <Box sx={{ flexShrink: 0 }}>
                            <UserAvatar userId={comment.senderId} />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Stack alignItems="center" direction="row" spacing={1}>
                                <Typography
                                    level="title-sm"
                                    sx={{
                                        fontWeight: 600,
                                        fontSize: "0.85rem",
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
                                        color: isDark
                                            ? "rgba(243, 232, 255, 0.6)"
                                            : isSent
                                              ? "rgba(59, 7, 100, 0.55)"
                                              : "rgba(17, 24, 39, 0.55)",
                                        letterSpacing: "0.02em",
                                    }}
                                >
                                    {isEdited
                                        ? `${extractYYYYMMDDHHMM(comment.tsSent)} Edited`
                                        : extractYYYYMMDDHHMM(comment.tsSent)}
                                </Typography>
                            </Stack>

                            <Box sx={{ mt: 0.5 }}>{commentBody}</Box>
                        </Box>
                    </Stack>

                    {/* Inline edit + wrap-toggle affordances, top-right
                        of bubble. Both fade in with the hover toolbar
                        so they don't add visual noise at rest. */}
                    <Box
                        sx={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            opacity: showUnderBarOption ? 1 : 0,
                            transition: "opacity 0.15s ease",
                        }}
                    >
                        <Stack alignItems="center" direction="row" spacing={0.25}>
                            {wrapToggleButtons}
                            {editButton}
                        </Stack>
                    </Box>

                    <Box sx={{ position: "absolute", bottom: 0, right: 10 }}>
                        {reactionsDisplay}
                    </Box>
                </Sheet>
            </Box>
        </Box>
    );
};
