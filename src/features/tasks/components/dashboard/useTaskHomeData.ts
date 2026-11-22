import { useEffect, useMemo, useRef, useState } from "react";
import { useColorScheme } from "@mui/joy/styles";

import { useAuth } from "../../../../context/AuthContext";
import { useTranslation } from "../../../../i18n";
import { useSyncFailure, useTasksSyncFailure } from "../../../../services/syncStatus";
import { TaskTableProps } from "../../../../types/tasks";
import { startOfTodayMs, todayCalendarIso } from "../../../../utils/calendarDate";
import { isDeletedUser } from "../../../../utils/teamRoster";
import { useBriefingToday } from "../../../today/useBriefingToday";
import { loadTeamTasks } from "../../services/loadTeamTasks";
import { Milestone, Sprint } from "../../sprint-milestone/types";
import { selectVisibleMilestones } from "../../sprint-milestone/utils/sortMilestones";
import { sprintBucketOf } from "../../sprint-milestone/utils/sprintBucket";
import { computeAssigneeStats, computeUpNext } from "../../utils/dashboardStats";
import { isDueWithin, isOverdueDate, sprintWindowMs } from "../../utils/dueWindow";
import { deriveEffectiveTasks, EffectiveTask } from "../../utils/effectiveTasks";
import { projectAvatarSrcMap } from "../../utils/projectAvatar";
import { computeTaskWeight } from "../../utils/taskWeight";
import { sortTopWeightRows, TopWeightSortMode } from "../../utils/topWeightSort";
import { useDashboardTab } from "./dashboardTab";
import { buildCapacityMap, isOngoingMilestone, taskUpdatedAtById } from "./taskHomeHelpers";
import type { TaskHomeContentProps } from "./taskHomeTypes";

