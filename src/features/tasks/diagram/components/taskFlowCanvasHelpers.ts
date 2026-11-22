import { Edge, MarkerType, Node } from "@xyflow/react";

import { TaskTableProps } from "../../../../types/tasks";
import { parseCalendarDate } from "../../../../utils/calendarDate";
import { Sprint } from "../../sprint-milestone/types";
import { isOpenBlockerStatus } from "../../utils/blockerStatus";
import {
    effectiveStatusOf,
    isUnderClosedAncestor,
    isUnderDeletedAncestor,
    selectAncestorVerdicts,
} from "../../utils/closedByAncestor";
import {
    DependencyEdgeData,
    EditableFields,
    HANDLE,
    ScheduleOverview,
    StructureEdgeData,
    TaskGraph,
    TaskNodeData,
} from "../types";
import { computeAnchoredExternalIds, computeHiddenTaskIds } from "../utils/computeHiddenTaskIds";
import { computeHealth, getMilestoneWindow } from "../utils/scheduleStatus";

// Hoisted so `computeOverview` and `buildNodesAndEdges` share one
// source of truth — both surfaces need to know "which visible task is
// blocked by how many open blockers" and recomputing it twice would
// drift if the rules changed.
//
// A blocker counts while it reads open: not Closed or Deleted, and not under a Closed or Deleted
// ancestor (MIP-1549, the same rule as the server's auto-Blocked flip). Its reading comes from the
// server when the edge carries one (`blockerStatus`: exact, whatever lies above this tree), else
// from the blocker's row in the graph through the one client implementation of the ancestor rule.
// `otherStatus` is the OTHER endpoint's: the BLOCKED task's for an edge that came from a
// `blocking` list, so it is only the last resort.
export const buildOpenBlockerCountByTask = (graph: TaskGraph): Map<number, number> => {
    const out = new Map<number, number>();
    const verdicts = selectAncestorVerdicts(graph.tasks);
    const byId = new Map(graph.tasks.map((t) => [String(t.id), t]));
    for (const edge of graph.dependencyEdges) {
        const blocker = byId.get(String(edge.blockerTaskId));
        const status =
            edge.blockerStatus ??
            (blocker ? effectiveStatusOf(blocker, verdicts) : edge.otherStatus?.status);
        if (isOpenBlockerStatus(status)) {
            out.set(edge.blockedTaskId, (out.get(edge.blockedTaskId) ?? 0) + 1);
        }
    }
    return out;
};

export const computeOverview = (
    graph: TaskGraph,
    sprintByTaskId: Map<number, Sprint>,
    openBlockerCountByTask: Map<number, number>
): ScheduleOverview => {
    // The tree's real top, resolved by the loader from the parent chain.
    // Taken off the graph rather than from the caller's anchor: the two
    // differ whenever the diagram was opened from a sub-task, and a
    // mismatched pair would count the root as its own descendant.
    const rootTaskId = graph.rootTaskId;
    // Deleted tasks are excluded from every overview figure (progress,
    // span, overdue/due-soon/blocked) so the header matches the graph,
    // which never renders them.
    // Whatever hangs under a Deleted task is gone with it, and whatever hangs under a
    // Closed one counts as Closed however its own row is set (MIP-1382): users do not
    // close every sub-task before the parent, so an "Open" child of a Closed parent must
    // neither hold the progress back nor show up as overdue.
    const verdicts = selectAncestorVerdicts(graph.tasks);
    const liveTasks = graph.tasks.filter(
        (t) => !isDeletedStatus(t.status) && !isUnderDeletedAncestor(t, verdicts)
    );
    // Span: min(start) → max(due) across visible (non-ghost) tasks.
    let spanStart: string | null = null;
    let spanEnd: string | null = null;
    for (const t of liveTasks) {
        if (t.startDate && (spanStart == null || t.startDate < spanStart)) {
            spanStart = t.startDate;
        }
        if (t.dueDate && (spanEnd == null || t.dueDate > spanEnd)) {
            spanEnd = t.dueDate;
        }
    }
    let spanDays: number | null = null;
    if (spanStart && spanEnd) {
        const ms = new Date(spanEnd).getTime() - new Date(spanStart).getTime();
        spanDays = Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)) + 1);
    }
    // Progress: descendants of the root task only (excludes root itself).
    let total = 0;
    let closed = 0;
    // Aggregate counts: overdue / due-soon / blocked. Computed inline
    // so we touch each task once. `today` and `today+7d` cutoffs are
    // ISO strings so we can compare lexically (YYYY-MM-DD sorts as
    // calendar order, dodging timezone churn).
    const today = todayIsoLocal();
    const dueSoonCutoff = addDaysIso(today, 7);
    let overdueCount = 0;
    let dueSoonCount = 0;
    let blockedCount = 0;
    for (const t of liveTasks) {
        if (t.id == null) continue;
        const taskId = Number(t.id);
        const isClosed =
            (t.status ?? "").toLowerCase() === "closed" || isUnderClosedAncestor(t, verdicts);
        if (taskId !== rootTaskId) {
            total += 1;
            if (isClosed) closed += 1;
        }
        if (!isClosed && t.dueDate) {
            if (t.dueDate < today) overdueCount += 1;
            else if (t.dueDate <= dueSoonCutoff) dueSoonCount += 1;
        }
        if ((openBlockerCountByTask.get(taskId) ?? 0) > 0) blockedCount += 1;
    }
    // Pick up the sprint linked to the root task. If the root isn't a
    // milestone (or has no sprint), this is null.
    const sprint = sprintByTaskId.get(rootTaskId) ?? null;
    const window = getMilestoneWindow({
        sprint: sprint ? { startDate: sprint.startDate, endDate: sprint.endDate } : null,
        spanStart,
        spanEnd,
    });
    const health = computeHealth(window, total, closed);
    return {
        spanStart,
        spanEnd,
        spanDays,
        total,
        closed,
        sprint,
        overdueCount,
        dueSoonCount,
        blockedCount,
        health,
        // Filled in asynchronously by the burndown fetch. Null is the
        // "loading" / "nothing yet" sentinel — caller handles both.
        burndown: null,
    };
};

