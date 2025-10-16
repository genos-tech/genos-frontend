import React from "react";
import { Box, Chip, Stack, Tooltip, Typography } from "@mui/joy";

import { UserProps } from "../../../../types/admin";
import { ActivityMessageProps } from "../../../../types/chat";
import { GroupedReactionProps } from "../../../../types/common";

interface ActivityReactionsProps {
    activity: ActivityMessageProps;
    myself: UserProps;
    groupedReactions: GroupedReactionProps[];
}

export const ActivityReactions: React.FC<ActivityReactionsProps> = ({
    activity,
    myself,
    groupedReactions,
}) => {
    const displayed = groupedReactions.slice(0, 10);
    const hidden = groupedReactions.slice(10);

    return (
        <Stack alignItems="flex-start" direction="row" justifyContent="space-between">
            <Stack alignItems="flex-start" direction="row" justifyContent="space-between">
                <Typography
                    level="body-sm"
                    sx={{
                        paddingTop: 1.5,
                        ml: "45px",
                        fontWeight: "bold",
                        display: "-webkit-box",
                        WebkitLineClamp: "2",
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                >
                    {activity.latestReaction.sender.userName} has reacted
                </Typography>
                <Typography
                    level="body-sm"
                    sx={{
                        fontSize: "25px",
                        pl: "10px",
                        display: "-webkit-box",
                        WebkitLineClamp: "2",
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                >
                    {activity.latestReaction.emoji}
                </Typography>
            </Stack>

            <Box sx={{ paddingTop: 0.5 }}>
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
                            color="neutral"
                            size="sm"
                            sx={{
                                fontSize: "0.8rem",
                                cursor: "pointer",
                                px: 0.5,
                                py: 0.5,
                            }}
                            variant={
                                senders.some((u) => u.userId === myself.userId)
                                    ? "solid"
                                    : "outlined"
                            }
                        >
                            {emoji}
                            {count}
                        </Chip>
                    </Tooltip>
                ))}

                {hidden.length > 0 && (
                    <Tooltip
                        title={hidden.map(({ emoji, count }) => `${emoji} ${count}`).join(" ")}
                    >
                        <Chip size="sm" sx={{ fontSize: "0.8rem" }} variant="plain">
                            +{hidden.length} more
                        </Chip>
                    </Tooltip>
                )}
            </Box>
        </Stack>
    );
};
