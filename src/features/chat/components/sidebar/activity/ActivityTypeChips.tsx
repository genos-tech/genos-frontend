import React, { useState } from "react";
import { Box, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../../../components/ui/AppTooltip";
import { useTranslation } from "../../../../../i18n";
import { ActivityMessageProps } from "../../../../../types/chat";
import { formatTaskDisplayId } from "../../../../tasks/utils/taskDisplayId";

interface ActivityTypeChipsProps {
    activity: ActivityMessageProps;
    chatTypeLookup: { [key: number]: string };
    /** Viewer-correct project/channel name resolved from the live chat
     *  list by the parent (`ActivityHeader`). The activity payload's
     *  `chatName` is frozen at adapt time and can be a `"?"` placeholder
     *  when the source channel wasn't loaded yet; this overrides it for
     *  the project chip. Falls back to `activity.chatName` when omitted. */
    resolvedChatName?: string;
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
    // Surface-specific colors for the @mention surfaces that aren't
    // chats — keeps task-body and the three note types visually
    // distinct from generic "chat type" tags so the user can scan the
    // feed and tell where each mention came from at a glance.
    taskBody: { dark: "#fb923c", light: "#ea580c" },
    personalNote: { dark: "#a78bfa", light: "#7c3aed" },
    taskNote: { dark: "#34d399", light: "#10b981" },
    chatNote: { dark: "#38bdf8", light: "#0284c7" },
} as const;

// Map chat_type → which palette to use for the surface chip. 1-4 use
// the generic neutral palette; 5-8 (task body + three note types) get
// the per-surface tints declared above.
const SURFACE_CHIP_COLOR: Record<number, (typeof CHIP_COLORS)[keyof typeof CHIP_COLORS]> = {
    5: CHIP_COLORS.taskBody,
    6: CHIP_COLORS.personalNote,
    7: CHIP_COLORS.taskNote,
    8: CHIP_COLORS.chatNote,
};

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
            onClick={copyText ? handleClick : undefined}
        >
            {label}
        </Box>
    );

    if (!copyText) return chip;
    return (
        <AppTooltip placement="top" title={copied ? "Copied!" : "Click to copy"} arrow>
            {chip}
        </AppTooltip>
    );
};

export const ActivityTypeChips: React.FC<ActivityTypeChipsProps> = ({
    activity,
    chatTypeLookup,
    resolvedChatName,
}) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    // Task comment = the v3 PM-thread mirror (`isTaskComment` flag, from
    // `message.metadata.taskCommentId`) OR a legacy chat_type=4 row carrying
    // a `taskId`. v3 task comments arrive as chat_type=3 (PM) + isThread, so
    // the legacy chat_type===4 test alone missed them — they rendered a "PM"
    // + "Thread" chip instead of "Task Comment". A chat_type=4 row WITHOUT a
    // taskId is a multi-user DM (MDM), which self-labels as "DM".
    const isTaskComment =
        activity.isTaskComment === true || (activity.chatType === 4 && !!activity.taskId);
    const isTaskBody = activity.chatType === 5;
    const isTaskNote = activity.chatType === 7;
    const isNote = activity.chatType >= 6 && activity.chatType <= 8;

    const chatTypeLabel = isTaskComment
        ? t.chat.activity.chipTaskComment
        : chatTypeLookup[activity.chatType];
    // Tinted surface palette for task-body + note types; everything
    // else keeps the existing neutral "chatType" grey.
    const surfaceChipColor = SURFACE_CHIP_COLOR[activity.chatType] ?? CHIP_COLORS.chatType;
    // Filled variant for the new surfaces so the colored tint actually
    // shows; soft is the neutral default for plain chat types.
    const surfaceChipVariant: "soft" | "filled" = SURFACE_CHIP_COLOR[activity.chatType]
        ? "filled"
        : "soft";

    // PM messages and task comments get the existing "project + #taskId"
    // pair. Task body (chat_type=5) carries the same shape — `chatName`
    // is the project name and `taskId` is set. Task note (chat_type=7)
    // gets the task chip only when the backend populated `taskId`
    // (project/task FK columns on `ActivityFact`).
    const showProjectAndTaskChips =
        activity.chatType === 3 || isTaskComment || isTaskBody || isTaskNote;

    // Prefer the parent's live-resolved name over the frozen payload
    // value (which can be the `"?"` placeholder for channel-backed
    // surfaces whose channel wasn't loaded at adapt time).
    const projectChipName = resolvedChatName ?? activity.chatName;

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
                    {/* Project chip only when we have a non-empty name.
                        Task note activities currently omit `chatName`
                        (set to the note title, not the project name) so
                        this gracefully falls back to just the task ID
                        chip. */}
                    {/* {!!projectChipName && projectChipName !== "?" && !isTaskNote && (
                        <ModernChip
                            colorScheme={CHIP_COLORS.project}
                            isDark={isDark}
                            label={projectChipName}
                            variant="filled"
                        />
                    )} */}
                    {!!activity.taskId && (
                        <ModernChip
                            colorScheme={CHIP_COLORS.task}
                            copyText={formatTaskDisplayId(activity)}
                            isDark={isDark}
                            label={formatTaskDisplayId(activity)}
                            variant="outlined"
                        />
                    )}
                </>
            )}

            {/* "Reply" only applies to inline messages, not task comments
                (which already self-label as "Task Comment"), not multi-
                user DMs (which already self-label as "DM"), and not the
                task-body / note surfaces (chat_type 5-8) which have
                their own surface chip and no notion of "replying". */}
            {activity.activityType === 1 &&
                activity.chatType !== 4 &&
                !isTaskComment &&
                !isTaskBody &&
                !isNote && (
                    <ModernChip
                        colorScheme={CHIP_COLORS.reply}
                        isDark={isDark}
                        label={t.chat.activity.chipReply}
                        variant="filled"
                    />
                )}

            {activity.activityType === 2 && (
                <ModernChip
                    colorScheme={CHIP_COLORS.reaction}
                    isDark={isDark}
                    label={t.chat.activity.chipReaction}
                    variant="filled"
                />
            )}

            {activity.activityType === 3 && (
                <ModernChip
                    colorScheme={CHIP_COLORS.mention}
                    isDark={isDark}
                    label={t.chat.activity.chipMention}
                    variant="filled"
                />
            )}

            <ModernChip
                colorScheme={surfaceChipColor}
                isDark={isDark}
                label={chatTypeLabel}
                variant={surfaceChipVariant}
            />

            {/* Task comments are structurally thread replies (isThread=true)
                but self-label as "Task Comment" — don't also tag them
                "Thread". Genuine DM/GM/MDM thread replies still get it. */}
            {activity.isThread === true && !isTaskComment && (
                <ModernChip
                    colorScheme={CHIP_COLORS.thread}
                    isDark={isDark}
                    label={t.chat.activity.chipThread}
                    variant="outlined"
                />
            )}
        </Stack>
    );
};
