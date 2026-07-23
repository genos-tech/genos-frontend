import { Key, useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
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
    ListItemContent,
    ListItemDecorator,
    Option,
    Select,
    Stack,
    Table,
    TabList,
    Tabs,
    Typography,
} from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";
import AutocompleteOption from "@mui/joy/AutocompleteOption";
import Avatar from "@mui/joy/Avatar";
import { useColorScheme } from "@mui/joy/styles";
import Tab, { tabClasses } from "@mui/joy/Tab";
import { Socket } from "socket.io-client";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { TaskHeaderStyles } from "../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { TaskTableProps } from "../../../../types/tasks";
import { LazyTaskDiagram } from "../../diagram/components/LazyTaskDiagram";
import { loadTeamTasks } from "../../services/loadTeamTasks";
import { SprintConfigDialog } from "../../sprint-milestone/components/SprintConfigDialog";
import { SprintManagerDialog } from "../../sprint-milestone/components/SprintManagerDialog";
import { SprintMilestonesSection } from "../../sprint-milestone/components/SprintMilestonesSection";
import { Milestone, Sprint } from "../../sprint-milestone/types";
import { selectVisibleMilestones } from "../../sprint-milestone/utils/sortMilestones";
import { PRIORITY_COLORS } from "../../utils/dashboardRowFormat";
import { computeTaskWeight, dueBucket, DueBucket, effortPoints } from "../../utils/taskWeight";
import { compareByUrgency, sortTopWeightRows, TopWeightSortMode } from "../../utils/topWeightSort";
import { CopyableTaskIdText } from "../CopyableTaskId";
import { ProjectTagChip } from "../ProjectTagChip";
import { getStatusIcon, STATUS_COLORS } from "../TaskStatusChip";
import { AssignedMilestoneCard } from "./AssignedMilestoneCard";
import { DashboardTaskRow } from "./DashboardTaskRow";
import { TaskVelocitySection } from "./TaskVelocitySection";

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

// Midnight-of-today in ms — the "overdue" cutoff for the urgency sorts.
const startOfTodayMs = (): number => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
};

// Roll a flat task list up into `EffectiveTask`s: drop Deleted tasks and
// whole branches under a Deleted parent, and treat a sub-task of a Closed
// parent as Closed itself. Shared by the current-project dashboard metrics
// and the team-wide (all-projects) Team Capacity pass, so both apply the
// exact same closed/deleted semantics. Iterates `taskById.values()` so any
// duplicate rows collapse to one entry per id (latest wins).
const deriveEffectiveTasks = (taskById: Map<string, TaskTableProps>): EffectiveTask[] => {
    const result: EffectiveTask[] = [];
    for (const t of taskById.values()) {
        if (!t.id) continue;
        if (t.status === "Deleted") continue;

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

        if (isInDeletedBranch) continue;

        const effectiveStatus = ancestorClosedDate !== null ? "Closed" : t.status || "Open";
        const effectiveCloseDate = t.status === "Closed" ? t.updatedAt : ancestorClosedDate;

        result.push({ ...t, effectiveStatus, effectiveCloseDate });
    }
    return result;
};

// Per-assignee effort load, bucketed by due-window. Shared by the
// current-project pass (which fixes the ROSTER) and the team-wide pass
// (which supplies each member's cross-project numbers) so the two can't
// diverge in how they count effort. Milestone-backing rows are excluded —
// their child tasks already carry the effort — and Closed (rolled-up)
// tasks don't count toward load.
type CapacityEntry = {
    id: string;
    name: string;
    imgPath: string | null;
    buckets: Record<DueBucket, number>;
    total: number;
    nearTerm: number;
    count: number;
};

const buildCapacityMap = (tasks: EffectiveTask[]): Map<string, CapacityEntry> => {
    const map = new Map<string, CapacityEntry>();
    for (const t of tasks) {
        if (t.effectiveStatus === "Closed") continue;
        if (t.isMilestone === true) continue;
        const id = t.assigneeId || "__unassigned__";
        const entry = map.get(id) || {
            id,
            name: t.assigneeName || "Unassigned",
            imgPath: t.assigneeImgPath || null,
            buckets: { overdue: 0, today: 0, week: 0, later: 0, none: 0 } as Record<
                DueBucket,
                number
            >,
            total: 0,
            nearTerm: 0,
            count: 0,
        };
        const pts = effortPoints(t.effortLevel);
        const bucket = dueBucket(t.dueDate);
        entry.buckets[bucket] += pts;
        entry.total += pts;
        entry.count += 1;
        if (bucket === "overdue" || bucket === "today" || bucket === "week") {
            entry.nearTerm += pts;
        }
        map.set(id, entry);
    }
    return map;
};

const sprintBucketOf = (s: Sprint, todayIso: string): "past" | "current" | "upcoming" => {
    if (s.endDate < todayIso) return "past";
    if (s.startDate <= todayIso && todayIso <= s.endDate) return "current";
    return "upcoming";
};

