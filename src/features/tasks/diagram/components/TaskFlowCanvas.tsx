import "@xyflow/react/dist/style.css";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Alert, Box, IconButton, Stack } from "@mui/joy";
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
    getNodesBounds,
    MiniMap,
    Node,
    NodeChange,
    ReactFlow,
    ReactFlowProvider,
    reconnectEdge,
    useConnection,
    useNodesInitialized,
    useReactFlow,
    useStoreApi,
} from "@xyflow/react";

import { Spinner } from "../../../../components/ui/feedback/Skeleton";
import { useAuth } from "../../../../context/authState";
import { invalidateCachedFullTask } from "../../../../db/services/task-full.service";
import { useUrlLinkModal } from "../../../../hooks/common/UrlLinkModalContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { useUndoHidden } from "../../../../hooks/common/useUndoableAction";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { useColorTheme } from "../../../../theme/colorThemeState";
import { purplePalette } from "../../../../theme/purplePalette";
import { UserProps } from "../../../../types/admin";
import { TaskTableProps } from "../../../../types/tasks";
import { useDeleteTask } from "../../hooks/useDeleteTask";
import { addTask } from "../../services/addTask";
import { createTaskDependency } from "../../services/createTaskDependency";
import { deleteTaskDependency } from "../../services/deleteTaskDependency";
import { onTaskTouched } from "../../services/taskEvents";
import { forgetInFlightTask } from "../../services/taskLoadInFlight";
import { Sprint } from "../../sprint-milestone/types";
import { overlayGraphDeletes, pendingDeleteSignature } from "../../utils/pendingTaskDelete";
import { taskMetaLabel } from "../../utils/taskMeta";
import { DIAGRAM_LIFT, URL_LINK_MODAL_DEFAULT_Z, useDiagramZIndex } from "../diagramZIndex";
import { createDiagramSubtask } from "../services/createDiagramSubtask";
import { loadMilestoneBurndown } from "../services/loadMilestoneBurndown";
import { loadTaskGraph } from "../services/loadTaskGraph";
import { patchTaskFields } from "../services/patchTaskFields";
import {
    DependencyEdgeData,
    EditableFields,
    isDependencyHandle,
    isStructureHandle,
    ScheduleOverview,
    StructureEdgeData,
    TaskGraph,
    TaskGraphScope,
    TaskNodeData,
} from "../types";
import { cardGeometryOf, isCardArrowKey, linkedCardInDirection } from "../utils/cardKeyboard";
import { FIT_PADDING, planInitialViewport } from "../utils/initialViewport";
import { BAND_LABEL_NODE_TYPE, layoutDiagramGraph } from "../utils/layoutDiagramGraph";
import { activeWorkRank, rowColumnsFor } from "../utils/layoutOptions";
import { applyLineage } from "../utils/lineage";
import { BandLabelNode } from "./BandLabelNode";
import { DependencyEdge } from "./DependencyEdge";
import { DiagramLegend } from "./DiagramLegend";
import { MilestoneNodeCard } from "./MilestoneNodeCard";
import { ParentChildEdge } from "./ParentChildEdge";
import {
    buildNodesAndEdges,
    buildOpenBlockerCountByTask,
    computeOverview,
} from "./taskFlowCanvasHelpers";
import { TaskNodeCard } from "./TaskNodeCard";

type Props = {
    myself: UserProps;
    /**
     * Anchor: any task in the tree to draw. `loadTaskGraph` resolves the
     * chain top above it, and everything downstream ("is root", the
     * rollups) reads that resolved id off the graph rather than this prop.
     */
    rootTaskId: number;
    /** "tree" (default) draws the anchor's whole hierarchy from the milestone down;
     *  "task" draws only the anchor and its subtasks. */
    scope?: TaskGraphScope;
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
    [BAND_LABEL_NODE_TYPE]: BandLabelNode,
};