// Exported for tests: the ghost-visibility rule is only meaningful in
// terms of the nodes actually produced, so `DiagramHiddenTasks` drives
// this rather than asserting on the helper alone.
export const buildNodesAndEdges = (
    graph: TaskGraph,
    // Task id of the preview pane the user opened the diagram from
    // (or null when none). Module-scope here can't read `useTM` —
    // the caller passes the snapshot at assembly time.
    currentPreviewTaskId: number | null,
    sprintByTaskId: Map<number, Sprint>,
    openBlockerCountByTask: Map<number, number>,
    diagramProjectName: string | null,
    handlers: {
        onChange: (taskId: number, patch: EditableFields) => void | Promise<void | boolean>;
        onAddSubtask: (parentTaskId: number) => void | Promise<void>;
        onDelete: (taskId: number) => void | Promise<void>;
        onOpenPreview: (taskId: number) => void;
    },
    hideClosed: boolean,
    // When set, task nodes whose assignee matches get the "assigned to
    // viewer" focus color. Null (the default everywhere but the dashboard's
    // Assigned Milestones section) leaves every node un-highlighted.
    highlightAssigneeId: number | string | null,
    // Ids created in the current diagram session — their nodes get the
    // "newly created" accent. Defaulted so test callers (and any future
    // caller that doesn't track creations) can omit it.
    newlyCreatedTaskIds: Set<number> = new Set(),
    untitledLabel = "Untitled"
): { nodes: Node[]; edges: Edge[]; titleByTaskId: Map<number, string> } => {
    // The tree's real top, resolved by the loader (see `TaskGraph`).
    // `isRoot` has to agree with the set of tasks actually in the graph,
    // and only the loader knows which chain it walked.
    const rootTaskId = graph.rootTaskId;
    // Descendant counts power the milestone progress bar.
    const descendantCounts = computeDescendantCounts(graph.tasks);

    // Title lookup used by edge tooltips (passed into edge data so
    // each edge can render "X blocks Y" / "Parent → Child" without
    // re-querying state during render).
    const titleByTaskId = new Map<number, string>();
    for (const t of [...graph.tasks, ...graph.externalTasks]) {
        if (t.id == null) continue;
        titleByTaskId.set(Number(t.id), t.title || untitledLabel);
    }

    const makeNode = (task: TaskTableProps, isExternal: boolean): Node => {
        const id = String(task.id);
        const taskId = Number(task.id);
        const isMilestone = task.isMilestone === true && !isExternal;
        const counts = descendantCounts.get(taskId) ?? { total: 0, closed: 0 };
        // Project name: ghosts ship their own (stashed on the synthesised
        // row by `refToGhostTask`); internal tasks fall back to the
        // diagram's project name since every internal row is from that
        // same project.
        const ghostProjectName = (task as { projectName?: string | null }).projectName ?? null;
        const projectName = isExternal ? ghostProjectName : diagramProjectName;
        const data: TaskNodeData = {
            task,
            isRoot: taskId === rootTaskId,
            // External (ghost) tasks live outside the visible tree and
            // can't be "the one you came from" by definition — skip the
            // accent treatment for them even if the id happens to match.
            isCurrentPreview:
                !isExternal && currentPreviewTaskId != null && taskId === currentPreviewTaskId,
            // "Just created here" accent. Ghosts excluded (they can't be
            // created from this diagram).
            isNewlyCreated: !isExternal && newlyCreatedTaskIds.has(taskId),
            // Focus color for the viewer's own tasks — ghosts excluded (they
            // live in another tree and can't be "your task here").
            isAssignedToViewer:
                !isExternal &&
                highlightAssigneeId != null &&
                task.assigneeId != null &&
                String(task.assigneeId) === String(highlightAssigneeId),
            // Other members' tasks in highlight mode → dimmed + read-only (like
            // a ghost). Root milestone and unassigned tasks stay normal.
            isDimmed:
                !isExternal &&
                taskId !== rootTaskId &&
                !isMilestone &&
                highlightAssigneeId != null &&
                task.assigneeId != null &&
                String(task.assigneeId) !== String(highlightAssigneeId),
            isMilestone,
            isExternal,
            openBlockerCount: openBlockerCountByTask.get(taskId) ?? 0,
            closedDescendantCount: counts.closed,
            totalDescendantCount: counts.total,
            sprint: isMilestone ? (sprintByTaskId.get(taskId) ?? null) : null,
            projectName,
            onChange: async (patch) => {
                await handlers.onChange(taskId, patch);
            },
            onAddSubtask: () => handlers.onAddSubtask(taskId),
            onDelete: () => handlers.onDelete(taskId),
            onOpenPreview: () => handlers.onOpenPreview(taskId),
        };
        return {
            id,
            // External milestone-backing tasks still render as a
            // regular ghost card; the milestone variant doesn't
            // currently have a sensible "ghost" treatment so we use
            // the task variant which already handles isExternal.
            type: isMilestone ? "milestone" : "task",
            position: { x: 0, y: 0 },
            data: data as unknown as Record<string, unknown>,
            selectable: true,
            draggable: true,
        };
    };

    // Hidden-task set for the "Hide closed tasks" toggle (+ always-hidden
    // Deleted rows). Closing a parent collapses its WHOLE branch: a Closed
    // task is hidden together with its entire subtree (open descendants
    // included), so hiding closed work never detaches an open subtask —
    // see `computeHiddenTaskIds` for the full rule and its unit tests.
    const hiddenTaskIds = computeHiddenTaskIds(graph.tasks, rootTaskId, hideClosed);
    const visibleInternalTasks = graph.tasks.filter(
        (t) => t.id != null && !hiddenTaskIds.has(Number(t.id))
    );
    // Ghosts follow the tasks they were drawn for. Dropping a hidden
    // task's dependency EDGES (further down, via the rendered-id set) was
    // never enough on its own: the blocker CARD stayed behind, stranded
    // in open space with no line to anything. Hiding a closed task now
    // takes its external blockers with it, and showing closed tasks
    // brings them back.
    //
    // Deleted ghosts are dropped outright, toggle or not: they're
    // synthesised from TaskDependencyRef, which carries status in the
    // same shape as internal rows, so the same predicate works.
    const visibleInternalIds = new Set(visibleInternalTasks.map((t) => Number(t.id)));
    const anchoredExternalIds = computeAnchoredExternalIds(
        graph.dependencyEdges,
        visibleInternalIds
    );
    const visibleExternalTasks = graph.externalTasks.filter(
        (t) => !isDeletedStatus(t.status) && anchoredExternalIds.has(Number(t.id))
    );

    // Id order, so the node array (and so the paint order) is the same every
    // time. Positions don't depend on it: `layoutDiagramNodes` places every card
    // from the parent and dependency edges (see `layoutDiagram.ts`).
    const sortedInternalTasks = [...visibleInternalTasks].sort(
        (a, b) => Number(a.id) - Number(b.id)
    );
    const sortedExternalTasks = [...visibleExternalTasks].sort(
        (a, b) => Number(a.id) - Number(b.id)
    );

    const nodes: Node[] = [
        ...sortedInternalTasks.map((t) => makeNode(t, false)),
        ...sortedExternalTasks.map((t) => makeNode(t, true)),
    ];

    // Structure edges from parent_task_id (visible-tree only —
    // ghosts have no structure edges into the visible set). Iterates
    // the already-filtered list so an edge can't survive when either
    // endpoint was dropped. A hidden Closed parent takes its whole
    // subtree with it (see `computeHiddenTaskIds`), so it never has a
    // visible child; the only way a child's parent is hidden here is the
    // pre-existing Deleted-mid-path case, where the child falls back to a
    // root-level card in the layout.
    const structureEdges: Edge[] = [];
    const visibleIdSet = new Set(sortedInternalTasks.map((t) => Number(t.id)));
    for (const task of sortedInternalTasks) {
        const taskId = Number(task.id);
        const parentId = task.parentTaskId == null ? null : Number(task.parentTaskId);
        if (parentId == null || !visibleIdSet.has(parentId)) continue;
        if (parentId === taskId) continue;
        const data: StructureEdgeData = {
            kind: "structure",
            parentTaskId: parentId,
            childTaskId: taskId,
        };
        structureEdges.push({
            id: `s-${parentId}-${taskId}`,
            source: String(parentId),
            sourceHandle: HANDLE.structureBottom,
            target: String(taskId),
            targetHandle: HANDLE.structureTop,
            type: "structure",
            data: {
                ...data,
                sourceTitle: titleByTaskId.get(parentId) ?? null,
                targetTitle: titleByTaskId.get(taskId) ?? null,
            } as unknown as Record<string, unknown>,
        });
    }

    // Dependency edges — keep ALL of them. With ghost nodes in the
    // node array, both endpoints always resolve.
    const allRenderedIds = new Set(nodes.map((n) => Number(n.id)));
    const dependencyEdges: Edge[] = graph.dependencyEdges
        .filter((d) => allRenderedIds.has(d.blockerTaskId) && allRenderedIds.has(d.blockedTaskId))
        .map((d) => {
            const data: DependencyEdgeData = {
                kind: "dependency",
                dependencyId: d.dependencyId,
                blockerTaskId: d.blockerTaskId,
                blockedTaskId: d.blockedTaskId,
            };
            return {
                id: `d-${d.dependencyId}`,
                source: String(d.blockerTaskId),
                sourceHandle: HANDLE.dependencyRight,
                target: String(d.blockedTaskId),
                targetHandle: HANDLE.dependencyLeft,
                type: "dependency",
                data: {
                    ...data,
                    sourceTitle: titleByTaskId.get(d.blockerTaskId) ?? null,
                    targetTitle: titleByTaskId.get(d.blockedTaskId) ?? null,
                } as unknown as Record<string, unknown>,
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: "#f97316",
                    width: 16,
                    height: 16,
                },
            };
        });

    return {
        nodes,
        edges: [...structureEdges, ...dependencyEdges],
        titleByTaskId,
    };
};

