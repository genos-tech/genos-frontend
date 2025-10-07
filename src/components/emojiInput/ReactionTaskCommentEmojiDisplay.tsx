import { Socket } from "socket.io-client";
import { useState, useEffect } from "react";
import { Box, Button, Chip, IconButton, Tooltip } from "@mui/joy";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";

import { UserProps } from "../../types/admin";
import { GroupedReactionProps, ReactionProps } from "../../types/common";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { TaskCommentProps } from "../../types/tasks";

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

type ReactionEmojiProps = {
    socket: Socket | null;
    myself: UserProps;
    comment: TaskCommentProps;
    projectId?: number;
    projectName?: string;
    showUnderBarOption: boolean;
    reactions: ReactionProps[];
    setReactions: (value: ReactionProps[]) => void;
    setShowEmojiPicker: (value: boolean) => void;
};
export const ReactionTaskCommentEmojiDisplay = (props: ReactionEmojiProps) => {
    const {
        socket,
        myself,
        comment,
        projectId,
        projectName,
        showUnderBarOption,
        reactions,
        setReactions,
        setShowEmojiPicker,
    } = props;
    const [baseEmojiList, setBaseEmojiList] = useState<string[]>(["👀", "👍", "✅"]);
    const [groupedReactions, setGroupedReactions] = useState<GroupedReactionProps[]>(
        groupEmojis(reactions)
    );
    const displayed = groupedReactions.slice(0, 10);
    const hidden = groupedReactions.slice(10);

    useEffect(() => {
        const groupedReactionEmojis: string[] = groupedReactions.map((item) => item.emoji);
        setBaseEmojiList(baseEmojiList.filter((emoji) => !groupedReactionEmojis.includes(emoji)));
    }, [groupedReactions]);

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
        <Box display="flex">
            {displayed.map(({ senders, emoji, count }, index) => (
                <Tooltip
                    key={`tooltip-${index}`}
                    title={
                        senders
                            .slice(0, 5)
                            .map((sender) => `${sender.userName} `)
                            .join(" and ") +
                        (senders.length > 5 ? " and more" : "") +
                        " reacted"
                    }
                >
                    <Chip
                        key={`emoji-chip-${emoji}-${index}`}
                        variant={
                            senders.some((u) => u.userId === myself.userId) ? "solid" : "outlined"
                        }
                        color="neutral"
                        size="sm"
                        sx={{
                            fontSize: "0.9rem",
                            cursor: "pointer",
                            px: 0.5,
                            py: 0.5,
                            mb: 1,
                            mx: 0.2,
                        }}
                        onClick={() => handleAddReaction(emoji)}
                    >
                        {emoji}
                        {count}
                    </Chip>
                </Tooltip>
            ))}

            {hidden.length > 0 && (
                <Tooltip title={hidden.map(({ emoji, count }) => `${emoji} ${count}`).join(" ")}>
                    <Chip size="sm" variant="plain" sx={{ fontSize: "0.8rem" }}>
                        +{hidden.length} more
                    </Chip>
                </Tooltip>
            )}

            {showUnderBarOption && (
                <>
                    {groupedReactions.length < 3 && (
                        <>
                            {baseEmojiList.map((emoji, index) => (
                                <Button
                                    key={`default-emoji-${index}`}
                                    onClick={() => handleAddReaction(emoji)}
                                    variant="plain"
                                    size="sm"
                                    sx={{
                                        minWidth: "auto",
                                        paddingX: "4px",
                                        marginBottom: 0.5,
                                        fontSize: "20px",
                                    }}
                                >
                                    {emoji}
                                </Button>
                            ))}
                        </>
                    )}
                    <IconButton
                        key={`emoji-icon-${comment.commentId}`}
                        onClick={() => {
                            setShowEmojiPicker(true);
                        }}
                        color="primary"
                        variant="plain"
                        size="sm"
                        sx={{
                            minWidth: "auto",
                            paddingX: "4px",
                            marginBottom: 0.5,
                            fontSize: "20px",
                        }}
                    >
                        <SentimentSatisfiedAltIcon sx={{ fontSize: "24px" }} />
                    </IconButton>
                </>
            )}
        </Box>
    );
};