export const useTaskHomeData = (props: TaskHomeContentProps) => {
    const { useTM, usePM, useSM, myself, useCM } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();
    const projectsSync = useSyncFailure("projects");
    const projectAvatars = useMemo(() => projectAvatarSrcMap(useCM.allChats), [useCM.allChats]);
    // The open project's rows: the cards below are computed from them, so a read that
    // is still running or failed must not draw as "no tasks / nothing assigned" (MIP-1323).
    const tasksSync = useTasksSyncFailure(usePM.currentProject?.projectId);
    const { accessToken } = useAuth();
    const [sprintConfigOpen, setSprintConfigOpen] = useState(false);
    const [sprintManagerOpen, setSprintManagerOpen] = useState(false);
    // The open tab lives in the address (`?view=today`, `?view=agent`, ...): see dashboardTab.ts.
    // With no tab named, Today on the first open of each day, then the one used last.
    const [activeTab, setActiveTab] = useDashboardTab(myself.userId);
    // The Today tab's data (MIP-1005): loaded only while that tab is open.
    const todayView = useBriefingToday(
        accessToken,
        myself.teamId,
        myself.userId,
        activeTab === "today"
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

    const todayIso = todayCalendarIso();
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
        // The sprint's last day is a calendar day: the window runs to the END of it, local time.
        if (selectedSprint)
            return sprintWindowMs(selectedSprint.startDate, selectedSprint.endDate).end;
        return Date.now();
    }, [selectedSprint?.sprintId]);
    const sprintStart = useMemo(() => {
        if (selectedSprint)
            return sprintWindowMs(selectedSprint.startDate, selectedSprint.endDate).start;
        return Date.now() - 14 * 86400000;
    }, [selectedSprint?.sprintId]);
    // ── All-project stats ──
    const allTasks = useTM.allTasks || [];
    const tasksUnread =
        allTasks.length === 0 && (tasksSync.failed || tasksSync.loading || tasksSync.retrying);

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
    // Only the Overall tab shows Team Capacity, so the (up to 500 row) read waits for it: opening
    // the dashboard on Today no longer fetches it. Read once per team, then kept.
    const teamTasksLoadedFor = useRef<string | null>(null);
    const needsTeamTasks = activeTab === "overall";
    useEffect(() => {
        if (!needsTeamTasks || !myself.teamId || !accessToken) return;
        if (teamTasksLoadedFor.current === myself.teamId) return;
        let cancelled = false;
        (async () => {
            const rows: TaskTableProps[] = (await loadTeamTasks(myself, accessToken)) ?? [];
            if (cancelled) return;
            teamTasksLoadedFor.current = myself.teamId;
            setTeamWideTasks(Array.isArray(rows) ? rows : []);
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myself.teamId, accessToken, needsTeamTasks]);

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

    const unassignedLabel = t.tasks.board.unassigned;

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
                name: t.assigneeName || unassignedLabel,
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
    }, [effectiveTasks, sprintStart, now, unassignedLabel]);

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
            const isOverdue = !isClosed && !!tk.dueDate && isOverdueDate(tk.dueDate, today);
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

    const sprintTaskUpdatedAt = useMemo(
        () =>
            taskUpdatedAtById(
                effectiveTasks.filter((t) =>
                    selectedSprint ? t.sprintId === selectedSprint.sprintId : t.sprintId == null
                )
            ),
        [effectiveTasks, selectedSprint?.sprintId]
    );

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
        const projectMap = buildCapacityMap(effectiveTasks, unassignedLabel);
        // Cross-project load per member, from the team-wide task set.
        const teamMap = buildCapacityMap(teamEffectiveTasks, unassignedLabel);

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
    }, [effectiveTasks, teamEffectiveTasks, unassignedLabel]);

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
        // Calendar days: due today is "upcoming", not overdue (MIP-1816).
        const overdue = effectiveTasks.filter((t) => {
            if (t.effectiveStatus === "Closed" || !t.dueDate) return false;
            return isOverdueDate(t.dueDate, today);
        });
        const upcoming = effectiveTasks.filter((t) => {
            if (t.effectiveStatus === "Closed" || !t.dueDate) return false;
            return isDueWithin(t.dueDate, today);
        });
        return { overdue, upcoming };
    }, [effectiveTasks]);

    // ── Milestones tab (MIP-1187) ──
    // The current project's ongoing milestones, in the sidebar's order. Same visibility rule
    // as the sprint section above (`selectVisibleMilestones`), then Closed ones are dropped.
    const ongoingProjectMilestones = useMemo<Milestone[]>(() => {
        const projectId = usePM.currentProject?.projectId;
        if (!projectId) return [];
        return selectVisibleMilestones(
            useSM.projectMilestones[projectId] ?? [],
            useSM.projectSprints[projectId] ?? []
        ).filter(isOngoingMilestone);
    }, [usePM.currentProject?.projectId, useSM.projectMilestones, useSM.projectSprints]);

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
            // A deleted assignee is anonymised, not unassigned — it arrives
            // named "Deleted user" with a `@deleted.invalid` email. Skip it
            // so gone people don't populate the member picker.
            if (isDeletedUser({ name: t.assigneeName, email: t.assigneeEmail })) continue;
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

    // The shared My Tasks / Member's Tasks body (hidden while the rows are unread).
    const showFocusBody =
        !tasksUnread &&
        (activeTab === "mytasks" || (activeTab === "members" && selectedMember != null));

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
    const focusTaskUpdatedAt = useMemo(() => taskUpdatedAtById(focusTasks), [focusTasks]);
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
    // `selectVisibleMilestones` (drops Deleted + Closed-in-ended-sprint)
    // MINUS every Closed milestone (`isOngoingMilestone`). The shared
    // selector keeps Closed milestones with no sprint or in an
    // active/upcoming sprint (the sidebar, filter menu and picker need
    // them), but a finished milestone is not work in progress, so this
    // section drops them (MIP-1004). Pending and Blocked stay. The count
    // chip, the section and the "nothing assigned" card all follow this
    // list, on both My Tasks and Member's Tasks. The selector already sorts,
    // so the cards render in due-date → status → title order.
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
            if (!isOngoingMilestone(m)) return false;
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
    const handleProjectChange = (projectId: number) => {
        const selectedProject = usePM.teamProjects?.find((p) => p.projectId === projectId);
        if (selectedProject && projectId !== usePM.currentProject?.projectId) {
            // An open task preview keeps `isTaskPreviewVisible=true`, which makes
            // useTaskRouting's URL-update effect skip its navigate(). The
            // enforce-match effect then reverts currentProject to the stale
            // `targetUrlProjectId.current`. Close the preview first so the URL
            // (and the routing target) tracks the new project.
            useTM.closeTaskPreview();
            usePM.openProject(selectedProject);
        }
    };

    // ── Shared style helpers ──
    const cardBg = isDark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.7)";
    const cardBorder = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    const textPrimary = isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)";
    const textSecondary = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)";
    const textMuted = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
    const sectionHeaderColor = isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.75)";

    return {
        isDark,
        t,
        projectsSync,
        tasksSync,
        projectAvatars,
        activeTab,
        setActiveTab,
        sprintConfigOpen,
        setSprintConfigOpen,
        sprintManagerOpen,
        setSprintManagerOpen,
        todayView,
        upNextSort,
        setUpNextSort,
        topWeightSort,
        setTopWeightSort,
        projectSprints,
        groupedSprints,
        selectedSprint,
        tasksUnread,
        effectiveTasks,
        stats,
        sprintStats,
        assigneeWorkload,
        tagStats,
        recentTasks,
        sprintTaskIds,
        sprintTaskUpdatedAt,
        sprintMembers,
        priorityBreakdown,
        effortBreakdown,
        teamCapacity,
        maxCapacityTotal,
        topByWeight,
        topByWeightRows,
        overdueAndUpcoming,
        ongoingProjectMilestones,
        myStats,
        selectedMemberId,
        setSelectedMemberId,
        projectMembers,
        selectedMember,
        showFocusBody,
        focusUserId,
        isViewingSelf,
        focusTaskIds,
        focusTaskUpdatedAt,
        focusStats,
        focusUpNext,
        focusAssignedMilestones,
        diagramMilestone,
        setDiagramMilestone,
        sprintNameFor,
        projectCount,
        joinedProjects,
        handleTaskClick,
        handleGoToTable,
        handleGoToBoard,
        handleCreateTask,
        handleProjectChange,
        cardBg,
        cardBorder,
        textPrimary,
        textSecondary,
        textMuted,
        sectionHeaderColor,
    };
};

export type TaskHomeData = ReturnType<typeof useTaskHomeData>;