export const todayIsoLocal = (): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

// `iso` is a calendar day: a UTC-midnight `new Date(iso)` is the day before west of UTC (MIP-1811).
export const addDaysIso = (iso: string, days: number): string => {
    const d = parseCalendarDate(iso) ?? new Date();
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

// Soft-deleted rows the rest of the app never exposes (table, sidebar,
// search) and which the canvas always hides. Shared by every stats
// helper so a Deleted task never leaks into a count or a span. Mirrors
// the local predicate inside `buildNodesAndEdges`.
export const isDeletedStatus = (status: string | null | undefined): boolean =>
    (status ?? "").toLowerCase() === "deleted";

// Count tasks per ancestor — used for the milestone progress bar
// (closed descendants / total descendants). BFS down the
// parent_task_id chain so a milestone with sub-sub-tasks still
// reports the full closed-count, not just direct children.
export const computeDescendantCounts = (
    tasks: TaskTableProps[]
): Map<number, { total: number; closed: number }> => {
    const byParent = new Map<number, TaskTableProps[]>();
    for (const t of tasks) {
        const pid = t.parentTaskId == null ? null : Number(t.parentTaskId);
        if (pid == null) continue;
        const bucket = byParent.get(pid) ?? [];
        bucket.push(t);
        byParent.set(pid, bucket);
    }
    const verdicts = selectAncestorVerdicts(tasks);
    const counts = new Map<number, { total: number; closed: number }>();
    const walk = (rootId: number): { total: number; closed: number } => {
        const cached = counts.get(rootId);
        if (cached) return cached;
        let total = 0;
        let closed = 0;
        const children = byParent.get(rootId) ?? [];
        for (const child of children) {
            if (child.id == null) continue;
            // Skip Deleted sub-tasks (and their now-deleted subtree) so a
            // milestone node's "closed / total" badge matches the header
            // overview, which also excludes them.
            if (isDeletedStatus(child.status)) continue;
            total += 1;
            // A child under a Closed task is Closed too, whatever its own row says
            // (MIP-1382), so the badge agrees with the header overview.
            if (
                (child.status ?? "").toLowerCase() === "closed" ||
                isUnderClosedAncestor(child, verdicts)
            )
                closed += 1;
            const sub = walk(Number(child.id));
            total += sub.total;
            closed += sub.closed;
        }
        const result = { total, closed };
        counts.set(rootId, result);
        return result;
    };
    for (const t of tasks) {
        if (t.id == null) continue;
        walk(Number(t.id));
    }
    return counts;
};
