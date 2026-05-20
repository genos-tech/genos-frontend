import React, { useState } from "react";
import { Box, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation } from "../../../../../i18n";
import { ActivityMessageProps } from "../../../../../types/chat";
import { formatTaskDisplayId } from "../../../../tasks/utils/taskDisplayId";

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
    /** When set, the chip becomes clickable; clicking copies this value
     *  to the clipboard and shows a brief "Copied!" tooltip. Used for
     *  task ID chips so users can paste the ID into a branch name. */
    copyText?: string;
}

const ModernChip: React.FC<ModernChipProps> = ({
    label,
    colorScheme,
    isDark,
    variant = "soft",
    copyText,
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
    const [copied, setCopied] = useState(false);
    const handleClick = (event: React.MouseEvent) => {
        if (!copyText) return;
        // Activity rows wrap a click handler that opens the source
        // chat/task — stop propagation so the chip "Copy" gesture
        // doesn't also navigate.
        event.stopPropagation();
        navigator.clipboard
            .writeText(copyText)
            .then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
            })
            .catch(() => {});
    };

    const chip = (
        <Box
            onClick={copyText ? handleClick : undefined}
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
                cursor: copyText ? "pointer" : "default",
                ...styles,
            }}
        >
            {label}
        </Box>
    );

    if (!copyText) return chip;
    return (
        <Tooltip arrow placement="top" title={copied ? "Copied!" : "Click to copy"}>
            {chip}
        </Tooltip>
    );
};

export const ActivityTypeChips: React.FC<ActivityTypeChipsProps> = ({
    activity,
    chatTypeLookup,
}) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    // chat_type=4 is dual-purpose: task-comment activities carry a `taskId`
    // (and a project name in `chatName`); MDM activities never do. We use
    // `taskId` as the discriminator so MDM activities don't render "#NULL"
    // or get labeled "Task".
    const isTaskComment = activity.chatType === 4 && !!activity.taskId;
    const isMDM = activity.chatType === 4 && !activity.taskId;

    const chatTypeLabel = isMDM
        ? "MDM"
        : isTaskComment
          ? t.chat.activity.chipTaskComment
          : chatTypeLookup[activity.chatType];

    // The "project + #taskId" pair only makes sense for PM messages and for
    // task comments. For MDM we let the chat-name show up in the header
    // (ActivityHeader) and skip the project chip entirely.
    const showProjectAndTaskChips = activity.chatType === 3 || isTaskComment;

    return (
        <Stack
            direction="row"
            spacing={0.5}
            sx={{
                flexWrap: "wrap",
                alignItems: "center",
            }}
        >
            {showProjectAndTaskChips && (
                <>
                    <ModernChip
                        label={activity.chatName}
                        colorScheme={CHIP_COLORS.project}
                        isDark={isDark}
                        variant="filled"
                    />
                    {!!activity.taskId && (
                        <ModernChip
                            label={formatTaskDisplayId(activity)}
                            copyText={formatTaskDisplayId(activity)}
                            colorScheme={CHIP_COLORS.task}
                            isDark={isDark}
                            variant="outlined"
                        />
                    )}
                </>
            )}

            {/* "Reply" only applies to inline messages, not task comments
                (which already self-label as "Task") and not MDM messages
                (which already self-label as "MDM"). */}
            {activity.activityType === 1 && activity.chatType !== 4 && (
                <ModernChip
                    label={t.chat.activity.chipReply}
                    colorScheme={CHIP_COLORS.reply}
                    isDark={isDark}
                    variant="filled"
                />
            )}

            {activity.activityType === 2 && (
                <ModernChip
                    label={t.chat.activity.chipReaction}
                    colorScheme={CHIP_COLORS.reaction}
                    isDark={isDark}
                    variant="filled"
                />
            )}

            {activity.activityType === 3 && (
                <ModernChip
                    label={t.chat.activity.chipMention}
                    colorScheme={CHIP_COLORS.mention}
                    isDark={isDark}
                    variant="filled"
                />
            )}

            <ModernChip
                label={chatTypeLabel}
                colorScheme={CHIP_COLORS.chatType}
                isDark={isDark}
                variant="soft"
            />

            {activity.isThread === true && (
                <ModernChip
                    label={t.chat.activity.chipThread}
                    colorScheme={CHIP_COLORS.thread}
                    isDark={isDark}
                    variant="outlined"
                />
            )}
        </Stack>
    );
};
