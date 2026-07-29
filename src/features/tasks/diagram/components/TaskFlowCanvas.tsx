import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Alert, Box, CircularProgress, IconButton, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import {
    addEdge,
    applyEdgeChanges,
    applyNodeChanges,
    Background,
    BackgroundVariant,
    Connection,
    Controls,
    Edge,
    EdgeChange,
    MarkerType,
    MiniMap,
    Node,
    NodeChange,
    ReactFlow,
    ReactFlowProvider,
    reconnectEdge,
    useNodesInitialized,
    useReactFlow,
} from "@xyflow/react";

import { useAuth } from "../../../../context/AuthContext";
import { invalidateCachedFullTask } from "../../../../db/services/task-full.service";
import { useUrlLinkModal } from "../../../../hooks/common/UrlLinkModalContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useColorTheme } from "../../../../theme/ColorThemeProvider";
import { purplePalette } from "../../../../theme/purplePalette";
import { UserProps } from "../../../../types/admin";
import { TaskTableProps } from "../../../../types/tasks";
import { addTask } from "../../services/addTask";
import { createTaskDependency } from "../../services/createTaskDependency";
import { deleteTaskDependency } from "../../services/deleteTaskDependency";
import { onTaskTouched } from "../../services/taskEvents";
import { Sprint } from "../../sprint-milestone/types";
import { DIAGRAM_LIFT, URL_LINK_MODAL_DEFAULT_Z, useDiagramZIndex } from "../diagramZIndex";
import { useDagreLayout } from "../hooks/useDagreLayout";
import { createDiagramSubtask } from "../services/createDiagramSubtask";
import { deleteDiagramTask } from "../services/deleteDiagramTask";
import { loadMilestoneBurndown } from "../services/loadMilestoneBurndown";
import { loadTaskGraph } from "../services/loadTaskGraph";
import { patchTaskFields } from "../services/patchTaskFields";
import {
    DependencyEdgeData,
    EditableFields,
    HANDLE,
    isDependencyHandle,
    isStructureHandle,
    ScheduleOverview,
    StructureEdgeData,
    TaskGraph,
    TaskNodeData,
} from "../types";
import { computeAnchoredExternalIds, computeHiddenTaskIds } from "../utils/computeHiddenTaskIds";
import { computeHealth, getMilestoneWindow } from "../utils/scheduleStatus";
import { sortDiagramTasks } from "../utils/sortDiagramTasks";
import { DependencyEdge } from "./DependencyEdge";
import { DiagramLegend } from "./DiagramLegend";
import { MilestoneNodeCard } from "./MilestoneNodeCard";
import { ParentChildEdge } from "./ParentChildEdge";
import { TaskNodeCard } from "./TaskNodeCard";

type Props = {
    myself: UserProps;
    rootTaskId: number;
    projectId: number;
    useTM: TaskManagementState;
    /** Needed for cross-project navigation when the user clicks a
     *  ghost (external) node in another project. */
    usePM: ProjectManagementState;
    /** Optional. When provided, the canvas looks up sprint info per
     *  milestone-backing-task and surfaces it on the milestone card +
     *  the modal header overview. */
    useSM?: SprintMilestoneManagementState;
    /** Published after every graph load so the modal header can
     *  render its "Schedule overview" pill. */
    onOverviewChange?: (overview: ScheduleOverview) => void;
    onCloseModal: () => void;
    /** When true, the canvas drops every Closed task (except the root,
     *  which stays so the focal point doesn't vanish) and any edge
     *  touching one. Layout re-runs automatically when this flips. */
    hideClosed: boolean;
    /** Optional. When set, task nodes whose `assigneeId` matches get a
     *  distinct focus color so the viewer can spot their own tasks in the
     *  tree. Opt-in — only the dashboard's "Assigned Milestones" section
     *  passes it; every other diagram surface leaves nodes un-highlighted. */
    highlightAssigneeId?: number | string | null;
};

// Hoisted so `computeOverview` and `buildNodesAndEdges` share one
// source of truth — both surfaces need to know "which visible task is
// blocked by how many open blockers" and recomputing it twice would
// drift if the rules changed.
const buildOpenBlockerCountByTask = (graph: TaskGraph): Map<number, number> => {
    const out = new Map<number, number>();
    for (const edge of graph.dependencyEdges) {
        const blockerStatus = edge.otherStatus?.status?.toLowerCase?.() ?? "";
        if (blockerStatus !== "closed") {
            out.set(edge.blockedTaskId, (out.get(edge.blockedTaskId) ?? 0) + 1);
        }
    }
    return out;
};

const todayIsoLocal = (): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

