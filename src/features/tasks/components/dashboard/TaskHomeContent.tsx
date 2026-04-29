import { useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import PendingActionsRoundedIcon from "@mui/icons-material/PendingActionsRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import ViewKanbanRoundedIcon from "@mui/icons-material/ViewKanbanRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import {
    Box,
    Button,
    Card,
    Chip,
    Grid,
    LinearProgress,
    Option,
    Select,
    Stack,
    Table,
    Tooltip,
    Typography,
} from "@mui/joy";
import Avatar from "@mui/joy/Avatar";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { TaskTableProps } from "../../../../types/tasks";

// A task augmented with status/close-date rolled up from its parent chain.
// `effectiveStatus`:
//   - "Deleted"  → task itself or any ancestor is Deleted (excluded from stats).
//   - "Closed"   → task itself OR any ancestor is Closed (sub-tasks of a closed
//                  parent are reported as completed even if their own status
//                  was never updated).
//   - otherwise  → the task's own status.
// `effectiveCloseDate`: when the task became "effectively" closed:
//   - the task's own `updatedAt` if its own status is Closed,
//   - else the closest closed ancestor's `updatedAt`,
//   - else null (task is not effectively closed).
type EffectiveTask = TaskTableProps & {
    effectiveStatus: string;
    effectiveCloseDate: string | null;
};

type TaskHomeContentProps = {
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    socket: Socket | null;
};

const SPRINT_OPTIONS = [
    { label: "Last 1 week", days: 7 },
    { label: "Last 2 weeks", days: 14 },
    { label: "Last 4 weeks", days: 28 },
    { label: "Last 8 weeks", days: 56 },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    Open: { bg: "rgba(59,130,246,0.12)", text: "#3b82f6" },
    WIP: { bg: "rgba(251,191,36,0.12)", text: "#fbbf24" },
    Pending: { bg: "rgba(251,146,60,0.12)", text: "#fb923c" },
    Closed: { bg: "rgba(34,197,94,0.12)", text: "#22c55e" },
};

const STATUS_LABELS: Record<string, string> = {
    Open: "Open",
    WIP: "In Progress",
    Pending: "Pending",
    Closed: "Completed",
};

const getStatusIcon = (status: string, size = 14) => {
    const sx = { fontSize: size };
    switch (status) {
        case "Open":
            return <RadioButtonUncheckedRoundedIcon sx={sx} />;
        case "WIP":
            return <PlayCircleOutlineRoundedIcon sx={sx} />;
        case "Pending":
            return <PendingActionsRoundedIcon sx={sx} />;
        case "Closed":
            return <CheckCircleOutlineRoundedIcon sx={sx} />;
        default:
            return <RadioButtonUncheckedRoundedIcon sx={sx} />;
    }
};

const formatRelativeTime = (dateStr: string | null): string => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return "today";
    if (days === 1) return "1 day ago";
    if (days < 7) return `${days} days ago`;
    const weeks = Math.floor(days / 7);
    if (weeks === 1) return "1 week ago";
    return `${weeks} weeks ago`;
};