const edgeTypes = {
    structure: ParentChildEdge,
    dependency: DependencyEdge,
};

const CanvasInner = ({
    myself,
    rootTaskId,
    scope = "tree",
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
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const P = isDark ? purplePalette.dark : purplePalette.light;
    // React Flow's Background and MiniMap write their `color` / `nodeColor`
    // straight into SVG presentation attributes, which never resolve a
    // `var()`. These two need the theme's RAW values — the documented
    // exception to going through `purplePalette`.
    const { raw: rawTheme } = useColorTheme();
    const rawAccent = isDark ? rawTheme.dark.accent : rawTheme.light.accent;
    const { fitView, setViewport, getNodes, getNode, deleteElements, getEdges } = useReactFlow();
    const flowStore = useStoreApi();
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
    // The card under the pointer (MIP-1278): its parents and children light up
    // and the rest of the graph dims. Not part of `nodes`/`edges`, so a hover never
    // rewrites the stored graph; `drawn` below layers it on.
    const [hoveredId, setHoveredId] = useState<number | null>(null);
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
    // How early each card comes among its siblings (active work first), fixed the first time the
    // card is laid out in this session: a status edit while the graph is open must not move cards.
    const orderRankRef = useRef<Map<number, number>>(new Map());
    // The first placement of the view is instant: nothing to animate from but the unplaced
    // canvas. Later ones (the hide-closed toggle) glide.
    const viewPlacedRef = useRef(false);

    // Task ids created during THIS diagram session (via a card's
    // add-subtask button). Their nodes get the "newly created" accent so
    // the user can spot the card they just added in a tree of many. Kept
    // in a ref (not state) so reads inside `assembleAndLayout` don't add it
    // to that callback's deps — which would churn the layout effects. The
    // set only grows; every re-layout (including server-driven refreshes)
    // reads the latest value, so the highlight persists until the diagram
    // is closed and reopened.
    const newTaskIdsRef = useRef<Set<number>>(new Set());

    // Tasks whose delete waits behind its Undo toast (MIP-1303). A ref, so the
    // assembly and the overview below keep their identity (they are dependencies of
    // the layout effects).
    const undoHidden = useUndoHidden();
    const undoHiddenRef = useRef(undoHidden);
    undoHiddenRef.current = undoHidden;

    // The header overview (progress, counts, health) of the graph WITH the pending
    // deletes applied: a card waiting behind its Undo toast is already off the canvas
    // and must not count in "0/1" either. The burndown arrives later than the rest
    // (its own request), so the last one is kept for a re-publish that only follows a
    // delete starting or ending.
    const burndownRef = useRef<ScheduleOverview["burndown"]>(null);
    const publishOverview = useCallback(
        (loadedGraph: TaskGraph): ScheduleOverview | null => {
            if (!onOverviewChange) return null;
            const graph = overlayGraphDeletes(loadedGraph, undoHiddenRef.current);
            const sprintByTaskId = buildSprintLookup(graph, useSM, projectId);
            const blockerMap = buildOpenBlockerCountByTask(graph);
            const overview = computeOverview(graph, sprintByTaskId, blockerMap);
            onOverviewChange({ ...overview, burndown: burndownRef.current });
            return overview;
        },
        [onOverviewChange, useSM, projectId]
    );

    const refresh = useCallback(async () => {
        setError(null);
        const graph = await loadTaskGraph(myself, projectId, rootTaskId, accessToken, scope);
        if (!graph) {
            setError(t.tasks.diagram.errors.load);
            setLoading(false);
            return;
        }
        graphRef.current = graph;
        // Drawn, but some dependency lines could not be loaded (MIP-1416): say so
        // rather than show those cards as unconnected.
        if (graph.dependenciesIncomplete) {
            setError(t.tasks.diagram.errors.dependenciesPartial);
        }
        // Notify the modal so its header pill can update. Computed
        // here (one source of truth) instead of in the modal so the
        // modal stays a thin shell. Burndown trails behind the synch-
        // ronous overview: we publish the cheap derivations first so
        // the chip + counts paint immediately, then patch in the chart
        // data after the (separately fetched) activity rollup lands.
        if (onOverviewChange) {
            burndownRef.current = null;
            const overview = publishOverview(graph);
            if (!overview) return graph;

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
                            burndownRef.current = burndown;
                            publishOverview(graphRef.current ?? graph);
                        }
                    }
                );
            }
        }
        return graph;
    }, [
        myself,
        projectId,
        rootTaskId,
        scope,
        accessToken,
        onOverviewChange,
        publishOverview,
        t.tasks.diagram.errors.load,
        t.tasks.diagram.errors.dependenciesPartial,
    ]);

    // CRUD handlers — defined before `assemble` so the assembly can
    // capture them in node data.
    // Resolves true once the change is saved and mirrored into the caches, false when the
    // server refused it (the error is already on screen). `failureText` is what the banner
    // says when the server gave no reason of its own.
    const handleChange = useCallback(
        async (
            taskId: number,
            patch: EditableFields,
            failureText: string = t.tasks.diagram.errors.update
        ): Promise<boolean> => {
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
                setError(res.error ?? failureText);
                return false;
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

            // 1b. Patch the cached graph too. `graphRef.current` is the
            //     snapshot every re-layout rebuilds from — and crucially the
            //     one `handleAddSubtask` / `handleDelete` splice into. Without
            //     this write it kept the PRE-edit row, so creating a subtask
            //     right after an inline edit re-assembled from the stale graph
            //     and visually reverted the edit (the change WAS saved to the
            //     backend — reopening the diagram re-fetched and showed it
            //     correctly — but the in-memory graph never learned about it).
            if (graphRef.current) {
                graphRef.current = {
                    ...graphRef.current,
                    tasks: graphRef.current.tasks.map((t) =>
                        Number(t.id) === taskId ? buildMergedTask(t) : t
                    ),
                };
            }

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
            // Also stop sharing a `getTask` that is already running: the
            // reload just below must start its own, not join a pre-edit one.
            forgetInFlightTask(taskId);

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
            return true;
        },
        [accessToken, projectId, useTM, t.tasks.diagram.errors.update]
    );

    const handleAddSubtask = useCallback(
        async (parentTaskId: number) => {
            // Title varies by parent kind: a milestone's child is just
            // "a task in this milestone" to the user, while a regular
            // task's child IS a sub-task. Look up the parent in the
            // last-loaded graph rather than re-querying.
            const parent = graphRef.current?.tasks.find((t) => Number(t.id) === parentTaskId);
            const defaultTitle =
                parent?.isMilestone === true
                    ? t.tasks.diagram.newTask
                    : t.tasks.diagram.newSubTask;
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

            // Flag the new task so its node renders with the "newly
            // created" accent. Recorded before the layout below so the
            // first render of the node already carries the highlight, and
            // held for the diagram's lifetime so later re-layouts keep it.
            newTaskIdsRef.current.add(res.taskId);

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
                    // resolves the root by walking parents in
                    // `loadTaskGraph`), but keep it sane for any
                    // downstream reader.
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

    // Delete a card (its status menu's "Deleted"): hidden behind an Undo toast, written
    // when the toast is gone (MIP-1303), the same as in the table and the preview. The
    // card leaves the canvas at once because `assembleAndLayout` shows a pending task as
    // Deleted; Undo, or a refused write, brings it back through the same path. The write is
    // `{task_id, status, status_code}` (a soft delete, so the task, its comments and its
    // sub-tasks stay in the database and nothing is orphaned, MIP-1302).
    const runDeleteTask = useDeleteTask({ useTM, useSM });
    const handleDelete = useCallback(
        (taskId: number) => {
            const row = graphRef.current?.tasks.find((t) => Number(t.id) === taskId);
            runDeleteTask(
                {
                    id: taskId,
                    projectId,
                    isMilestone: row?.isMilestone === true,
                    milestoneId: row?.milestoneId,
                },
                {
                    onCommitted: () => {
                        // The graph is the snapshot every re-layout rebuilds from: it must
                        // say Deleted before the overlay lets go of the task.
                        if (!graphRef.current) return;
                        graphRef.current = {
                            ...graphRef.current,
                            tasks: graphRef.current.tasks.map((t) =>
                                Number(t.id) === taskId ? { ...t, status: "Deleted" } : t
                            ),
                        };
                    },
                }
            );
        },
        [runDeleteTask, projectId]
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
        (loadedGraph: TaskGraph, opts?: { fit?: boolean }) => {
            // A pending delete reads as Deleted here, whatever the loaded graph says: the
            // card is dropped from the canvas and nothing waits on it.
            const graph = overlayGraphDeletes(loadedGraph, undoHiddenRef.current);
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
                highlightAssigneeId ?? null,
                newTaskIdsRef.current,
                t.tasks.diagram.untitled
            );
            // Cards placed, and the parent-child lines to the later rows of a group routed
            // through the gaps between rows (MIP-1682).
            const rank = orderRankRef.current;
            for (const node of rawNodes) {
                const id = Number(node.id);
                const task = (node.data as TaskNodeData).task;
                if (!rank.has(id) && task) {
                    rank.set(id, activeWorkRank(task.status, task.priority));
                }
            }
            const laid = layoutDiagramGraph(rawNodes, rawEdges, {
                order: rank,
                freeRowColumns: rowColumnsFor(
                    flowStore.getState().width || window.innerWidth * 0.9
                ),
            });
            setNodes(laid.nodes);
            setEdges(laid.edges);
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
            useSM,
            projectId,
            usePM.currentProject,
            hideClosed,
            highlightAssigneeId,
            t.tasks.diagram.untitled,
            flowStore,
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
            // MIP-1681: fit the whole graph only if it stays readable; a big graph opens at a
            // readable zoom on the card the person came from (see `planInitialViewport`).
            const current = getNodes();
            const { width, height, minZoom, maxZoom } = flowStore.getState();
            const lit = (pick: "isCurrentPreview" | "isRoot") =>
                current.find((n) => (n.data as Record<string, unknown>)?.[pick] === true);
            const focusNode = lit("isCurrentPreview") ?? lit("isRoot");
            const plan =
                current.length > 0
                    ? planInitialViewport({
                          bounds: getNodesBounds(current),
                          pane: { width, height },
                          focus: focusNode ? getNodesBounds([focusNode]) : null,
                          focusAt: lit("isCurrentPreview") ? "center" : "top",
                          minZoom,
                          maxZoom,
                      })
                    : null;
            const duration = viewPlacedRef.current ? 300 : 0;
            viewPlacedRef.current = true;
            if (plan && plan.kind === "focus") {
                void setViewport({ x: plan.x, y: plan.y, zoom: plan.zoom }, { duration });
            } else {
                fitView({ padding: FIT_PADDING, duration });
            }
        }
    }, [nodesInitialized, nodes, fitView, setViewport, getNodes, flowStore]);

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

    // A delete starts (the card leaves), is undone or fails (it comes back), or is
    // committed (the graph already says Deleted): lay out again from the last-loaded
    // graph, without re-framing the camera.
    const pendingDeletes = pendingDeleteSignature(undoHidden);
    useEffect(() => {
        if (!graphRef.current) return;
        assembleAndLayout(graphRef.current, { fit: false });
        publishOverview(graphRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingDeletes]);

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

    // Dragging a new line across other cards would flash the highlight at every card
    // it passes, so no card is lit while React Flow is drawing a connection (its own
    // state, so it can't be left stale by a drag that ends off the canvas).
    const connecting = useConnection((c) => c.inProgress);
    const drawn = useMemo(
        () => applyLineage(nodes, edges, connecting ? null : hoveredId),
        [nodes, edges, hoveredId, connecting]
    );
    // MIP-1830: each card's accessible name and role, and React Flow's description of a
    // card (its default text talks about moving the card with arrows, which no longer
    // happens from the keyboard). The status is the word the card shows (MIP-1856: the same
    // label source as StatusLabel, not the raw enum).
    const cardNodes = useMemo(
        () =>
            drawn.nodes.map((n) => {
                // MIP-1925: band caption nodes carry no task; leave them as they are.
                const d = n.data as unknown as TaskNodeData | undefined;
                if (n.type === BAND_LABEL_NODE_TYPE || !d?.task) return n;
                const status = d.task.status ?? "";
                return {
                    ...n,
                    ariaRole: "button",
                    // MIP-1928: React Flow sets aria-roledescription="node" on every card, so a
                    // screen reader said "node" (English) over the card's own role. domAttributes
                    // is spread last, so undefined removes it and the role ("button") is read.
                    domAttributes: { "aria-roledescription": undefined },
                    ariaLabel: fmt(t.tasks.diagram.tooltips.cardAriaLabel, {
                        id: d.task.displayId ?? String(d.task.id),
                        title: d.task.title ?? "",
                        status: taskMetaLabel(status, t.tasks.filters) || status,
                    }),
                };
            }),
        [drawn.nodes, t]
    );
    const cardAriaLabelConfig = useMemo(
        () => ({
            "node.a11yDescription.default": t.tasks.diagram.tooltips.cardAriaHint,
            "node.a11yDescription.keyboardDisabled": t.tasks.diagram.tooltips.cardAriaHint,
        }),
        [t]
    );
    const onNodeMouseEnter = useCallback((_: unknown, node: Node) => {
        setHoveredId(Number(node.id));
    }, []);
    const onNodeMouseLeave = useCallback(() => setHoveredId(null), []);

    // React Flow events.
    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes((prev) => applyNodeChanges(changes, prev)),
        []
    );

    // Backspace/Delete removes the selection. React Flow has ONE `deleteKeyCode` for
    // nodes and edges, and `onNodesChange` only mirrors a removal locally, so a deleted
    // card would vanish from the canvas while the task stayed on the server (MIP-1320).
    // Task deletion is the card's own confirmed soft delete, so the key may only remove
    // edges the user selected (those go through `onEdgesChange` to the server). The edges
    // React Flow adds because they touch a selected node are dropped too: deleting a
    // node must never unlink its neighbours.
    const onBeforeDelete = useCallback(
        async ({ edges: doomed }: { nodes: Node[]; edges: Edge[] }) => ({
            nodes: [] as Node[],
            edges: doomed.filter((e) => e.selected),
        }),
        []
    );

    // Backspace/Delete on a selected EDGE (MIP-1390). The graph lives in a modal, and the
    // modal frame stops key events at its own root so they never reach the page, which is
    // also where React Flow listens for `deleteKeyCode`: its own key handling never saw the
    // key, and an edge has no delete control of its own. So the canvas handles the key
    // itself, here, below the frame's fence, and React Flow's is switched off (one path,
    // never two). Only edges: a card is deleted from its own status menu (MIP-1303), which
    // `onBeforeDelete` above also enforces. Typing in a card's title or a date field is left
    // alone.
    const onCanvasKeyDown = useCallback(
        (event: ReactKeyboardEvent) => {
            if (event.key !== "Backspace" && event.key !== "Delete") return;
            if (event.defaultPrevented) return;
            const target = event.target as HTMLElement | null;
            if (target?.closest?.("input, textarea, select, [contenteditable='true']")) return;
            const selected = getEdges().filter((edge) => edge.selected);
            if (selected.length === 0) return;
            event.preventDefault();
            void deleteElements({ edges: selected });
        },
        [getEdges, deleteElements]
    );

    // MIP-1830 (decision note task:219, option A): the graph by keyboard. A card is one Tab
    // stop (React Flow's own node wrapper). Enter or Space opens its preview; an arrow key
    // moves focus to a linked card in that direction. Arrows never move a card here:
    // React Flow would, so the key is taken in the capture phase, before it reaches the
    // card. Mouse and touch dragging are untouched. Keys typed inside a card's own controls
    // (its target is not the card's wrapper) are left alone.
    const onCardKeyDownCapture = useCallback(
        (event: ReactKeyboardEvent) => {
            const card = event.target as HTMLElement;
            if (!card.classList?.contains("react-flow__node")) return;
            const id = card.getAttribute("data-id");
            if (id == null) return;
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                const data = getNode(id)?.data as unknown as TaskNodeData | undefined;
                data?.onOpenPreview?.();
                return;
            }
            if (!isCardArrowKey(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            const links = getEdges().map((e) => ({ source: e.source, target: e.target }));
            const next = linkedCardInDirection(
                id,
                event.key,
                getNodes().map(cardGeometryOf),
                links
            );
            if (next == null) return;
            document
                .querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(next)}"]`)
                ?.focus();
        },
        [getNode, getNodes, getEdges]
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
                    setError(res.error ?? t.tasks.diagram.errors.reparent);
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
        [
            accessToken,
            refresh,
            assembleAndLayout,
            useTM,
            projectId,
            t.tasks.diagram.errors.reparent,
        ]
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
                    setError(res.error ?? t.tasks.diagram.errors.reparent);
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
        [
            accessToken,
            refresh,
            assembleAndLayout,
            useTM,
            projectId,
            t.tasks.diagram.errors.reparent,
        ]
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
            // Focusable only so the keyboard goes here on a click; no ring on the whole canvas.
            outline: "none",
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
            // Touch (MIP-1319): zoom / fit are 44px buttons, and the stack moves to the top-left
            // corner: bottom-left it sat under the legend, which covers it on a phone.
            "@media (pointer: coarse)": {
                "& .react-flow__panel.react-flow__controls": { top: 0, bottom: "auto" },
                "& .react-flow__controls-button": { width: 44, height: 44 },
            },
            // MIP-1830: the focused card's ring for keyboard users (React Flow draws none).
            "& .react-flow__node:focus-visible": {
                outline: `2px solid ${rawAccent}`,
                outlineOffset: "3px",
                borderRadius: "10px",
            },
            "& .react-flow__minimap": {
                background: P.surface,
                border: `1px solid ${P.border}`,
                borderRadius: "8px",
            },
        }),
        [isDark, P, rawAccent]
    );

    return (
        // Focusable, so a click on the canvas puts the keyboard here (Backspace/Delete).
        <Box
            sx={containerSx}
            tabIndex={-1}
            onKeyDown={onCanvasKeyDown}
            onKeyDownCapture={onCardKeyDownCapture}
        >
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
                    <Spinner caption={t.tasks.diagram.loading} size="lg" stacked />
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
                ariaLabelConfig={cardAriaLabelConfig}
                colorMode={isDark ? "dark" : "light"}
                defaultEdgeOptions={{ animated: false }}
                deleteKeyCode={null}
                edges={drawn.edges}
                edgeTypes={edgeTypes}
                maxZoom={2}
                minZoom={0.25}
                nodes={cardNodes}
                nodeTypes={nodeTypes}
                proOptions={{ hideAttribution: true }}
                onBeforeDelete={onBeforeDelete}
                onConnect={onConnectFresh}
                onEdgesChange={onEdgesChange}
                onNodeMouseEnter={onNodeMouseEnter}
                onNodeMouseLeave={onNodeMouseLeave}
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
                        // A caption over a band of outside tasks is no card.
                        if (n.type === BAND_LABEL_NODE_TYPE) return "transparent";
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
