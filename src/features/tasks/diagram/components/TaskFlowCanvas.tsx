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
    useReactFlow,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import { useAuth } from "../../../../context/AuthContext";
import { invalidateCachedFullTask } from "../../../../db/services/task-full.service";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { purplePalette } from "../../../../theme/purplePalette";
import { UserProps } from "../../../../types/admin";
import { TaskTableProps } from "../../../../types/tasks";
import { addTask } from "../../services/addTask";
import { createTaskDependency } from "../../services/createTaskDependency";
import { deleteTaskDependency } from "../../services/deleteTaskDependency";
import { Sprint } from "../../sprint-milestone/types";
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
import { computeHealth, getMilestoneWindow } from "../utils/scheduleStatus";
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

const computeOverview = (
    graph: TaskGraph,
    rootTaskId: number,
    sprintByTaskId: Map<number, Sprint>,
    openBlockerCountByTask: Map<number, number>
): ScheduleOverview => {
    // Span: min(start) → max(due) across visible (non-ghost) tasks.
    let spanStart: string | null = null;
    let spanEnd: string | null = null;
    for (const t of graph.tasks) {
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
    for (const t of graph.tasks) {
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

const buildNodesAndEdges = (
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
    hideClosed: boolean
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

    // Hidden-task set for the "Hide closed tasks" toggle. The root is
    // always kept — hiding the focal point would just empty the canvas
    // and look broken. External (ghost) tasks aren't filtered for the
    // Closed case: they're outside-tree references; dependency edges
    // that touch a hidden internal task get dropped further down via
    // the rendered-id set, so disconnected ghosts simply fall out on
    // their own.
    //
    // Deleted tasks are ALWAYS hidden, regardless of the `hideClosed`
    // toggle — they're soft-deleted rows the rest of the app doesn't
    // expose (table, sidebar, search), so showing them only in the
    // diagram would surface dead data with no way to act on it. Also
    // applied to ghost dependency refs so a "blocker" pointing at a
    // deleted task from another project doesn't leak in.
    const isDeleted = (status: string | null | undefined): boolean =>
        (status ?? "").toLowerCase() === "deleted";
    const hiddenTaskIds = new Set<number>();
    for (const t of graph.tasks) {
        if (t.id == null) continue;
        const taskId = Number(t.id);
        if (isDeleted(t.status)) {
            hiddenTaskIds.add(taskId);
            continue;
        }
        if (hideClosed && taskId !== rootTaskId) {
            if ((t.status ?? "").toLowerCase() === "closed") {
                hiddenTaskIds.add(taskId);
            }
        }
    }
    const visibleInternalTasks = graph.tasks.filter(
        (t) => t.id != null && !hiddenTaskIds.has(Number(t.id))
    );
    // Deleted ghosts: synthesised from TaskDependencyRef which carries
    // status in the same shape as internal rows, so the same predicate
    // works.
    const visibleExternalTasks = graph.externalTasks.filter((t) => !isDeleted(t.status));

    const nodes: Node[] = [
        ...visibleInternalTasks.map((t) => makeNode(t, false)),
        ...visibleExternalTasks.map((t) => makeNode(t, true)),
    ];

    // Structure edges from parent_task_id (visible-tree only —
    // ghosts have no structure edges into the visible set). Iterates
    // the already-filtered list so an edge can't survive when either
    // endpoint was dropped by `hideClosed`. Children of a hidden
    // parent become root-level siblings in dagre — acceptable since
    // their original parent has gone away from the user's view.
    const structureEdges: Edge[] = [];
    const visibleIdSet = new Set(visibleInternalTasks.map((t) => Number(t.id)));
    for (const task of visibleInternalTasks) {
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
}: Props) => {
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const P = isDark ? purplePalette.dark : purplePalette.light;
    const { fitView } = useReactFlow();
    const dagreLayout = useDagreLayout();

    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Cached reference to the most recent loaded graph; used by
    // mutation handlers that need to look up `parentTaskId` of a
    // node we're about to re-parent (so the optimistic update
    // matches the server state).
    const graphRef = useRef<TaskGraph | null>(null);

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
            const res = await createDiagramSubtask(myself, projectId, parentTaskId, accessToken);
            if (!res.ok) {
                setError(res.error);
                return;
            }
            const graph = await refresh();
            if (graph) {
                assembleAndLayout(graph);
            }
            void useTM.loadUpdatedTask(projectId);
        },
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
            if (graph) assembleAndLayout(graph);
            void useTM.loadUpdatedTask(projectId);
        },
        [myself, accessToken, useTM, projectId, refresh] // eslint-disable-line react-hooks/exhaustive-deps
    );

    const handleOpenPreview = useCallback(
        (taskId: number) => {
            // For ghost (external) nodes the target task lives in a
            // different project; we need to switch `usePM.currentProject`
            // first or the preview pane won't be able to hydrate.
            // Mirrors the cross-project navigation in
            // TaskDependenciesBlock's chip click handler.
            const ghost = graphRef.current?.externalTasks.find((t) => Number(t.id) === taskId);
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
        [useTM, usePM, onCloseModal, projectId]
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
        (graph: TaskGraph) => {
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
                hideClosed
            );
            const positioned = dagreLayout(rawNodes, rawEdges, "TB");
            setNodes(positioned);
            setEdges(rawEdges);
            requestAnimationFrame(() => {
                fitView({ padding: 0.15, duration: 300 });
            });
        },
        [dagreLayout, fitView, rootTaskId, useSM, projectId, usePM.currentProject, hideClosed]
    );

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
            if (graph) assembleAndLayout(graph);
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
            if (graph) assembleAndLayout(graph);
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
                ? "linear-gradient(180deg, rgba(20,14,34,1) 0%, rgba(11,10,22,1) 100%)"
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
                    variant="soft"
                    size="sm"
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
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnectFresh}
                onReconnect={onReconnect}
                defaultEdgeOptions={{ animated: false }}
                proOptions={{ hideAttribution: true }}
                fitView
                minZoom={0.25}
                maxZoom={2}
                deleteKeyCode={["Backspace", "Delete"]}
                colorMode={isDark ? "dark" : "light"}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={1}
                    color={isDark ? "rgba(124,58,237,0.2)" : "rgba(124,58,237,0.18)"}
                />
                <Controls showInteractive={false} />
                <MiniMap
                    nodeColor={(n) => {
                        const d = n.data as unknown as TaskNodeData;
                        if (d?.isExternal) return "#94a3b8";
                        if (d?.isMilestone) return "#f97316";
                        return P.accent;
                    }}
                    pannable
                    zoomable
                    maskColor={isDark ? "rgba(20,14,34,0.65)" : "rgba(252,250,255,0.65)"}
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
