import { useMemo } from "react";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import { Avatar, AvatarGroup, Box, Card, Chip, LinearProgress, Stack, Typography } from "@mui/joy";

import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { Milestone, Sprint } from "../types";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

const STATUS_COLOR: Record<string, string> = {
    Open: "#0044c2",
    WIP: "#ff8c00",
    Pending: "#b900ff",
    Closed: "#1dc200",
    Deleted: "#94a3b8",
};

type Props = {
    selectedSprint: Sprint | null;
    projectId: number | undefined;
    useSM: SprintMilestoneManagementState;
    useTM: TaskManagementState;
    isDark: boolean;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
};

export const SprintMilestonesSection = ({
    selectedSprint,
    projectId,
    useSM,
    useTM,
    isDark,
    textPrimary,
    textSecondary,
    textMuted,
}: Props) => {
    const milestones: Milestone[] = useMemo(() => {
        if (!projectId) return [];
        const all = useSM.projectMilestones[projectId] ?? [];
        return all.filter((m) =>
            selectedSprint ? m.sprintId === selectedSprint.sprintId : m.sprintId == null
        );
    }, [projectId, selectedSprint?.sprintId, useSM.projectMilestones]);

    const handleOpenMilestone = (milestoneId: number) => {
        useTM.setCurrentPreviewKind("milestone");
        useTM.setCurrentPreviewMilestoneId(milestoneId);
        useTM.setIsTaskPreviewVisible(true);
    };

    return (
        <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <FlagRoundedIcon sx={{ fontSize: 18, color: isDark ? "#a78bfa" : "#7c3aed" }} />
                <Typography
                    level="title-sm"
                    sx={{
                        fontWeight: 600,
                        color: textPrimary,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                    }}
                >
                    {selectedSprint
                        ? `Milestones in ${selectedSprint.name}`
                        : "Milestones (no sprint)"}
                </Typography>
                <Chip size="sm" variant="soft">
                    {milestones.length}
                </Chip>
            </Stack>
            {milestones.length === 0 ? (
                <Typography level="body-sm" sx={{ color: textMuted }}>
                    No milestones in this sprint yet.
                </Typography>
            ) : (
                <Stack spacing={1.25}>
                    {milestones.map((m) => {
                        const total = m.tasksTotal ?? 0;
                        const closed = m.tasksClosed ?? 0;
                        const pct = total > 0 ? Math.round((closed / total) * 100) : 0;
                        const statusColor = STATUS_COLOR[m.status as string] ?? "#94a3b8";
                        return (
                            <Card
                                key={m.milestoneId}
                                variant="outlined"
                                onClick={() => handleOpenMilestone(m.milestoneId)}
                                sx={{
                                    p: 1.5,
                                    cursor: "pointer",
                                    "&:hover": {
                                        backgroundColor: isDark
                                            ? "rgba(255,255,255,0.04)"
                                            : "rgba(0,0,0,0.03)",
                                    },
                                }}
                            >
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    spacing={1.5}
                                >
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        spacing={1}
                                        sx={{ flex: 1, minWidth: 0 }}
                                    >
                                        <Box
                                            sx={{
                                                width: 6,
                                                height: 6,
                                                borderRadius: "50%",
                                                backgroundColor: statusColor,
                                                flexShrink: 0,
                                            }}
                                        />
                                        <Typography
                                            level="title-sm"
                                            sx={{
                                                fontWeight: 600,
                                                color: textPrimary,
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            }}
                                        >
                                            {m.title || "Untitled milestone"}
                                        </Typography>
                                        <Chip
                                            size="sm"
                                            variant="soft"
                                            sx={{
                                                color: statusColor,
                                                backgroundColor: `${statusColor}1A`,
                                            }}
                                        >
                                            {m.status}
                                        </Chip>
                                    </Stack>
                                    <Stack direction="row" alignItems="center" spacing={1.5}>
                                        <Typography level="body-xs" sx={{ color: textSecondary }}>
                                            {closed}/{total}
                                        </Typography>
                                        <AvatarGroup size="sm">
                                            {m.assignees.slice(0, 4).map((a, idx) => (
                                                <Avatar
                                                    key={`${a.userId ?? "_"}-${idx}`}
                                                    src={
                                                        a.profileImageUrl
                                                            ? `${media_url}${a.profileImageUrl}`
                                                            : undefined
                                                    }
                                                    alt={a.username ?? ""}
                                                >
                                                    {(a.username ?? "?").slice(0, 1).toUpperCase()}
                                                </Avatar>
                                            ))}
                                        </AvatarGroup>
                                    </Stack>
                                </Stack>
                                <Box sx={{ mt: 1 }}>
                                    <LinearProgress
                                        determinate
                                        value={pct}
                                        color={pct >= 100 ? "success" : "primary"}
                                        sx={{
                                            "--LinearProgress-thickness": "6px",
                                            "--LinearProgress-radius": "3px",
                                            "--LinearProgress-progressRadius": "3px",
                                        }}
                                    />
                                </Box>
                            </Card>
                        );
                    })}
                </Stack>
            )}
        </Box>
    );
};
