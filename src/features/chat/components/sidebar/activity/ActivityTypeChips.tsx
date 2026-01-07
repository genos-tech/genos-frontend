import React from "react";
import { Box, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { ActivityMessageProps } from "../../../../../types/chat";

interface ActivityTypeChipsProps {
    activity: ActivityMessageProps;
    chatTypeLookup: { [key: number]: string };
}

// Chip color configurations
const CHIP_COLORS = {
    reply: { dark: "#4ade80", light: "#22c55e" },
    reaction: { dark: "#fbbf24", light: "#f59e0b" },
    mention: { dark: "#f87171", light: "#ef4444" },
    project: { dark: "#60a5fa", light: "#3b82f6" },
    task: { dark: "#c084fc", light: "#a855f7" },
    chatType: { dark: "#94a3b8", light: "#64748b" },
    thread: { dark: "#22d3ee", light: "#06b6d4" },
} as const;

interface ModernChipProps {
    label: string;
    colorScheme: { dark: string; light: string };
    isDark: boolean;
    variant?: "filled" | "outlined" | "soft";
}

const ModernChip: React.FC<ModernChipProps> = ({
    label,
    colorScheme,
    isDark,
    variant = "soft",
}) => {
    const color = isDark ? colorScheme.dark : colorScheme.light;

    const getStyles = () => {
        switch (variant) {
            case "filled":
                return {
                    background: isDark
                        ? `linear-gradient(135deg, ${color}20 0%, ${color}15 100%)`
                        : `linear-gradient(135deg, ${color}18 0%, ${color}12 100%)`,
                    borderColor: `${color}35`,
                    color: color,
                };
            case "outlined":
                return {
                    background: "transparent",
                    borderColor: `${color}40`,
                    color: color,
                };
            case "soft":
            default:
                return {
                    background: isDark ? `rgba(255,255,255,0.04)` : `rgba(0,0,0,0.03)`,
                    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                    color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)",
                };
        }
    };

    const styles = getStyles();

    return (
        <Box
            sx={{
                display: "inline-flex",
                alignItems: "center",
                height: 20,
                px: 0.75,
                borderRadius: "5px",
                fontSize: "0.65rem",
                fontWeight: 600,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                border: "1px solid",
                transition: "all 0.15s ease",
                ...styles,
            }}
        >
            {label}
        </Box>
    );
};

export const ActivityTypeChips: React.FC<ActivityTypeChipsProps> = ({
    activity,
    chatTypeLookup,
}) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    return (
        <Stack
            direction="row"
            spacing={0.5}
            sx={{
                flexWrap: "wrap",
                gap: 0.5,
                alignItems: "center",
            }}
        >
            {/* Chat Name for PM and Task */}
            {(activity.chatType === 3 || activity.chatType === 4) && (
                <>
                    <ModernChip
                        label={activity.chatName}
                        colorScheme={CHIP_COLORS.project}
                        isDark={isDark}
                        variant="filled"
                    />
                    <ModernChip
                        label={`#${activity.taskId}`}
                        colorScheme={CHIP_COLORS.task}
                        isDark={isDark}
                        variant="outlined"
                    />
                </>
            )}

            {/* Activity Type Chips */}
            {activity.activityType === 1 && activity.chatType !== 4 && (
                <ModernChip
                    label="Reply"
                    colorScheme={CHIP_COLORS.reply}
                    isDark={isDark}
                    variant="filled"
                />
            )}

            {activity.activityType === 2 && (
                <ModernChip
                    label="Reaction"
                    colorScheme={CHIP_COLORS.reaction}
                    isDark={isDark}
                    variant="filled"
                />
            )}

            {activity.activityType === 3 && (
                <ModernChip
                    label="Mention"
                    colorScheme={CHIP_COLORS.mention}
                    isDark={isDark}
                    variant="filled"
                />
            )}

            {/* Chat Type Chip */}
            <ModernChip
                label={chatTypeLookup[activity.chatType]}
                colorScheme={CHIP_COLORS.chatType}
                isDark={isDark}
                variant="soft"
            />

            {/* Thread Chip */}
            {activity.isThread === true && (
                <ModernChip
                    label="Thread"
                    colorScheme={CHIP_COLORS.thread}
                    isDark={isDark}
                    variant="outlined"
                />
            )}
        </Stack>
    );
};
