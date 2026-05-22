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
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { purplePalette } from "../../../../theme/purplePalette";
import { UserProps } from "../../../../types/admin";
import { TaskTableProps } from "../../../../types/tasks";
import { createTaskDependency } from "../../services/createTaskDependency";
import { deleteTaskDependency } from "../../services/deleteTaskDependency";
import { Sprint } from "../../sprint-milestone/types";
import { useDagreLayout } from "../hooks/useDagreLayout";
import { createDiagramSubtask } from "../services/createDiagramSubtask";
import { deleteDiagramTask } from "../services/deleteDiagramTask";
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
};

const computeOverview = (
    graph: TaskGraph,
    rootTaskId: number,
    sprintByTaskId: Map<number, Sprint>
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
    for (const t of graph.tasks) {
        if (t.id == null || Number(t.id) === rootTaskId) continue;
        total += 1;
        if ((t.status ?? "").toLowerCase() === "closed") closed += 1;
    }
    // Pick up the sprint linked to the root task. If the root isn't a
    // milestone (or has no sprint), this is null.
    const sprint = sprintByTaskId.get(rootTaskId) ?? null;
    return { spanStart, spanEnd, spanDays, total, closed, sprint };
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
    sprintByTaskId: Map<number, Sprint>,
    handlers: {
        onChange: (taskId: number, patch: EditableFields) => void | Promise<void>;
        onAddSubtask: (parentTaskId: number) => void | Promise<void>;
        onDelete: (taskId: number) => void | Promise<void>;
        onOpenPreview: (taskId: number) => void;
    }
): { nodes: Node[]; edges: Edge[]; titleByTaskId: Map<number, string> } => {
    // Count "open blockers" per task. Used by the warning badge in
    // the node header.
    const openBlockerCountByTask = new Map<number, number>();
    for (const edge of graph.dependencyEdges) {
        const blockerStatus = edge.otherStatus?.status?.toLowerCase?.() ?? "";
        if (blockerStatus !== "closed") {
            openBlockerCountByTask.set(
                edge.blockedTaskId,
                (openBlockerCountByTask.get(edge.blockedTaskId) ?? 0) + 1
            );
        }
    }

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
        const data: TaskNodeData = {
            task,
            isRoot: taskId === rootTaskId,
            isMilestone,
            isExternal,
            openBlockerCount: openBlockerCountByTask.get(taskId) ?? 0,
            closedDescendantCount: counts.closed,
            totalDescendantCount: counts.total,
            sprint: isMilestone ? (sprintByTaskId.get(taskId) ?? null) : null,
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

    const nodes: Node[] = [
        ...graph.tasks.map((t) => makeNode(t, false)),
        ...graph.externalTasks.map((t) => makeNode(t, true)),
    ];

    // Structure edges from parent_task_id (visible-tree only —
    // ghosts have no structure edges into the visible set).
    const structureEdges: Edge[] = [];
    const visibleIdSet = new Set(graph.tasks.map((t) => Number(t.id)));
    for (const task of graph.tasks) {
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
        // modal stays a thin shell.
        if (onOverviewChange) {
            const sprintByTaskId = buildSprintLookup(graph, useSM, projectId);
            onOverviewChange(computeOverview(graph, rootTaskId, sprintByTaskId));
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
                },
                accessToken
            );
            if (!res.ok) {
                setError(res.error ?? "Update failed.");
                return;
            }
            // Reflect immediately in the visible card without a full reload.
            setNodes((prev) =>
                prev.map((n) => {
                    if (n.id !== String(taskId)) return n;
                    const oldData = n.data as unknown as TaskNodeData;
                    const merged: TaskTableProps = {
                        ...oldData.task,
                        ...(patch.title !== undefined ? { title: patch.title } : {}),
                        ...(patch.startDate !== undefined ? { startDate: patch.startDate } : {}),
                        ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
                    };
                    return {
                        ...n,
                        data: { ...oldData, task: merged } as unknown as Record<string, unknown>,
                    };
                })
            );
            // Background refresh — keeps the parent table consistent
            // when the modal closes.
            void useTM.loadUpdatedTask(projectId);
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
            const { nodes: rawNodes, edges: rawEdges } = buildNodesAndEdges(
                graph,
                rootTaskId,
                sprintByTaskId,
                {
                    onChange: (id, patch) => handlerBagRef.current.onChange(id, patch),
                    onAddSubtask: (id) => handlerBagRef.current.onAddSubtask(id),
                    onDelete: (id) => handlerBagRef.current.onDelete(id),
                    onOpenPreview: (id) => handlerBagRef.current.onOpenPreview(id),
                }
            );
            const positioned = dagreLayout(rawNodes, rawEdges, "TB");
            setNodes(positioned);
            setEdges(rawEdges);
            requestAnimationFrame(() => {
                fitView({ padding: 0.15, duration: 300 });
            });
        },
        [dagreLayout, fitView, rootTaskId, useSM, projectId]
    );

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