const addDaysIso = (iso: string, days: number): string => {
    const d = new Date(iso);
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
const isDeletedStatus = (status: string | null | undefined): boolean =>
    (status ?? "").toLowerCase() === "deleted";

const computeOverview = (
    graph: TaskGraph,
    rootTaskId: number,
    sprintByTaskId: Map<number, Sprint>,
    openBlockerCountByTask: Map<number, number>
): ScheduleOverview => {
    // Deleted tasks are excluded from every overview figure (progress,
    // span, overdue/due-soon/blocked) so the header matches the graph,
    // which never renders them.
    const liveTasks = graph.tasks.filter((t) => !isDeletedStatus(t.status));
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
        const isClosed = (t.status ?? "").toLowerCase() === "closed";
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

/** Build `taskId → Sprint` for every milestone-backing task in the
 *  visible set that has a `sprintId`. Empty map when `useSM` isn't
 *  available (e.g. diagram opened from a surface that doesn't carry
 *  the sprint hook). */
const buildSprintLookup = (
    graph: TaskGraph,
    useSM: SprintMilestoneManagementState | undefined,
    projectId: number
): Map<number, Sprint> => {
    const out = new Map<number, Sprint>();
    if (!useSM) return out;
    const sprintsForProject = useSM.projectSprints[projectId] ?? [];
    if (sprintsForProject.length === 0) return out;
    const sprintById = new Map(sprintsForProject.map((s) => [s.sprintId, s]));
    for (const t of graph.tasks) {
        if (!t.isMilestone) continue;
        const sprintId = t.sprintId ?? null;
        if (sprintId == null) continue;
        const taskId = t.id == null ? null : Number(t.id);
        if (taskId == null) continue;
        const sprint = sprintById.get(sprintId);
        if (sprint) out.set(taskId, sprint);
    }
    return out;
};

// Stable node/edge type registries. Defined at module scope so React
// Flow doesn't re-register on every render (which it warns about).
const nodeTypes = {
    task: TaskNodeCard,
    milestone: MilestoneNodeCard,
};

const edgeTypes = {
    structure: ParentChildEdge,
    dependency: DependencyEdge,
};

// Count tasks per ancestor — used for the milestone progress bar
// (closed descendants / total descendants). BFS down the
// parent_task_id chain so a milestone with sub-sub-tasks still
// reports the full closed-count, not just direct children.
const computeDescendantCounts = (
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
            if ((child.status ?? "").toLowerCase() === "closed") closed += 1;
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

// Exported for tests: the ghost-visibility rule is only meaningful in
// terms of the nodes actually produced, so `DiagramHiddenTasks` drives
// this rather than asserting on the helper alone.
export const buildNodesAndEdges = (
    graph: TaskGraph,
    rootTaskId: number,
    // Task id of the preview pane the user opened the diagram from
    // (or null when none). Module-scope here can't read `useTM` —
    // the caller passes the snapshot at assembly time.
    currentPreviewTaskId: number | null,
    sprintByTaskId: Map<number, Sprint>,
    openBlockerCountByTask: Map<number, number>,
    diagramProjectName: string | null,
    handlers: {
        onChange: (taskId: number, patch: EditableFields) => void | Promise<void>;
        onAddSubtask: (parentTaskId: number) => void | Promise<void>;
        onDelete: (taskId: number) => void | Promise<void>;
        onOpenPreview: (taskId: number) => void;
    },
    hideClosed: boolean,
    // When set, task nodes whose assignee matches get the "assigned to
    // viewer" focus color. Null (the default everywhere but the dashboard's
    // Assigned Milestones section) leaves every node un-highlighted.
    highlightAssigneeId: number | string | null
): { nodes: Node[]; edges: Edge[]; titleByTaskId: Map<number, string> } => {
    // Descendant counts power the milestone progress bar.
    const descendantCounts = computeDescendantCounts(graph.tasks);

    // Title lookup used by edge tooltips (passed into edge data so
    // each edge can render "X blocks Y" / "Parent → Child" without
    // re-querying state during render).
    const titleByTaskId = new Map<number, string>();
    for (const t of [...graph.tasks, ...graph.externalTasks]) {
        if (t.id == null) continue;
        titleByTaskId.set(Number(t.id), t.title || "Untitled");
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
            onChange: (patch) => handlers.onChange(taskId, patch),
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

    // Pre-sort so each parent's sibling columns render ordered by task
    // id and so blocker/blocked sibling pairs sit adjacent (blocker
    // left of blocked). sortDiagramTasks returns each sibling group
    // in REVERSE of the desired visual order to compensate for dagre
    // v3's order phase, which places the LAST-added successor at the
    // leftmost column. The structure-edges loop below walks this
    // array verbatim when calling setEdge, so the desired-leftmost
    // sibling is added last and ends up on the left.
    const sortedInternalTasks = sortDiagramTasks(visibleInternalTasks, graph.dependencyEdges);
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
    // root-level sibling in dagre.
    const structureEdges: Edge[] = [];
    const visibleIdSet = new Set(sortedInternalTasks.map((t) => Number(t.id)));
    // Iterate the SORTED list so setEdge call order reflects the
    // desired sibling column ordering (see sortDiagramTasks for the
    // dagre-quirk reversal).
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

const CanvasInner = ({
    myself,
    rootTaskId,
    projectId,
    useTM,
    usePM,
    useSM,
    onOverviewChange,
    onCloseModal,
    hideClosed,
    highlightAssigneeId,
}: Props) => {
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const P = isDark ? purplePalette.dark : purplePalette.light;
    // React Flow's Background and MiniMap write their `color` / `nodeColor`
    // straight into SVG presentation attributes, which never resolve a
    // `var()`. These two need the theme's RAW values — the documented
    // exception to going through `purplePalette`.
    const { raw: rawTheme } = useColorTheme();
    const rawAccent = isDark ? rawTheme.dark.accent : rawTheme.light.accent;
    const { fitView } = useReactFlow();
    const dagreLayout = useDagreLayout();
    // True once React Flow has measured every node (real dimensions). We
    // gate viewport fitting on this — see `pendingFitRef` and the fit
    // effect below for why fitting before measurement corrupts the view.
    const nodesInitialized = useNodesInitialized();
    // Global URL-link modal (the same overlay chat links open). Used by
    // the node cards' "Open task / milestone" buttons so the target
    // opens ABOVE the diagram instead of tearing the diagram down.
    // Null outside the provider (signin pages) — falls back to the
    // legacy close-diagram-and-open-preview path.
    const urlLinkModal = useUrlLinkModal();
    // Effective z of the enclosing diagram dialog (see diagramZIndex.ts)
    // — node-click previews must open ABOVE it, whatever surface hosts it.
    const diagramZIndex = useDiagramZIndex();

    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Cached reference to the most recent loaded graph; used by
    // mutation handlers that need to look up `parentTaskId` of a
    // node we're about to re-parent (so the optimistic update
    // matches the server state).
    const graphRef = useRef<TaskGraph | null>(null);

    // Set by `assembleAndLayout` when a fit is wanted (initial load /
    // hide-closed toggle, but NOT in-place edits). Consumed by the fit
    // effect below once the nodes are measured. Deferring like this is
    // what prevents the NaN-viewport bug — see that effect.
    const pendingFitRef = useRef(false);

    const refresh = useCallback(async () => {
        setError(null);
        const graph = await loadTaskGraph(myself, projectId, rootTaskId, accessToken);
        if (!graph) {
            setError("Couldn't load the task graph.");
            setLoading(false);
            return;
        }
        graphRef.current = graph;
        // Notify the modal so its header pill can update. Computed
        // here (one source of truth) instead of in the modal so the
        // modal stays a thin shell. Burndown trails behind the synch-
        // ronous overview: we publish the cheap derivations first so
        // the chip + counts paint immediately, then patch in the chart
        // data after the (separately fetched) activity rollup lands.
        if (onOverviewChange) {
            const sprintByTaskId = buildSprintLookup(graph, useSM, projectId);
            const blockerMap = buildOpenBlockerCountByTask(graph);
            const overview = computeOverview(graph, rootTaskId, sprintByTaskId, blockerMap);
            onOverviewChange(overview);

            // Fire-and-forget burndown fetch. Uses the same window the
            // health verdict came from (sprint dates when set, else
            // task span). We don't await — the rest of the canvas
            // renders immediately and the sparkline appears once data
            // arrives.
            const window = overview.health
                ? overview.sprint
                    ? {
                          start: overview.sprint.startDate,
                          end: overview.sprint.endDate,
                      }
                    : overview.spanStart && overview.spanEnd
                      ? { start: overview.spanStart, end: overview.spanEnd }
                      : null
                : null;
            if (window) {
                const taskIds = graph.tasks
                    .map((t) => (t.id == null ? null : Number(t.id)))
                    .filter((n): n is number => n != null);
                void loadMilestoneBurndown(taskIds, window.start, window.end, accessToken).then(
                    (burndown) => {
                        if (burndown != null) {
                            onOverviewChange({ ...overview, burndown });
                        }
                    }
                );
            }
        }
        return graph;
    }, [myself, projectId, rootTaskId, accessToken, onOverviewChange, useSM]);

    // CRUD handlers — defined before `assemble` so the assembly can
    // capture them in node data.
    const handleChange = useCallback(
        async (taskId: number, patch: EditableFields) => {
            const res = await patchTaskFields(
                taskId,
                {
                    ...(patch.title !== undefined ? { title: patch.title } : {}),
                    ...(patch.startDate !== undefined ? { start_date: patch.startDate } : {}),
                    ...(patch.dueDate !== undefined ? { due_date: patch.dueDate } : {}),
                    ...(patch.status !== undefined ? { status: patch.status } : {}),
                    ...(patch.statusCode !== undefined ? { status_code: patch.statusCode } : {}),
                },
                accessToken
            );
            if (!res.ok) {
                setError(res.error ?? "Update failed.");
                return;
            }
            // Build the merged row once and broadcast it to every cache
            // layer the rest of the app reads from. Previously the
            // diagram only updated its own node state, so closing the
            // modal exposed stale data in the task table + preview
            // until a hard refresh re-fetched from backend.
            const buildMergedTask = (prev: TaskTableProps): TaskTableProps => ({
                ...prev,
                ...(patch.title !== undefined ? { title: patch.title } : {}),
                ...(patch.startDate !== undefined ? { startDate: patch.startDate } : {}),
                ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
                ...(patch.status !== undefined ? { status: patch.status } : {}),
            });

            // 1. Reflect immediately in the visible card.
            setNodes((prev) =>
                prev.map((n) => {
                    if (n.id !== String(taskId)) return n;
                    const oldData = n.data as unknown as TaskNodeData;
                    const merged = buildMergedTask(oldData.task);
                    return {
                        ...n,
                        data: { ...oldData, task: merged } as unknown as Record<string, unknown>,
                    };
                })
            );

            // 2. Mirror into useTM.allTasks (drives the project table /
            //    sidebar) and the IDB cache (survives page refresh).
            //    Without these writes, closing the modal would surface
            //    stale title / dates / status in every other surface
            //    until a full reload happened.
            let mergedForCache: TaskTableProps | null = null;
            useTM.setAllTasks((prev) =>
                prev.map((t) => {
                    if (t.id !== String(taskId)) return t;
                    const merged = buildMergedTask(t);
                    mergedForCache = merged;
                    return merged;
                })
            );
            // Fallback: if the row wasn't in allTasks (e.g. user opened
            // the diagram before the project task list loaded), reach
            // into the graph's snapshot to mint a row for IDB.
            if (mergedForCache == null) {
                const fromGraph = graphRef.current?.tasks.find((t) => Number(t.id) === taskId);
                if (fromGraph) mergedForCache = buildMergedTask(fromGraph);
            }
            if (mergedForCache) {
                void addTask(mergedForCache);
            }

            // 3. Invalidate the full-task IDB cache for this id.
            //    `loadSpecificTask` returns the cached TaskProps when
            //    present, so without this invalidation the very next
            //    preview-open would replay the pre-edit values from
            //    cache — that was the root cause of "diagram edits
            //    don't show up in the preview until full page refresh".
            void invalidateCachedFullTask(taskId);

            // 4. If the edited task IS the currently-previewed one,
            //    actively re-fetch + re-set `currentPreviewTask` so the
            //    open preview pane updates immediately (the cache
            //    invalidation above guarantees `loadSpecificTask` hits
            //    the backend this time). For a non-previewed edit, the
            //    invalidation alone is enough: the next time the user
            //    opens that task's preview, the cache-miss forces a
            //    backend fetch and they see the fresh values.
            if (useTM.currentPreviewTaskId === taskId) {
                void useTM.loadUpdatedTask(projectId);
            }
        },
        [accessToken, projectId, useTM]
    );

    const handleAddSubtask = useCallback(
        async (parentTaskId: number) => {
            // Title varies by parent kind: a milestone's child is just
            // "a task in this milestone" to the user, while a regular
            // task's child IS a sub-task. Look up the parent in the
            // last-loaded graph rather than re-querying.
            const parent = graphRef.current?.tasks.find((t) => Number(t.id) === parentTaskId);
            const defaultTitle = parent?.isMilestone === true ? "New task" : "New sub-task";
            const res = await createDiagramSubtask(
                myself,
                projectId,
                parentTaskId,
                accessToken,
                defaultTitle
            );
            if (!res.ok) {
                setError(res.error);
                return;
            }

            // Optimistic insert. Previously we awaited a full graph reload
            // (getProjectTasks + a dependency batch) before the new node
            // appeared — two extra round-trips that made "add subtask" feel
            // like a multi-second wait. A brand-new leaf task is fully
            // deterministic: we already know its id, real display id (from
            // the create response), title, Open status, owner, parent edge,
            // and it inherits the parent's milestone/sprint chain (the same
            // bridge the server applies). So we synthesise its row, drop it
            // straight into the cached graph, and re-layout WITHOUT
            // re-fitting the camera (`fit: false`) so the node shows up
            // instantly right under the parent the user just clicked. No
            // background graph reload is needed — skipping it also avoids
            // clobbering an inline rename that races the reload.
            // `loadUpdatedTask` still syncs the main task table/sidebar so
            // the row is there when the diagram closes.
            const current = graphRef.current;
            if (current && parent) {
                const now = new Date().toISOString();
                const optimistic: TaskTableProps = {
                    id: String(res.taskId),
                    displayId: res.displayId,
                    title: defaultTitle,
                    priority: null,
                    effortLevel: null,
                    createdDate: now,
                    updatedAt: now,
                    dueDate: null,
                    startDate: null,
                    daysLeft: null,
                    status: "Open",
                    assigneeId: myself.userId,
                    assigneeEmail: myself.userEmail ?? null,
                    assigneeName: myself.userName ?? null,
                    assigneeImgPath: null,
                    parentTaskId: String(parentTaskId),
                    // task.rootTaskId isn't used for rendering (the diagram
                    // keys "is root" off the rootTaskId prop), but keep it
                    // sane for any downstream reader.
                    rootTaskId:
                        parent.rootTaskId ?? (parent.id != null ? Number(parent.id) : null),
                    threadId: null,
                    tags: [],
                    concatTags: null,
                    teamId: myself.teamId ?? null,
                    projectId,
                    isMilestone: false,
                    milestoneId: parent.milestoneId ?? null,
                    sprintId: parent.sprintId ?? null,
                };
                const nextGraph: TaskGraph = { ...current, tasks: [...current.tasks, optimistic] };
                graphRef.current = nextGraph;
                assembleAndLayout(nextGraph, { fit: false });
            } else {
                // Fallback (no cached graph/parent to splice into): reload,
                // still without re-fitting the camera.
                const graph = await refresh();
                if (graph) assembleAndLayout(graph, { fit: false });
            }
            void useTM.loadUpdatedTask(projectId);
        },
        // `assembleAndLayout` is intentionally omitted: it's declared below
        // this handler, so listing it here is a use-before-declaration (TDZ)
        // error. It's called at runtime inside the async body (safe), and
        // handleDelete follows the same pattern.
        [myself, projectId, accessToken, useTM, refresh] // eslint-disable-line react-hooks/exhaustive-deps
    );

    const handleDelete = useCallback(
        async (taskId: number) => {
            // Soft prompt — using window.confirm because a full
            // confirmation modal nested inside this modal is overkill
            // for a single-task action.
            if (!window.confirm("Delete this task and all its sub-tasks?")) return;
            const res = await deleteDiagramTask(myself, taskId, accessToken);
            if (!res.ok) {
                setError(res.error ?? "Delete failed.");
                return;
            }
            const graph = await refresh();
            if (graph) assembleAndLayout(graph, { fit: false });
            void useTM.loadUpdatedTask(projectId);
        },
        [myself, accessToken, useTM, projectId, refresh] // eslint-disable-line react-hooks/exhaustive-deps
    );

    const handleOpenPreview = useCallback(
        (taskId: number) => {
            // Preferred path: open the task/milestone in the global
            // URL-link modal, stacked ABOVE this diagram's Joy modal —
            // the graph stays open behind the overlay. For a page-hosted
            // diagram (z 9999) the max() resolves to the modal's 10020
            // default, the historical stacking; for a modal-hosted
            // diagram it lifts the preview past the raised graph. The
            // modal views hydrate themselves from the ids in the URL
            // (ModalTaskView / ModalMilestoneView keep global preview
            // state untouched), so ghost (external) nodes just carry
            // their own projectId in the URL — no
            // `usePM.setCurrentProject` switch needed.
            const internal = graphRef.current?.tasks.find((t) => Number(t.id) === taskId);
            const ghost = graphRef.current?.externalTasks.find((t) => Number(t.id) === taskId);
            if (urlLinkModal && (internal || ghost)) {
                const targetProjectId =
                    ghost && ghost.projectId != null ? ghost.projectId : projectId;
                // Milestone-backing nodes open the milestone view (the
                // card's button reads "Open milestone"); everything
                // else opens the task view.
                const href =
                    internal?.isMilestone === true && internal.milestoneId != null
                        ? `/workspace/tasks/project/${targetProjectId}/milestone/${internal.milestoneId}`
                        : `/workspace/tasks/project/${targetProjectId}/task/${taskId}`;
                urlLinkModal.openModalByHref(href, {
                    zIndex: Math.max(URL_LINK_MODAL_DEFAULT_Z, diagramZIndex + DIAGRAM_LIFT),
                });
                return;
            }

            // Fallback (no UrlLinkModal provider mounted): legacy
            // behavior — switch project for ghosts, open the preview
            // pane, and close the diagram so the pane is visible.
            if (ghost && ghost.projectId != null && ghost.projectId !== projectId) {
                const projectName = (ghost as { projectName?: string | null }).projectName ?? "";
                usePM.setCurrentProject({
                    projectId: ghost.projectId,
                    projectName,
                    projectTags: [],
                });
            }
            useTM.setCurrentPreviewTaskId(taskId);
            onCloseModal();
        },
        [urlLinkModal, useTM, usePM, onCloseModal, projectId, diagramZIndex]
    );

    // Wire handlers into a stable bag so `buildNodesAndEdges` doesn't
    // see a new object each render (would re-render every card).
    const handlerBagRef = useRef({
        onChange: handleChange,
        onAddSubtask: handleAddSubtask,
        onDelete: handleDelete,
        onOpenPreview: handleOpenPreview,
    });
    handlerBagRef.current = {
        onChange: handleChange,
        onAddSubtask: handleAddSubtask,
        onDelete: handleDelete,
        onOpenPreview: handleOpenPreview,
    };

    const assembleAndLayout = useCallback(
        // `fit` re-frames the whole graph (zoom + pan) after layout. It's
        // wanted on initial load and when the hide-closed toggle flips
        // (the visible set changes materially), but NOT on in-place
        // mutations (create / delete / re-parent / dependency edits, and
        // background task-touched refreshes) — re-fitting there yanks the
        // camera back to the whole tree and loses the user's zoom/pan,
        // which reads as the diagram "resetting" on every edit.
        (graph: TaskGraph, opts?: { fit?: boolean }) => {
            const sprintByTaskId = buildSprintLookup(graph, useSM, projectId);
            const blockerMap = buildOpenBlockerCountByTask(graph);
            // Diagram project name — every internal task in `graph.tasks`
            // is from `projectId` (loadProjectTasksFromApi is scoped to
            // it), so the canvas-level project name applies uniformly.
            // Ghosts get their own name from the dep-ref instead.
            const diagramProjectName =
                usePM.currentProject?.projectId === projectId
                    ? (usePM.currentProject.projectName ?? null)
                    : null;
            const { nodes: rawNodes, edges: rawEdges } = buildNodesAndEdges(
                graph,
                rootTaskId,
                // Snapshot the preview-pane target at assemble time so
                // the "you are here" highlight lands on the right card.
                // Captured here (inside CanvasInner) because the module-
                // scope builder can't reach `useTM`.
                useTM.currentPreviewTaskId,
                sprintByTaskId,
                blockerMap,
                diagramProjectName,
                {
                    onChange: (id, patch) => handlerBagRef.current.onChange(id, patch),
                    onAddSubtask: (id) => handlerBagRef.current.onAddSubtask(id),
                    onDelete: (id) => handlerBagRef.current.onDelete(id),
                    onOpenPreview: (id) => handlerBagRef.current.onOpenPreview(id),
                },
                hideClosed,
                highlightAssigneeId ?? null
            );
            const positioned = dagreLayout(rawNodes, rawEdges, "TB");
            setNodes(positioned);
            setEdges(rawEdges);
            // Don't fit here directly: on the first assemble (modal open)
            // the nodes we just set haven't been measured yet and the pane
            // can still be 0×0, so fitView() would derive the viewport from
            // an empty node set against a zero-sized pane (0/0 = NaN) and
            // leave a stuck NaN viewport. Flag the intent and let the fit
            // effect run it once the nodes are measured.
            if (opts?.fit !== false) {
                pendingFitRef.current = true;
            }
        },
        [
            dagreLayout,
            rootTaskId,
            useSM,
            projectId,
            usePM.currentProject,
            hideClosed,
            highlightAssigneeId,
        ]
    );

    // Perform a pending fit once React Flow has measured the nodes.
    // `fitView()` computes zoom from the bounds of the *measured* nodes:
    // with none measured the bounds collapse to 0×0, and if the pane is
    // also still unsized (true on the frame the diagram opens) the zoom is
    // 0/0 = NaN. That NaN viewport sticks and every subsequent render
    // paints the background dots, minimap and edges with NaN coordinates
    // (the "<circle> attribute cx: Expected length, NaN" console spam).
    // `nodesInitialized` guarantees a non-empty, finite fit bounds, so the
    // viewport is always finite. `nodes` is in the deps too so a re-layout
    // that only removes nodes (hide-closed) — which doesn't flip
    // `nodesInitialized` — still triggers the pending fit.
    useEffect(() => {
        if (pendingFitRef.current && nodesInitialized) {
            pendingFitRef.current = false;
            fitView({ padding: 0.15, duration: 300 });
        }
    }, [nodesInitialized, nodes, fitView]);

    // Re-run layout when the hide-closed toggle flips so closed nodes
    // (and their edges) disappear / reappear in place without waiting
    // for the next graph refresh. `graphRef` holds the last-loaded
    // graph; if it's null (initial load still in flight) the regular
    // initial-load effect will handle layout when the fetch completes.
    useEffect(() => {
        if (graphRef.current) assembleAndLayout(graphRef.current);
        // `assembleAndLayout` already includes `hideClosed` in its
        // deps, so this effect would fire on `assembleAndLayout`
        // identity change too. Listing `hideClosed` explicitly keeps
        // the intent visible at the call site.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hideClosed]);

    // Initial load.
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        (async () => {
            const graph = await refresh();
            if (cancelled) return;
            if (graph) assembleAndLayout(graph);
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rootTaskId, projectId]);

    // Keep the graph fresh while the URL-link overlay is open on top of
    // it: edits made in that modal go through useSendUpdatedTask (emits
    // "update") and its quick-add path (emits "children"). When the
    // touched task is part of this graph, re-fetch + re-layout so the
    // cards behind the overlay don't show stale titles/statuses.
    // "comment" events don't change anything a card renders — skipped.
    // Canvas-originated mutations don't emit task-touched, so this
    // never re-enters off our own writes.
    useEffect(() => {
        return onTaskTouched(({ taskId, kind }) => {
            if (kind === "comment") return;
            const inGraph = graphRef.current?.tasks.some((t) => Number(t.id) === taskId) ?? false;
            if (!inGraph) return;
            void (async () => {
                const graph = await refresh();
                if (graph) assembleAndLayout(graph, { fit: false });
            })();
        });
    }, [refresh, assembleAndLayout]);

    // React Flow events.
    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes((prev) => applyNodeChanges(changes, prev)),
        []
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            // Intercept *removes* — every other change (selection,
            // position) flows through React Flow unchanged.
            for (const change of changes) {
                if (change.type !== "remove") continue;
                const edge = edges.find((e) => e.id === change.id);
                if (!edge) continue;
                const data = edge.data as unknown as
                    | StructureEdgeData
                    | DependencyEdgeData
                    | undefined;
                if (!data) continue;
                if (data.kind === "dependency") {
                    void deleteTaskDependency(data.dependencyId, accessToken);
                } else if (data.kind === "structure") {
                    // Removing a parent-child edge means orphaning
                    // the child (sets parent_task_id to null).
                    void patchTaskFields(
                        data.childTaskId,
                        { parent_task_id: null, milestone: null },
                        accessToken
                    );
                }
            }
            setEdges((prev) => applyEdgeChanges(changes, prev));
            // Refresh once the dust settles so server state aligns.
            setTimeout(() => void useTM.loadUpdatedTask(projectId), 400);
        },
        [edges, accessToken, useTM, projectId]
    );

    // New connection (drag from a handle to another node's handle).
    // Source handle disambiguates: structure (top/bottom) → parent-child,
    // dependency (left/right) → blocking edge.
    const onConnect = useCallback(
        async (connection: Connection) => {
            if (!connection.source || !connection.target) return;
            if (connection.source === connection.target) return;
            const sourceTaskId = Number(connection.source);
            const targetTaskId = Number(connection.target);

            if (
                isStructureHandle(connection.sourceHandle) ||
                isStructureHandle(connection.targetHandle)
            ) {
                // Source is parent, target is child.
                const res = await patchTaskFields(
                    targetTaskId,
                    { parent_task_id: sourceTaskId },
                    accessToken
                );
                if (!res.ok) {
                    setError(res.error ?? "Re-parent failed.");
                    return;
                }
            } else if (
                isDependencyHandle(connection.sourceHandle) ||
                isDependencyHandle(connection.targetHandle)
            ) {
                const res = await createTaskDependency(sourceTaskId, targetTaskId, accessToken);
                if (!res.ok) {
                    setError(res.error);
                    return;
                }
            }
            const graph = await refresh();
            if (graph) assembleAndLayout(graph, { fit: false });
            void useTM.loadUpdatedTask(projectId);
        },
        [accessToken, refresh, assembleAndLayout, useTM, projectId]
    );

    // Reconnect — user dragged an existing edge's endpoint elsewhere.
    const onReconnect = useCallback(
        async (oldEdge: Edge, newConnection: Connection) => {
            const data = oldEdge.data as unknown as
                | StructureEdgeData
                | DependencyEdgeData
                | undefined;
            if (!data || !newConnection.source || !newConnection.target) return;

            if (data.kind === "structure") {
                // Reconnecting a parent-child edge means re-parenting
                // the child. The child end (target of the original
                // edge) is fixed; the parent end (source) moves to
                // whichever node the user dropped on.
                const newParentId = Number(newConnection.source);
                const childId = data.childTaskId;
                if (newParentId === childId) return;
                const res = await patchTaskFields(
                    childId,
                    { parent_task_id: newParentId },
                    accessToken
                );
                if (!res.ok) {
                    setError(res.error ?? "Re-parent failed.");
                    return;
                }
            } else {
                // Dependency reconnect — drop old, create new.
                const newSource = Number(newConnection.source);
                const newTarget = Number(newConnection.target);
                if (newSource === newTarget) return;
                await deleteTaskDependency(data.dependencyId, accessToken);
                const res = await createTaskDependency(newSource, newTarget, accessToken);
                if (!res.ok) {
                    setError(res.error);
                    return;
                }
            }
            // Optimistic local update so the edge doesn't flicker
            // while refresh is in flight.
            setEdges((prev) => reconnectEdge(oldEdge, newConnection, prev));
            const graph = await refresh();
            if (graph) assembleAndLayout(graph, { fit: false });
            void useTM.loadUpdatedTask(projectId);
        },
        [accessToken, refresh, assembleAndLayout, useTM, projectId]
    );

    const onConnectFresh = useCallback(
        (connection: Connection) => {
            // Optimistically add the edge so the user sees the
            // connection while we're saving. Real edge data is
            // overwritten by the post-mutation refresh.
            setEdges((prev) => addEdge(connection, prev));
            void onConnect(connection);
        },
        [onConnect]
    );

    const containerSx = useMemo(
        () => ({
            flex: 1,
            position: "relative" as const,
            background: isDark
                ? "linear-gradient(180deg, rgba(var(--gp-dark-surface-b-rgb), 1) 0%, rgba(11,10,22,1) 100%)"
                : "linear-gradient(180deg, rgba(252,250,255,1) 0%, rgba(248,245,255,1) 100%)",
            "& .react-flow__attribution": { display: "none" },
            "& .react-flow__controls-button": {
                background: P.surfaceElevated,
                color: P.text,
                border: `1px solid ${P.border}`,
                "&:hover": { background: P.hoverBg },
            },
            "& .react-flow__minimap": {
                background: P.surface,
                border: `1px solid ${P.border}`,
                borderRadius: "8px",
            },
        }),
        [isDark, P]
    );

    return (
        <Box sx={containerSx}>
            {loading && (
                <Stack
                    alignItems="center"
                    justifyContent="center"
                    sx={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 5,
                        background: isDark ? "rgba(11,10,22,0.7)" : "rgba(248,245,255,0.7)",
                        backdropFilter: "blur(2px)",
                    }}
                >
                    <CircularProgress size="lg" />
                    <Typography level="body-sm" sx={{ mt: 1, color: P.textMuted }}>
                        Loading task graph…
                    </Typography>
                </Stack>
            )}
            {error && (
                <Alert
                    color="danger"
                    size="sm"
                    variant="soft"
                    endDecorator={
                        <IconButton
                            color="danger"
                            size="sm"
                            variant="plain"
                            onClick={() => setError(null)}
                        >
                            <CloseRoundedIcon />
                        </IconButton>
                    }
                    sx={{
                        position: "absolute",
                        top: 12,
                        left: 12,
                        right: 12,
                        zIndex: 6,
                    }}
                >
                    {error}
                </Alert>
            )}
            <ReactFlow
                colorMode={isDark ? "dark" : "light"}
                defaultEdgeOptions={{ animated: false }}
                deleteKeyCode={["Backspace", "Delete"]}
                edges={edges}
                edgeTypes={edgeTypes}
                // Padding matches the deferred fit effect so React Flow's
                // own init-fit and that effect frame the graph identically
                // whichever lands last. Both are gated on node measurement,
                // so neither produces the NaN viewport that effect guards.
                fitViewOptions={{ padding: 0.15 }}
                maxZoom={2}
                minZoom={0.25}
                nodes={nodes}
                nodeTypes={nodeTypes}
                proOptions={{ hideAttribution: true }}
                fitView
                onConnect={onConnectFresh}
                onEdgesChange={onEdgesChange}
                onNodesChange={onNodesChange}
                onReconnect={onReconnect}
            >
                <Background
                    color={`rgba(${rawTheme.brandRgb}, ${isDark ? 0.2 : 0.18})`}
                    gap={20}
                    size={1}
                    variant={BackgroundVariant.Dots}
                />
                <Controls showInteractive={false} />
                <MiniMap
                    maskColor={
                        isDark
                            ? `rgba(${rawTheme.dark.surfaceBRgb}, 0.65)`
                            : `rgba(${rawTheme.light.surfaceCRgb}, 0.65)`
                    }
                    nodeColor={(n) => {
                        const d = n.data as unknown as TaskNodeData;
                        if (d?.isExternal) return "#94a3b8";
                        if (d?.isMilestone) return "#f97316";
                        return rawAccent;
                    }}
                    pannable
                    zoomable
                />
                <DiagramLegend />
            </ReactFlow>
        </Box>
    );
};

export const TaskFlowCanvas = (props: Props) => (
    <ReactFlowProvider>
        <CanvasInner {...props} />
    </ReactFlowProvider>
);
