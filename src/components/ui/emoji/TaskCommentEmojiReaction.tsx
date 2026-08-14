import { useEffect, useMemo, useState } from "react";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";
import { Box, Button, IconButton, useColorScheme } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useQuickReactionsPreference } from "../../../hooks/common/useQuickReactionsPreference";
import { useTranslation } from "../../../i18n";
import { UserProps } from "../../../types/admin";
import { GroupedReactionProps, ReactionProps } from "../../../types/common";
import { TaskCommentProps } from "../../../types/tasks";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { AppTooltip } from "../AppTooltip";
import { EmojiGlyph } from "./EmojiGlyph";

export const groupEmojis = (reactions: ReactionProps[]): GroupedReactionProps[] => {
    const map = new Map<string, { count: number; senders: UserProps[] }>();

    reactions.forEach(({ emoji, sender }) => {
        const entry = map.get(emoji);
        if (entry) {
            entry.count += 1;
            entry.senders.push(sender);
        } else {
            map.set(emoji, { count: 1, senders: [sender] });
        }
    });

    return Array.from(map.entries())
        .map(([emoji, { count, senders }]) => ({
            emoji,
            count,
            senders,
        }))
        .sort((a, b) => b.count - a.count);
};

// The quick-add row (3 default picks + open-picker icon) for task
// comments — split out of `ReactionTaskCommentEmojiDisplay` so it can
// live in the bubble's top-right hover toolbar next to Edit/⋮, the same
// place chat's `EmojiReaction` sits next to `BubbleMoreMenu`. The
// counted reaction chips stay in `ReactionTaskCommentEmojiDisplay`,
// which now mirrors chat's `ShowEmojiReaction`.
type TaskCommentEmojiReactionProps = {
    socket: Socket | null;
    myself: UserProps;
    comment: TaskCommentProps;
    projectId?: number;
    projectName?: string;
    // Parent task's human-readable id ("<code>-<n>") used on outgoing
    // `task_comment_reaction` emits so the derived activity broadcast
    // can stamp it onto the chat-activity-sidebar entry. Without this
    // the activity item for a reaction falls back to "#<taskId>".
    taskDisplayId?: string | null;
    showUnderBarOption: boolean;
    reactions: ReactionProps[];
    setReactions: (value: ReactionProps[]) => void;
    setShowEmojiPicker: (value: boolean) => void;
};
export const TaskCommentEmojiReaction = (props: TaskCommentEmojiReactionProps) => {
    const {
        socket,
        myself,
        comment,
        projectId,
        projectName,
        taskDisplayId,
        showUnderBarOption,
        reactions,
        setReactions,
        setShowEmojiPicker,
    } = props;
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    // Same user-picked quick reactions as the chat/thread bubbles
    // (Settings → Chat), so the hover row is consistent everywhere.
    const { emojis: quickReactions } = useQuickReactionsPreference();
    const [groupedReactions, setGroupedReactions] = useState<GroupedReactionProps[]>(
        groupEmojis(reactions)
    );

    // Hide a quick pick that's already showing as a chip below — see
    // the note in chat's `EmojiReaction`: derived, not state, so
    // removing a reaction always brings its quick pick back.
    const baseEmojiList = useMemo(() => {
        const reacted = new Set(groupedReactions.map((item) => item.emoji));
        return quickReactions.filter((emoji) => !reacted.has(emoji));
    }, [quickReactions, groupedReactions]);

    useEffect(() => {
        setGroupedReactions(groupEmojis(reactions));
    }, [reactions]);

    const handleAddReaction = (selectedEmoji: string) => {
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
                    project_id: projectId,
                    project_name: projectName,
                    task_id: comment.taskId,
                    display_id: taskDisplayId,
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
                    project_id: projectId,
                    project_name: projectName,
                    task_id: comment.taskId,
                    display_id: taskDisplayId,
                    comment_id: comment.commentId,
                    comment_body: comment.commentBody,
                    comment_sender_id: comment.senderId,
                    comment_sender_name: comment.senderName,
                    reaction_emoji: selectedEmoji,
                });
            }
        }
    };

    return (
        // `gap`, because the picks are square-ish buttons sized to a 16px
        // glyph: with none, adjacent emoji touch and the hover highlight
        // reads as one continuous strip rather than four targets.
        <Box sx={{ display: "flex", gap: 0.5 }}>
            {showUnderBarOption && (
                <>
                    {groupedReactions.length < 3 && (
                        <>
                            {baseEmojiList.map((emoji) => (
                                <Button
                                    key={`default-emoji-${emoji}`}
                                    size="sm"
                                    variant="plain"
                                    sx={{
                                        minWidth: "auto",
                                        paddingX: "6px",
                                        paddingY: "0",
                                        fontSize: "16px",
                                        "&:hover": {
                                            backgroundColor: isDark ? "#3730a3" : "#e0e7ff",
                                        },
                                    }}
                                    onClick={() => handleAddReaction(emoji)}
                                >
                                    {/* Team custom emoji (":name:") must render as an
                                        image, not the literal shortcode. */}
                                    <EmojiGlyph emoji={emoji} />
                                </Button>
                            ))}
                        </>
                    )}
                    <AppTooltip size="sm" title={t.common.ui.emoji.reaction}>
                        <IconButton
                            key={`emoji-icon-${comment.commentId}`}
                            color="primary"
                            size="sm"
                            variant="plain"
                            sx={{
                                minWidth: "auto",
                                paddingX: "6px",
                                paddingY: "0",
                                fontSize: "16px",
                                "&:hover": {
                                    backgroundColor: isDark ? "#3730a3" : "#e0e7ff",
                                },
                            }}
                            onClick={() => {
                                setShowEmojiPicker(true);
                            }}
                        >
                            <SentimentSatisfiedAltIcon sx={{ fontSize: "24px" }} />
                        </IconButton>
                    </AppTooltip>
                </>
            )}
        </Box>
    );
};