// Maps a backend status enum to the i18n key whose value renders in
// the dashboard. Resolve through `t.tasks.dashboard.statusLabels[key]`
// at the call site (`statusKeyFor` below).
const STATUS_LABEL_KEYS: Record<string, "open" | "wip" | "blocked" | "pending" | "closed"> = {
    Open: "open",
    WIP: "wip",
    Blocked: "blocked",
    Pending: "pending",
    Closed: "closed",
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

// KPI rollup for one person's tasks (active/closed/overdue/completion, …).
// Extracted so the "My Tasks" tab, its tab badge, and the "Member's Tasks"
// tab all compute the same numbers for whichever user is in focus.
const computeAssigneeStats = (tasks: EffectiveTask[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAhead = new Date(today);
    weekAhead.setDate(weekAhead.getDate() + 7);

    let openCount = 0;
    let wipCount = 0;
    let blockedCount = 0;
    let pendingCount = 0;
    let closedCount = 0;
    let overdueCount = 0;
    let dueThisWeekCount = 0;
    for (const t of tasks) {
        const isClosed = t.effectiveStatus === "Closed";
        if (t.effectiveStatus === "Open") openCount++;
        else if (t.effectiveStatus === "WIP") wipCount++;
        else if (t.effectiveStatus === "Blocked") blockedCount++;
        else if (t.effectiveStatus === "Pending") pendingCount++;
        else if (isClosed) closedCount++;

        if (!isClosed && t.dueDate) {
            const d = new Date(t.dueDate);
            d.setHours(0, 0, 0, 0);
            if (d < today) overdueCount++;
            else if (d <= weekAhead) dueThisWeekCount++;
        }
    }
    const totalCount = openCount + wipCount + blockedCount + pendingCount + closedCount;
    const activeCount = openCount + wipCount + blockedCount + pendingCount;
    const completionPct = totalCount > 0 ? Math.round((closedCount / totalCount) * 100) : 0;
    return {
        openCount,
        wipCount,
        blockedCount,
        pendingCount,
        closedCount,
        totalCount,
        activeCount,
        overdueCount,
        dueThisWeekCount,
        completionPct,
    };
};

// Top 10 active tasks to look at next: overdue → priority → soonest due →
// recent (urgency), or weight-first with urgency as tie-break. Shared by the
// "Up Next" list for whichever user is in focus.
const computeUpNext = (tasks: EffectiveTask[], upNextSort: "weight" | "urgency") => {
    const todayMs = startOfTodayMs();
    const active = tasks.filter((t) => t.effectiveStatus !== "Closed");
    const byUrgency = (a: EffectiveTask, b: EffectiveTask): number =>
        compareByUrgency(a, b, todayMs);
    const byWeight = (a: EffectiveTask, b: EffectiveTask): number => {
        const wa = computeTaskWeight(a);
        const wb = computeTaskWeight(b);
        if (wa !== wb) return wb - wa;
        return byUrgency(a, b);
    };
    return active
        .slice()
        .sort(upNextSort === "weight" ? byWeight : byUrgency)
        .slice(0, 10);
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
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const headerStyles = isDark ? TaskHeaderStyles.dark : TaskHeaderStyles.light;
    const [sprintConfigOpen, setSprintConfigOpen] = useState(false);
    const [sprintManagerOpen, setSprintManagerOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"overall" | "sprint" | "mytasks" | "members">(
        "overall"
    );
    // How the My Tasks "Up Next" list is ordered. Default "weight" so the
    // most pressing task (priority × urgency) surfaces first — the whole
    // point of the pointing system. "urgency" keeps the older overdue →
    // priority → due-date rule for users who prefer a deadline-first view.
    const [upNextSort, setUpNextSort] = useState<"weight" | "urgency">("weight");
    // How the "Top by Weight" shortlist is ordered (not which tasks are in
    // it — the shortlist is always the heaviest tasks). Mirrors the "Up Next"
    // list's options: "weight" (default) reads heaviest → soonest due →
    // status; "urgency" reuses Up Next's deadline-first rule.
    const [topWeightSort, setTopWeightSort] = useState<TopWeightSortMode>("weight");

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
    const effectiveTasks = useMemo<EffectiveTask[]>(
        () => deriveEffectiveTasks(taskById),
        [taskById]
    );

    // ── Team-wide tasks (all projects), for the Team Capacity section ──
    // This dashboard is project-scoped, but a member's real load spans every
    // project they're on. `getTeamTasks` returns the whole team's tasks
    // (all projects) with effort/due/assignee, letting us sum a member's
    // cross-project load while keeping the visible ROSTER project-scoped
    // (see `teamCapacity`). Keyed on the team — the data isn't
    // project-specific, and the dashboard remounts on navigation which
    // refreshes it. Fails soft: an error (or the pre-load window) just
    // leaves the capacity bars on this project's numbers.
    const [teamWideTasks, setTeamWideTasks] = useState<TaskTableProps[]>([]);
    useEffect(() => {
        if (!myself.teamId || !accessToken) return;
        let cancelled = false;
        (async () => {
            const rows: TaskTableProps[] = (await loadTeamTasks(myself, accessToken)) ?? [];
            if (cancelled) return;
            setTeamWideTasks(Array.isArray(rows) ? rows : []);
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myself.teamId, accessToken]);

    // Same closed/deleted rollup as `effectiveTasks`, over the team-wide set.
    const teamEffectiveTasks = useMemo<EffectiveTask[]>(() => {
        if (teamWideTasks.length === 0) return [];
        const map = new Map<string, TaskTableProps>();
        for (const tk of teamWideTasks) {
            if (tk.id) map.set(String(tk.id), tk);
        }
        return deriveEffectiveTasks(map);
    }, [teamWideTasks]);

    const stats = useMemo(() => {
        const openCount = effectiveTasks.filter((t) => t.effectiveStatus === "Open").length;
        const wipCount = effectiveTasks.filter((t) => t.effectiveStatus === "WIP").length;
        const blockedCount = effectiveTasks.filter((t) => t.effectiveStatus === "Blocked").length;
        const pendingCount = effectiveTasks.filter((t) => t.effectiveStatus === "Pending").length;
        const closedCount = effectiveTasks.filter((t) => t.effectiveStatus === "Closed").length;
        const totalTasks = openCount + wipCount + blockedCount + pendingCount + closedCount;
        const completionRate = totalTasks > 0 ? Math.round((closedCount / totalTasks) * 100) : 0;
        return {
            openCount,
            wipCount,
            blockedCount,
            pendingCount,
            closedCount,
            totalTasks,
            completionRate,
        };
    }, [effectiveTasks]);

    // ── Sprint-scoped metrics ──
    // The Sprint Summary header and the "Sprint Insights" milestone cards
    // must always agree, so they are driven by the SAME data: the project's
    // milestones filtered to the selected sprint. `sprintMilestones` mirrors
    // the exact filter SprintMilestonesSection applies, so summing the cards
    // below reproduces the header here by construction.
    const sprintMilestones = useMemo<Milestone[]>(() => {
        const projectId = usePM.currentProject?.projectId;
        if (!projectId) return [];
        const all = useSM.projectMilestones[projectId] ?? [];
        return all.filter((m) =>
            selectedSprint ? m.sprintId === selectedSprint.sprintId : m.sprintId == null
        );
    }, [usePM.currentProject?.projectId, selectedSprint?.sprintId, useSM.projectMilestones]);

    // Roll the per-milestone task counts up into one sprint total.
    // Each milestone's `tasksTotal` / `tasksClosed` already excludes Deleted
    // tasks and includes the FULL sub-task sub-tree — the backend cascades a
    // milestone's FK down the `parent_task_id` chain — so this aggregate
    // satisfies "ignore Deleted, count every sub-task" without any extra
    // walking here. Tasks attached to the sprint but to no milestone are
    // intentionally out of scope: the header is defined as the sum of its
    // milestones precisely so the two numbers can never diverge.
    const sprintStats = useMemo(() => {
        let total = 0;
        let closed = 0;
        for (const m of sprintMilestones) {
            total += m.tasksTotal ?? 0;
            closed += m.tasksClosed ?? 0;
        }
        return {
            milestones: sprintMilestones.length,
            total,
            closed,
            remaining: Math.max(0, total - closed),
        };
    }, [sprintMilestones]);

    // ── Assignee workload ──
    const assigneeWorkload = useMemo(() => {
        const map = new Map<
            string,
            {
                name: string;
                imgPath: string | null;
                open: number;
                wip: number;
                blocked: number;
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
                blocked: 0,
                pending: 0,
                closed: 0,
                closedInSprint: 0,
                total: 0,
            };
            entry.total++;
            if (t.effectiveStatus === "Open") entry.open++;
            else if (t.effectiveStatus === "WIP") entry.wip++;
            else if (t.effectiveStatus === "Blocked") entry.blocked++;
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

    // ── Tag insights (project-wide) ──
    // Aggregates every tagged item by tag name. Milestones are rows inside
    // `allTasks` (isMilestone === true) that carry their own `tags`, so this
    // single pass over `effectiveTasks` covers tasks AND milestones with no
    // double-count — and reconciles with the Status Distribution numbers.
    // NOTE: an item with N tags is counted once per tag, so summing the
    // per-tag totals exceeds the item count; `taggedCount` is the honest
    // "how many items carry ≥1 tag" coverage figure.
    const tagStats = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const map = new Map<
            string,
            {
                tagName: string;
                tagColor: string;
                tagTextColor: string;
                open: number;
                wip: number;
                blocked: number;
                pending: number;
                closed: number;
                overdue: number;
                total: number;
            }
        >();
        let taggedCount = 0;
        for (const tk of effectiveTasks) {
            const tags = tk.tags ?? [];
            if (tags.length > 0) taggedCount++;
            const isClosed = tk.effectiveStatus === "Closed";
            const isOverdue = !isClosed && !!tk.dueDate && new Date(tk.dueDate) < today;
            for (const tag of tags) {
                if (!tag?.tagName) continue;
                const entry = map.get(tag.tagName) ?? {
                    tagName: tag.tagName,
                    tagColor: tag.tagColor || "#94a3b8",
                    tagTextColor: tag.tagTextColor || "white",
                    open: 0,
                    wip: 0,
                    blocked: 0,
                    pending: 0,
                    closed: 0,
                    overdue: 0,
                    total: 0,
                };
                entry.total++;
                if (tk.effectiveStatus === "Open") entry.open++;
                else if (tk.effectiveStatus === "WIP") entry.wip++;
                else if (tk.effectiveStatus === "Blocked") entry.blocked++;
                else if (tk.effectiveStatus === "Pending") entry.pending++;
                else if (isClosed) entry.closed++;
                if (isOverdue) entry.overdue++;
                map.set(tag.tagName, entry);
            }
        }
        const rows = Array.from(map.values()).sort((a, b) => b.total - a.total);
        const coveragePct =
            effectiveTasks.length > 0
                ? Math.round((taggedCount / effectiveTasks.length) * 100)
                : 0;
        return { rows, taggedCount, total: effectiveTasks.length, coveragePct };
    }, [effectiveTasks]);

    // ── Recently updated tasks (scoped to the selected sprint) ──
    // Members of the selected sprint (`task.sprintId` is the app-wide
    // task→sprint key), most-recently-updated first, capped at 12 — so this
    // is "recent activity WITHIN this sprint", not "any task touched lately".
    // Mirrors the `sprintMilestones` filter above: no sprint selected ⇒ the
    // backlog (tasks with no sprint). effectiveTasks already excludes Deleted
    // and Deleted-branch orphans.
    const recentTasks = useMemo(() => {
        return effectiveTasks
            .filter((t) =>
                selectedSprint ? t.sprintId === selectedSprint.sprintId : t.sprintId == null
            )
            .sort((a, b) => {
                const dA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                const dB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                return dB - dA;
            })
            .slice(0, 12);
    }, [effectiveTasks, selectedSprint?.sprintId]);

    // Numeric task ids for the sprint-scoped velocity chart. Same filter
    // as `recentTasks` (selected sprint, or backlog when none) — velocity
    // reflects exactly the sprint the header describes. Milestone-backing
    // rows are included: their own activity is legitimate sprint flow.
    const sprintTaskIds = useMemo(() => {
        return effectiveTasks
            .filter((t) =>
                selectedSprint ? t.sprintId === selectedSprint.sprintId : t.sprintId == null
            )
            .map((t) => Number(t.id))
            .filter((n) => Number.isFinite(n) && n > 0);
    }, [effectiveTasks, selectedSprint?.sprintId]);

    // Per-assignee task-id subsets for the velocity chart's "by member"
    // picker (assignee lens). Distinct assignees of the sprint's tasks,
    // each carrying their own valid numeric task ids; unassigned rows are
    // skipped (nobody to attribute them to). Sorted by task count so the
    // busiest members surface first in the dropdown.
    const sprintMembers = useMemo(() => {
        const map = new Map<string, { id: string; name: string; taskIds: number[] }>();
        for (const t of effectiveTasks) {
            const inSprint = selectedSprint
                ? t.sprintId === selectedSprint.sprintId
                : t.sprintId == null;
            if (!inSprint || !t.assigneeId) continue;
            const id = Number(t.id);
            if (!Number.isFinite(id) || id <= 0) continue;
            const entry = map.get(t.assigneeId) ?? {
                id: t.assigneeId,
                name: t.assigneeName || t.assigneeId,
                taskIds: [],
            };
            entry.taskIds.push(id);
            map.set(t.assigneeId, entry);
        }
        return Array.from(map.values()).sort((a, b) => b.taskIds.length - a.taskIds.length);
    }, [effectiveTasks, selectedSprint?.sprintId]);

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

    // ── Team Capacity (effort load by member, bucketed by due-window) ──
    // Effort points (Σ) over each person's ACTIVE, non-milestone tasks are
    // the currency for "who's busy" — priority is irrelevant to load, a
    // low-priority task still eats a day. Milestone-backing rows are
    // excluded because their child tasks already carry the effort (same
    // no-double-count rule as sprintStats). Splitting by `dueBucket` turns
    // one number into a load *curve* — busy today vs. later — which is what
    // answers "who can take on this task?".
    const teamCapacity = useMemo(() => {
        // Roster = members with active work in THIS project (unchanged): the
        // dashboard is project-scoped, so we don't surface people who only
        // have tasks on other projects.
        const projectMap = buildCapacityMap(effectiveTasks);
        // Cross-project load per member, from the team-wide task set.
        const teamMap = buildCapacityMap(teamEffectiveTasks);

        // For each roster member, swap in their WHOLE-TEAM numbers so a bar
        // reflects their real load across every project — the point of the
        // feature. `__unassigned__` stays project-scoped (it isn't a person,
        // and summing unassigned tasks team-wide is meaningless). Missing
        // from the team map (fetch not landed / failed) ⇒ keep the
        // project-scoped fallback so bars are never blank.
        for (const [id, entry] of projectMap) {
            if (id === "__unassigned__") continue;
            const teamEntry = teamMap.get(id);
            if (!teamEntry) continue;
            entry.buckets = teamEntry.buckets;
            entry.total = teamEntry.total;
            entry.nearTerm = teamEntry.nearTerm;
            entry.count = teamEntry.count;
        }

        // Busiest-in-the-near-term first — that's the manager's triage order.
        return Array.from(projectMap.values()).sort(
            (a, b) => b.nearTerm - a.nearTerm || b.total - a.total
        );
    }, [effectiveTasks, teamEffectiveTasks]);

    // Largest single-member near-term load, so every capacity bar can be
    // drawn to a shared scale (a bar's fill = this member's load vs. the
    // busiest member) instead of each bar self-normalizing.
    const maxCapacityTotal = useMemo(
        () => teamCapacity.reduce((mx, m) => Math.max(mx, m.total), 0),
        [teamCapacity]
    );

    // ── Top by Weight (importance ranking, team-wide) ──
    // Highest Task Weight (priority × urgency) among ACTIVE tasks — the
    // "what should we look at first today" companion to the capacity view.
    // Milestones are included (a due-soon critical milestone is legitimately
    // top of mind). Tasks with neither a priority nor a due date carry no
    // real signal (weight === floor), so they're dropped to keep the list
    // meaningful.
    const topByWeight = useMemo(() => {
        return effectiveTasks
            .filter((t) => t.effectiveStatus !== "Closed")
            .filter((t) => t.priority || t.dueDate)
            .map((t) => ({ task: t, weight: computeTaskWeight(t) }))
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 10);
    }, [effectiveTasks]);

    // Display order for that shortlist. Deliberately a SECOND pass over the
    // already-sliced top 10: the panel always shows the heaviest tasks, and
    // this only decides how they're read (by weight, or by urgency). Sorting
    // before the slice would silently turn it into a different panel.
    const topByWeightRows = useMemo(
        () => sortTopWeightRows(topByWeight, topWeightSort, startOfTodayMs()),
        [topByWeight, topWeightSort]
    );

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

    // ── My Tasks (badge) + Focus user (shared tasks body) ──
    // `myTasks`/`myStats` stay pinned to the logged-in user so the "My Tasks"
    // TAB BADGE always shows my own count, no matter which tab is open.
    const myTasks = useMemo(
        () => effectiveTasks.filter((t) => t.assigneeId === myself.userId),
        [effectiveTasks, myself.userId]
    );
    const myStats = useMemo(() => computeAssigneeStats(myTasks), [myTasks]);

    // Distinct assignees WITH tasks in the current project (excluding me),
    // busiest-first — the picker options for the "Member's Tasks" tab.
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const projectMembers = useMemo(() => {
        const map = new Map<
            string,
            { id: string; name: string; email: string | null; count: number }
        >();
        for (const t of effectiveTasks) {
            if (!t.assigneeId || String(t.assigneeId) === String(myself.userId)) continue;
            const key = String(t.assigneeId);
            const entry = map.get(key) ?? {
                id: key,
                name: t.assigneeName || key,
                email: t.assigneeEmail ?? null,
                count: 0,
            };
            entry.count++;
            map.set(key, entry);
        }
        return Array.from(map.values()).sort((a, b) => b.count - a.count);
    }, [effectiveTasks, myself.userId]);
    // Resolve the picked id to a member object. `null` when nothing is picked
    // OR the picked member isn't in THIS project's list (e.g. after a project
    // switch). Every render gate keys off this RESOLVED object, so a stale id
    // self-heals back to the "pick a member" prompt instead of a ghost body.
    const selectedMember = selectedMemberId
        ? (projectMembers.find((m) => m.id === selectedMemberId) ?? null)
        : null;

    // The user the shared tasks-body renders stats for: me on "My Tasks", the
    // resolved member on "Member's Tasks" (null → the body isn't shown).
    const focusUserId: string | null =
        activeTab === "members"
            ? (selectedMember?.id ?? null)
            : myself.userId != null
              ? String(myself.userId)
              : null;
    const isViewingSelf = focusUserId != null && focusUserId === String(myself.userId);

    const focusTasks = useMemo(
        () =>
            focusUserId == null
                ? []
                : effectiveTasks.filter((t) => String(t.assigneeId) === focusUserId),
        [effectiveTasks, focusUserId]
    );
    // Numeric task ids for the focus user's velocity chart.
    const focusTaskIds = useMemo(
        () => focusTasks.map((t) => Number(t.id)).filter((n) => Number.isFinite(n) && n > 0),
        [focusTasks]
    );
    const focusStats = useMemo(() => computeAssigneeStats(focusTasks), [focusTasks]);
    const focusUpNext = useMemo(
        () => computeUpNext(focusTasks, upNextSort),
        [focusTasks, upNextSort]
    );

    // ── Assigned Milestones (current project, focus user) ──
    // Ongoing milestones the FOCUS user is involved in — EITHER a milestone
    // assignee OR the assignee of a task under the milestone. (A user often
    // owns tasks inside a milestone without being one of the milestone's own
    // assignees, and those milestones must still show up.)
    // Current-project scoped: milestones only load for the active project
    // (`useSM.projectMilestones` is keyed by project and populated on
    // project switch), so this reads that slice directly. "Ongoing" ==
    // `selectVisibleMilestones` (drops Deleted + Closed-in-ended-sprint) —
    // the same visible-set definition the sidebar/filter use. The selector
    // already sorts, so the cards render in due-date → status → title order.
    const focusAssignedMilestones = useMemo<Milestone[]>(() => {
        const projectId = usePM.currentProject?.projectId;
        if (!projectId || focusUserId == null) return [];
        const all = useSM.projectMilestones[projectId] ?? [];
        const sprints = useSM.projectSprints[projectId] ?? [];

        // Milestones the user has a task in. A task links to its milestone by
        // `milestoneId`; a task in a milestone (incl. subtasks that may not
        // carry `milestoneId`) has the milestone's backing task as its tree
        // root, so `rootTaskId === milestone.taskId` catches those too.
        const taskMilestoneIds = new Set<number>();
        const taskRootIds = new Set<number>();
        for (const t of focusTasks) {
            if (t.isMilestone === true) continue;
            if (t.milestoneId != null) taskMilestoneIds.add(Number(t.milestoneId));
            const root =
                t.rootTaskId != null ? Number(t.rootTaskId) : t.id != null ? Number(t.id) : null;
            if (root != null) taskRootIds.add(root);
        }

        return selectVisibleMilestones(all, sprints).filter((m) => {
            const isAssignee = (m.assignees ?? []).some(
                (a) => a.userId != null && String(a.userId) === focusUserId
            );
            const hasTaskInIt =
                taskMilestoneIds.has(m.milestoneId) ||
                (m.taskId != null && taskRootIds.has(Number(m.taskId)));
            return isAssignee || hasTaskInIt;
        });
    }, [
        usePM.currentProject?.projectId,
        useSM.projectMilestones,
        useSM.projectSprints,
        focusUserId,
        focusTasks,
    ]);

    // Milestone whose task graph is open (null = closed). Opened by clicking
    // a card in the Assigned Milestones section; the diagram highlights the
    // viewer's own tasks via `highlightAssigneeId`.
    const [diagramMilestone, setDiagramMilestone] = useState<Milestone | null>(null);

    // sprintId → name for the CURRENT project. `allTasks` (and therefore
    // `effectiveTasks`/`myTasks`/`topByWeight`) is current-project only, so
    // this resolves the sprint chip on every dashboard row and on the
    // Assigned Milestones cards. Unknown / null sprintId → SprintChip shows
    // "No Sprint".
    const sprintNameById = useMemo(() => {
        const map = new Map<number, string>();
        const projectId = usePM.currentProject?.projectId;
        if (projectId != null) {
            for (const s of useSM.projectSprints[projectId] ?? []) {
                map.set(s.sprintId, s.name);
            }
        }
        return map;
    }, [usePM.currentProject?.projectId, useSM.projectSprints]);
    const sprintNameFor = (sprintId: number | null | undefined): string | null =>
        sprintId != null ? (sprintNameById.get(sprintId) ?? null) : null;

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
                    <AppTooltip key={i} title={`${Math.round((seg.value / total) * 100)}%`}>
                        <Box
                            sx={{
                                width: `${(seg.value / total) * 100}%`,
                                backgroundColor: seg.color,
                                transition: "width 0.3s ease",
                            }}
                        />
                    </AppTooltip>
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
                            {total}
                            {t.tasks.dashboard.tasksSuffix}
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

    // Due-window segments for the Team Capacity bars, in "soonest first"
    // order so a member's bar reads left-to-right as overdue → later. Same
    // red→amber→blue→gray heat language as the rest of the dashboard.
    const capacityBuckets: { key: DueBucket; color: string; label: string }[] = [
        { key: "overdue", color: "#ef4444", label: t.tasks.dashboard.capacity.overdue },
        { key: "today", color: "#f59e0b", label: t.tasks.dashboard.capacity.today },
        { key: "week", color: "#3b82f6", label: t.tasks.dashboard.capacity.week },
        { key: "later", color: "#94a3b8", label: t.tasks.dashboard.capacity.later },
        {
            key: "none",
            color: isDark ? "#4b5563" : "#cbd5e1",
            label: t.tasks.dashboard.capacity.none,
        },
    ];

    // Sprint completion percentage — closed vs total across the selected
    // sprint's milestones. Same numerator/denominator as the "{closed} /
    // {total}" label and the per-milestone progress bars below, so every
    // sprint figure on the dashboard tells one story.
    const sprintProgressPct =
        sprintStats.total > 0
            ? Math.min(100, Math.round((sprintStats.closed / sprintStats.total) * 100))
            : 0;

    // Find the PM chat mirroring the focused project so its avatar renders
    // (else the generic WorkRoundedIcon fallback below shows). Post
    // v3-migration `chat.chatId` is the Channel UUID, not the numeric
    // project id, so the old `chatId === String(projectId)` match never hit.
    // Match on `chat.project.projectId` like `HistoryModal` /
    // `notificationRouter` / the task header.
    const pmChat = useCM.allChats.find(
        (chat) =>
            chat.chatType === 3 &&
            usePM.currentProject != null &&
            chat.project?.projectId === usePM.currentProject.projectId
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
                                {t.tasks.dashboard.taskStats}
                            </Typography>
                        </Stack>
                        <Stack alignItems="center" direction="row" spacing={1.5}>
                            <Typography level="body-sm" sx={{ color: textMuted }}>
                                {fmt(t.tasks.dashboard.projectsCount, { count: projectCount })}
                            </Typography>
                            {(useTM.isTaskPreviewVisible === true ||
                                useTM.isCreatingTask.flag === true) && (
                                <AppTooltip title={t.tasks.dashboard.closePanel}>
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
                                </AppTooltip>
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
                                                    myself={myself}
                                                    pmChat={pmChat}
                                                    setMyself={setMyself}
                                                    socket={socket}
                                                    useCM={useCM}
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

                                    {/* Sprint period selector — on mobile
                                        the Select takes a full row and
                                        the action icons + progress chip
                                        wrap onto the next row so a
                                        390px viewport doesn't clip them. */}
                                    <Stack
                                        alignItems={{ xs: "stretch", sm: "center" }}
                                        direction={{ xs: "column", sm: "row" }}
                                        spacing={1}
                                        sx={{ width: "100%" }}
                                    >
                                        <Select<number | string>
                                            indicator={<KeyboardArrowDownRoundedIcon />}
                                            size="sm"
                                            value={selectedSprint?.sprintId ?? null}
                                            placeholder={
                                                projectSprints.length === 0
                                                    ? t.tasks.dashboard.noSprintsConfigure
                                                    : t.tasks.dashboard.pickASprint
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
                                                minWidth: { xs: 0, sm: 220 },
                                                width: { xs: "100%", sm: "auto" },
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
                                        <Stack alignItems="center" direction="row" spacing={1}>
                                            <AppTooltip
                                                title={t.tasks.dashboard.sprintSettingsTooltip}
                                            >
                                                <IconButton
                                                    disabled={!usePM.currentProject?.projectId}
                                                    size="sm"
                                                    variant="soft"
                                                    onClick={() => setSprintConfigOpen(true)}
                                                >
                                                    <SettingsRoundedIcon />
                                                </IconButton>
                                            </AppTooltip>
                                            <AppTooltip
                                                title={t.tasks.dashboard.manageSprintsTooltip}
                                            >
                                                <IconButton
                                                    disabled={!usePM.currentProject?.projectId}
                                                    size="sm"
                                                    variant="soft"
                                                    onClick={() => setSprintManagerOpen(true)}
                                                >
                                                    <TuneRoundedIcon />
                                                </IconButton>
                                            </AppTooltip>
                                        </Stack>
                                    </Stack>
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
                                    {t.tasks.dashboard.noProjectSelected}
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
                            {/* ════════ Section tabs + Quick Actions ════════ */}
                            {/* One-screen dashboard: the three insight groups
                            are switched via these tabs (they never route). The
                            project + sprint selectors stay pinned above because
                            the Overall tab's "Closed (Sprint)" column depends on
                            the selected sprint. */}
                            <Stack
                                alignItems={{ md: "center" }}
                                direction={{ xs: "column", md: "row" }}
                                spacing={1.5}
                                sx={{ mt: 1 }}
                            >
                                <Tabs
                                    aria-label="Dashboard sections"
                                    value={activeTab}
                                    sx={{
                                        flex: 1,
                                        minWidth: 0,
                                        width: { xs: "100%", md: "auto" },
                                        backgroundColor: "transparent",
                                    }}
                                    onChange={(_, value) =>
                                        value &&
                                        setActiveTab(
                                            value as "overall" | "sprint" | "mytasks" | "members"
                                        )
                                    }
                                >
                                    <TabList
                                        sx={{
                                            gap: 0.5,
                                            flexWrap: "nowrap",
                                            overflowX: "auto",
                                            [`&& .${tabClasses.root}`]: {
                                                // `0 0 auto`, NOT `initial`. `initial` is
                                                // `0 1 auto` — shrink ENABLED — so at a narrow
                                                // width the tabs compressed below their content
                                                // and, with `whiteSpace: nowrap`, their labels
                                                // spilled over each other instead of the
                                                // TabList's `overflowX: auto` kicking in.
                                                // Refusing to shrink turns that squash back
                                                // into a scroll.
                                                flex: "0 0 auto",
                                                bgcolor: "transparent",
                                                borderRadius: "10px 10px 0 0",
                                                px: 2,
                                                py: 1,
                                                gap: 1,
                                                fontWeight: 500,
                                                fontSize: "0.8rem",
                                                whiteSpace: "nowrap",
                                                color: isDark
                                                    ? "rgba(255,255,255,0.5)"
                                                    : "rgba(0,0,0,0.5)",
                                                transition: "all 0.2s ease",
                                                "&:hover": {
                                                    bgcolor: isDark
                                                        ? "rgba(255,255,255,0.04)"
                                                        : "rgba(0,0,0,0.03)",
                                                    color: isDark
                                                        ? "rgba(255,255,255,0.8)"
                                                        : "rgba(0,0,0,0.7)",
                                                },
                                                [`&.${tabClasses.selected}`]: {
                                                    color: isDark ? "#a78bfa" : "#7c3aed",
                                                    fontWeight: 600,
                                                    bgcolor: isDark
                                                        ? "rgba(139,92,246,0.1)"
                                                        : "rgba(124,58,237,0.08)",
                                                    "&::after": {
                                                        height: "2px",
                                                        borderRadius: "2px 2px 0 0",
                                                        bgcolor: isDark ? "#a78bfa" : "#7c3aed",
                                                    },
                                                },
                                            },
                                        }}
                                    >
                                        <Tab value="overall" indicatorInset>
                                            <TrendingUpRoundedIcon sx={{ fontSize: 16 }} />
                                            Overall Insights
                                        </Tab>
                                        <Tab value="sprint" indicatorInset>
                                            <CalendarMonthRoundedIcon sx={{ fontSize: 16 }} />
                                            Sprint Insights
                                        </Tab>
                                        <Tab value="mytasks" indicatorInset>
                                            <PersonRoundedIcon sx={{ fontSize: 16 }} />
                                            My Tasks
                                            {myStats.totalCount > 0 && (
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        ml: 0.5,
                                                        px: 0.8,
                                                        py: 0.2,
                                                        fontSize: "0.65rem",
                                                        fontWeight: 700,
                                                        borderRadius: "6px",
                                                        background:
                                                            activeTab === "mytasks"
                                                                ? isDark
                                                                    ? "rgba(139,92,246,0.2)"
                                                                    : "rgba(124,58,237,0.15)"
                                                                : isDark
                                                                  ? "rgba(255,255,255,0.08)"
                                                                  : "rgba(0,0,0,0.06)",
                                                        color:
                                                            activeTab === "mytasks"
                                                                ? isDark
                                                                    ? "#a78bfa"
                                                                    : "#7c3aed"
                                                                : isDark
                                                                  ? "rgba(255,255,255,0.5)"
                                                                  : "rgba(0,0,0,0.5)",
                                                    }}
                                                >
                                                    {myStats.totalCount}
                                                </Box>
                                            )}
                                        </Tab>
                                        <Tab value="members" indicatorInset>
                                            <GroupsRoundedIcon sx={{ fontSize: 16 }} />
                                            Member&apos;s Tasks
                                        </Tab>
                                    </TabList>
                                </Tabs>
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    sx={{ flexShrink: 0, width: { xs: "100%", md: "auto" } }}
                                >
                                    <Button
                                        size="sm"
                                        startDecorator={<AddRoundedIcon />}
                                        variant="soft"
                                        sx={{
                                            flex: { xs: 1, md: "none" },
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
                                            flex: { xs: 1, md: "none" },
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
                                            flex: { xs: 1, md: "none" },
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
                            </Stack>

                            {/* ════════ TAB: Sprint Insights ════════ */}
                            {activeTab === "sprint" && (
                                <>
                                    {/* Sprint progress summary — moved here out of
                                    the pinned header so the header stays compact. */}
                                    <Card
                                        variant="soft"
                                        sx={{
                                            p: 2.5,
                                            background: isDark
                                                ? "linear-gradient(135deg, rgba(251,146,60,0.08) 0%, rgba(234,88,12,0.08) 100%)"
                                                : "linear-gradient(135deg, rgba(251,146,60,0.06) 0%, rgba(234,88,12,0.06) 100%)",
                                            border: "1px solid",
                                            borderColor: isDark
                                                ? "rgba(251,146,60,0.2)"
                                                : "rgba(251,146,60,0.15)",
                                        }}
                                    >
                                        <Stack spacing={2}>
                                            <Box>
                                                <Stack
                                                    alignItems="center"
                                                    direction="row"
                                                    justifyContent="space-between"
                                                    sx={{ mb: 1 }}
                                                >
                                                    <Stack
                                                        alignItems="center"
                                                        direction="row"
                                                        spacing={1}
                                                    >
                                                        <Typography
                                                            level="body-sm"
                                                            sx={{
                                                                color: textSecondary,
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            Sprint Progress
                                                        </Typography>
                                                        {selectedSprint && (
                                                            <Chip
                                                                size="sm"
                                                                variant="soft"
                                                                sx={{
                                                                    backgroundColor: isDark
                                                                        ? "rgba(124,58,237,0.15)"
                                                                        : "rgba(124,58,237,0.1)",
                                                                    color: isDark
                                                                        ? "#a78bfa"
                                                                        : "#7c3aed",
                                                                }}
                                                            >
                                                                {selectedSprint.name}
                                                            </Chip>
                                                        )}
                                                    </Stack>
                                                    <Stack
                                                        alignItems="center"
                                                        direction="row"
                                                        spacing={1}
                                                    >
                                                        <Typography
                                                            level="body-sm"
                                                            sx={{
                                                                color: textSecondary,
                                                                fontWeight: 500,
                                                            }}
                                                        >
                                                            {sprintStats.closed} /{" "}
                                                            {sprintStats.total} closed
                                                        </Typography>
                                                        <Chip
                                                            size="sm"
                                                            variant="soft"
                                                            sx={{
                                                                backgroundColor: isDark
                                                                    ? "rgba(34,197,94,0.12)"
                                                                    : "rgba(34,197,94,0.1)",
                                                                color: "#22c55e",
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            {sprintProgressPct}%
                                                        </Chip>
                                                    </Stack>
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
                                            <Stack
                                                direction="row"
                                                flexWrap="wrap"
                                                spacing={1.5}
                                                useFlexGap
                                            >
                                                <Chip
                                                    size="md"
                                                    variant="soft"
                                                    startDecorator={
                                                        <FlagRoundedIcon sx={{ fontSize: 16 }} />
                                                    }
                                                    sx={{
                                                        backgroundColor: isDark
                                                            ? "rgba(147,51,234,0.12)"
                                                            : "rgba(147,51,234,0.1)",
                                                        color: "#a855f7",
                                                    }}
                                                >
                                                    {sprintStats.milestones} Milestones
                                                </Chip>
                                                <Chip
                                                    size="md"
                                                    variant="soft"
                                                    startDecorator={
                                                        <AssignmentRoundedIcon
                                                            sx={{ fontSize: 16 }}
                                                        />
                                                    }
                                                    sx={{
                                                        backgroundColor: isDark
                                                            ? "rgba(59,130,246,0.12)"
                                                            : "rgba(59,130,246,0.1)",
                                                        color: "#3b82f6",
                                                    }}
                                                >
                                                    {sprintStats.total} Tasks
                                                </Chip>
                                                <Chip
                                                    size="md"
                                                    variant="soft"
                                                    startDecorator={
                                                        <CheckCircleOutlineRoundedIcon
                                                            sx={{ fontSize: 16 }}
                                                        />
                                                    }
                                                    sx={{
                                                        backgroundColor: isDark
                                                            ? "rgba(34,197,94,0.12)"
                                                            : "rgba(34,197,94,0.1)",
                                                        color: "#22c55e",
                                                    }}
                                                >
                                                    {sprintStats.closed} Done
                                                </Chip>
                                                <Chip
                                                    size="md"
                                                    variant="soft"
                                                    startDecorator={
                                                        <PendingActionsRoundedIcon
                                                            sx={{ fontSize: 16 }}
                                                        />
                                                    }
                                                    sx={{
                                                        backgroundColor: isDark
                                                            ? "rgba(251,146,60,0.12)"
                                                            : "rgba(251,146,60,0.1)",
                                                        color: "#fb923c",
                                                    }}
                                                >
                                                    {sprintStats.remaining} Remaining
                                                </Chip>
                                            </Stack>
                                        </Stack>
                                    </Card>

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

                                    {/* ════════ Section C: Sprint Velocity ════════ */}
                                    <TaskVelocitySection
                                        isDark={isDark}
                                        members={sprintMembers}
                                        taskIds={sprintTaskIds}
                                        teamId={myself.teamId}
                                        textMuted={textMuted}
                                        textPrimary={textPrimary}
                                        textSecondary={textSecondary}
                                        windowEnd={selectedSprint?.endDate}
                                        windowStart={selectedSprint?.startDate}
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
                                                                    handleTaskClick(
                                                                        Number(task.id)
                                                                    )
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
                                                                            <CopyableTaskIdText
                                                                                level="body-xs"
                                                                                task={task}
                                                                                sx={{
                                                                                    fontWeight: 600,
                                                                                    color: textMuted,
                                                                                }}
                                                                            />
                                                                            {task.isMilestone ===
                                                                                true && (
                                                                                <AppTooltip
                                                                                    title={
                                                                                        t.tasks
                                                                                            .dashboard
                                                                                            .milestoneTooltip
                                                                                    }
                                                                                >
                                                                                    <FlagRoundedIcon
                                                                                        sx={{
                                                                                            fontSize: 12,
                                                                                            color: "#f97316",
                                                                                        }}
                                                                                    />
                                                                                </AppTooltip>
                                                                            )}
                                                                        </Stack>
                                                                        <Chip
                                                                            size="sm"
                                                                            variant="soft"
                                                                            startDecorator={getStatusIcon(
                                                                                task.effectiveStatus
                                                                            )}
                                                                            sx={{
                                                                                fontSize:
                                                                                    "0.65rem",
                                                                                backgroundColor:
                                                                                    sc.bg,
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
                                                                            textOverflow:
                                                                                "ellipsis",
                                                                            whiteSpace: "nowrap",
                                                                        }}
                                                                    >
                                                                        {task.title ||
                                                                            t.tasks.dashboard
                                                                                .untitledTask}
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
                                                                                        task
                                                                                            .priority
                                                                                    ];
                                                                                const color =
                                                                                    swatch
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
                                                                                        {
                                                                                            task.priority
                                                                                        }
                                                                                    </Chip>
                                                                                );
                                                                            })()}
                                                                        <Typography
                                                                            level="body-xs"
                                                                            sx={{
                                                                                color: textMuted,
                                                                                ml: "auto",
                                                                                fontStyle:
                                                                                    "italic",
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
                                                    {selectedSprint
                                                        ? "No tasks in this sprint yet"
                                                        : "No backlog tasks yet"}
                                                </Typography>
                                                <Typography
                                                    level="body-sm"
                                                    sx={{ color: textMuted }}
                                                >
                                                    {selectedSprint
                                                        ? "Assign tasks to this sprint or create new ones"
                                                        : "Tasks not attached to a sprint will show here"}
                                                </Typography>
                                            </Stack>
                                        </Card>
                                    )}
                                </>
                            )}

                            {/* ════════ TAB: Member's Tasks — picker + banner ════════ */}
                            {activeTab === "members" && (
                                <Box sx={{ mb: 2 }}>
                                    <Card
                                        variant="soft"
                                        sx={{
                                            p: 2,
                                            background: cardBg,
                                            border: "1px solid",
                                            borderColor: cardBorder,
                                        }}
                                    >
                                        <Stack
                                            alignItems={{ sm: "center" }}
                                            direction={{ xs: "column", sm: "row" }}
                                            spacing={2}
                                        >
                                            <Box sx={{ minWidth: { sm: 260 }, width: "100%" }}>
                                                <Typography
                                                    level="body-xs"
                                                    sx={{
                                                        color: textMuted,
                                                        fontWeight: 600,
                                                        mb: 0.5,
                                                    }}
                                                >
                                                    {t.tasks.dashboard.memberTasks.pickLabel}
                                                </Typography>
                                                <Autocomplete
                                                    getOptionLabel={(o) => o.name}
                                                    isOptionEqualToValue={(o, v) => o.id === v.id}
                                                    options={projectMembers}
                                                    size="sm"
                                                    value={selectedMember}
                                                    placeholder={
                                                        t.tasks.dashboard.memberTasks
                                                            .pickPlaceholder
                                                    }
                                                    renderOption={(optProps, o) => {
                                                        // MUI derives the option key from
                                                        // getOptionLabel (the NAME), so two members
                                                        // with the same name collide. Drop that key
                                                        // (extract it out of the spread) and key by
                                                        // the unique member id instead.
                                                        const { key: _labelKey, ...rest } =
                                                            optProps as typeof optProps & {
                                                                key?: Key;
                                                            };
                                                        void _labelKey;
                                                        return (
                                                            <AutocompleteOption
                                                                key={o.id}
                                                                {...rest}
                                                            >
                                                                <ListItemDecorator>
                                                                    <UserAvatar
                                                                        clickable={false}
                                                                        showPulseDot={false}
                                                                        size={22}
                                                                        userId={o.id}
                                                                    />
                                                                </ListItemDecorator>
                                                                <ListItemContent
                                                                    sx={{ minWidth: 0 }}
                                                                >
                                                                    <Typography
                                                                        level="body-sm"
                                                                        sx={{ fontWeight: 600 }}
                                                                        noWrap
                                                                    >
                                                                        {o.name}
                                                                    </Typography>
                                                                    {o.email && (
                                                                        <Typography
                                                                            level="body-xs"
                                                                            sx={{
                                                                                color: textMuted,
                                                                            }}
                                                                            noWrap
                                                                        >
                                                                            {o.email}
                                                                        </Typography>
                                                                    )}
                                                                </ListItemContent>
                                                                <Chip size="sm" variant="soft">
                                                                    {o.count}
                                                                </Chip>
                                                            </AutocompleteOption>
                                                        );
                                                    }}
                                                    startDecorator={
                                                        <PersonRoundedIcon sx={{ fontSize: 16 }} />
                                                    }
                                                    onChange={(_, v) =>
                                                        setSelectedMemberId(v ? v.id : null)
                                                    }
                                                />
                                            </Box>
                                            {/* Prominent "whose stats" banner so it's always
                                                clear which member is selected. */}
                                            {selectedMember ? (
                                                <Stack
                                                    alignItems="center"
                                                    direction="row"
                                                    spacing={1.25}
                                                    sx={{
                                                        px: 1.5,
                                                        py: 1,
                                                        borderRadius: "10px",
                                                        background: isDark
                                                            ? "rgba(139,92,246,0.12)"
                                                            : "rgba(124,58,237,0.08)",
                                                        border: "1px solid",
                                                        borderColor: isDark
                                                            ? "rgba(139,92,246,0.3)"
                                                            : "rgba(124,58,237,0.2)",
                                                    }}
                                                >
                                                    {/* Clickable: opens the member's profile
                                                        modal. Safe here because — unlike the
                                                        dashboard task rows — this banner has no
                                                        onClick of its own for the avatar's
                                                        handler to bubble into. */}
                                                    <UserAvatar
                                                        showPulseDot={false}
                                                        size={32}
                                                        userId={selectedMember.id}
                                                    />
                                                    <Box sx={{ minWidth: 0 }}>
                                                        <Typography
                                                            level="body-xs"
                                                            sx={{ color: textMuted }}
                                                        >
                                                            {t.tasks.dashboard.memberTasks.viewing}
                                                        </Typography>
                                                        <Typography
                                                            level="title-sm"
                                                            sx={{
                                                                fontWeight: 700,
                                                                color: isDark
                                                                    ? "#a78bfa"
                                                                    : "#7c3aed",
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                                whiteSpace: "nowrap",
                                                            }}
                                                        >
                                                            {selectedMember.name}
                                                        </Typography>
                                                        {selectedMember.email && (
                                                            <Typography
                                                                level="body-xs"
                                                                sx={{ color: textMuted }}
                                                                noWrap
                                                            >
                                                                {selectedMember.email}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </Stack>
                                            ) : (
                                                <Typography
                                                    level="body-sm"
                                                    sx={{ color: textMuted }}
                                                >
                                                    {projectMembers.length === 0
                                                        ? t.tasks.dashboard.memberTasks.noMembers
                                                        : t.tasks.dashboard.memberTasks.pickHint}
                                                </Typography>
                                            )}
                                        </Stack>
                                    </Card>
                                </Box>
                            )}

                            {/* Members tab, nothing picked yet → prompt (skips the body). */}
                            {activeTab === "members" && selectedMember == null && (
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
                                                    ? "rgba(139,92,246,0.1)"
                                                    : "rgba(124,58,237,0.08)",
                                            }}
                                        >
                                            <GroupsRoundedIcon
                                                sx={{
                                                    fontSize: 28,
                                                    color: isDark ? "#a78bfa" : "#7c3aed",
                                                }}
                                            />
                                        </Box>
                                        <Typography
                                            level="title-md"
                                            sx={{ fontWeight: 600, color: textPrimary }}
                                        >
                                            {t.tasks.dashboard.memberTasks.promptTitle}
                                        </Typography>
                                        <Typography level="body-sm" sx={{ color: textMuted }}>
                                            {projectMembers.length === 0
                                                ? t.tasks.dashboard.memberTasks.noMembers
                                                : t.tasks.dashboard.memberTasks.promptBody}
                                        </Typography>
                                    </Stack>
                                </Card>
                            )}

                            {/* ════════ TAB: My Tasks / Member's Tasks (shared body) ════════ */}
                            {(activeTab === "mytasks" ||
                                (activeTab === "members" && selectedMember != null)) && (
                                <>
                                    {/* ════════ Section MY: My Tasks ════════ */}
                                    {/* Big "nothing assigned" card only when there's truly
                                        nothing on this tab — no tasks AND no assigned
                                        milestones. With milestones present it would sit,
                                        contradictorily, above populated milestone cards. */}
                                    {focusStats.totalCount === 0 &&
                                    focusAssignedMilestones.length === 0 ? (
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
                                                    {isViewingSelf
                                                        ? t.tasks.dashboard.nothingAssignedTitle
                                                        : t.tasks.dashboard.memberTasks
                                                              .nothingAssignedTitle}
                                                </Typography>
                                                <Typography
                                                    level="body-sm"
                                                    sx={{ color: textMuted }}
                                                >
                                                    {isViewingSelf
                                                        ? t.tasks.dashboard.nothingAssignedBody
                                                        : t.tasks.dashboard.memberTasks
                                                              .nothingAssignedBody}
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
                                                            label: t.tasks.dashboard.kpiActive,
                                                            value: String(focusStats.activeCount),
                                                            color: "#3b82f6",
                                                            icon: (
                                                                <PlayCircleOutlineRoundedIcon
                                                                    sx={{ fontSize: 18 }}
                                                                />
                                                            ),
                                                        },
                                                        {
                                                            label: t.tasks.dashboard.kpiClosed,
                                                            value: String(focusStats.closedCount),
                                                            color: "#22c55e",
                                                            icon: (
                                                                <CheckCircleOutlineRoundedIcon
                                                                    sx={{ fontSize: 18 }}
                                                                />
                                                            ),
                                                        },
                                                        {
                                                            label: t.tasks.dashboard.kpiOverdue,
                                                            value: String(focusStats.overdueCount),
                                                            color: "#ef4444",
                                                            icon: (
                                                                <WarningAmberRoundedIcon
                                                                    sx={{ fontSize: 18 }}
                                                                />
                                                            ),
                                                        },
                                                        {
                                                            label: t.tasks.dashboard
                                                                .kpiDueThisWeek,
                                                            value: String(
                                                                focusStats.dueThisWeekCount
                                                            ),
                                                            color: "#f59e0b",
                                                            icon: (
                                                                <CalendarMonthRoundedIcon
                                                                    sx={{ fontSize: 18 }}
                                                                />
                                                            ),
                                                        },
                                                        {
                                                            label: t.tasks.dashboard.kpiCompletion,
                                                            value: `${focusStats.completionPct}%`,
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

                                            {/* My velocity (personal throughput over time) */}
                                            <TaskVelocitySection
                                                isDark={isDark}
                                                taskIds={focusTaskIds}
                                                teamId={myself.teamId}
                                                textMuted={textMuted}
                                                textPrimary={textPrimary}
                                                textSecondary={textSecondary}
                                            />

                                            {/* Up Next list */}
                                            <Box>
                                                <Stack
                                                    alignItems="center"
                                                    direction="row"
                                                    flexWrap="wrap"
                                                    spacing={1}
                                                    sx={{ mb: 1 }}
                                                >
                                                    <Typography
                                                        level="body-sm"
                                                        sx={{
                                                            color: textSecondary,
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        Up Next
                                                    </Typography>
                                                    <AppTooltip
                                                        title={
                                                            <Box sx={{ maxWidth: 260 }}>
                                                                <b>
                                                                    {
                                                                        t.tasks.dashboard.upNext
                                                                            .help.title
                                                                    }
                                                                </b>
                                                                <br />
                                                                {
                                                                    t.tasks.dashboard.upNext.help
                                                                        .body
                                                                }
                                                            </Box>
                                                        }
                                                    >
                                                        <HelpOutlineRoundedIcon
                                                            sx={{
                                                                fontSize: 15,
                                                                color: textMuted,
                                                                cursor: "help",
                                                            }}
                                                        />
                                                    </AppTooltip>
                                                    {/* Sort selector — order the list by Task
                                                        Weight (default) or by the deadline rule. */}
                                                    <Stack
                                                        direction="row"
                                                        spacing={0.5}
                                                        sx={{ ml: { sm: "auto" } }}
                                                    >
                                                        {(
                                                            [
                                                                {
                                                                    key: "weight" as const,
                                                                    label: t.tasks.dashboard.upNext
                                                                        .byWeight,
                                                                },
                                                                {
                                                                    key: "urgency" as const,
                                                                    label: t.tasks.dashboard.upNext
                                                                        .byUrgency,
                                                                },
                                                            ] as const
                                                        ).map((opt) => {
                                                            const active = upNextSort === opt.key;
                                                            return (
                                                                <Chip
                                                                    key={opt.key}
                                                                    size="sm"
                                                                    sx={{
                                                                        cursor: "pointer",
                                                                        fontSize: "0.7rem",
                                                                        fontWeight: 600,
                                                                        backgroundColor: active
                                                                            ? "#7c3aed"
                                                                            : isDark
                                                                              ? "rgba(255,255,255,0.06)"
                                                                              : "rgba(0,0,0,0.05)",
                                                                        color: active
                                                                            ? "white"
                                                                            : textSecondary,
                                                                        "&:hover": {
                                                                            backgroundColor: active
                                                                                ? "#6d28d9"
                                                                                : isDark
                                                                                  ? "rgba(255,255,255,0.1)"
                                                                                  : "rgba(0,0,0,0.08)",
                                                                        },
                                                                    }}
                                                                    variant={
                                                                        active ? "solid" : "soft"
                                                                    }
                                                                    onClick={() =>
                                                                        setUpNextSort(opt.key)
                                                                    }
                                                                >
                                                                    {opt.label}
                                                                </Chip>
                                                            );
                                                        })}
                                                    </Stack>
                                                </Stack>
                                                {focusUpNext.length === 0 ? (
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
                                                            All your assigned tasks are closed —
                                                            nothing to do here.
                                                        </Typography>
                                                    </Card>
                                                ) : (
                                                    <Stack spacing={0.75}>
                                                        {focusUpNext.map((task) => (
                                                            <DashboardTaskRow
                                                                key={task.id}
                                                                task={task}
                                                                sprintName={sprintNameFor(
                                                                    task.sprintId
                                                                )}
                                                                onClick={() =>
                                                                    handleTaskClick(
                                                                        Number(task.id)
                                                                    )
                                                                }
                                                            />
                                                        ))}
                                                    </Stack>
                                                )}
                                            </Box>
                                        </Stack>
                                    )}

                                    {/* ════════ Section: Assigned Milestones ════════ */}
                                    {/* Suppressed only when the WHOLE tab is empty (no tasks
                                        and no milestones) — the big card above already covers
                                        that, so we don't stack a second "empty" line under it. */}
                                    {(focusAssignedMilestones.length > 0 ||
                                        focusStats.totalCount > 0) && (
                                        <Box sx={{ mt: 3 }}>
                                            <Stack
                                                alignItems="center"
                                                direction="row"
                                                flexWrap="wrap"
                                                spacing={1}
                                                sx={{ mb: 1.5 }}
                                            >
                                                <FlagRoundedIcon
                                                    sx={{ fontSize: 16, color: "#f97316" }}
                                                />
                                                <Typography
                                                    level="body-sm"
                                                    sx={{ color: textSecondary, fontWeight: 600 }}
                                                >
                                                    {t.tasks.dashboard.assignedMilestones.title}
                                                </Typography>
                                                <AppTooltip
                                                    title={
                                                        <Box sx={{ maxWidth: 260 }}>
                                                            {isViewingSelf
                                                                ? t.tasks.dashboard
                                                                      .assignedMilestones.help
                                                                : t.tasks.dashboard.memberTasks
                                                                      .milestonesHelp}
                                                        </Box>
                                                    }
                                                >
                                                    <HelpOutlineRoundedIcon
                                                        sx={{
                                                            fontSize: 15,
                                                            color: textMuted,
                                                            cursor: "help",
                                                        }}
                                                    />
                                                </AppTooltip>
                                                {focusAssignedMilestones.length > 0 && (
                                                    <Chip
                                                        size="sm"
                                                        sx={{ ml: { sm: "auto" } }}
                                                        variant="soft"
                                                    >
                                                        {focusAssignedMilestones.length}
                                                    </Chip>
                                                )}
                                            </Stack>
                                            {focusAssignedMilestones.length === 0 ? (
                                                <Typography
                                                    level="body-sm"
                                                    sx={{ color: textMuted }}
                                                >
                                                    {isViewingSelf
                                                        ? t.tasks.dashboard.assignedMilestones
                                                              .empty
                                                        : t.tasks.dashboard.memberTasks
                                                              .milestonesEmpty}
                                                </Typography>
                                            ) : (
                                                <Box
                                                    sx={{
                                                        display: "grid",
                                                        gap: 1.5,
                                                        gridTemplateColumns: {
                                                            xs: "1fr",
                                                            sm: "repeat(2, 1fr)",
                                                            md: "repeat(3, 1fr)",
                                                        },
                                                    }}
                                                >
                                                    {focusAssignedMilestones.map((m) => (
                                                        <AssignedMilestoneCard
                                                            key={m.milestoneId}
                                                            milestone={m}
                                                            sprintName={sprintNameFor(m.sprintId)}
                                                            onOpen={setDiagramMilestone}
                                                        />
                                                    ))}
                                                </Box>
                                            )}
                                        </Box>
                                    )}
                                </>
                            )}

                            {/* ════════ TAB: Overall Insights ════════ */}
                            {activeTab === "overall" && (
                                <>
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
                                                            color: STATUS_COLORS.Blocked.text,
                                                            value: stats.blockedCount,
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

                                        {/* Status cards — one equal-width card per
                                            status, all on a single row. A CSS grid
                                            (not the 12-column MUI Grid): 12 isn't
                                            divisible by 5, so the 5th card wrapped to
                                            a second row. */}
                                        <Box
                                            sx={{
                                                display: "grid",
                                                gridTemplateColumns: {
                                                    xs: "repeat(2, 1fr)",
                                                    md: "repeat(5, 1fr)",
                                                },
                                                gap: 1.5,
                                            }}
                                        >
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
                                                        key: "Blocked",
                                                        count: stats.blockedCount,
                                                        icon: <BlockRoundedIcon />,
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
                                                        ? Math.round(
                                                              (s.count / stats.totalTasks) * 100
                                                          )
                                                        : 0;
                                                return (
                                                    <Card
                                                        key={s.key}
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
                                                                    {
                                                                        t.tasks.dashboard
                                                                            .statusLabels[
                                                                            STATUS_LABEL_KEYS[
                                                                                s.key
                                                                            ] ?? "open"
                                                                        ]
                                                                    }
                                                                </Typography>
                                                            </Box>
                                                        </Stack>
                                                    </Card>
                                                );
                                            })}
                                        </Box>
                                    </Box>

                                    {/* ════════ Section F: Overdue & Upcoming ════════ */}
                                    {(overdueAndUpcoming.overdue.length > 0 ||
                                        overdueAndUpcoming.upcoming.length > 0) && (
                                        <Stack
                                            direction={{ xs: "column", md: "row" }}
                                            spacing={1.5}
                                        >
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
                                                                sx={{
                                                                    fontSize: 16,
                                                                    color: "#ef4444",
                                                                }}
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
                                                                backgroundColor:
                                                                    "rgba(239,68,68,0.12)",
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
                                                                        handleTaskClick(
                                                                            Number(task.id)
                                                                        )
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
                                                                            textOverflow:
                                                                                "ellipsis",
                                                                            whiteSpace: "nowrap",
                                                                        }}
                                                                    >
                                                                        {task.title ||
                                                                            t.tasks.dashboard
                                                                                .untitledTask}
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
                                                                +
                                                                {overdueAndUpcoming.overdue
                                                                    .length - 5}{" "}
                                                                more
                                                            </Typography>
                                                        )}
                                                        {overdueAndUpcoming.overdue.length ===
                                                            0 && (
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
                                                                sx={{
                                                                    fontSize: 16,
                                                                    color: "#3b82f6",
                                                                }}
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
                                                                backgroundColor:
                                                                    "rgba(59,130,246,0.12)",
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
                                                                        handleTaskClick(
                                                                            Number(task.id)
                                                                        )
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
                                                                            textOverflow:
                                                                                "ellipsis",
                                                                            whiteSpace: "nowrap",
                                                                        }}
                                                                    >
                                                                        {task.title ||
                                                                            t.tasks.dashboard
                                                                                .untitledTask}
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
                                                        {overdueAndUpcoming.upcoming.length >
                                                            5 && (
                                                            <Typography
                                                                level="body-xs"
                                                                sx={{ color: textMuted, pl: 1 }}
                                                            >
                                                                +
                                                                {overdueAndUpcoming.upcoming
                                                                    .length - 5}{" "}
                                                                more
                                                            </Typography>
                                                        )}
                                                        {overdueAndUpcoming.upcoming.length ===
                                                            0 && (
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
                                    {/* ════════ Section E: Priority & Effort Breakdown ════════ */}
                                    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                                        {renderDistributionCard(
                                            t.tasks.dashboard.priorityDistribution,
                                            <WarningAmberRoundedIcon
                                                sx={{ fontSize: 16, color: "#f97316" }}
                                            />,
                                            priorityBreakdown,
                                            priorityColors
                                        )}
                                        {renderDistributionCard(
                                            t.tasks.dashboard.effortDistribution,
                                            <TrendingUpRoundedIcon
                                                sx={{ fontSize: 16, color: "#7c3aed" }}
                                            />,
                                            effortBreakdown,
                                            effortColors
                                        )}
                                    </Stack>

                                    {/* ════════ Section F: Top by Weight ════════ */}
                                    {topByWeight.length > 0 && (
                                        <Box>
                                            {/* Title and sort chips are siblings inside a
                                                flex row: the chip Stack renders a <div>,
                                                which can't live inside the <p> a Joy
                                                Typography renders. */}
                                            <Stack
                                                alignItems="center"
                                                direction="row"
                                                sx={{ gap: 1, mb: 0.5 }}
                                            >
                                                <Typography
                                                    level="title-sm"
                                                    sx={{
                                                        fontWeight: 600,
                                                        color: sectionHeaderColor,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 1,
                                                    }}
                                                >
                                                    <WarningAmberRoundedIcon
                                                        sx={{ fontSize: 16, color: "#ef4444" }}
                                                    />
                                                    {t.tasks.dashboard.topWeight.title}
                                                    <AppTooltip
                                                        title={
                                                            <Box sx={{ maxWidth: 260 }}>
                                                                <b>
                                                                    {
                                                                        t.tasks.dashboard.topWeight
                                                                            .help.title
                                                                    }
                                                                </b>
                                                                <br />
                                                                {
                                                                    t.tasks.dashboard.topWeight
                                                                        .help.body
                                                                }
                                                            </Box>
                                                        }
                                                    >
                                                        <HelpOutlineRoundedIcon
                                                            sx={{
                                                                fontSize: 15,
                                                                color: textMuted,
                                                                cursor: "help",
                                                            }}
                                                        />
                                                    </AppTooltip>
                                                </Typography>
                                                {/* Sort selector — reorders the
                                                    shortlist. Same options as the
                                                    "Up Next" list: order by Task
                                                    Weight (default) or by the
                                                    deadline rule. */}
                                                <Stack
                                                    direction="row"
                                                    spacing={0.5}
                                                    sx={{ ml: { sm: "auto" } }}
                                                >
                                                    {(
                                                        [
                                                            {
                                                                key: "weight" as const,
                                                                label: t.tasks.dashboard.upNext
                                                                    .byWeight,
                                                            },
                                                            {
                                                                key: "urgency" as const,
                                                                label: t.tasks.dashboard.upNext
                                                                    .byUrgency,
                                                            },
                                                        ] as const
                                                    ).map((opt) => {
                                                        const active = topWeightSort === opt.key;
                                                        return (
                                                            <Chip
                                                                key={opt.key}
                                                                size="sm"
                                                                variant={active ? "solid" : "soft"}
                                                                sx={{
                                                                    cursor: "pointer",
                                                                    fontSize: "0.7rem",
                                                                    fontWeight: 600,
                                                                    backgroundColor: active
                                                                        ? "#7c3aed"
                                                                        : isDark
                                                                          ? "rgba(255,255,255,0.06)"
                                                                          : "rgba(0,0,0,0.05)",
                                                                    color: active
                                                                        ? "white"
                                                                        : textSecondary,
                                                                    "&:hover": {
                                                                        backgroundColor: active
                                                                            ? "#6d28d9"
                                                                            : isDark
                                                                              ? "rgba(255,255,255,0.1)"
                                                                              : "rgba(0,0,0,0.08)",
                                                                    },
                                                                }}
                                                                onClick={() =>
                                                                    setTopWeightSort(opt.key)
                                                                }
                                                            >
                                                                {opt.label}
                                                            </Chip>
                                                        );
                                                    })}
                                                </Stack>
                                            </Stack>
                                            <Typography
                                                level="body-xs"
                                                sx={{ color: textMuted, mb: 1.5 }}
                                            >
                                                {t.tasks.dashboard.topWeight.subtitle}
                                            </Typography>
                                            <Stack spacing={0.75}>
                                                {topByWeightRows.map(({ task }) => (
                                                    <DashboardTaskRow
                                                        key={task.id}
                                                        sprintName={sprintNameFor(task.sprintId)}
                                                        task={task}
                                                        onClick={() =>
                                                            handleTaskClick(Number(task.id))
                                                        }
                                                    />
                                                ))}
                                            </Stack>
                                        </Box>
                                    )}

                                    {/* ════════ Section G: Team Capacity ════════ */}
                                    <Box>
                                        <Typography
                                            level="title-sm"
                                            sx={{
                                                fontWeight: 600,
                                                mb: 0.5,
                                                color: sectionHeaderColor,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                            }}
                                        >
                                            <WorkRoundedIcon sx={{ fontSize: 16 }} />
                                            {t.tasks.dashboard.capacity.title}
                                            <AppTooltip
                                                title={
                                                    <Box sx={{ maxWidth: 260 }}>
                                                        <b>
                                                            {t.tasks.dashboard.capacity.help.title}
                                                        </b>
                                                        <br />
                                                        {t.tasks.dashboard.capacity.help.body}
                                                    </Box>
                                                }
                                            >
                                                <HelpOutlineRoundedIcon
                                                    sx={{
                                                        fontSize: 15,
                                                        color: textMuted,
                                                        cursor: "help",
                                                    }}
                                                />
                                            </AppTooltip>
                                        </Typography>
                                        <Typography
                                            level="body-xs"
                                            sx={{ color: textMuted, mb: 1.5 }}
                                        >
                                            {t.tasks.dashboard.capacity.subtitle}
                                        </Typography>
                                        <Card
                                            variant="outlined"
                                            sx={{
                                                p: 2,
                                                background: cardBg,
                                                borderColor: cardBorder,
                                            }}
                                        >
                                            {teamCapacity.length === 0 ? (
                                                <Typography
                                                    level="body-sm"
                                                    sx={{
                                                        color: textMuted,
                                                        textAlign: "center",
                                                        py: 1,
                                                    }}
                                                >
                                                    {t.tasks.dashboard.capacity.empty}
                                                </Typography>
                                            ) : (
                                                <Stack spacing={2}>
                                                    {/* Legend */}
                                                    <Stack
                                                        direction="row"
                                                        flexWrap="wrap"
                                                        gap={1.5}
                                                    >
                                                        {capacityBuckets.map((b) => (
                                                            <Stack
                                                                key={b.key}
                                                                alignItems="center"
                                                                direction="row"
                                                                spacing={0.5}
                                                            >
                                                                <Box
                                                                    sx={{
                                                                        width: 8,
                                                                        height: 8,
                                                                        borderRadius: "2px",
                                                                        backgroundColor: b.color,
                                                                    }}
                                                                />
                                                                <Typography
                                                                    level="body-xs"
                                                                    sx={{ color: textSecondary }}
                                                                >
                                                                    {b.label}
                                                                </Typography>
                                                            </Stack>
                                                        ))}
                                                    </Stack>
                                                    {/* Per-member load rows (shared scale) */}
                                                    <Stack spacing={1.25}>
                                                        {teamCapacity.map((m) => (
                                                            <Stack
                                                                key={m.id}
                                                                alignItems="center"
                                                                direction="row"
                                                                spacing={1.5}
                                                            >
                                                                <Stack
                                                                    alignItems="center"
                                                                    direction="row"
                                                                    spacing={1}
                                                                    sx={{
                                                                        width: { xs: 90, sm: 150 },
                                                                        flexShrink: 0,
                                                                        minWidth: 0,
                                                                    }}
                                                                >
                                                                    <UserAvatar
                                                                        showPulseDot={false}
                                                                        size={26}
                                                                        clickable={
                                                                            m.id !==
                                                                            "__unassigned__"
                                                                        }
                                                                        fallbackInitial={m.name
                                                                            .charAt(0)
                                                                            .toUpperCase()}
                                                                        userId={
                                                                            m.id ===
                                                                            "__unassigned__"
                                                                                ? null
                                                                                : m.id
                                                                        }
                                                                    />
                                                                    <Typography
                                                                        level="body-xs"
                                                                        sx={{
                                                                            color: textPrimary,
                                                                            fontWeight: 500,
                                                                            overflow: "hidden",
                                                                            textOverflow:
                                                                                "ellipsis",
                                                                            whiteSpace: "nowrap",
                                                                        }}
                                                                    >
                                                                        {m.name}
                                                                    </Typography>
                                                                </Stack>
                                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                    <Box
                                                                        sx={{
                                                                            display: "flex",
                                                                            height: 12,
                                                                            borderRadius: 6,
                                                                            overflow: "hidden",
                                                                            backgroundColor: isDark
                                                                                ? "rgba(255,255,255,0.08)"
                                                                                : "rgba(0,0,0,0.06)",
                                                                        }}
                                                                    >
                                                                        <Box
                                                                            sx={{
                                                                                display: "flex",
                                                                                height: "100%",
                                                                                minWidth:
                                                                                    m.total > 0
                                                                                        ? 6
                                                                                        : 0,
                                                                                width: `${
                                                                                    maxCapacityTotal >
                                                                                    0
                                                                                        ? (m.total /
                                                                                              maxCapacityTotal) *
                                                                                          100
                                                                                        : 0
                                                                                }%`,
                                                                            }}
                                                                        >
                                                                            {capacityBuckets.map(
                                                                                (b) => {
                                                                                    const v =
                                                                                        m.buckets[
                                                                                            b.key
                                                                                        ];
                                                                                    return v >
                                                                                        0 ? (
                                                                                        <AppTooltip
                                                                                            key={
                                                                                                b.key
                                                                                            }
                                                                                            title={fmt(
                                                                                                t
                                                                                                    .tasks
                                                                                                    .dashboard
                                                                                                    .capacity
                                                                                                    .effortTooltip,
                                                                                                {
                                                                                                    label: b.label,
                                                                                                    points: v,
                                                                                                }
                                                                                            )}
                                                                                        >
                                                                                            <Box
                                                                                                sx={{
                                                                                                    width: `${(v / m.total) * 100}%`,
                                                                                                    backgroundColor:
                                                                                                        b.color,
                                                                                                }}
                                                                                            />
                                                                                        </AppTooltip>
                                                                                    ) : null;
                                                                                }
                                                                            )}
                                                                        </Box>
                                                                    </Box>
                                                                </Box>
                                                                <Stack
                                                                    alignItems="center"
                                                                    direction="row"
                                                                    spacing={0.75}
                                                                    sx={{ flexShrink: 0 }}
                                                                >
                                                                    <AppTooltip
                                                                        title={
                                                                            t.tasks.dashboard
                                                                                .capacity.nearTerm
                                                                        }
                                                                    >
                                                                        <Chip
                                                                            size="sm"
                                                                            variant="soft"
                                                                            sx={{
                                                                                fontWeight: 700,
                                                                                fontSize: "0.7rem",
                                                                                minWidth: 34,
                                                                                backgroundColor:
                                                                                    m.nearTerm > 0
                                                                                        ? "rgba(239,68,68,0.14)"
                                                                                        : "rgba(148,163,184,0.14)",
                                                                                color:
                                                                                    m.nearTerm > 0
                                                                                        ? "#ef4444"
                                                                                        : textMuted,
                                                                            }}
                                                                        >
                                                                            {m.nearTerm}
                                                                        </Chip>
                                                                    </AppTooltip>
                                                                    <Typography
                                                                        level="body-xs"
                                                                        sx={{
                                                                            color: textMuted,
                                                                            minWidth: 54,
                                                                            textAlign: "right",
                                                                        }}
                                                                    >
                                                                        {fmt(
                                                                            t.tasks.dashboard
                                                                                .capacity
                                                                                .tasksCount,
                                                                            { count: m.count }
                                                                        )}
                                                                    </Typography>
                                                                </Stack>
                                                            </Stack>
                                                        ))}
                                                    </Stack>
                                                </Stack>
                                            )}
                                        </Card>
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
                                                            <th style={{ width: "30%" }}>
                                                                {t.tasks.dashboard.member}
                                                            </th>
                                                            <th style={{ textAlign: "center" }}>
                                                                {t.tasks.dashboard.open}
                                                            </th>
                                                            <th style={{ textAlign: "center" }}>
                                                                {t.tasks.dashboard.wip}
                                                            </th>
                                                            <th style={{ textAlign: "center" }}>
                                                                {t.tasks.dashboard.blocked}
                                                            </th>
                                                            <th style={{ textAlign: "center" }}>
                                                                {t.tasks.dashboard.pending}
                                                            </th>
                                                            <th style={{ textAlign: "center" }}>
                                                                {t.tasks.dashboard.closed}
                                                            </th>
                                                            <th style={{ textAlign: "center" }}>
                                                                {t.tasks.dashboard.total}
                                                            </th>
                                                            <th style={{ textAlign: "center" }}>
                                                                {t.tasks.dashboard.closedSprint}
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
                                                                        {a.id !==
                                                                            "__unassigned__" &&
                                                                        useTEM.teamMemberProfiles[
                                                                            a.id
                                                                        ] ? (
                                                                            <AvatarWithStatus
                                                                                avatarSize={26}
                                                                                myself={myself}
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
                                                                                    myself.userId ===
                                                                                    a.id
                                                                                }
                                                                                setMyself={
                                                                                    setMyself
                                                                                }
                                                                                showPulseDot={
                                                                                    false
                                                                                }
                                                                            />
                                                                        ) : (
                                                                            <Avatar
                                                                                size="sm"
                                                                                src={
                                                                                    a.imgPath ||
                                                                                    undefined
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
                                                                                textOverflow:
                                                                                    "ellipsis",
                                                                                whiteSpace:
                                                                                    "nowrap",
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
                                                                            key: "Open",
                                                                            val: a.open,
                                                                        },
                                                                        {
                                                                            key: "WIP",
                                                                            val: a.wip,
                                                                        },
                                                                        {
                                                                            key: "Blocked",
                                                                            val: a.blocked,
                                                                        },
                                                                        {
                                                                            key: "Pending",
                                                                            val: a.pending,
                                                                        },
                                                                        {
                                                                            key: "Closed",
                                                                            val: a.closed,
                                                                        },
                                                                    ] as const
                                                                ).map((cell) => (
                                                                    <td
                                                                        key={cell.key}
                                                                        style={{
                                                                            textAlign: "center",
                                                                        }}
                                                                    >
                                                                        {cell.val > 0 ? (
                                                                            <Chip
                                                                                size="sm"
                                                                                variant="soft"
                                                                                sx={{
                                                                                    minWidth: 28,
                                                                                    backgroundColor:
                                                                                        STATUS_COLORS[
                                                                                            cell
                                                                                                .key
                                                                                        ].bg,
                                                                                    color: STATUS_COLORS[
                                                                                        cell.key
                                                                                    ].text,
                                                                                    fontWeight: 600,
                                                                                }}
                                                                            >
                                                                                {cell.val}
                                                                            </Chip>
                                                                        ) : (
                                                                            <Typography
                                                                                level="body-xs"
                                                                                sx={{
                                                                                    color: textMuted,
                                                                                }}
                                                                            >
                                                                                -
                                                                            </Typography>
                                                                        )}
                                                                    </td>
                                                                ))}
                                                                <td
                                                                    style={{ textAlign: "center" }}
                                                                >
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
                                                                <td
                                                                    style={{ textAlign: "center" }}
                                                                >
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
                                                                            sx={{
                                                                                color: textMuted,
                                                                            }}
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

                                    {/* ════════ Tag Insights ════════ */}
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
                                            <LocalOfferRoundedIcon sx={{ fontSize: 16 }} />
                                            Tag Insights
                                            <Chip size="sm" sx={{ ml: 0.5 }} variant="soft">
                                                {tagStats.rows.length}
                                            </Chip>
                                        </Typography>

                                        {tagStats.rows.length === 0 ? (
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
                                                <Stack alignItems="center" spacing={1.5}>
                                                    <Box
                                                        sx={{
                                                            width: 56,
                                                            height: 56,
                                                            borderRadius: "14px",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            background: isDark
                                                                ? "rgba(236,72,153,0.1)"
                                                                : "rgba(236,72,153,0.08)",
                                                        }}
                                                    >
                                                        <LocalOfferRoundedIcon
                                                            sx={{
                                                                fontSize: 28,
                                                                color: isDark
                                                                    ? "#f472b6"
                                                                    : "#ec4899",
                                                            }}
                                                        />
                                                    </Box>
                                                    <Typography
                                                        level="title-md"
                                                        sx={{
                                                            fontWeight: 600,
                                                            color: textPrimary,
                                                        }}
                                                    >
                                                        No tags yet
                                                    </Typography>
                                                    <Typography
                                                        level="body-sm"
                                                        sx={{ color: textMuted }}
                                                    >
                                                        Add tags to tasks or milestones to see
                                                        tag-based insights here.
                                                    </Typography>
                                                </Stack>
                                            </Card>
                                        ) : (
                                            <Stack spacing={2}>
                                                {/* Summary KPI tiles */}
                                                <Grid spacing={1.5} container>
                                                    {(
                                                        [
                                                            {
                                                                label: "Tags in use",
                                                                value: String(
                                                                    tagStats.rows.length
                                                                ),
                                                                color: "#ec4899",
                                                                icon: (
                                                                    <LocalOfferRoundedIcon
                                                                        sx={{ fontSize: 18 }}
                                                                    />
                                                                ),
                                                            },
                                                            {
                                                                label: "Tagged items",
                                                                value: String(
                                                                    tagStats.taggedCount
                                                                ),
                                                                color: "#3b82f6",
                                                                icon: (
                                                                    <AssignmentRoundedIcon
                                                                        sx={{ fontSize: 18 }}
                                                                    />
                                                                ),
                                                            },
                                                            {
                                                                label: "Tag coverage",
                                                                value: `${tagStats.coveragePct}%`,
                                                                color: "#22c55e",
                                                                icon: (
                                                                    <TrendingUpRoundedIcon
                                                                        sx={{ fontSize: 18 }}
                                                                    />
                                                                ),
                                                            },
                                                            {
                                                                label: "Most used",
                                                                value:
                                                                    tagStats.rows[0]?.tagName ??
                                                                    "—",
                                                                color:
                                                                    tagStats.rows[0]?.tagColor ??
                                                                    "#a78bfa",
                                                                icon: (
                                                                    <FlagRoundedIcon
                                                                        sx={{ fontSize: 18 }}
                                                                    />
                                                                ),
                                                            },
                                                        ] as const
                                                    ).map((tile) => (
                                                        <Grid
                                                            key={tile.label}
                                                            md={3}
                                                            sm={6}
                                                            xs={6}
                                                        >
                                                            <Card
                                                                variant="soft"
                                                                sx={{
                                                                    p: 2,
                                                                    height: "100%",
                                                                    background: isDark
                                                                        ? `${tile.color}1F`
                                                                        : `${tile.color}14`,
                                                                    border: "1px solid",
                                                                    borderColor: cardBorder,
                                                                    transition:
                                                                        "transform 0.2s ease",
                                                                    "&:hover": {
                                                                        transform:
                                                                            "translateY(-2px)",
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
                                                                            justifyContent:
                                                                                "center",
                                                                            color: tile.color,
                                                                            backgroundColor: isDark
                                                                                ? "rgba(255,255,255,0.06)"
                                                                                : "rgba(255,255,255,0.8)",
                                                                        }}
                                                                    >
                                                                        {tile.icon}
                                                                    </Box>
                                                                    <Box sx={{ minWidth: 0 }}>
                                                                        <Typography
                                                                            level="h3"
                                                                            sx={{
                                                                                fontWeight: 700,
                                                                                fontSize: "1.4rem",
                                                                                color: textPrimary,
                                                                                overflow: "hidden",
                                                                                textOverflow:
                                                                                    "ellipsis",
                                                                                whiteSpace:
                                                                                    "nowrap",
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

                                                {/* Status legend — the per-row Status bars
                                                    are unlabeled, so this maps each color to
                                                    its status. Same STATUS_COLORS the bars use. */}
                                                <Stack
                                                    alignItems="center"
                                                    direction="row"
                                                    flexWrap="wrap"
                                                    spacing={1.5}
                                                    sx={{ px: 0.5 }}
                                                    useFlexGap
                                                >
                                                    <Typography
                                                        level="body-xs"
                                                        sx={{ color: textMuted, fontWeight: 600 }}
                                                    >
                                                        Status
                                                    </Typography>
                                                    {(
                                                        [
                                                            "Open",
                                                            "WIP",
                                                            "Blocked",
                                                            "Pending",
                                                            "Closed",
                                                        ] as const
                                                    ).map((s) => (
                                                        <Stack
                                                            key={s}
                                                            alignItems="center"
                                                            direction="row"
                                                            spacing={0.5}
                                                        >
                                                            <Box
                                                                sx={{
                                                                    width: 10,
                                                                    height: 10,
                                                                    borderRadius: "3px",
                                                                    backgroundColor:
                                                                        STATUS_COLORS[s].text,
                                                                }}
                                                            />
                                                            <Typography
                                                                level="body-xs"
                                                                sx={{ color: textSecondary }}
                                                            >
                                                                {
                                                                    t.tasks.dashboard.statusLabels[
                                                                        STATUS_LABEL_KEYS[s] ??
                                                                            "open"
                                                                    ]
                                                                }
                                                            </Typography>
                                                        </Stack>
                                                    ))}
                                                </Stack>

                                                {/* Per-tag breakdown table */}
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
                                                                verticalAlign: "middle",
                                                            },
                                                            "& tbody tr:last-child td": {
                                                                borderBottom: "none",
                                                            },
                                                        }}
                                                    >
                                                        <thead>
                                                            <tr>
                                                                <th style={{ width: "26%" }}>
                                                                    Tag
                                                                </th>
                                                                <th
                                                                    style={{
                                                                        width: 64,
                                                                        textAlign: "center",
                                                                    }}
                                                                >
                                                                    Items
                                                                </th>
                                                                <th style={{ width: "42%" }}>
                                                                    Status
                                                                </th>
                                                                <th
                                                                    style={{
                                                                        width: 84,
                                                                        textAlign: "center",
                                                                    }}
                                                                >
                                                                    Progress
                                                                </th>
                                                                <th
                                                                    style={{
                                                                        width: 76,
                                                                        textAlign: "center",
                                                                    }}
                                                                >
                                                                    Overdue
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {tagStats.rows.map((row) => {
                                                                const pct =
                                                                    row.total > 0
                                                                        ? Math.round(
                                                                              (row.closed /
                                                                                  row.total) *
                                                                                  100
                                                                          )
                                                                        : 0;
                                                                return (
                                                                    <tr key={row.tagName}>
                                                                        <td>
                                                                            <ProjectTagChip
                                                                                fontSize="0.8rem"
                                                                                isDark={isDark}
                                                                                label={row.tagName}
                                                                                tagColor={
                                                                                    row.tagColor
                                                                                }
                                                                            />
                                                                        </td>
                                                                        <td
                                                                            style={{
                                                                                textAlign:
                                                                                    "center",
                                                                            }}
                                                                        >
                                                                            <Typography
                                                                                level="body-sm"
                                                                                sx={{
                                                                                    fontWeight: 700,
                                                                                    color: textPrimary,
                                                                                }}
                                                                            >
                                                                                {row.total}
                                                                            </Typography>
                                                                        </td>
                                                                        <td>
                                                                            {renderStackedBar(
                                                                                [
                                                                                    {
                                                                                        color: STATUS_COLORS
                                                                                            .Open
                                                                                            .text,
                                                                                        value: row.open,
                                                                                    },
                                                                                    {
                                                                                        color: STATUS_COLORS
                                                                                            .WIP
                                                                                            .text,
                                                                                        value: row.wip,
                                                                                    },
                                                                                    {
                                                                                        color: STATUS_COLORS
                                                                                            .Blocked
                                                                                            .text,
                                                                                        value: row.blocked,
                                                                                    },
                                                                                    {
                                                                                        color: STATUS_COLORS
                                                                                            .Pending
                                                                                            .text,
                                                                                        value: row.pending,
                                                                                    },
                                                                                    {
                                                                                        color: STATUS_COLORS
                                                                                            .Closed
                                                                                            .text,
                                                                                        value: row.closed,
                                                                                    },
                                                                                ],
                                                                                row.total
                                                                            )}
                                                                        </td>
                                                                        <td
                                                                            style={{
                                                                                textAlign:
                                                                                    "center",
                                                                            }}
                                                                        >
                                                                            {/* Completion %
                                                                                (closed / total).
                                                                                The bar was dropped
                                                                                — the Status column's
                                                                                green segment already
                                                                                shows progress. */}
                                                                            <Typography
                                                                                level="body-sm"
                                                                                sx={{
                                                                                    fontWeight: 700,
                                                                                    color: textPrimary,
                                                                                }}
                                                                            >
                                                                                {pct}%
                                                                            </Typography>
                                                                        </td>
                                                                        <td
                                                                            style={{
                                                                                textAlign:
                                                                                    "center",
                                                                            }}
                                                                        >
                                                                            {row.overdue > 0 ? (
                                                                                <Chip
                                                                                    size="sm"
                                                                                    variant="soft"
                                                                                    sx={{
                                                                                        minWidth: 28,
                                                                                        backgroundColor:
                                                                                            "rgba(239,68,68,0.12)",
                                                                                        color: "#ef4444",
                                                                                        fontWeight: 700,
                                                                                    }}
                                                                                >
                                                                                    {row.overdue}
                                                                                </Chip>
                                                                            ) : (
                                                                                <Typography
                                                                                    level="body-xs"
                                                                                    sx={{
                                                                                        color: textMuted,
                                                                                    }}
                                                                                >
                                                                                    -
                                                                                </Typography>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </Table>
                                                </Card>
                                            </Stack>
                                        )}
                                    </Box>
                                </>
                            )}
                        </>
                    )}
                </Stack>
            </Box>

            {/* Task graph for a clicked "Assigned Milestones" card. Lazy —
                keeps @xyflow out of the dashboard chunk (only fetched on
                first open). `highlightAssigneeId` paints the viewer's own
                tasks/subtasks in the focus color. */}
            {diagramMilestone != null &&
                diagramMilestone.taskId != null &&
                diagramMilestone.projectId != null && (
                    <LazyTaskDiagram
                        highlightAssigneeId={focusUserId ?? myself.userId}
                        myself={myself}
                        projectId={Number(diagramMilestone.projectId)}
                        rootLabel={`${diagramMilestone.displayId ?? ""} · ${diagramMilestone.title}`}
                        rootTaskId={Number(diagramMilestone.taskId)}
                        usePM={usePM}
                        useSM={useSM}
                        useTM={useTM}
                        open
                        onClose={() => setDiagramMilestone(null)}
                    />
                )}
        </>
    );
};