export const TaskHomeContent = ({
    useTM,
    usePM,
    useTEM,
    myself,
    setMyself,
    useCM,
    useUISM,
    socket,
}: TaskHomeContentProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const [sprintDays, setSprintDays] = useState(14);

    useEffect(() => {
        if (usePM.currentProject?.projectId) {
            useTM.fetchProjectTasks(usePM.currentProject.projectId);
        }
    }, []);

    const now = useMemo(() => Date.now(), [sprintDays]);
    const sprintStart = useMemo(() => now - sprintDays * 86400000, [now, sprintDays]);

    // ── All-project stats ──
    const allTasks = useTM.allTasks || [];

    // Index every task by id so we can walk the parent chain efficiently.
    const taskById = useMemo(() => {
        const map = new Map<string, TaskTableProps>();
        for (const t of allTasks) {
            if (t.id) map.set(String(t.id), t);
        }
        return map;
    }, [allTasks]);

    // Rolled-up task list used by every dashboard metric below.
    // We exclude Deleted tasks and entire branches under a Deleted parent,
    // and we treat sub-tasks of a Closed parent as Closed themselves.
    const effectiveTasks = useMemo<EffectiveTask[]>(() => {
        const result: EffectiveTask[] = [];
        for (const t of allTasks) {
            if (!t.id) continue;
            // Rule 1: ignore tasks that are themselves Deleted.
            if (t.status === "Deleted") continue;

            // Walk ancestors (including self) to find the closest Closed and
            // detect any Deleted ancestor.
            const visited = new Set<string>();
            let current: TaskTableProps | undefined = t;
            let ancestorClosedDate: string | null = null;
            let isInDeletedBranch = false;

            while (current && current.id && !visited.has(current.id)) {
                visited.add(current.id);
                if (current.status === "Deleted") {
                    isInDeletedBranch = true;
                    break;
                }
                if (current.status === "Closed" && ancestorClosedDate === null) {
                    ancestorClosedDate = current.updatedAt;
                }
                if (!current.parentTaskId) break;
                current = taskById.get(String(current.parentTaskId));
            }

            // Rule 4: also drop tasks whose ancestor is Deleted (orphan branch).
            if (isInDeletedBranch) continue;

            // Rule 2: parent Closed ⇒ child treated as Closed.
            const effectiveStatus = ancestorClosedDate !== null ? "Closed" : t.status || "Open";
            const effectiveCloseDate = t.status === "Closed" ? t.updatedAt : ancestorClosedDate;

            result.push({ ...t, effectiveStatus, effectiveCloseDate });
        }
        return result;
    }, [allTasks, taskById]);

    const stats = useMemo(() => {
        const openCount = effectiveTasks.filter((t) => t.effectiveStatus === "Open").length;
        const wipCount = effectiveTasks.filter((t) => t.effectiveStatus === "WIP").length;
        const pendingCount = effectiveTasks.filter((t) => t.effectiveStatus === "Pending").length;
        const closedCount = effectiveTasks.filter((t) => t.effectiveStatus === "Closed").length;
        const totalTasks = openCount + wipCount + pendingCount + closedCount;
        const completionRate = totalTasks > 0 ? Math.round((closedCount / totalTasks) * 100) : 0;
        return { openCount, wipCount, pendingCount, closedCount, totalTasks, completionRate };
    }, [effectiveTasks]);

    // ── Sprint-scoped metrics ──
    // All counts use effectiveTasks so Deleted (and orphans of Deleted parents)
    // are excluded. "Closed in sprint" uses the effective close date so a
    // sub-task counts when its parent was closed during the sprint window.
    const sprintStats = useMemo(() => {
        const createdInSprint = effectiveTasks.filter((t) => {
            const d = t.createdDate ? new Date(t.createdDate).getTime() : 0;
            return d >= sprintStart && d <= now;
        });
        const closedInSprint = effectiveTasks.filter((t) => {
            if (t.effectiveStatus !== "Closed") return false;
            const d = t.effectiveCloseDate ? new Date(t.effectiveCloseDate).getTime() : 0;
            return d >= sprintStart && d <= now;
        });
        const updatedInSprint = effectiveTasks.filter((t) => {
            const d = t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
            return d >= sprintStart && d <= now;
        });
        return {
            created: createdInSprint.length,
            closed: closedInSprint.length,
            updated: updatedInSprint.length,
            net: createdInSprint.length - closedInSprint.length,
        };
    }, [effectiveTasks, sprintStart, now]);

    // ── Assignee workload ──
    const assigneeWorkload = useMemo(() => {
        const map = new Map<
            string,
            {
                name: string;
                imgPath: string | null;
                open: number;
                wip: number;
                pending: number;
                closed: number;
                closedInSprint: number;
                total: number;
            }
        >();
        for (const t of effectiveTasks) {
            const id = t.assigneeId || "__unassigned__";
            const entry = map.get(id) || {
                name: t.assigneeName || "Unassigned",
                imgPath: t.assigneeImgPath || null,
                open: 0,
                wip: 0,
                pending: 0,
                closed: 0,
                closedInSprint: 0,
                total: 0,
            };
            entry.total++;
            if (t.effectiveStatus === "Open") entry.open++;
            else if (t.effectiveStatus === "WIP") entry.wip++;
            else if (t.effectiveStatus === "Pending") entry.pending++;
            else if (t.effectiveStatus === "Closed") {
                entry.closed++;
                const d = t.effectiveCloseDate ? new Date(t.effectiveCloseDate).getTime() : 0;
                if (d >= sprintStart && d <= now) entry.closedInSprint++;
            }
            map.set(id, entry);
        }
        return Array.from(map.entries())
            .map(([id, v]) => ({ id, ...v }))
            .sort((a, b) => b.total - a.total);
    }, [effectiveTasks, sprintStart, now]);

    // ── Recently updated tasks (sprint scoped) ──
    // effectiveTasks already excludes Deleted and Deleted-branch orphans.
    const recentTasks = useMemo(() => {
        return effectiveTasks
            .filter((t) => {
                const d = t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
                return d >= sprintStart;
            })
            .sort((a, b) => {
                const dA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                const dB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                return dB - dA;
            })
            .slice(0, 12);
    }, [effectiveTasks, sprintStart]);

    // ── Priority breakdown (active tasks only) ──
    // "Active" uses effectiveStatus, so sub-tasks of Closed parents are
    // correctly excluded from the active count.
    const priorityBreakdown = useMemo(() => {
        const levels = ["Critical", "High", "Normal", "Low", "Minimal"];
        const active = effectiveTasks.filter((t) => t.effectiveStatus !== "Closed");
        const counts: Record<string, number> = {};
        for (const l of levels) counts[l] = 0;
        counts["None"] = 0;
        for (const t of active) {
            const p = t.priority || "None";
            if (levels.includes(p)) counts[p]++;
            else counts["None"]++;
        }
        return counts;
    }, [effectiveTasks]);

    // ── Effort breakdown (active tasks only) ──
    const effortBreakdown = useMemo(() => {
        const levels = ["Extensive", "High", "Moderate", "Low", "Minimal"];
        const active = effectiveTasks.filter((t) => t.effectiveStatus !== "Closed");
        const counts: Record<string, number> = {};
        for (const l of levels) counts[l] = 0;
        counts["None"] = 0;
        for (const t of active) {
            const e = t.effortLevel || "None";
            if (levels.includes(e)) counts[e]++;
            else counts["None"]++;
        }
        return counts;
    }, [effectiveTasks]);

    // ── Overdue & upcoming ──
    // Filtering on effectiveStatus !== "Closed" ensures sub-tasks of a closed
    // parent never appear in Overdue or Due-This-Week.
    const overdueAndUpcoming = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekAhead = new Date(today);
        weekAhead.setDate(weekAhead.getDate() + 7);

        const overdue = effectiveTasks.filter((t) => {
            if (t.effectiveStatus === "Closed" || !t.dueDate) return false;
            return new Date(t.dueDate) < today;
        });
        const upcoming = effectiveTasks.filter((t) => {
            if (t.effectiveStatus === "Closed" || !t.dueDate) return false;
            const d = new Date(t.dueDate);
            return d >= today && d <= weekAhead;
        });
        return { overdue, upcoming };
    }, [effectiveTasks]);

    // ── Handlers ──
    const projectCount = usePM.teamProjects?.length || 0;

    const joinedProjects = useMemo(() => {
        return (usePM.teamProjects || []).filter((p) => p.isJoined === true);
    }, [usePM.teamProjects]);

    const handleTaskClick = (taskId: number) => {
        useTM.setIsTaskPreviewVisible(true);
        useTM.setCurrentPreviewTaskId(taskId);
    };
    const handleGoToTable = () => {
        useTM.setIsDashboardVisible(false);
        useTM.setIsTaskHomeVisible(true);
        useTM.setIsSprintBoardVisible(false);
    };
    const handleGoToBoard = () => {
        useTM.setIsDashboardVisible(false);
        useTM.setIsTaskHomeVisible(false);
        useTM.setIsSprintBoardVisible(true);
    };
    const handleCreateTask = () => {
        useTM.handleCreateTask();
    };
    const handleProjectChange = async (projectId: number) => {
        const selectedProject = usePM.teamProjects?.find((p) => p.projectId === projectId);
        if (selectedProject && projectId !== usePM.currentProject?.projectId) {
            useTM.setAllTasks([]);
            await usePM.loadProjectsAndTasks(projectId);
            usePM.setCurrentProject({
                projectId: selectedProject.projectId,
                projectName: selectedProject.projectName,
                projectTags: selectedProject.projectTags || [],
                isPrivate: selectedProject.isPrivate,
                systemUserId: selectedProject.systemUserId,
            });
        }
    };

    // ── Shared style helpers ──
    const cardBg = isDark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.7)";
    const cardBorder = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    const textPrimary = isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)";
    const textSecondary = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)";
    const textMuted = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
    const sectionHeaderColor = isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.75)";

    // ── Stacked bar helper ──
    const renderStackedBar = (segments: { color: string; value: number }[], total: number) => (
        <Box
            sx={{
                display: "flex",
                height: 10,
                borderRadius: 5,
                overflow: "hidden",
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            }}
        >
            {segments.map((seg, i) =>
                seg.value > 0 ? (
                    <Tooltip key={i} title={`${Math.round((seg.value / total) * 100)}%`} size="sm">
                        <Box
                            sx={{
                                width: `${(seg.value / total) * 100}%`,
                                backgroundColor: seg.color,
                                transition: "width 0.3s ease",
                            }}
                        />
                    </Tooltip>
                ) : null
            )}
        </Box>
    );

    // ── Mini distribution bar (for priority / effort) ──
    const renderDistributionCard = (
        title: string,
        icon: React.ReactNode,
        data: Record<string, number>,
        colorMap: Record<string, string>
    ) => {
        const total = Object.values(data).reduce((a, b) => a + b, 0);
        return (
            <Card
                variant="outlined"
                sx={{
                    p: 2.5,
                    flex: 1,
                    background: cardBg,
                    borderColor: cardBorder,
                }}
            >
                <Stack spacing={2}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        {icon}
                        <Typography level="title-sm" sx={{ fontWeight: 600, color: textPrimary }}>
                            {title}
                        </Typography>
                        <Chip size="sm" variant="soft" sx={{ ml: "auto" }}>
                            {total} tasks
                        </Chip>
                    </Stack>
                    {total > 0 &&
                        renderStackedBar(
                            Object.entries(data)
                                .filter(([, v]) => v > 0)
                                .map(([k, v]) => ({
                                    color: colorMap[k] || "#94a3b8",
                                    value: v,
                                })),
                            total
                        )}
                    <Stack spacing={0.75}>
                        {Object.entries(data).map(([label, count]) => (
                            <Stack
                                key={label}
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                            >
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Box
                                        sx={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: "50%",
                                            backgroundColor: colorMap[label] || "#94a3b8",
                                        }}
                                    />
                                    <Typography level="body-xs" sx={{ color: textSecondary }}>
                                        {label}
                                    </Typography>
                                </Stack>
                                <Typography
                                    level="body-xs"
                                    sx={{ fontWeight: 600, color: textPrimary }}
                                >
                                    {count}
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                </Stack>
            </Card>
        );
    };

    const priorityColors: Record<string, string> = {
        Critical: "#EF4444",
        High: "#F59E0B",
        Normal: "#3B82F6",
        Low: "#34D399",
        Minimal: "#9CA3AF",
        None: "#94a3b8",
    };

    const effortColors: Record<string, string> = {
        Extensive: "#EF4444",
        High: "#F59E0B",
        Moderate: "#3B82F6",
        Low: "#34D399",
        Minimal: "#9CA3AF",
        None: "#94a3b8",
    };

    return (
        <Box
            sx={{
                height: "100%",
                overflow: "auto",
                p: { xs: 2, md: 4 },
                background: isDark
                    ? "linear-gradient(180deg, rgba(18, 18, 19, 0.95) 0%, rgb(25, 26, 28) 100%)"
                    : "linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(241,245,249,1) 100%)",
            }}
            className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
        >
            <Stack spacing={3} sx={{ maxWidth: 1200, mx: "auto" }}>
                {/* ════════ Dashboard Title ════════ */}
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box
                            sx={{
                                width: 36,
                                height: 36,
                                borderRadius: "10px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: isDark
                                    ? "linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(99,102,241,0.2) 100%)"
                                    : "linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(99,102,241,0.15) 100%)",
                            }}
                        >
                            <TrendingUpRoundedIcon
                                sx={{ fontSize: 20, color: isDark ? "#60a5fa" : "#3b82f6" }}
                            />
                        </Box>
                        <Typography
                            level="h3"
                            sx={{
                                fontWeight: 700,
                                color: textPrimary,
                                letterSpacing: "-0.02em",
                            }}
                        >
                            Sprint Dashboard
                        </Typography>
                    </Stack>
                    <Typography level="body-sm" sx={{ color: textMuted }}>
                        {projectCount} projects
                    </Typography>
                </Stack>

                {/* ════════ Section A: Sprint Summary Header ════════ */}
                {usePM.currentProject ? (
                    <Card
                        variant="soft"
                        sx={{
                            p: 3,
                            background: isDark
                                ? "linear-gradient(135deg, rgba(251,146,60,0.08) 0%, rgba(234,88,12,0.08) 100%)"
                                : "linear-gradient(135deg, rgba(251,146,60,0.06) 0%, rgba(234,88,12,0.06) 100%)",
                            border: "1px solid",
                            borderColor: isDark ? "rgba(251,146,60,0.2)" : "rgba(251,146,60,0.15)",
                        }}
                    >
                        <Stack spacing={2.5}>
                            {/* Project selector + sprint selector row */}
                            <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                flexWrap="wrap"
                                gap={2}
                            >
                                <Stack direction="row" alignItems="center" spacing={1.5}>
                                    <Box
                                        sx={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: "10px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            backgroundColor: isDark
                                                ? "rgba(251,146,60,0.15)"
                                                : "rgba(251,146,60,0.12)",
                                        }}
                                    >
                                        <WorkRoundedIcon
                                            sx={{
                                                fontSize: 22,
                                                color: isDark ? "#fb923c" : "#ea580c",
                                            }}
                                        />
                                    </Box>
                                    <Box>
                                        <Typography
                                            level="body-xs"
                                            sx={{
                                                color: isDark
                                                    ? "rgba(255,255,255,0.5)"
                                                    : "rgba(0,0,0,0.5)",
                                                fontWeight: 500,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.05em",
                                                mb: 0.5,
                                            }}
                                        >
                                            Current Project
                                        </Typography>
                                        <Select
                                            value={usePM.currentProject.projectId}
                                            onChange={(_, value) => {
                                                if (value) handleProjectChange(value as number);
                                            }}
                                            indicator={<KeyboardArrowDownRoundedIcon />}
                                            startDecorator={
                                                <SwapHorizRoundedIcon sx={{ fontSize: 18 }} />
                                            }
                                            sx={{
                                                minWidth: 180,
                                                maxWidth: 280,
                                                fontWeight: 700,
                                                fontSize: "1rem",
                                                color: isDark ? "#fb923c" : "#ea580c",
                                                backgroundColor: isDark
                                                    ? "rgba(251,146,60,0.1)"
                                                    : "rgba(251,146,60,0.08)",
                                                border: "1px solid",
                                                borderColor: isDark
                                                    ? "rgba(251,146,60,0.3)"
                                                    : "rgba(251,146,60,0.2)",
                                                "&:hover": {
                                                    backgroundColor: isDark
                                                        ? "rgba(251,146,60,0.15)"
                                                        : "rgba(251,146,60,0.12)",
                                                },
                                                "& .MuiSelect-indicator": {
                                                    color: isDark ? "#fb923c" : "#ea580c",
                                                },
                                            }}
                                            slotProps={{
                                                listbox: {
                                                    sx: {
                                                        backgroundColor: isDark
                                                            ? "rgba(30,30,32,0.98)"
                                                            : "rgba(255,255,255,0.98)",
                                                        border: "1px solid",
                                                        borderColor: isDark
                                                            ? "rgba(255,255,255,0.1)"
                                                            : "rgba(0,0,0,0.1)",
                                                    },
                                                },
                                            }}
                                        >
                                            {joinedProjects.map((project) => (
                                                <Option
                                                    key={project.projectId}
                                                    value={project.projectId}
                                                    sx={{
                                                        fontWeight:
                                                            project.projectId ===
                                                            usePM.currentProject?.projectId
                                                                ? 700
                                                                : 500,
                                                    }}
                                                >
                                                    {project.projectName}
                                                </Option>
                                            ))}
                                        </Select>
                                    </Box>
                                </Stack>

                                {/* Sprint period selector */}
                                <Stack direction="row" alignItems="center" spacing={1.5}>
                                    <Select
                                        value={sprintDays}
                                        onChange={(_, value) => {
                                            if (value) setSprintDays(value as number);
                                        }}
                                        indicator={<KeyboardArrowDownRoundedIcon />}
                                        startDecorator={
                                            <CalendarMonthRoundedIcon sx={{ fontSize: 18 }} />
                                        }
                                        size="sm"
                                        sx={{
                                            minWidth: 160,
                                            fontWeight: 600,
                                            color: isDark ? "#a5b4fc" : "#6366f1",
                                            backgroundColor: isDark
                                                ? "rgba(99,102,241,0.1)"
                                                : "rgba(99,102,241,0.08)",
                                            border: "1px solid",
                                            borderColor: isDark
                                                ? "rgba(99,102,241,0.3)"
                                                : "rgba(99,102,241,0.2)",
                                            "&:hover": {
                                                backgroundColor: isDark
                                                    ? "rgba(99,102,241,0.15)"
                                                    : "rgba(99,102,241,0.12)",
                                            },
                                            "& .MuiSelect-indicator": {
                                                color: isDark ? "#a5b4fc" : "#6366f1",
                                            },
                                        }}
                                        slotProps={{
                                            listbox: {
                                                sx: {
                                                    backgroundColor: isDark
                                                        ? "rgba(30,30,32,0.98)"
                                                        : "rgba(255,255,255,0.98)",
                                                    border: "1px solid",
                                                    borderColor: isDark
                                                        ? "rgba(255,255,255,0.1)"
                                                        : "rgba(0,0,0,0.1)",
                                                },
                                            },
                                        }}
                                    >
                                        {SPRINT_OPTIONS.map((opt) => (
                                            <Option key={opt.days} value={opt.days}>
                                                {opt.label}
                                            </Option>
                                        ))}
                                    </Select>
                                    <Chip
                                        size="lg"
                                        variant="soft"
                                        sx={{
                                            backgroundColor: isDark
                                                ? "rgba(34,197,94,0.12)"
                                                : "rgba(34,197,94,0.1)",
                                            color: "#22c55e",
                                            fontWeight: 700,
                                            fontSize: "0.95rem",
                                            px: 2,
                                        }}
                                    >
                                        {stats.completionRate}%
                                    </Chip>
                                </Stack>
                            </Stack>

                            {/* Sprint date range indicator */}
                            <Typography
                                level="body-xs"
                                sx={{
                                    color: isDark
                                        ? "rgba(165,180,252,0.7)"
                                        : "rgba(99,102,241,0.6)",
                                    fontWeight: 500,
                                }}
                            >
                                Sprint window: {new Date(sprintStart).toLocaleDateString()} &mdash;{" "}
                                {new Date(now).toLocaleDateString()}
                            </Typography>

                            {/* Project progress bar */}
                            <Box>
                                <Stack
                                    direction="row"
                                    justifyContent="space-between"
                                    sx={{ mb: 1 }}
                                >
                                    <Typography
                                        level="body-sm"
                                        sx={{ color: textSecondary, fontWeight: 500 }}
                                    >
                                        Overall Progress
                                    </Typography>
                                    <Typography
                                        level="body-sm"
                                        sx={{ color: textSecondary, fontWeight: 500 }}
                                    >
                                        {stats.closedCount} / {stats.totalTasks} tasks
                                    </Typography>
                                </Stack>
                                <LinearProgress
                                    determinate
                                    value={stats.completionRate}
                                    color="success"
                                    sx={{
                                        "--LinearProgress-thickness": "8px",
                                        "--LinearProgress-radius": "4px",
                                        "--LinearProgress-progressRadius": "4px",
                                        backgroundColor: isDark
                                            ? "rgba(255,255,255,0.1)"
                                            : "rgba(0,0,0,0.08)",
                                    }}
                                />
                            </Box>

                            {/* Sprint-scoped quick chips */}
                            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                                <Chip
                                    size="md"
                                    variant="soft"
                                    startDecorator={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                                    sx={{
                                        backgroundColor: isDark
                                            ? "rgba(59,130,246,0.12)"
                                            : "rgba(59,130,246,0.1)",
                                        color: "#3b82f6",
                                    }}
                                >
                                    {sprintStats.created} Created
                                </Chip>
                                <Chip
                                    size="md"
                                    variant="soft"
                                    startDecorator={
                                        <CheckCircleOutlineRoundedIcon sx={{ fontSize: 16 }} />
                                    }
                                    sx={{
                                        backgroundColor: isDark
                                            ? "rgba(34,197,94,0.12)"
                                            : "rgba(34,197,94,0.1)",
                                        color: "#22c55e",
                                    }}
                                >
                                    {sprintStats.closed} Closed
                                </Chip>
                                <Chip
                                    size="md"
                                    variant="soft"
                                    startDecorator={
                                        <TrendingUpRoundedIcon sx={{ fontSize: 16 }} />
                                    }
                                    sx={{
                                        backgroundColor:
                                            sprintStats.net <= 0
                                                ? isDark
                                                    ? "rgba(34,197,94,0.12)"
                                                    : "rgba(34,197,94,0.1)"
                                                : isDark
                                                  ? "rgba(251,146,60,0.12)"
                                                  : "rgba(251,146,60,0.1)",
                                        color: sprintStats.net <= 0 ? "#22c55e" : "#fb923c",
                                    }}
                                >
                                    {sprintStats.net > 0 ? "+" : ""}
                                    {sprintStats.net} Net
                                </Chip>
                                <Chip
                                    size="md"
                                    variant="soft"
                                    startDecorator={
                                        <AssignmentRoundedIcon sx={{ fontSize: 16 }} />
                                    }
                                    sx={{
                                        backgroundColor: isDark
                                            ? "rgba(147,51,234,0.12)"
                                            : "rgba(147,51,234,0.1)",
                                        color: "#a855f7",
                                    }}
                                >
                                    {sprintStats.updated} Updated
                                </Chip>
                            </Stack>
                        </Stack>
                    </Card>
                ) : (
                    /* No Project selected */
                    <Card
                        variant="soft"
                        sx={{
                            p: 4,
                            textAlign: "center",
                            background: cardBg,
                            border: "2px dashed",
                            borderColor: cardBorder,
                        }}
                    >
                        <Stack spacing={2} alignItems="center">
                            <Box
                                sx={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: "16px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: isDark
                                        ? "rgba(251,146,60,0.1)"
                                        : "rgba(251,146,60,0.08)",
                                }}
                            >
                                <WorkRoundedIcon
                                    sx={{
                                        fontSize: 32,
                                        color: isDark ? "#fb923c" : "#ea580c",
                                    }}
                                />
                            </Box>
                            <Typography
                                level="title-lg"
                                sx={{ fontWeight: 600, color: textPrimary, mb: 0.5 }}
                            >
                                No Project Selected
                            </Typography>
                            <Typography level="body-sm" sx={{ color: textMuted }}>
                                Select a project from the sidebar to view sprint analytics
                            </Typography>
                        </Stack>
                    </Card>
                )}

                {/* Only render remaining sections if a project is selected */}
                {usePM.currentProject && (
                    <>
                        {/* ════════ Quick Actions (compact) ════════ */}
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button
                                variant="soft"
                                size="sm"
                                startDecorator={<AddRoundedIcon />}
                                onClick={handleCreateTask}
                                sx={{
                                    flex: 1,
                                    py: 1,
                                    background: isDark
                                        ? "rgba(34,197,94,0.1)"
                                        : "rgba(34,197,94,0.07)",
                                    color: "#22c55e",
                                    "&:hover": {
                                        background: isDark
                                            ? "rgba(34,197,94,0.18)"
                                            : "rgba(34,197,94,0.14)",
                                    },
                                }}
                            >
                                New Task
                            </Button>
                            <Button
                                variant="soft"
                                size="sm"
                                startDecorator={<FolderOpenRoundedIcon />}
                                onClick={handleGoToTable}
                                sx={{
                                    flex: 1,
                                    py: 1,
                                    background: isDark
                                        ? "rgba(59,130,246,0.1)"
                                        : "rgba(59,130,246,0.07)",
                                    color: "#3b82f6",
                                    "&:hover": {
                                        background: isDark
                                            ? "rgba(59,130,246,0.18)"
                                            : "rgba(59,130,246,0.14)",
                                    },
                                }}
                            >
                                Task Table
                            </Button>
                            <Button
                                variant="soft"
                                size="sm"
                                startDecorator={<ViewKanbanRoundedIcon />}
                                onClick={handleGoToBoard}
                                sx={{
                                    flex: 1,
                                    py: 1,
                                    background: isDark
                                        ? "rgba(147,51,234,0.1)"
                                        : "rgba(147,51,234,0.07)",
                                    color: "#a855f7",
                                    "&:hover": {
                                        background: isDark
                                            ? "rgba(147,51,234,0.18)"
                                            : "rgba(147,51,234,0.14)",
                                    },
                                }}
                            >
                                Sprint Board
                            </Button>
                        </Stack>

                        {/* ════════ Section B: Status Distribution ════════ */}
                        <Box>
                            <Typography
                                level="title-sm"
                                sx={{
                                    fontWeight: 600,
                                    mb: 2,
                                    color: sectionHeaderColor,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                }}
                            >
                                <TrendingUpRoundedIcon sx={{ fontSize: 16 }} />
                                Status Distribution
                            </Typography>

                            {/* Stacked bar */}
                            {stats.totalTasks > 0 && (
                                <Box sx={{ mb: 2 }}>
                                    {renderStackedBar(
                                        [
                                            {
                                                color: STATUS_COLORS.Open.text,
                                                value: stats.openCount,
                                            },
                                            {
                                                color: STATUS_COLORS.WIP.text,
                                                value: stats.wipCount,
                                            },
                                            {
                                                color: STATUS_COLORS.Pending.text,
                                                value: stats.pendingCount,
                                            },
                                            {
                                                color: STATUS_COLORS.Closed.text,
                                                value: stats.closedCount,
                                            },
                                        ],
                                        stats.totalTasks
                                    )}
                                </Box>
                            )}

                            {/* Status cards */}
                            <Grid container spacing={1.5}>
                                {(
                                    [
                                        {
                                            key: "Open",
                                            count: stats.openCount,
                                            icon: <RadioButtonUncheckedRoundedIcon />,
                                        },
                                        {
                                            key: "WIP",
                                            count: stats.wipCount,
                                            icon: <PlayCircleOutlineRoundedIcon />,
                                        },
                                        {
                                            key: "Pending",
                                            count: stats.pendingCount,
                                            icon: <PendingActionsRoundedIcon />,
                                        },
                                        {
                                            key: "Closed",
                                            count: stats.closedCount,
                                            icon: <CheckCircleOutlineRoundedIcon />,
                                        },
                                    ] as const
                                ).map((s) => {
                                    const sc = STATUS_COLORS[s.key];
                                    const pct =
                                        stats.totalTasks > 0
                                            ? Math.round((s.count / stats.totalTasks) * 100)
                                            : 0;
                                    return (
                                        <Grid key={s.key} xs={6} md={3}>
                                            <Card
                                                variant="soft"
                                                sx={{
                                                    p: 2,
                                                    background: isDark
                                                        ? sc.bg
                                                        : sc.bg.replace("0.12", "0.08"),
                                                    border: "1px solid",
                                                    borderColor: cardBorder,
                                                    transition: "transform 0.2s ease",
                                                    "&:hover": {
                                                        transform: "translateY(-2px)",
                                                    },
                                                }}
                                            >
                                                <Stack spacing={1}>
                                                    <Stack
                                                        direction="row"
                                                        alignItems="center"
                                                        justifyContent="space-between"
                                                    >
                                                        <Box
                                                            sx={{
                                                                width: 32,
                                                                height: 32,
                                                                borderRadius: "8px",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                color: sc.text,
                                                                backgroundColor: isDark
                                                                    ? "rgba(255,255,255,0.06)"
                                                                    : "rgba(255,255,255,0.8)",
                                                            }}
                                                        >
                                                            {s.icon}
                                                        </Box>
                                                        <Typography
                                                            level="body-xs"
                                                            sx={{
                                                                color: sc.text,
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            {pct}%
                                                        </Typography>
                                                    </Stack>
                                                    <Box>
                                                        <Typography
                                                            level="h3"
                                                            sx={{
                                                                fontWeight: 700,
                                                                fontSize: "1.4rem",
                                                                color: textPrimary,
                                                            }}
                                                        >
                                                            {s.count}
                                                        </Typography>
                                                        <Typography
                                                            level="body-xs"
                                                            sx={{
                                                                color: textSecondary,
                                                                fontWeight: 500,
                                                            }}
                                                        >
                                                            {STATUS_LABELS[s.key]}
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                            </Card>
                                        </Grid>
                                    );
                                })}
                            </Grid>
                        </Box>

                        {/* ════════ Section C: Assignee Workload ════════ */}
                        {assigneeWorkload.length > 0 && (
                            <Box>
                                <Typography
                                    level="title-sm"
                                    sx={{
                                        fontWeight: 600,
                                        mb: 2,
                                        color: sectionHeaderColor,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <PersonRoundedIcon sx={{ fontSize: 16 }} />
                                    Assignee Workload
                                </Typography>
                                <Card
                                    variant="outlined"
                                    sx={{
                                        background: cardBg,
                                        borderColor: cardBorder,
                                        overflow: "auto",
                                    }}
                                >
                                    <Table
                                        size="sm"
                                        sx={{
                                            "& thead th": {
                                                backgroundColor: "transparent",
                                                color: textSecondary,
                                                fontWeight: 600,
                                                fontSize: "0.7rem",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.04em",
                                                borderBottom: "1px solid",
                                                borderColor: cardBorder,
                                                py: 1,
                                            },
                                            "& tbody td": {
                                                borderBottom: "1px solid",
                                                borderColor: isDark
                                                    ? "rgba(255,255,255,0.04)"
                                                    : "rgba(0,0,0,0.04)",
                                                py: 1.25,
                                            },
                                            "& tbody tr:last-child td": {
                                                borderBottom: "none",
                                            },
                                        }}
                                    >
                                        <thead>
                                            <tr>
                                                <th style={{ width: "30%" }}>Member</th>
                                                <th style={{ textAlign: "center" }}>Open</th>
                                                <th style={{ textAlign: "center" }}>WIP</th>
                                                <th style={{ textAlign: "center" }}>Pending</th>
                                                <th style={{ textAlign: "center" }}>Closed</th>
                                                <th style={{ textAlign: "center" }}>Total</th>
                                                <th style={{ textAlign: "center" }}>
                                                    Closed (Sprint)
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {assigneeWorkload.map((a) => (
                                                <tr key={a.id}>
                                                    <td>
                                                        <Stack
                                                            direction="row"
                                                            alignItems="center"
                                                            spacing={1}
                                                        >
                                                            {a.id !== "__unassigned__" &&
                                                            useTEM.teamMemberProfiles[a.id] ? (
                                                                <AvatarWithStatus
                                                                    avatarSize={26}
                                                                    avatarUser={
                                                                        useTEM.teamMemberProfiles[
                                                                            a.id
                                                                        ]
                                                                    }
                                                                    isYou={myself.userId === a.id}
                                                                    myself={myself}
                                                                    setMyself={setMyself}
                                                                    socket={socket}
                                                                    useCM={useCM}
                                                                    useUISM={useUISM}
                                                                />
                                                            ) : (
                                                                <Avatar
                                                                    size="sm"
                                                                    src={a.imgPath || undefined}
                                                                    sx={{ width: 26, height: 26 }}
                                                                >
                                                                    {(a.name ||
                                                                        "?")[0]?.toUpperCase()}
                                                                </Avatar>
                                                            )}
                                                            <Typography
                                                                level="body-sm"
                                                                sx={{
                                                                    fontWeight: 500,
                                                                    color: textPrimary,
                                                                    overflow: "hidden",
                                                                    textOverflow: "ellipsis",
                                                                    whiteSpace: "nowrap",
                                                                    maxWidth: 140,
                                                                }}
                                                            >
                                                                {a.name}
                                                            </Typography>
                                                        </Stack>
                                                    </td>
                                                    {(
                                                        [
                                                            {
                                                                val: a.open,
                                                                color: STATUS_COLORS.Open.text,
                                                            },
                                                            {
                                                                val: a.wip,
                                                                color: STATUS_COLORS.WIP.text,
                                                            },
                                                            {
                                                                val: a.pending,
                                                                color: STATUS_COLORS.Pending.text,
                                                            },
                                                            {
                                                                val: a.closed,
                                                                color: STATUS_COLORS.Closed.text,
                                                            },
                                                        ] as const
                                                    ).map((cell, i) => (
                                                        <td
                                                            key={i}
                                                            style={{ textAlign: "center" }}
                                                        >
                                                            {cell.val > 0 ? (
                                                                <Chip
                                                                    size="sm"
                                                                    variant="soft"
                                                                    sx={{
                                                                        minWidth: 28,
                                                                        backgroundColor:
                                                                            STATUS_COLORS[
                                                                                [
                                                                                    "Open",
                                                                                    "WIP",
                                                                                    "Pending",
                                                                                    "Closed",
                                                                                ][i]
                                                                            ].bg,
                                                                        color: cell.color,
                                                                        fontWeight: 600,
                                                                    }}
                                                                >
                                                                    {cell.val}
                                                                </Chip>
                                                            ) : (
                                                                <Typography
                                                                    level="body-xs"
                                                                    sx={{ color: textMuted }}
                                                                >
                                                                    -
                                                                </Typography>
                                                            )}
                                                        </td>
                                                    ))}
                                                    <td style={{ textAlign: "center" }}>
                                                        <Typography
                                                            level="body-sm"
                                                            sx={{
                                                                fontWeight: 700,
                                                                color: textPrimary,
                                                            }}
                                                        >
                                                            {a.total}
                                                        </Typography>
                                                    </td>
                                                    <td style={{ textAlign: "center" }}>
                                                        {a.closedInSprint > 0 ? (
                                                            <Chip
                                                                size="sm"
                                                                variant="soft"
                                                                sx={{
                                                                    minWidth: 28,
                                                                    backgroundColor:
                                                                        "rgba(34,197,94,0.12)",
                                                                    color: "#22c55e",
                                                                    fontWeight: 600,
                                                                }}
                                                            >
                                                                {a.closedInSprint}
                                                            </Chip>
                                                        ) : (
                                                            <Typography
                                                                level="body-xs"
                                                                sx={{ color: textMuted }}
                                                            >
                                                                -
                                                            </Typography>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </Card>
                            </Box>
                        )}

                        {/* ════════ Section D: Recently Updated Tasks ════════ */}
                        {recentTasks.length > 0 && (
                            <Box>
                                <Typography
                                    component="div"
                                    level="title-sm"
                                    sx={{
                                        fontWeight: 600,
                                        mb: 2,
                                        color: sectionHeaderColor,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <AssignmentRoundedIcon sx={{ fontSize: 16 }} />
                                    Recently Updated
                                    <Chip size="sm" variant="soft" sx={{ ml: 0.5 }}>
                                        {recentTasks.length}
                                    </Chip>
                                </Typography>
                                <Grid container spacing={1.5}>
                                    {recentTasks.map((task) => {
                                        const sc =
                                            STATUS_COLORS[task.effectiveStatus] ||
                                            STATUS_COLORS.Open;
                                        return (
                                            <Grid key={task.id} xs={12} sm={6} md={4}>
                                                <Card
                                                    variant="outlined"
                                                    sx={{
                                                        p: 2,
                                                        cursor: "pointer",
                                                        background: cardBg,
                                                        borderColor: cardBorder,
                                                        transition: "all 0.2s ease",
                                                        "&:hover": {
                                                            borderColor: sc.text,
                                                            background: isDark
                                                                ? "rgba(255,255,255,0.04)"
                                                                : "rgba(255,255,255,0.9)",
                                                        },
                                                    }}
                                                    onClick={() =>
                                                        handleTaskClick(Number(task.id))
                                                    }
                                                >
                                                    <Stack spacing={1}>
                                                        <Stack
                                                            direction="row"
                                                            justifyContent="space-between"
                                                            alignItems="flex-start"
                                                        >
                                                            <Typography
                                                                level="body-xs"
                                                                sx={{
                                                                    fontWeight: 600,
                                                                    color: textMuted,
                                                                }}
                                                            >
                                                                #{task.id}
                                                            </Typography>
                                                            <Chip
                                                                size="sm"
                                                                variant="soft"
                                                                startDecorator={getStatusIcon(
                                                                    task.effectiveStatus
                                                                )}
                                                                sx={{
                                                                    fontSize: "0.65rem",
                                                                    backgroundColor: sc.bg,
                                                                    color: sc.text,
                                                                }}
                                                            >
                                                                {task.effectiveStatus}
                                                            </Chip>
                                                        </Stack>
                                                        <Typography
                                                            level="title-sm"
                                                            sx={{
                                                                fontWeight: 600,
                                                                color: textPrimary,
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                                whiteSpace: "nowrap",
                                                            }}
                                                        >
                                                            {task.title || "Untitled Task"}
                                                        </Typography>
                                                        <Stack
                                                            direction="row"
                                                            justifyContent="space-between"
                                                            alignItems="center"
                                                        >
                                                            {task.priority && (
                                                                <Typography
                                                                    level="body-xs"
                                                                    sx={{ color: textMuted }}
                                                                >
                                                                    {task.priority}
                                                                </Typography>
                                                            )}
                                                            <Typography
                                                                level="body-xs"
                                                                sx={{
                                                                    color: textMuted,
                                                                    ml: "auto",
                                                                    fontStyle: "italic",
                                                                }}
                                                            >
                                                                {formatRelativeTime(
                                                                    task.updatedAt
                                                                )}
                                                            </Typography>
                                                        </Stack>
                                                    </Stack>
                                                </Card>
                                            </Grid>
                                        );
                                    })}
                                </Grid>
                            </Box>
                        )}

                        {/* No tasks empty state */}
                        {recentTasks.length === 0 && (
                            <Card
                                variant="soft"
                                sx={{
                                    p: 4,
                                    textAlign: "center",
                                    background: cardBg,
                                    border: "2px dashed",
                                    borderColor: cardBorder,
                                }}
                            >
                                <Stack spacing={2} alignItems="center">
                                    <Box
                                        sx={{
                                            width: 56,
                                            height: 56,
                                            borderRadius: "14px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            background: isDark
                                                ? "rgba(59,130,246,0.1)"
                                                : "rgba(59,130,246,0.08)",
                                        }}
                                    >
                                        <AssignmentRoundedIcon
                                            sx={{
                                                fontSize: 28,
                                                color: isDark ? "#60a5fa" : "#3b82f6",
                                            }}
                                        />
                                    </Box>
                                    <Typography
                                        level="title-md"
                                        sx={{ fontWeight: 600, color: textPrimary }}
                                    >
                                        No task activity in this sprint period
                                    </Typography>
                                    <Typography level="body-sm" sx={{ color: textMuted }}>
                                        Try selecting a longer sprint window or create new tasks
                                    </Typography>
                                </Stack>
                            </Card>
                        )}

                        {/* ════════ Section E: Priority & Effort Breakdown ════════ */}
                        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                            {renderDistributionCard(
                                "Priority Distribution",
                                <WarningAmberRoundedIcon
                                    sx={{ fontSize: 16, color: "#f97316" }}
                                />,
                                priorityBreakdown,
                                priorityColors
                            )}
                            {renderDistributionCard(
                                "Effort Distribution",
                                <TrendingUpRoundedIcon sx={{ fontSize: 16, color: "#6366f1" }} />,
                                effortBreakdown,
                                effortColors
                            )}
                        </Stack>

                        {/* ════════ Section F: Overdue & Upcoming ════════ */}
                        {(overdueAndUpcoming.overdue.length > 0 ||
                            overdueAndUpcoming.upcoming.length > 0) && (
                            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                                {/* Overdue */}
                                <Card
                                    variant="outlined"
                                    sx={{
                                        flex: 1,
                                        p: 2.5,
                                        background: isDark
                                            ? "rgba(239,68,68,0.04)"
                                            : "rgba(239,68,68,0.03)",
                                        borderColor: isDark
                                            ? "rgba(239,68,68,0.2)"
                                            : "rgba(239,68,68,0.15)",
                                    }}
                                >
                                    <Stack spacing={1.5}>
                                        <Stack
                                            direction="row"
                                            alignItems="center"
                                            justifyContent="space-between"
                                        >
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <WarningAmberRoundedIcon
                                                    sx={{ fontSize: 16, color: "#ef4444" }}
                                                />
                                                <Typography
                                                    level="title-sm"
                                                    sx={{
                                                        fontWeight: 600,
                                                        color: "#ef4444",
                                                    }}
                                                >
                                                    Overdue
                                                </Typography>
                                            </Stack>
                                            <Chip
                                                size="sm"
                                                variant="soft"
                                                sx={{
                                                    backgroundColor: "rgba(239,68,68,0.12)",
                                                    color: "#ef4444",
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {overdueAndUpcoming.overdue.length}
                                            </Chip>
                                        </Stack>
                                        <Stack spacing={0.75}>
                                            {overdueAndUpcoming.overdue.slice(0, 5).map((task) => (
                                                <Stack
                                                    key={task.id}
                                                    direction="row"
                                                    alignItems="center"
                                                    spacing={1}
                                                    sx={{
                                                        cursor: "pointer",
                                                        borderRadius: "6px",
                                                        px: 1,
                                                        py: 0.5,
                                                        "&:hover": {
                                                            backgroundColor: isDark
                                                                ? "rgba(239,68,68,0.08)"
                                                                : "rgba(239,68,68,0.06)",
                                                        },
                                                    }}
                                                    onClick={() =>
                                                        handleTaskClick(Number(task.id))
                                                    }
                                                >
                                                    {getStatusIcon(task.effectiveStatus, 12)}
                                                    <Typography
                                                        level="body-xs"
                                                        sx={{
                                                            flex: 1,
                                                            color: textPrimary,
                                                            fontWeight: 500,
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {task.title || "Untitled"}
                                                    </Typography>
                                                    <Typography
                                                        level="body-xs"
                                                        sx={{
                                                            color: "#ef4444",
                                                            fontWeight: 600,
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {task.dueDate}
                                                    </Typography>
                                                </Stack>
                                            ))}
                                            {overdueAndUpcoming.overdue.length > 5 && (
                                                <Typography
                                                    level="body-xs"
                                                    sx={{ color: textMuted, pl: 1 }}
                                                >
                                                    +{overdueAndUpcoming.overdue.length - 5} more
                                                </Typography>
                                            )}
                                            {overdueAndUpcoming.overdue.length === 0 && (
                                                <Typography
                                                    level="body-xs"
                                                    sx={{ color: textMuted }}
                                                >
                                                    No overdue tasks
                                                </Typography>
                                            )}
                                        </Stack>
                                    </Stack>
                                </Card>

                                {/* Upcoming (due this week) */}
                                <Card
                                    variant="outlined"
                                    sx={{
                                        flex: 1,
                                        p: 2.5,
                                        background: isDark
                                            ? "rgba(59,130,246,0.04)"
                                            : "rgba(59,130,246,0.03)",
                                        borderColor: isDark
                                            ? "rgba(59,130,246,0.2)"
                                            : "rgba(59,130,246,0.15)",
                                    }}
                                >
                                    <Stack spacing={1.5}>
                                        <Stack
                                            direction="row"
                                            alignItems="center"
                                            justifyContent="space-between"
                                        >
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <CalendarMonthRoundedIcon
                                                    sx={{ fontSize: 16, color: "#3b82f6" }}
                                                />
                                                <Typography
                                                    level="title-sm"
                                                    sx={{
                                                        fontWeight: 600,
                                                        color: "#3b82f6",
                                                    }}
                                                >
                                                    Due This Week
                                                </Typography>
                                            </Stack>
                                            <Chip
                                                size="sm"
                                                variant="soft"
                                                sx={{
                                                    backgroundColor: "rgba(59,130,246,0.12)",
                                                    color: "#3b82f6",
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {overdueAndUpcoming.upcoming.length}
                                            </Chip>
                                        </Stack>
                                        <Stack spacing={0.75}>
                                            {overdueAndUpcoming.upcoming
                                                .slice(0, 5)
                                                .map((task) => (
                                                    <Stack
                                                        key={task.id}
                                                        direction="row"
                                                        alignItems="center"
                                                        spacing={1}
                                                        sx={{
                                                            cursor: "pointer",
                                                            borderRadius: "6px",
                                                            px: 1,
                                                            py: 0.5,
                                                            "&:hover": {
                                                                backgroundColor: isDark
                                                                    ? "rgba(59,130,246,0.08)"
                                                                    : "rgba(59,130,246,0.06)",
                                                            },
                                                        }}
                                                        onClick={() =>
                                                            handleTaskClick(Number(task.id))
                                                        }
                                                    >
                                                        {getStatusIcon(task.effectiveStatus, 12)}
                                                        <Typography
                                                            level="body-xs"
                                                            sx={{
                                                                flex: 1,
                                                                color: textPrimary,
                                                                fontWeight: 500,
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                                whiteSpace: "nowrap",
                                                            }}
                                                        >
                                                            {task.title || "Untitled"}
                                                        </Typography>
                                                        <Typography
                                                            level="body-xs"
                                                            sx={{
                                                                color: "#3b82f6",
                                                                fontWeight: 600,
                                                                whiteSpace: "nowrap",
                                                            }}
                                                        >
                                                            {task.dueDate}
                                                        </Typography>
                                                    </Stack>
                                                ))}
                                            {overdueAndUpcoming.upcoming.length > 5 && (
                                                <Typography
                                                    level="body-xs"
                                                    sx={{ color: textMuted, pl: 1 }}
                                                >
                                                    +{overdueAndUpcoming.upcoming.length - 5} more
                                                </Typography>
                                            )}
                                            {overdueAndUpcoming.upcoming.length === 0 && (
                                                <Typography
                                                    level="body-xs"
                                                    sx={{ color: textMuted }}
                                                >
                                                    No tasks due this week
                                                </Typography>
                                            )}
                                        </Stack>
                                    </Stack>
                                </Card>
                            </Stack>
                        )}
                    </>
                )}
            </Stack>
        </Box>
    );
};
