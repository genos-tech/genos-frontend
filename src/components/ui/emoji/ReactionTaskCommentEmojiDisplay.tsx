import { useEffect, useState } from "react";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";
import { Box, Button, Chip, IconButton, useColorScheme } from "@mui/joy";
import { Socket } from "socket.io-client";

import { fmt, useTranslation } from "../../../i18n";
import { UserProps } from "../../../types/admin";
import { GroupedReactionProps, ReactionProps } from "../../../types/common";
import { TaskCommentProps } from "../../../types/tasks";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { AppTooltip } from "../AppTooltip";

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
export const ReactionTaskCommentEmojiDisplay = (props: ReactionEmojiProps) => {
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
        <Box display="flex">
            {displayed.map(({ senders, emoji, count }, index) => (
                <AppTooltip
                    key={`tooltip-${index}`}
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
                    <Chip
                        key={`emoji-chip-${emoji}-${index}`}
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
                        variant={
                            senders.some((u) => u.userId === myself.userId) ? "solid" : "outlined"
                        }
                        onClick={() => handleAddReaction(emoji)}
                    >
                        {emoji}
                        {count}
                    </Chip>
                </AppTooltip>
            ))}

            {hidden.length > 0 && (
                <AppTooltip
                    size="sm"
                    title={hidden.map(({ emoji, count }) => `${emoji} ${count}`).join(" ")}
                >
                    <Chip size="sm" sx={{ fontSize: "0.8rem" }} variant="plain">
                        {fmt(t.common.ui.emoji.moreLabel, { count: hidden.length })}
                    </Chip>
                </AppTooltip>
            )}

            {showUnderBarOption && (
                <>
                    {groupedReactions.length < 3 && (
                        <>
                            {baseEmojiList.map((emoji, index) => (
                                <Button
                                    key={`default-emoji-${index}`}
                                    size="sm"
                                    variant="plain"
                                    sx={{
                                        minWidth: "auto",
                                        paddingX: "4px",
                                        marginBottom: 0.5,
                                        fontSize: "16px",
                                        "&:hover": {
                                            backgroundColor: isDark ? "#3730a3" : "#e0e7ff",
                                        },
                                    }}
                                    onClick={() => handleAddReaction(emoji)}
                                >
                                    {emoji}
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
                                paddingX: "4px",
                                marginBottom: 0.5,
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
