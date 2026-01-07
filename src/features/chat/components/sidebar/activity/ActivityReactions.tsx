import React from "react";
import { Box, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { UserProps } from "../../../../../types/admin";
import { ActivityMessageProps } from "../../../../../types/chat";
import { GroupedReactionProps } from "../../../../../types/common";

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
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const displayed = groupedReactions.slice(0, 8);
    const hidden = groupedReactions.slice(8);

    return (
        <Stack
            alignItems="center"
            direction="row"
            justifyContent="space-between"
            spacing={1}
            sx={{ ml: "44px" }}
        >
            {/* Reaction notification text */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                    level="body-sm"
                    sx={{
                        fontWeight: 600,
                        fontSize: "0.8rem",
                        color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.75)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                >
                    {activity.latestReaction.sender.userName}
                </Typography>
                <Typography
                    level="body-xs"
                    sx={{
                        color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
                        whiteSpace: "nowrap",
                    }}
                >
                    reacted
                </Typography>
                <Box
                    sx={{
                        fontSize: "1.25rem",
                        lineHeight: 1,
                        filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))",
                    }}
                >
                    {activity.latestReaction.emoji}
                </Box>
            </Stack>

            {/* Reaction pills */}
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.25 }}>
                {displayed.map(({ senders, emoji, count }, index) => {
                    const isOwn = senders.some((u) => u.userId === myself.userId);
                    const reactionColor = isDark ? "#fbbf24" : "#f59e0b";

                    return (
                        <Tooltip
                            key={`tooltip-${index}`}
                            size="sm"
                            variant="outlined"
                            placement="top"
                            title={
                                senders
                                    .slice(0, 5)
                                    .map((sender) => sender.userName)
                                    .join(", ") +
                                (senders.length > 5 ? " and more" : "") +
                                " reacted"
                            }
                            sx={{
                                borderRadius: "8px",
                                fontSize: "0.75rem",
                            }}
                        >
                            <Box
                                sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 0.25,
                                    px: 0.5,
                                    py: 0.25,
                                    borderRadius: "6px",
                                    fontSize: "0.75rem",
                                    cursor: "pointer",
                                    transition: "all 0.15s ease",
                                    background: isOwn
                                        ? isDark
                                            ? `linear-gradient(135deg, ${reactionColor}25 0%, ${reactionColor}15 100%)`
                                            : `linear-gradient(135deg, ${reactionColor}20 0%, ${reactionColor}12 100%)`
                                        : isDark
                                          ? "rgba(255,255,255,0.05)"
                                          : "rgba(0,0,0,0.04)",
                                    border: "1px solid",
                                    borderColor: isOwn
                                        ? `${reactionColor}40`
                                        : isDark
                                          ? "rgba(255,255,255,0.08)"
                                          : "rgba(0,0,0,0.06)",
                                    "&:hover": {
                                        transform: "scale(1.05)",
                                        boxShadow: isDark
                                            ? "0 2px 8px rgba(0,0,0,0.3)"
                                            : "0 2px 8px rgba(0,0,0,0.1)",
                                    },
                                }}
                            >
                                <span style={{ fontSize: "0.85rem", lineHeight: 1 }}>{emoji}</span>
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        fontWeight: 600,
                                        fontSize: "0.65rem",
                                        color: isOwn
                                            ? reactionColor
                                            : isDark
                                              ? "rgba(255,255,255,0.6)"
                                              : "rgba(0,0,0,0.55)",
                                    }}
                                >
                                    {count}
                                </Typography>
                            </Box>
                        </Tooltip>
                    );
                })}

                {hidden.length > 0 && (
                    <Tooltip
                        size="sm"
                        placement="top"
                        title={hidden.map(({ emoji, count }) => `${emoji} ${count}`).join("  ")}
                        variant="outlined"
                        sx={{
                            borderRadius: "8px",
                            fontSize: "0.75rem",
                        }}
                    >
                        <Box
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                px: 0.5,
                                py: 0.25,
                                borderRadius: "6px",
                                fontSize: "0.65rem",
                                fontWeight: 600,
                                color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)",
                                background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                                border: "1px solid",
                                borderColor: isDark
                                    ? "rgba(255,255,255,0.06)"
                                    : "rgba(0,0,0,0.04)",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                "&:hover": {
                                    background: isDark
                                        ? "rgba(255,255,255,0.06)"
                                        : "rgba(0,0,0,0.04)",
                                },
                            }}
                        >
                            +{hidden.length}
                        </Box>
                    </Tooltip>
                )}
            </Stack>
        </Stack>
    );
};
