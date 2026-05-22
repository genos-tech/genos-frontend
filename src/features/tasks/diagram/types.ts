import { ScheduleHealth } from "./utils/scheduleStatus";

import { TaskDependencyRef, TaskTableProps } from "../../../types/tasks";
import { Sprint } from "../sprint-milestone/types";

// Editable fields that the node card can mutate. The diagram only
// touches scheduling + title; everything else (status, assignee,
// links, tags) stays in the full TaskPreview surface.
export type EditableFields = {
    title?: string;
    startDate?: string | null;
    dueDate?: string | null;
};

// Data attached to a `task` or `milestone` React Flow node. The card
// component reads `task` for display and calls back into the canvas
// via the handler props; the canvas owns network state.
export type TaskNodeData = {
    task: TaskTableProps;
    /** True for the root node — the milestone/task that opened the diagram. */
    isRoot: boolean;
    /** Mirrors `task.isMilestone`, surfaced for fast lookups during render. */
    isMilestone: boolean;
    /**
     * True when this node represents a task OUTSIDE the visible
     * descendant tree, included only because it has a dependency edge
     * with a visible node. Ghosts are read-only: no rename, no add,
     * no delete; clicking navigates to that task's preview (which
     * may require switching the current project first).
     */
    isExternal: boolean;
    /**
     * Sub-task counters used by the milestone variant. `closed` =
     * descendants with status === "Closed"; `total` excludes the
     * milestone itself.
     */
    closedDescendantCount: number;
    totalDescendantCount: number;
    /** Open-blocker count. Renders a small "blocked" badge when > 0. */
    openBlockerCount: number;
    /**
     * Sprint metadata for milestone nodes. Looked up by the canvas
     * from `useSM.projectSprints` via the milestone's `sprintId`.
     * Always null for non-milestone nodes.
     */
    sprint?: Sprint | null;
    onChange: (patch: EditableFields) => void | Promise<void>;
    onAddSubtask: () => void | Promise<void>;
    onDelete: () => void | Promise<void>;
    onOpenPreview: () => void;
};

// Two visually-distinct edge kinds. `structure` = parent-child (solid
// purple, no arrow). `dependency` = blocker → blocked (dashed amber,
// triangle arrow). The kind drives both the renderer used by React
// Flow and the service called on connect / reconnect / delete.
export type EdgeKind = "structure" | "dependency";

export type StructureEdgeData = {
    kind: "structure";
    /** Parent task id (TaskMaster.task_id). */
    parentTaskId: number;
    /** Child task id (TaskMaster.task_id). */
    childTaskId: number;
};

export type DependencyEdgeData = {
    kind: "dependency";
    /** Server-side TaskDependency.id, so we can DELETE on remove. */
    dependencyId: number;
    /** TaskMaster.task_id of the blocker. */
    blockerTaskId: number;
    /** TaskMaster.task_id of the blocked side. */
    blockedTaskId: number;
};

// Shape returned by `loadTaskGraph`. The deps array is parallel to the
// tasks array — `deps[i]` belongs to `tasks[i]`. (Caller hydrates from
// these into nodes/edges.)
export type TaskGraph = {
    /** Every task in the descendant tree, including the root. */
    tasks: TaskTableProps[];
    /**
     * Tasks that aren't in the descendant tree but are connected to it
     * via at least one dependency edge. Synthesized from
     * `TaskDependencyRef` data — they ARE NOT full TaskTableProps rows
     * from the project; just enough for the ghost card to render
     * (id / displayId / title / status / projectId / projectName / isMilestone).
     */
    externalTasks: TaskTableProps[];
    /** Dependency edges expressed once each: blocker → blocked. */
    dependencyEdges: Array<{
        dependencyId: number;
        blockerTaskId: number;
        blockedTaskId: number;
        /** Status of the OTHER endpoint, kept so the dependency edge
         *  renderer can dim resolved (Closed) blockers. */
        otherStatus: TaskDependencyRef["status"];
    }>;
};

// Handle ids — must stay in sync with the strings hardcoded inside
// TaskNodeCard. Exported so the canvas can disambiguate which kind of
// edge a fresh connection should become.
export const HANDLE = {
    structureTop: "s-top",
    structureBottom: "s-bottom",
    dependencyLeft: "d-left",
    dependencyRight: "d-right",
} as const;

export const isStructureHandle = (id: string | null | undefined) =>
    id === HANDLE.structureTop || id === HANDLE.structureBottom;

export const isDependencyHandle = (id: string | null | undefined) =>
    id === HANDLE.dependencyLeft || id === HANDLE.dependencyRight;

// Rollup published by the canvas after a graph load, consumed by the
// modal header pill. `null` for any field that can't be computed
// (e.g. no descendants, no scheduled tasks). All three are independent
// — a tree with descendants but no dates still shows progress; a tree
// with dates but no children still shows the date span.
export type ScheduleOverview = {
    /** Earliest start_date among visible tasks (ISO YYYY-MM-DD). */
    spanStart: string | null;
    /** Latest due_date among visible tasks (ISO YYYY-MM-DD). */
    spanEnd: string | null;
    /** Inclusive duration in days when both ends are known. */
    spanDays: number | null;
    /** Total non-root descendants of the root node. */
    total: number;
    /** Of those descendants, how many are Closed. */
    closed: number;
    /**
     * Sprint linked to the root milestone (if the root is a milestone
     * with a sprint). Used by the modal header pill to surface
     * "Sprint N · start – end".
     */
    sprint?: Sprint | null;
    /** Tasks past their due date and still open. */
    overdueCount: number;
    /** Tasks open and due within the next 7 days (inclusive of today). */
    dueSoonCount: number;
    /** Tasks with at least one open blocker in the visible set. */
    blockedCount: number;
    /**
     * Milestone-level health verdict (On track / At risk / Behind).
     * Null when the canvas can't compute a window (no sprint and no
     * task dates). When non-null, callers also paint the
     * "expected-by-now" marker on the progress bar at `expectedPct`.
     */
    health: ScheduleHealth | null;
    /**
     * Daily remaining-task series across the milestone window. Filled
     * asynchronously after the graph loads (see `loadMilestoneBurndown`).
     * Null while in flight or when the endpoint returned nothing usable.
     */
    burndown: BurndownPoint[] | null;
};

/** Single point on the burndown trend. `remaining` is open-task count
 *  at end-of-day. Series is chronological. */
export type BurndownPoint = {
    date: string; // YYYY-MM-DD
    remaining: number;
};
