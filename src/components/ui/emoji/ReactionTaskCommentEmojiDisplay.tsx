import { useEffect, useState } from "react";
import { Box } from "@mui/joy";
import { Socket } from "socket.io-client";

import { fmt, useTranslation } from "../../../i18n";
import { UserProps } from "../../../types/admin";
import { GroupedReactionProps, ReactionProps } from "../../../types/common";
import { TaskCommentProps } from "../../../types/tasks";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { AppTooltip } from "../AppTooltip";
import { MoreReactionsChip, ReactionChip } from "./ReactionChip";

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

// This component renders reaction CHIPS only — the counted reactions
// already on the comment. The quick-add row (3 default picks + the
// open-picker icon) lives in `TaskCommentEmojiReaction`, which
// `TaskCommentBubble` mounts in the top-right hover toolbar alongside
// Edit/⋮, mirroring chat's `ShowEmojiReaction` / `EmojiReaction` split.
type ReactionEmojiProps = {
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
    reactions: ReactionProps[];
    setReactions: (value: ReactionProps[]) => void;
};
export const ReactionTaskCommentEmojiDisplay = (props: ReactionEmojiProps) => {
    const {
        myself,
        comment,
        projectId,
        projectName,
        taskDisplayId,
        reactions,
        setReactions,
        socket,
    } = props;
    const { t } = useTranslation();
    const [groupedReactions, setGroupedReactions] = useState<GroupedReactionProps[]>(
        groupEmojis(reactions)
    );
    const displayed = groupedReactions.slice(0, 10);
    const hidden = groupedReactions.slice(10);

    useEffect(() => {
        const _groupedReactions = groupEmojis(reactions);
        setGroupedReactions(_groupedReactions);
    }, [reactions]);

    const handleAddReaction = (selectedEmoji: string) => {
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
                // add emoji
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
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
            {displayed.map(({ senders, emoji, count }) => (
                <AppTooltip
                    key={`emoji-chip-${emoji}`}
                    title={fmt(
                        senders.length > 5
                            ? t.common.ui.emoji.multipleReacted
                            : t.common.ui.emoji.singleReacted,
                        {
                            names: senders
                                .slice(0, 5)
                                .map((sender) => `${sender.userName} `)
                                .join(" and "),
                        }
                    )}
                >
                    <ReactionChip
                        count={count}
                        emoji={emoji}
                        mine={senders.some((u) => u.userId === myself.userId)}
                        onClick={() => handleAddReaction(emoji)}
                    />
                </AppTooltip>
            ))}

            {hidden.length > 0 && (
                <AppTooltip
                    size="sm"
                    title={hidden.map(({ emoji, count }) => `${emoji} ${count}`).join(" ")}
                >
                    <MoreReactionsChip
                        text={fmt(t.common.ui.emoji.moreLabel, { count: hidden.length })}
                    />
                </AppTooltip>
            )}
        </Box>
    );
};
