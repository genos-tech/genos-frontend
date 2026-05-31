import { useMemo } from "react";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import { Box, Chip, Sheet, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { priorities, statuses } from "./utils/taskMeta";

import { UserAvatar } from "../../components/ui/avatars/UserAvatar";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { TaskTableProps } from "../../types/tasks";
import { extractYYYYMMDD } from "../../utils/dateUtils";

type MobileTaskListProps = {
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
};

// Quick lookup tables — `statuses` / `priorities` from taskMeta are
// authoritative for colors. Mobile chips mirror desktop StatusChip /
// priority chip styling so the list reads the same in both modes.
const statusMetaByName = new Map(statuses.map((s) => [s.status, s]));
const priorityMetaByName = new Map(priorities.map((p) => [p.priority, p]));

// Vertical card list — mobile replacement for the desktop
// DraggableTaskTable (16 sortable/draggable columns). Each card shows
// the most-load-bearing fields only: title, status, priority, assignee,
// due date, milestone flag, tags. Tapping a card opens the task
// preview overlay.
export const MobileTaskList = ({ usePM, useTM }: MobileTaskListProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const projectId = usePM.currentProject?.projectId;

    // Project-scoped, top-level rows. Closed and Deleted are hidden —
    // an "active work" view by default; reopening or re-listing is a
    // desktop concern.
    const tasks = useMemo<TaskTableProps[]>(() => {
        if (!projectId) return [];
        return useTM.allTasks.filter(
            (t) =>
                t.projectId === projectId &&
                t.status !== "Deleted" &&
                t.status !== "Closed" &&
                t.parentTaskId == null
        );
    }, [useTM.allTasks, projectId]);

    const openTask = (taskId: string | null) => {
        if (!taskId) return;
        const idNum = Number(taskId);
        if (!Number.isFinite(idNum)) return;
        useTM.setCurrentPreviewTaskId(idNum);
        useTM.setIsTaskPreviewVisible(true);
    };

    if (!projectId) {
        return (
            <Box sx={{ p: 3, textAlign: "center" }}>
                <Typography level="body-sm" sx={{ opacity: 0.7 }}>
                    Pick a project from the sidebar to see its tasks.
                </Typography>
            </Box>
        );
    }

    if (tasks.length === 0) {
        return (
            <Box sx={{ p: 3, textAlign: "center" }}>
                <AssignmentRoundedIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                <Typography level="body-sm" sx={{ opacity: 0.7 }}>
                    No open tasks in this project.
                </Typography>
            </Box>
        );
    }

    return (
        <Stack
            spacing={1}
            sx={{
                p: 1,
                overflowY: "auto",
                flex: 1,
                minHeight: 0,
            }}
        >
            {tasks.map((task) => {
                const statusMeta = task.status ? statusMetaByName.get(task.status) : undefined;
                const priorityMeta = task.priority
                    ? priorityMetaByName.get(task.priority)
                    : undefined;
                return (
                    <Sheet
                        key={task.id ?? task.title}
                        sx={{
                            p: 1.5,
                            borderRadius: "12px",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            background: isDark
                                ? "rgba(255,255,255,0.03)"
                                : "rgba(255,255,255,0.85)",
                            border: "1px solid",
                            borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                            "&:active": {
                                transform: "scale(0.99)",
                                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
                            },
                        }}
                        onClick={() => openTask(task.id)}
                    >
                        <Stack alignItems="flex-start" direction="row" spacing={1.25}>
                            {/* Assignee avatar (or empty slot) */}
                            <Box sx={{ flexShrink: 0, mt: 0.25 }}>
                                {task.assigneeId ? (
                                    <UserAvatar userId={String(task.assigneeId)} />
                                ) : (
                                    <Box
                                        sx={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: "50%",
                                            background: isDark
                                                ? "rgba(255,255,255,0.06)"
                                                : "rgba(0,0,0,0.04)",
                                        }}
                                    />
                                )}
                            </Box>

                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                {/* Title row */}
                                <Stack alignItems="center" direction="row" spacing={0.75}>
                                    {/* Milestone flag — surfaces backing-task
                                        rows so users can tell milestones from
                                        regular tasks at a glance. Mirrors the
                                        desktop table's flag column. */}
                                    {task.isMilestone === true && (
                                        <FlagRoundedIcon
                                            sx={{
                                                fontSize: 16,
                                                color: isDark ? "#fb923c" : "#ea580c",
                                                flexShrink: 0,
                                            }}
                                        />
                                    )}
                                    {task.displayId && (
                                        <Typography
                                            level="body-xs"
                                            sx={{
                                                fontFamily: "monospace",
                                                opacity: 0.6,
                                                flexShrink: 0,
                                                color: isDark
                                                    ? "rgba(255,255,255,0.7)"
                                                    : "rgba(0,0,0,0.6)",
                                            }}
                                        >
                                            {task.displayId}
                                        </Typography>
                                    )}
                                    <Typography
                                        level="body-sm"
                                        sx={{
                                            fontWeight: 600,
                                            flex: 1,
                                            minWidth: 0,
                                            // Brighter than the default body-sm
                                            // muted color so titles read clearly
                                            // in dark mode.
                                            color: isDark
                                                ? "rgba(255,255,255,0.95)"
                                                : "rgba(0,0,0,0.88)",
                                        }}
                                        noWrap
                                    >
                                        {task.title || "(untitled)"}
                                    </Typography>
                                </Stack>

                                {/* Status + Priority + Due date */}
                                <Stack
                                    alignItems="center"
                                    direction="row"
                                    spacing={0.5}
                                    sx={{ mt: 0.75, flexWrap: "wrap", gap: 0.5 }}
                                >
                                    {statusMeta && (
                                        <Chip
                                            size="sm"
                                            variant="soft"
                                            sx={{
                                                backgroundColor: statusMeta.color
                                                    ? alpha(statusMeta.color, isDark ? 0.5 : 0.75)
                                                    : "transparent",
                                                color: statusMeta.textColor ?? undefined,
                                                fontWeight: 700,
                                                fontSize: "0.65rem",
                                                borderRadius: "5px",
                                                "--Chip-paddingInline": "8px",
                                                "--Chip-minHeight": "20px",
                                            }}
                                        >
                                            {statusMeta.status}
                                        </Chip>
                                    )}
                                    {priorityMeta && (
                                        <Chip
                                            size="sm"
                                            variant="soft"
                                            sx={{
                                                backgroundColor: priorityMeta.color
                                                    ? alpha(
                                                          priorityMeta.color,
                                                          isDark ? 0.5 : 0.75
                                                      )
                                                    : "transparent",
                                                color: priorityMeta.textColor ?? undefined,
                                                fontWeight: 700,
                                                fontSize: "0.65rem",
                                                borderRadius: "5px",
                                                "--Chip-paddingInline": "8px",
                                                "--Chip-minHeight": "20px",
                                            }}
                                        >
                                            {priorityMeta.priority}
                                        </Chip>
                                    )}
                                    {task.dueDate && (
                                        <Stack
                                            alignItems="center"
                                            direction="row"
                                            spacing={0.25}
                                            sx={{
                                                ml: "auto",
                                                opacity: 0.65,
                                                fontSize: "0.7rem",
                                            }}
                                        >
                                            <AccessTimeRoundedIcon sx={{ fontSize: 12 }} />
                                            <Typography level="body-xs">
                                                {extractYYYYMMDD(task.dueDate)}
                                            </Typography>
                                        </Stack>
                                    )}
                                </Stack>

                                {/* Tags */}
                                {task.tags && task.tags.length > 0 && (
                                    <Stack
                                        direction="row"
                                        spacing={0.5}
                                        sx={{
                                            mt: 0.5,
                                            flexWrap: "wrap",
                                            gap: 0.25,
                                        }}
                                    >
                                        {task.tags.slice(0, 3).map((tag) => (
                                            <Chip
                                                key={tag.tagName}
                                                size="sm"
                                                variant="soft"
                                                sx={{
                                                    fontSize: "0.6rem",
                                                    fontWeight: 500,
                                                    borderRadius: "4px",
                                                    background: tag.tagColor,
                                                    color: tag.tagTextColor,
                                                    "--Chip-paddingInline": "6px",
                                                    "--Chip-minHeight": "16px",
                                                }}
                                            >
                                                {tag.tagName}
                                            </Chip>
                                        ))}
                                        {task.tags.length > 3 && (
                                            <Typography
                                                level="body-xs"
                                                sx={{
                                                    opacity: 0.5,
                                                    fontSize: "0.6rem",
                                                }}
                                            >
                                                +{task.tags.length - 3}
                                            </Typography>
                                        )}
                                    </Stack>
                                )}
                            </Box>
                        </Stack>
                    </Sheet>
                );
            })}
        </Stack>
    );
};
