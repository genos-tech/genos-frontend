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
    status?: string;
    statusCode?: number | null;
};

// Data attached to a `task` or `milestone` React Flow node. The card
// component reads `task` for display and calls back into the canvas
// via the handler props; the canvas owns network state.
export type TaskNodeData = {
    task: TaskTableProps;
    /** True for the root node — the milestone/task that opened the diagram. */
    isRoot: boolean;
    /**
     * True when this node matches `useTM.currentPreviewTaskId` — i.e.
     * the task whose preview pane the user opened the diagram from.
     * Used by the card to paint an "anchor" accent so the user can spot
     * "this is the one I came from" in a tree of many sibling tasks.
     * Distinct from `isRoot`: when the previewed task is a sub-task,
     * the diagram's root is the chain top (a milestone or parent), so
     * `isRoot` and `isCurrentPreview` light up different cards.
     */
    isCurrentPreview: boolean;
    /**
     * True when this node's task was created in THIS diagram session via the
     * card's "add sub-task / add task under milestone" button. Drives a
     * distinct (cyan) accent — separate from the purple `isCurrentPreview`
     * anchor and the amber `isAssignedToViewer` focus — so the user can
     * instantly spot the card they just added in a tree of many siblings.
     * Only ever set on freshly-created nodes; a graph reload from the server
     * keeps the highlight because the canvas tracks the created ids for the
     * lifetime of the open diagram.
     */
    isNewlyCreated?: boolean;
    /**
     * True when this node's task is assigned to the "viewer" the diagram was
     * opened to highlight (see `ModalTaskDiagram.highlightAssigneeId`). Opt-in:
     * only the dashboard's "Assigned Milestones" section sets it, so every
     * other diagram surface leaves it false. Drives a distinct focus color on
     * the card so the viewer can spot their own tasks/subtasks in the tree.
     */
    isAssignedToViewer?: boolean;
    /**
     * True for a task assigned to someone OTHER than the highlight viewer
     * (see `ModalTaskDiagram.highlightAssigneeId`). Opt-in like
     * `isAssignedToViewer`: set only in the dashboard's highlight mode. Such
     * nodes render dimmed + read-only — the same treatment as an external
     * ghost — so the viewer's own tasks stand out and other members' work
     * can't be edited from this focused view. Unassigned tasks and the root
     * milestone are never dimmed.
     */
    isDimmed?: boolean;
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
    /**
     * Project name shown in the card footer. For internal nodes the
     * canvas fills this from `usePM.currentProject.projectName` (all
     * internal tasks share the diagram's project). For external
     * ghosts it carries the ref's `projectName` so the card reads
     * "this blocker lives in PROJECT-X".
     */
    projectName?: string | null;
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
    /**
     * The task the tree is actually rooted at: the top of the parent
     * chain above the anchor the caller asked for, resolved from the
     * fetched rows rather than read off the stored `rootTaskId` column
     * (which can lag a milestone move). Consumers key "is root" and the
     * rollups off THIS, not off what they passed in — opening the
     * diagram from a sub-task passes that sub-task, and the root is its
     * milestone or parent.
     */
    rootTaskId: number;
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
