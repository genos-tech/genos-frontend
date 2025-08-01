import { useState, useEffect } from "react";
import { Box, Button, Chip, IconButton, Tooltip } from "@mui/joy";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";

import { GroupedReactionProps } from "../../types/common";

export const groupEmojis = (emojis: string[]): GroupedReactionProps[] => {
    const map = new Map<string, number>();
    emojis.forEach((emoji) => {
        map.set(emoji, (map.get(emoji) || 0) + 1);
    });

    return Array.from(map.entries())
        .map(([emoji, count]) => ({ emoji, count }))
        .sort((a, b) => b.count - a.count);
};

type ReactionEmojiProps = {
    messageId: number;
    showUnderBarOption: boolean;
    reactions: string[];
    setReactions: (value: string[]) => void;
    setShowEmojiPicker: (value: boolean) => void;
};
export const ReactionEmojiDisplay = (props: ReactionEmojiProps) => {
    const { messageId, showUnderBarOption, reactions, setReactions, setShowEmojiPicker } = props;
    const defaultEmojiList: string[] = ["👍", "✅", "👀"];
    const [groupedReactions, setGroupedReactions] = useState<GroupedReactionProps[]>([]);
    const displayed = groupedReactions.slice(0, 3);
    const hidden = groupedReactions.slice(3);

    useEffect(() => {
        setGroupedReactions(groupEmojis(reactions));
    }, [reactions]);

    const handleReact = (emoji: string) => {
        setReactions([...reactions, emoji]);
    };

    const reactedUsers: string[] = ["Ken", "Ryan", "Jun"];

    return (
        <Box display="flex">
            {displayed.map(({ emoji, count }) => (
                <Tooltip
                    title={reactedUsers.map((name) => `${name} `).join(", ") + " and more reacted"}
                >
                    <Chip
                        key={`emoji-chip-${emoji}`}
                        variant="outlined"
                        color="primary"
                        size="sm"
                        sx={{ fontSize: "1rem", cursor: "pointer", px: 0.5, py: 0.5 }}
                        onClick={() => handleReact(emoji)}
                    >
                        {emoji}
                        {count}
                    </Chip>
                </Tooltip>
            ))}

            {hidden.length > 0 && (
                <Tooltip title={hidden.map(({ emoji, count }) => `${emoji} ${count}`).join(" ")}>
                    <Chip size="sm" variant="plain" sx={{ fontSize: "1rem" }}>
                        +{hidden.length} more
                    </Chip>
                </Tooltip>
            )}

            {showUnderBarOption && (
                <>
                    {groupedReactions.length < 3 && (
                        <>
                            {defaultEmojiList.map((emoji, index) => (
                                <Button
                                    key={`default-emoji-${index}`}
                                    onClick={() => handleReact(emoji)}
                                    variant="plain"
                                    size="sm"
                                    sx={{
                                        minWidth: "auto",
                                        paddingX: "4px",
                                        paddingY: "0",
                                        fontSize: "20px",
                                    }}
                                >
                                    {emoji}
                                </Button>
                            ))}
                        </>
                    )}
                    <IconButton
                        key={`emoji-icon-${messageId}`}
                        onClick={() => {
                            setShowEmojiPicker(true);
                        }}
                        color="primary"
                        variant="plain"
                        size="sm"
                        sx={{
                            minWidth: "auto",
                            paddingX: "4px",
                            paddingY: "0",
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
