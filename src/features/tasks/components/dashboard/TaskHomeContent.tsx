import { useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import PendingActionsRoundedIcon from "@mui/icons-material/PendingActionsRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import ViewKanbanRoundedIcon from "@mui/icons-material/ViewKanbanRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import {
    Box,
    Button,
    Card,
    Chip,
    Grid,
    IconButton,
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
import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
import { TaskHeaderStyles } from "../../../../components/ui/styles/commonStyle";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { TaskTableProps } from "../../../../types/tasks";
import { SprintConfigDialog } from "../../sprint-milestone/components/SprintConfigDialog";
import { SprintManagerDialog } from "../../sprint-milestone/components/SprintManagerDialog";
import { SprintMilestonesSection } from "../../sprint-milestone/components/SprintMilestonesSection";
import { Sprint } from "../../sprint-milestone/types";
import { predefinedPriorityFilters } from "../../types/TaskTableTypes";

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
    useSM: SprintMilestoneManagementState;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    socket: Socket | null;
    onCloseTaskHome: () => void;
};

const sprintBucketOf = (s: Sprint, todayIso: string): "past" | "current" | "upcoming" => {
    if (s.endDate < todayIso) return "past";
    if (s.startDate <= todayIso && todayIso <= s.endDate) return "current";
    return "upcoming";
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    Open: { bg: "rgba(59,130,246,0.12)", text: "#3b82f6" },
    WIP: { bg: "rgba(251,191,36,0.12)", text: "#fbbf24" },
    Pending: { bg: "rgba(251,146,60,0.12)", text: "#fb923c" },
    Closed: { bg: "rgba(34,197,94,0.12)", text: "#22c55e" },
};

// Priority swatches sourced from `predefinedPriorityFilters` so the
// dashboard chip stays in lockstep with the table's filter chips.
// `light` / `dark` are kept separate even though the current palette
// happens to match across modes — keeps the lookup honest for future
// per-mode tweaks. Non-priority labels (e.g. the "All" filter row) are
// skipped at build time.
const PRIORITY_COLORS: Record<string, { light: string; dark: string }> = Object.fromEntries(
    predefinedPriorityFilters
        .filter((f) => f.label !== "All")
        .map((f) => [f.label, { light: f.lightModeColor, dark: f.darkModeColor }])
);

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

type DueTone = "overdue" | "today" | "soon" | "later" | "none";
// Compact, human-readable due-date label used by the My Tasks "Up Next" list.
// `tone` lets the caller pick the right color without re-parsing the date.
const formatDueLabel = (dueDate: string | null): { text: string; tone: DueTone } => {
    if (!dueDate) return { text: "No due date", tone: "none" };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dueDate);
    d.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return { text: `Overdue ${-diffDays}d`, tone: "overdue" };
    if (diffDays === 0) return { text: "Due today", tone: "today" };
    if (diffDays === 1) return { text: "Due tomorrow", tone: "soon" };
    if (diffDays <= 6) {
        return {
            text: `Due ${d.toLocaleDateString(undefined, { weekday: "short" })}`,
            tone: "soon",
        };
    }
    return {
        text: `Due ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
        tone: "later",
    };
};

export const TaskHomeContent = ({
    useTM,
    usePM,
    useTEM,
    useSM,
    myself,
    setMyself,
    useCM,
    useUISM,
    socket,
    onCloseTaskHome,
}: TaskHomeContentProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const headerStyles = isDark ? TaskHeaderStyles.dark : TaskHeaderStyles.light;
    const [sprintConfigOpen, setSprintConfigOpen] = useState(false);
    const [sprintManagerOpen, setSprintManagerOpen] = useState(false);

    useEffect(() => {
        if (usePM.currentProject?.projectId) {
            useTM.fetchProjectTasks(usePM.currentProject.projectId);
        }
    }, []);

    // Pull project-scoped sprint data from the central hook. Falls back
    // to a synthetic 14-day window only when no sprint is selected, so
    // the rest of the dashboard never has to care about that branch.
    const projectSprints: Sprint[] = useMemo(() => {
        if (!usePM.currentProject?.projectId) return [];
        return useSM.projectSprints[usePM.currentProject.projectId] ?? [];
    }, [usePM.currentProject?.projectId, useSM.projectSprints]);

    const todayIso = new Date().toISOString().slice(0, 10);
    const groupedSprints = useMemo(() => {
        const out: Record<"past" | "current" | "upcoming", Sprint[]> = {
            past: [],
            current: [],
            upcoming: [],
        };
        for (const s of projectSprints) out[sprintBucketOf(s, todayIso)].push(s);
        return out;
    }, [projectSprints, todayIso]);

    const selectedSprint: Sprint | null =
        useSM.currentSprint && useSM.currentSprint.projectId === usePM.currentProject?.projectId
            ? useSM.currentSprint
            : (groupedSprints.current[0] ??
              groupedSprints.upcoming[0] ??
              groupedSprints.past[groupedSprints.past.length - 1] ??
              null);

    const now = useMemo(() => {
        if (selectedSprint) return new Date(selectedSprint.endDate).getTime();
        return Date.now();
    }, [selectedSprint?.sprintId]);
    const sprintStart = useMemo(() => {
        if (selectedSprint) return new Date(selectedSprint.startDate).getTime();
        return Date.now() - 14 * 86400000;
    }, [selectedSprint?.sprintId]);
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
    //
    // We iterate `taskById.values()` (not `allTasks` directly) so that any
    // accidental duplicate rows in `useTM.allTasks` — which can creep in
    // via socket-driven upserts upstream — collapse to one entry per id.
    // `taskById` is built with `Map.set`, so the latest row wins, which
    // matches what a user expects after an edit.
    const effectiveTasks = useMemo<EffectiveTask[]>(() => {
        const result: EffectiveTask[] = [];
        for (const t of taskById.values()) {
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
    }, [taskById]);

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
    //
    // `created` / `closed` / `updated` are three INDEPENDENT counts — they
    // are not subsets of each other. A task created before the sprint and
    // closed during it lands in `closed` but not `created`, so `closed >
    // created` is expected whenever there's carryover from prior work.
    //
    // For "X / Y closed" to make sense, the denominator must be the sprint
    // SCOPE — the set of tasks that moved through the sprint window
    // (created in sprint ∪ closed in sprint, deduped by id). That set is a
    // proper superset of `closedInSprint`, so the ratio is always well-
    // defined and ≤ 100%.
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
        const scopeIds = new Set<string>();
        for (const t of createdInSprint) {
            if (t.id != null) scopeIds.add(String(t.id));
        }
        for (const t of closedInSprint) {
            if (t.id != null) scopeIds.add(String(t.id));
        }
        return {
            created: createdInSprint.length,
            closed: closedInSprint.length,
            updated: updatedInSprint.length,
            net: createdInSprint.length - closedInSprint.length,
            scope: scopeIds.size,
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

    // ── My Tasks (assigned to the logged-in user) ──
    // Personal lens over effectiveTasks. Counts feed the KPI strip; the
    // ranked list ("Up Next") surfaces what to look at next.
    const myTasks = useMemo(
        () => effectiveTasks.filter((t) => t.assigneeId === myself.userId),
        [effectiveTasks, myself.userId]
    );

    const myStats = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekAhead = new Date(today);
        weekAhead.setDate(weekAhead.getDate() + 7);

        let openCount = 0;
        let wipCount = 0;
        let pendingCount = 0;
        let closedCount = 0;
        let overdueCount = 0;
        let dueThisWeekCount = 0;
        for (const t of myTasks) {
            const isClosed = t.effectiveStatus === "Closed";
            if (t.effectiveStatus === "Open") openCount++;
            else if (t.effectiveStatus === "WIP") wipCount++;
            else if (t.effectiveStatus === "Pending") pendingCount++;
            else if (isClosed) closedCount++;

            if (!isClosed && t.dueDate) {
                const d = new Date(t.dueDate);
                d.setHours(0, 0, 0, 0);
                if (d < today) overdueCount++;
                else if (d <= weekAhead) dueThisWeekCount++;
            }
        }
        const totalCount = openCount + wipCount + pendingCount + closedCount;
        const activeCount = openCount + wipCount + pendingCount;
        const completionPct = totalCount > 0 ? Math.round((closedCount / totalCount) * 100) : 0;
        return {
            openCount,
            wipCount,
            pendingCount,
            closedCount,
            totalCount,
            activeCount,
            overdueCount,
            dueThisWeekCount,
            completionPct,
        };
    }, [myTasks]);

    // Top 5 active tasks to look at next. Ranking:
    //   1. Overdue first (most overdue first)
    //   2. Then priority order (Critical → Minimal → no priority)
    //   3. Then soonest due date (no due date last)
    //   4. Tie-break on most recently updated
    const myUpNext = useMemo(() => {
        const todayMs = (() => {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            return d.getTime();
        })();
        const priorityRank: Record<string, number> = {
            Critical: 0,
            High: 1,
            Normal: 2,
            Low: 3,
            Minimal: 4,
        };
        const active = myTasks.filter((t) => t.effectiveStatus !== "Closed");
        return active
            .slice()
            .sort((a, b) => {
                const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                const aOver = a.dueDate != null && da < todayMs;
                const bOver = b.dueDate != null && db < todayMs;
                if (aOver !== bOver) return aOver ? -1 : 1;
                if (aOver && bOver) return da - db;

                const pa = priorityRank[a.priority ?? ""] ?? 5;
                const pb = priorityRank[b.priority ?? ""] ?? 5;
                if (pa !== pb) return pa - pb;

                if (da !== db) return da - db;

                const ua = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                const ub = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                return ub - ua;
            })
            .slice(0, 5);
    }, [myTasks]);

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
        useTM.setIsTaskDashboardVisible(false);
        useTM.setIsTaskTableVisible(true);
        useTM.setIsSprintBoardVisible(false);
    };
    const handleGoToBoard = () => {
        useTM.setIsTaskDashboardVisible(false);
        useTM.setIsTaskTableVisible(false);
        useTM.setIsSprintBoardVisible(true);
    };
    const handleCreateTask = () => {
        useTM.handleCreateTask();
    };
    const handleProjectChange = async (projectId: number) => {
        const selectedProject = usePM.teamProjects?.find((p) => p.projectId === projectId);
        if (selectedProject && projectId !== usePM.currentProject?.projectId) {
            // An open task preview keeps `isTaskPreviewVisible=true`, which makes
            // useTaskRouting's URL-update effect skip its navigate(). The
            // enforce-match effect then reverts currentProject to the stale
            // `targetUrlProjectId.current`. Close the preview first so the URL
            // (and the routing target) tracks the new project.
            useTM.closeTaskPreview();
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
                    <Tooltip
                        key={i}
                        size="sm"
                        title={`${Math.round((seg.value / total) * 100)}%`}
                        variant="outlined"
                    >
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
                    <Stack alignItems="center" direction="row" spacing={1}>
                        {icon}
                        <Typography level="title-sm" sx={{ fontWeight: 600, color: textPrimary }}>
                            {title}
                        </Typography>
                        <Chip size="sm" sx={{ ml: "auto" }} variant="soft">
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
                                alignItems="center"
                                direction="row"
                                justifyContent="space-between"
                            >
                                <Stack alignItems="center" direction="row" spacing={1}>
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

    // Sprint-scoped progress percentage. Used in place of the previous
    // overall-progress bar inside the Sprint Summary card so the sprint
    // section's numbers don't mix in project-wide data. Denominator is
    // the sprint SCOPE (created ∪ closed in window) so carryover work
    // counts toward the bar and the value can never exceed 100%.
    const sprintProgressPct =
        sprintStats.scope > 0
            ? Math.min(100, Math.round((sprintStats.closed / sprintStats.scope) * 100))
            : 0;

    const pmChat = useCM.allChats.find(
        (chat) =>
            chat.chatType === 3 &&
            usePM.currentProject &&
            chat.chatId === usePM.currentProject.projectId
    );

    return (
        <>
            {usePM.currentProject?.projectId && (
                <>
                    <SprintConfigDialog
                        open={sprintConfigOpen}
                        projectId={usePM.currentProject.projectId}
                        useSM={useSM}
                        onClose={() => setSprintConfigOpen(false)}
                    />
                    <SprintManagerDialog
                        open={sprintManagerOpen}
                        projectId={usePM.currentProject.projectId}
                        useSM={useSM}
                        onClose={() => setSprintManagerOpen(false)}
                    />
                </>
            )}
            <Box
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                sx={{
                    height: "100%",
                    overflow: "auto",
                    p: { xs: 2, md: 4 },
                    background: isDark
                        ? "linear-gradient(180deg, rgba(18, 18, 19, 0.95) 0%, rgb(25, 26, 28) 100%)"
                        : "linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(241,245,249,1) 100%)",
                }}
            >
                <Stack spacing={3} sx={{ maxWidth: 1200, mx: "auto" }}>
                    {/* ════════ Dashboard Title ════════ */}
                    <Stack alignItems="center" direction="row" justifyContent="space-between">
                        <Stack alignItems="center" direction="row" spacing={1.5}>
                            <Box
                                sx={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: "10px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: isDark
                                        ? "linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(124,58,237,0.2) 100%)"
                                        : "linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(124,58,237,0.15) 100%)",
                                }}
                            >
                                <TrendingUpRoundedIcon
                                    sx={{ fontSize: 20, color: isDark ? "#60a5fa" : "#3b82f6" }}
                                />
                            </Box>
                            <Typography
                                level="h2"
                                sx={{
                                    fontWeight: 700,
                                    color: textPrimary,
                                    letterSpacing: "-0.02em",
                                }}
                            >
                                Task Stats
                            </Typography>
                        </Stack>
                        <Stack alignItems="center" direction="row" spacing={1.5}>
                            <Typography level="body-sm" sx={{ color: textMuted }}>
                                {projectCount} projects
                            </Typography>
                            {(useTM.isTaskPreviewVisible === true ||
                                useTM.isCreatingTask.flag === true) && (
                                <Tooltip
                                    size="sm"
                                    title="Close Panel"
                                    variant="outlined"
                                    sx={{
                                        background: headerStyles.menuBg,
                                        border: `1px solid ${headerStyles.menuBorder}`,
                                        borderRadius: "8px",
                                    }}
                                >
                                    <IconButton
                                        size="sm"
                                        sx={{
                                            background: headerStyles.dangerBg,
                                            border: `1px solid ${headerStyles.dangerBorder}`,
                                            borderRadius: "10px",
                                            width: "36px",
                                            height: "36px",
                                            transition: "all 0.2s ease",
                                            "&:hover": {
                                                background: headerStyles.dangerHover,
                                                transform: "translateY(-1px)",
                                            },
                                        }}
                                        onClick={onCloseTaskHome}
                                    >
                                        <CancelIcon
                                            sx={{
                                                fontSize: "20px",
                                                color: isDark ? "#f87171" : "#dc2626",
                                            }}
                                        />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </Stack>
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
                                borderColor: isDark
                                    ? "rgba(251,146,60,0.2)"
                                    : "rgba(251,146,60,0.15)",
                            }}
                        >
                            <Stack spacing={2.5}>
                                {/* Project selector + sprint selector row */}
                                <Stack
                                    alignItems="center"
                                    direction="row"
                                    flexWrap="wrap"
                                    gap={2}
                                    justifyContent="space-between"
                                >
                                    <Stack alignItems="center" direction="row" spacing={1.5}>
                                        <Box
                                            sx={{
                                                width: 50,
                                                height: 50,
                                                borderRadius: "10px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                backgroundColor: isDark
                                                    ? "rgba(251,146,60,0.15)"
                                                    : "rgba(251,146,60,0.12)",
                                            }}
                                        >
                                            {pmChat && (
                                                <ProjectAvatar
                                                    avatarSize={46}
                                                    useCM={useCM}
                                                    myself={myself}
                                                    pmChat={pmChat}
                                                    setMyself={setMyself}
                                                    socket={socket}
                                                    useTEM={useTEM}
                                                    useUISM={useUISM}
                                                />
                                            )}
                                            {!pmChat && (
                                                <WorkRoundedIcon
                                                    sx={{
                                                        fontSize: 22,
                                                        color: isDark ? "#fb923c" : "#ea580c",
                                                    }}
                                                />
                                            )}
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
                                                indicator={<KeyboardArrowDownRoundedIcon />}
                                                value={usePM.currentProject.projectId}
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
                                                onChange={(_, value) => {
                                                    if (value)
                                                        handleProjectChange(value as number);
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
                                    <Stack alignItems="center" direction="row" spacing={1}>
                                        <Select<number | string>
                                            indicator={<KeyboardArrowDownRoundedIcon />}
                                            size="sm"
                                            value={selectedSprint?.sprintId ?? null}
                                            placeholder={
                                                projectSprints.length === 0
                                                    ? "No sprints — configure"
                                                    : "Pick a sprint"
                                            }
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
                                            startDecorator={
                                                <CalendarMonthRoundedIcon sx={{ fontSize: 18 }} />
                                            }
                                            sx={{
                                                minWidth: 220,
                                                fontWeight: 600,
                                                color: isDark ? "#a78bfa" : "#7c3aed",
                                                backgroundColor: isDark
                                                    ? "rgba(124,58,237,0.1)"
                                                    : "rgba(124,58,237,0.08)",
                                                border: "1px solid",
                                                borderColor: isDark
                                                    ? "rgba(124,58,237,0.3)"
                                                    : "rgba(124,58,237,0.2)",
                                                "&:hover": {
                                                    backgroundColor: isDark
                                                        ? "rgba(124,58,237,0.15)"
                                                        : "rgba(124,58,237,0.12)",
                                                },
                                                "& .MuiSelect-indicator": {
                                                    color: isDark ? "#a78bfa" : "#7c3aed",
                                                },
                                            }}
                                            onChange={(_, value) => {
                                                if (value === null || value === undefined) {
                                                    useSM.setCurrentSprint(null);
                                                    return;
                                                }
                                                if (typeof value === "string") return;
                                                const found = projectSprints.find(
                                                    (s) => s.sprintId === value
                                                );
                                                if (found) useSM.setCurrentSprint(found);
                                            }}
                                        >
                                            {(["current", "upcoming", "past"] as const).map(
                                                (bucket) => {
                                                    const list = groupedSprints[bucket];
                                                    if (list.length === 0) return null;
                                                    return [
                                                        <Option
                                                            key={`hdr-${bucket}`}
                                                            value={`__hdr_${bucket}`}
                                                            sx={{
                                                                opacity: 0.6,
                                                                fontSize: "0.75rem",
                                                            }}
                                                            disabled
                                                        >
                                                            {bucket === "current"
                                                                ? "Current"
                                                                : bucket === "upcoming"
                                                                  ? "Upcoming"
                                                                  : "Past"}
                                                        </Option>,
                                                        ...list.map((s) => (
                                                            <Option
                                                                key={s.sprintId}
                                                                value={s.sprintId}
                                                            >
                                                                {s.name} · {s.startDate} →{" "}
                                                                {s.endDate}
                                                            </Option>
                                                        )),
                                                    ];
                                                }
                                            )}
                                        </Select>
                                        <Tooltip title="Sprint settings" variant="outlined">
                                            <IconButton
                                                disabled={!usePM.currentProject?.projectId}
                                                size="sm"
                                                variant="soft"
                                                onClick={() => setSprintConfigOpen(true)}
                                            >
                                                <SettingsRoundedIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Manage sprints" variant="outlined">
                                            <IconButton
                                                disabled={!usePM.currentProject?.projectId}
                                                size="sm"
                                                variant="soft"
                                                onClick={() => setSprintManagerOpen(true)}
                                            >
                                                <TuneRoundedIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip
                                            size="sm"
                                            title="Closed in sprint / Created in sprint"
                                            variant="outlined"
                                        >
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
                                                {sprintProgressPct}%
                                            </Chip>
                                        </Tooltip>
                                    </Stack>
                                </Stack>

                                {/* Sprint date range indicator */}
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        color: isDark
                                            ? "rgba(165,180,252,0.7)"
                                            : "rgba(124,58,237,0.6)",
                                        fontWeight: 500,
                                    }}
                                >
                                    Sprint window: {new Date(sprintStart).toLocaleDateString()}{" "}
                                    &mdash; {new Date(now).toLocaleDateString()}
                                </Typography>

                                {/* Sprint progress bar */}
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
                                            Sprint Progress
                                        </Typography>
                                        <Typography
                                            level="body-sm"
                                            sx={{ color: textSecondary, fontWeight: 500 }}
                                        >
                                            {sprintStats.closed} / {sprintStats.scope} closed
                                        </Typography>
                                    </Stack>
                                    <LinearProgress
                                        color="success"
                                        value={sprintProgressPct}
                                        sx={{
                                            "--LinearProgress-thickness": "8px",
                                            "--LinearProgress-radius": "4px",
                                            "--LinearProgress-progressRadius": "4px",
                                            backgroundColor: isDark
                                                ? "rgba(255,255,255,0.1)"
                                                : "rgba(0,0,0,0.08)",
                                        }}
                                        determinate
                                    />
                                </Box>

                                {/* Sprint-scoped quick chips */}
                                <Stack direction="row" flexWrap="wrap" spacing={1.5} useFlexGap>
                                    <Chip
                                        size="md"
                                        startDecorator={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                                        variant="soft"
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
                            <Stack alignItems="center" spacing={2}>
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
                                    size="sm"
                                    startDecorator={<AddRoundedIcon />}
                                    variant="soft"
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
                                    onClick={handleCreateTask}
                                >
                                    New Task
                                </Button>
                                <Button
                                    size="sm"
                                    startDecorator={<FolderOpenRoundedIcon />}
                                    variant="soft"
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
                                    onClick={handleGoToTable}
                                >
                                    Task Table
                                </Button>
                                <Button
                                    size="sm"
                                    startDecorator={<ViewKanbanRoundedIcon />}
                                    variant="soft"
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
                                    onClick={handleGoToBoard}
                                >
                                    Sprint Board
                                </Button>
                            </Stack>

                            {/* ════════ Sprint Insights banner ════════ */}
                            {/* Visually groups every sprint-scoped section
                            (Sprint Milestones + Recently Updated) so the
                            sprint vs project-wide split is unambiguous. */}
                            <Stack
                                alignItems="center"
                                direction="row"
                                spacing={1}
                                sx={{ mt: 1, mb: -0.5 }}
                            >
                                <CalendarMonthRoundedIcon
                                    sx={{ fontSize: 18, color: "#7c3aed" }}
                                />
                                <Typography
                                    level="h3"
                                    sx={{ fontWeight: 700, color: textPrimary }}
                                >
                                    Sprint Insights
                                </Typography>
                                {selectedSprint && (
                                    <Chip size="sm" sx={{ ml: 0.5 }} variant="soft">
                                        {selectedSprint.name}
                                    </Chip>
                                )}
                                <Box
                                    sx={{
                                        flex: 1,
                                        height: 1,
                                        background: cardBorder,
                                        ml: 1,
                                    }}
                                />
                            </Stack>

                            {/* ════════ Section A2: Sprint Milestones ════════ */}
                            <SprintMilestonesSection
                                isDark={isDark}
                                myself={myself}
                                projectId={usePM.currentProject?.projectId}
                                selectedSprint={selectedSprint}
                                setMyself={setMyself}
                                socket={socket}
                                textMuted={textMuted}
                                textPrimary={textPrimary}
                                textSecondary={textSecondary}
                                useCM={useCM}
                                useSM={useSM}
                                useTEM={useTEM}
                                useTM={useTM}
                                useUISM={useUISM}
                            />

                            {/* ════════ Section D: Recently Updated Tasks (sprint-scoped) ════════ */}
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
                                        <Chip size="sm" sx={{ ml: 0.5 }} variant="soft">
                                            {recentTasks.length}
                                        </Chip>
                                    </Typography>
                                    <Grid spacing={1.5} container>
                                        {recentTasks.map((task) => {
                                            const sc =
                                                STATUS_COLORS[task.effectiveStatus] ||
                                                STATUS_COLORS.Open;
                                            return (
                                                <Grid key={task.id} md={4} sm={6} xs={12}>
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
                                                                alignItems="flex-start"
                                                                direction="row"
                                                                justifyContent="space-between"
                                                            >
                                                                <Stack
                                                                    alignItems="center"
                                                                    direction="row"
                                                                    spacing={0.5}
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
                                                                    {task.isMilestone === true && (
                                                                        <Tooltip
                                                                            size="sm"
                                                                            title="Milestone"
                                                                            variant="outlined"
                                                                        >
                                                                            <FlagRoundedIcon
                                                                                sx={{
                                                                                    fontSize: 12,
                                                                                    color: "#f97316",
                                                                                }}
                                                                            />
                                                                        </Tooltip>
                                                                    )}
                                                                </Stack>
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
                                                                alignItems="center"
                                                                direction="row"
                                                                justifyContent="space-between"
                                                            >
                                                                {task.priority &&
                                                                    (() => {
                                                                        const swatch =
                                                                            PRIORITY_COLORS[
                                                                                task.priority
                                                                            ];
                                                                        const color = swatch
                                                                            ? isDark
                                                                                ? swatch.dark
                                                                                : swatch.light
                                                                            : textMuted;
                                                                        return (
                                                                            <Chip
                                                                                size="sm"
                                                                                variant="soft"
                                                                                sx={{
                                                                                    fontSize:
                                                                                        "0.65rem",
                                                                                    fontWeight: 600,
                                                                                    // ~12% alpha
                                                                                    // matches the
                                                                                    // adjacent
                                                                                    // status chip.
                                                                                    backgroundColor: `${color}1F`,
                                                                                    color,
                                                                                }}
                                                                            >
                                                                                {task.priority}
                                                                            </Chip>
                                                                        );
                                                                    })()}
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
                                    <Stack alignItems="center" spacing={2}>
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
                                            Try selecting a longer sprint window or create new
                                            tasks
                                        </Typography>
                                    </Stack>
                                </Card>
                            )}

                            {/* ════════ My Tasks banner ════════ */}
                            {/* Personal-lens divider: separates sprint-scoped sections
                            above from "what's on my plate" below. */}
                            <Stack
                                alignItems="center"
                                direction="row"
                                spacing={1}
                                sx={{ mt: 2, mb: -0.5 }}
                            >
                                <PersonRoundedIcon sx={{ fontSize: 18, color: "#22c55e" }} />
                                <Typography
                                    level="h3"
                                    sx={{ fontWeight: 700, color: textPrimary }}
                                >
                                    My Tasks
                                </Typography>
                                <Chip size="sm" sx={{ ml: 0.5 }} variant="soft">
                                    {myStats.totalCount} assigned
                                </Chip>
                                <Box
                                    sx={{
                                        flex: 1,
                                        height: 1,
                                        background: cardBorder,
                                        ml: 1,
                                    }}
                                />
                            </Stack>

                            {/* ════════ Section MY: My Tasks ════════ */}
                            {myStats.totalCount === 0 ? (
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
                                    <Stack alignItems="center" spacing={2}>
                                        <Box
                                            sx={{
                                                width: 56,
                                                height: 56,
                                                borderRadius: "14px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                background: isDark
                                                    ? "rgba(34,197,94,0.1)"
                                                    : "rgba(34,197,94,0.08)",
                                            }}
                                        >
                                            <PersonRoundedIcon
                                                sx={{
                                                    fontSize: 28,
                                                    color: isDark ? "#4ade80" : "#22c55e",
                                                }}
                                            />
                                        </Box>
                                        <Typography
                                            level="title-md"
                                            sx={{ fontWeight: 600, color: textPrimary }}
                                        >
                                            Nothing assigned to you yet
                                        </Typography>
                                        <Typography level="body-sm" sx={{ color: textMuted }}>
                                            Tasks assigned to you in this project will show up
                                            here.
                                        </Typography>
                                    </Stack>
                                </Card>
                            ) : (
                                <Stack spacing={2}>
                                    {/* KPI strip */}
                                    <Grid spacing={1.5} container>
                                        {(
                                            [
                                                {
                                                    label: "Active",
                                                    value: String(myStats.activeCount),
                                                    color: "#3b82f6",
                                                    icon: (
                                                        <PlayCircleOutlineRoundedIcon
                                                            sx={{ fontSize: 18 }}
                                                        />
                                                    ),
                                                },
                                                {
                                                    label: "Closed",
                                                    value: String(myStats.closedCount),
                                                    color: "#22c55e",
                                                    icon: (
                                                        <CheckCircleOutlineRoundedIcon
                                                            sx={{ fontSize: 18 }}
                                                        />
                                                    ),
                                                },
                                                {
                                                    label: "Overdue",
                                                    value: String(myStats.overdueCount),
                                                    color: "#ef4444",
                                                    icon: (
                                                        <WarningAmberRoundedIcon
                                                            sx={{ fontSize: 18 }}
                                                        />
                                                    ),
                                                },
                                                {
                                                    label: "Due This Week",
                                                    value: String(myStats.dueThisWeekCount),
                                                    color: "#f59e0b",
                                                    icon: (
                                                        <CalendarMonthRoundedIcon
                                                            sx={{ fontSize: 18 }}
                                                        />
                                                    ),
                                                },
                                                {
                                                    label: "Completion",
                                                    value: `${myStats.completionPct}%`,
                                                    color: "#a78bfa",
                                                    icon: (
                                                        <TrendingUpRoundedIcon
                                                            sx={{ fontSize: 18 }}
                                                        />
                                                    ),
                                                },
                                            ] as const
                                        ).map((tile) => (
                                            <Grid key={tile.label} md={2.4} sm={4} xs={6}>
                                                <Card
                                                    variant="soft"
                                                    sx={{
                                                        p: 2,
                                                        background: isDark
                                                            ? `${tile.color}1F`
                                                            : `${tile.color}14`,
                                                        border: "1px solid",
                                                        borderColor: cardBorder,
                                                        transition: "transform 0.2s ease",
                                                        "&:hover": {
                                                            transform: "translateY(-2px)",
                                                        },
                                                    }}
                                                >
                                                    <Stack spacing={1}>
                                                        <Box
                                                            sx={{
                                                                width: 32,
                                                                height: 32,
                                                                borderRadius: "8px",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                color: tile.color,
                                                                backgroundColor: isDark
                                                                    ? "rgba(255,255,255,0.06)"
                                                                    : "rgba(255,255,255,0.8)",
                                                            }}
                                                        >
                                                            {tile.icon}
                                                        </Box>
                                                        <Box>
                                                            <Typography
                                                                level="h3"
                                                                sx={{
                                                                    fontWeight: 700,
                                                                    fontSize: "1.4rem",
                                                                    color: textPrimary,
                                                                }}
                                                            >
                                                                {tile.value}
                                                            </Typography>
                                                            <Typography
                                                                level="body-xs"
                                                                sx={{
                                                                    color: textSecondary,
                                                                    fontWeight: 500,
                                                                }}
                                                            >
                                                                {tile.label}
                                                            </Typography>
                                                        </Box>
                                                    </Stack>
                                                </Card>
                                            </Grid>
                                        ))}
                                    </Grid>

                                    {/* Up Next list */}
                                    <Box>
                                        <Stack
                                            alignItems="center"
                                            direction="row"
                                            spacing={1}
                                            sx={{ mb: 1 }}
                                        >
                                            <Typography
                                                level="body-sm"
                                                sx={{ color: textSecondary, fontWeight: 600 }}
                                            >
                                                Up Next
                                            </Typography>
                                            <Typography level="body-xs" sx={{ color: textMuted }}>
                                                ranked by overdue → priority → due date
                                            </Typography>
                                        </Stack>
                                        {myUpNext.length === 0 ? (
                                            <Card
                                                variant="outlined"
                                                sx={{
                                                    p: 2,
                                                    background: cardBg,
                                                    borderColor: cardBorder,
                                                }}
                                            >
                                                <Typography
                                                    level="body-sm"
                                                    sx={{
                                                        color: textMuted,
                                                        textAlign: "center",
                                                    }}
                                                >
                                                    All your assigned tasks are closed — nothing to
                                                    do here.
                                                </Typography>
                                            </Card>
                                        ) : (
                                            <Stack spacing={0.75}>
                                                {myUpNext.map((task) => {
                                                    const sc =
                                                        STATUS_COLORS[task.effectiveStatus] ||
                                                        STATUS_COLORS.Open;
                                                    const pSwatch = task.priority
                                                        ? PRIORITY_COLORS[task.priority]
                                                        : undefined;
                                                    const pColor = pSwatch
                                                        ? isDark
                                                            ? pSwatch.dark
                                                            : pSwatch.light
                                                        : textMuted;
                                                    const due = formatDueLabel(task.dueDate);
                                                    const dueColor =
                                                        due.tone === "overdue"
                                                            ? "#ef4444"
                                                            : due.tone === "today" ||
                                                                due.tone === "soon"
                                                              ? "#f59e0b"
                                                              : textMuted;
                                                    return (
                                                        <Card
                                                            key={task.id}
                                                            variant="outlined"
                                                            sx={{
                                                                p: 1.25,
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
                                                            <Stack
                                                                alignItems="center"
                                                                direction="row"
                                                                spacing={1.5}
                                                            >
                                                                <Box
                                                                    sx={{
                                                                        width: 8,
                                                                        height: 8,
                                                                        borderRadius: "50%",
                                                                        backgroundColor: pColor,
                                                                        flexShrink: 0,
                                                                    }}
                                                                />
                                                                <Stack
                                                                    alignItems="center"
                                                                    direction="row"
                                                                    spacing={0.75}
                                                                    sx={{ flex: 1, minWidth: 0 }}
                                                                >
                                                                    <Typography
                                                                        level="body-xs"
                                                                        sx={{
                                                                            fontWeight: 600,
                                                                            color: textMuted,
                                                                            flexShrink: 0,
                                                                        }}
                                                                    >
                                                                        #{task.id}
                                                                    </Typography>
                                                                    {task.isMilestone === true && (
                                                                        <FlagRoundedIcon
                                                                            sx={{
                                                                                fontSize: 12,
                                                                                color: "#f97316",
                                                                                flexShrink: 0,
                                                                            }}
                                                                        />
                                                                    )}
                                                                    <Typography
                                                                        level="body-sm"
                                                                        sx={{
                                                                            fontWeight: 500,
                                                                            color: textPrimary,
                                                                            overflow: "hidden",
                                                                            textOverflow:
                                                                                "ellipsis",
                                                                            whiteSpace: "nowrap",
                                                                        }}
                                                                    >
                                                                        {task.title ||
                                                                            "Untitled Task"}
                                                                    </Typography>
                                                                </Stack>
                                                                {task.priority && (
                                                                    <Chip
                                                                        size="sm"
                                                                        variant="soft"
                                                                        sx={{
                                                                            fontSize: "0.65rem",
                                                                            fontWeight: 600,
                                                                            backgroundColor: `${pColor}1F`,
                                                                            color: pColor,
                                                                            flexShrink: 0,
                                                                            display: {
                                                                                xs: "none",
                                                                                sm: "inline-flex",
                                                                            },
                                                                        }}
                                                                    >
                                                                        {task.priority}
                                                                    </Chip>
                                                                )}
                                                                <Chip
                                                                    size="sm"
                                                                    variant="soft"
                                                                    startDecorator={getStatusIcon(
                                                                        task.effectiveStatus,
                                                                        12
                                                                    )}
                                                                    sx={{
                                                                        fontSize: "0.65rem",
                                                                        backgroundColor: sc.bg,
                                                                        color: sc.text,
                                                                        flexShrink: 0,
                                                                    }}
                                                                >
                                                                    {task.effectiveStatus}
                                                                </Chip>
                                                                <Typography
                                                                    level="body-xs"
                                                                    sx={{
                                                                        color: dueColor,
                                                                        fontWeight:
                                                                            due.tone === "overdue"
                                                                                ? 700
                                                                                : 500,
                                                                        flexShrink: 0,
                                                                        minWidth: 90,
                                                                        textAlign: "right",
                                                                    }}
                                                                >
                                                                    {due.text}
                                                                </Typography>
                                                            </Stack>
                                                        </Card>
                                                    );
                                                })}
                                            </Stack>
                                        )}
                                    </Box>
                                </Stack>
                            )}

                            {/* ════════ Overall Insights banner ════════ */}
                            {/* Marks the boundary between sprint-scoped sections
                            (above) and project-wide stats (below). */}
                            <Stack
                                alignItems="center"
                                direction="row"
                                spacing={1}
                                sx={{ mt: 2, mb: -0.5 }}
                            >
                                <TrendingUpRoundedIcon sx={{ fontSize: 18, color: "#3b82f6" }} />
                                <Typography
                                    level="h3"
                                    sx={{ fontWeight: 700, color: textPrimary }}
                                >
                                    Overall Insights
                                </Typography>
                                <Chip size="sm" sx={{ ml: 0.5 }} variant="soft">
                                    Project-wide
                                </Chip>
                                <Box
                                    sx={{
                                        flex: 1,
                                        height: 1,
                                        background: cardBorder,
                                        ml: 1,
                                    }}
                                />
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
                                <Grid spacing={1.5} container>
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
                                            <Grid key={s.key} md={3} xs={6}>
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
                                                            alignItems="center"
                                                            direction="row"
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
                                                    <th style={{ textAlign: "center" }}>
                                                        Pending
                                                    </th>
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
                                                                alignItems="center"
                                                                direction="row"
                                                                spacing={1}
                                                            >
                                                                {a.id !== "__unassigned__" &&
                                                                useTEM.teamMemberProfiles[a.id] ? (
                                                                    <AvatarWithStatus
                                                                        avatarSize={26}
                                                                        myself={myself}
                                                                        setMyself={setMyself}
                                                                        socket={socket}
                                                                        useCM={useCM}
                                                                        useUISM={useUISM}
                                                                        avatarUser={
                                                                            useTEM
                                                                                .teamMemberProfiles[
                                                                                a.id
                                                                            ]
                                                                        }
                                                                        isYou={
                                                                            myself.userId === a.id
                                                                        }
                                                                    />
                                                                ) : (
                                                                    <Avatar
                                                                        size="sm"
                                                                        src={
                                                                            a.imgPath || undefined
                                                                        }
                                                                        sx={{
                                                                            width: 26,
                                                                            height: 26,
                                                                        }}
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
                                                                    color: STATUS_COLORS.Pending
                                                                        .text,
                                                                },
                                                                {
                                                                    val: a.closed,
                                                                    color: STATUS_COLORS.Closed
                                                                        .text,
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
                                    <TrendingUpRoundedIcon
                                        sx={{ fontSize: 16, color: "#7c3aed" }}
                                    />,
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
                                                alignItems="center"
                                                direction="row"
                                                justifyContent="space-between"
                                            >
                                                <Stack
                                                    alignItems="center"
                                                    direction="row"
                                                    spacing={1}
                                                >
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
                                                {overdueAndUpcoming.overdue
                                                    .slice(0, 5)
                                                    .map((task) => (
                                                        <Stack
                                                            key={task.id}
                                                            alignItems="center"
                                                            direction="row"
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
                                                            {getStatusIcon(
                                                                task.effectiveStatus,
                                                                12
                                                            )}
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
                                                        +{overdueAndUpcoming.overdue.length - 5}{" "}
                                                        more
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
                                                alignItems="center"
                                                direction="row"
                                                justifyContent="space-between"
                                            >
                                                <Stack
                                                    alignItems="center"
                                                    direction="row"
                                                    spacing={1}
                                                >
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
                                                            alignItems="center"
                                                            direction="row"
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
                                                            {getStatusIcon(
                                                                task.effectiveStatus,
                                                                12
                                                            )}
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
                                                        +{overdueAndUpcoming.upcoming.length - 5}{" "}
                                                        more
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
        </>
    );
};
