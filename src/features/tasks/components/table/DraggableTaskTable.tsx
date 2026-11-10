import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Droppable, DropResult } from "@hello-pangea/dnd";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import PendingIcon from "@mui/icons-material/Pending";
import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import dayjs from "dayjs";
import { Socket } from "socket.io-client";

import { DataState } from "../../../../components/ui/feedback/DataState";
import { PlainButton } from "../../../../components/ui/PlainButton";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { useLeadingDebouncedCallback } from "../../../../hooks/common/useLeadingDebouncedCallback";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import {
    tableSortOverrideFor,
    useTaskSortPreferences,
} from "../../../../hooks/common/useTaskSortPreferences";
import { useTaskTableColumnPreferences } from "../../../../hooks/common/useTaskTableColumnPreferences";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { useProjectCustomFields } from "../../../../hooks/tasks/useProjectCustomFields";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { useSyncFailure } from "../../../../services/syncStatus";
import { focusRing } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { TagListProps, TaskProps, TaskTableProps } from "../../../../types/tasks";
import { popTeamMembers } from "../../../admin/services/popTeamMembers";
import { LazyTaskDiagram } from "../../diagram/components/LazyTaskDiagram";
import type { TaskGraphScope } from "../../diagram/types";
import { statusSolid } from "../../meta/taskTone";
import { createQuickTask } from "../../services/createQuickTask";
import { emitTasksBulkChanged, emitTaskTouched } from "../../services/taskEvents";
import { TaskSaveRefusedError } from "../../services/taskSaveRefusedError";
import { updateTaskFromTable } from "../../services/updateTaskFromTable";
import { FilterProps } from "../../types/TaskTableTypes";
import {
    applyTreePositionToDescendants,
    collectDescendantIds,
    TreePosition,
} from "../../utils/cascadeTreePosition";
import { buildCustomFieldColumns, parseCustomFieldColKey } from "../../utils/customFields";
import {
    DND_ACTIVE_ATTR,
    installFamilyFocusStyles,
    onFamilyFocusPointerLeave,
    onFamilyFocusPointerOver,
    TASK_BODY_CLASS,
} from "../../utils/familyFocusCss";
import { deriveGhostAncestors } from "../../utils/ghostAncestors";
import { buildOptimisticQuickTask } from "../../utils/optimisticQuickTask";
import { PREVIEW_SWITCH_DEBOUNCE_MS } from "../../utils/previewSwitchDebounce";
import { nextHeaderTiers, sortTableTasks } from "../../utils/sortTask";
import { formatTaskDisplayId } from "../../utils/taskDisplayId";
import { taskFilterStorageKey } from "../../utils/taskFilterStorage";
import { effortLevels, priorities, statuses } from "../../utils/taskMeta";
import { QuickAddDraft } from "./QuickAddTaskRow";
import { TaskFilterMenu } from "./TaskFilterMenu";
import { TaskTableColumnSettings } from "./TaskTableColumnSettings";
import { TaskTableRows } from "./TaskTableRows";
import { TaskTableSkeleton } from "./TaskTableSkeleton";
import {
    GRID_COL_ATTR,
    GRID_HEADER_ROW,
    GRID_ROW_ATTR,
    GridNavContext,
    useGridNavController,
} from "./useGridNav";

// Shared empty fallback so a project without tags doesn't mint a new array
// identity on every render (see `quickAddProjectTags`).
const EMPTY_PROJECT_TAGS: TagListProps[] = [];

// Column definitions for the table
export type ColumnDef = {
    field: string;
    // `headerName` is the resolved label that gets rendered. It's filled
    // in at render time from `headerLabelKey` (or stays empty for the
    // expand column). Kept on the type so downstream consumers can read
    // the rendered label without re-resolving from the i18n catalog.
    headerName: string;
    // Key into `t.tasks.table.columns` used to localize the header. The
    // expand column has no label so it omits the key.
    headerLabelKey?: keyof (typeof import("../../../../i18n/locales/en/tasks").tasks)["table"]["columns"];
    width: number;
    minWidth?: number;
    maxWidth?: number;
    align?: "left" | "center" | "right";
    editable?: boolean;
    hidden?: boolean;
    resizable?: boolean;
};

export const defaultColumns: ColumnDef[] = [
    { field: "__expand", headerName: "", width: 16, align: "center", resizable: false },
    {
        field: "id",
        headerName: "ID",
        headerLabelKey: "id",
        // Wide enough for "MIP-1150" + the open icon on one line (it wrapped at 100).
        width: 124,
        align: "center",
        resizable: false,
    },
    {
        field: "status",
        headerName: "Status",
        headerLabelKey: "status",
        width: 105,
        minWidth: 80,
        align: "center",
        editable: true,
        resizable: true,
    },
    {
        field: "tags",
        headerName: "Tags",
        headerLabelKey: "tags",
        width: 110,
        minWidth: 80,
        align: "center",
        resizable: true,
    },
    {
        field: "title",
        headerName: "Title",
        headerLabelKey: "title",
        width: 300,
        minWidth: 150,
        maxWidth: 800,
        align: "left",
        editable: true,
        resizable: true,
    },
    {
        field: "assigneeId",
        headerName: "Assignee",
        headerLabelKey: "assignee",
        width: 150,
        minWidth: 150,
        maxWidth: 400,
        align: "left",
        editable: true,
        resizable: true,
    },
    {
        // Compact PR-state badge surfaced when the task has at least
        // one GitHub PR URL in `links`. State is fetched lazily via
        // `prStatusCache`; the column otherwise renders blank.
        //
        // Hidden by default — opt-in via the table's column-settings
        // gear. Teams that don't use the GitHub integration shouldn't
        // see an empty column taking up table real estate.
        field: "pr",
        headerName: "PR",
        headerLabelKey: "pr",
        // Each chip now carries its PR number (`#443`, about 60px), and the
        // cell wraps: a narrow column stacks the chips, a wide one (up to
        // `maxWidth`) keeps several on one line (MIP-1032).
        width: 96,
        minWidth: 72,
        maxWidth: 360,
        align: "center",
        resizable: true,
        hidden: true,
    },
    {
        field: "priority",
        headerName: "Priority",
        headerLabelKey: "priority",
        width: 100,
        minWidth: 80,
        align: "center",
        editable: true,
        resizable: true,
    },
    {
        field: "effortLevel",
        headerName: "Effort Level",
        headerLabelKey: "effortLevel",
        // Room for the colored chip ("Extensive" with its dot) without cutting it.
        width: 124,
        minWidth: 100,
        align: "center",
        editable: true,
        resizable: true,
    },
    {
        // Derived "Task Weight" = priority × urgency (1..25). Read-only —
        // it recomputes from the row's priority + due date (no persisted
        // value), so editing those two cells is how you change it.
        field: "weight",
        headerName: "Weight",
        headerLabelKey: "weight",
        width: 90,
        minWidth: 70,
        align: "center",
        resizable: true,
    },
    {
        field: "daysLeft",
        headerName: "Days Left",
        headerLabelKey: "daysLeft",
        width: 100,
        minWidth: 80,
        align: "center",
        resizable: true,
    },
    {
        field: "dueDate",
        headerName: "Due Date",
        headerLabelKey: "dueDate",
        width: 110,
        minWidth: 80,
        align: "center",
        editable: true,
        resizable: true,
    },
    {
        // Surfaced only when the current filtered list contains at least
        // one milestone — see the `hasMilestoneInDisplay` gate in
        // DraggableTaskTable. Read-only: editing a task's sprint goes
        // through SprintMilestonePicker in the task preview pane.
        field: "sprint",
        headerName: "Sprint",
        headerLabelKey: "sprint",
        width: 130,
        minWidth: 90,
        maxWidth: 240,
        align: "center",
        resizable: true,
    },
    {
        field: "updatedAt",
        headerName: "Last Updated",
        headerLabelKey: "updatedAt",
        width: 180,
        minWidth: 120,
        align: "center",
        resizable: true,
    },
    {
        // When the task, or anything under it, last had real progress
        // (MIP-1351). Differs from "Last Updated" only for a parent or
        // milestone whose CHILD changed. Read-only; shown as an age.
        field: "lastProgressAt",
        headerName: "Last Progress",
        headerLabelKey: "lastProgressAt",
        width: 130,
        minWidth: 100,
        align: "center",
        resizable: true,
    },
    {
        field: "createdDate",
        headerName: "Created Date",
        headerLabelKey: "createdDate",
        width: 120,
        minWidth: 100,
        align: "center",
        resizable: true,
    },
];

// For backwards compatibility
export const columns = defaultColumns;

// Leading columns the user cannot reorder or hide. `__expand` is the
// subtask-tree chevron (purely UI mechanics) and `id` is the task's
// human identifier — both are essential and pinned at the front of the
// table regardless of column-settings state.
export const FIXED_LEADING_FIELDS: readonly string[] = ["__expand", "id"];

// Stable empties for the member-filter "ghost ancestor" computation. Returned
// (by reference) whenever the member filter is inactive, so `ghostInfo.ghostIds`
// keeps a constant identity across `allTasks` churn — otherwise the memoized
// `TaskTableRows` comparator would see a "changed" set and re-render the whole
// row list on every task open (the exact cascade that memo exists to avoid).
const EMPTY_GHOST_IDS: Set<string> = new Set();
const EMPTY_GHOST_ROWS: TaskTableProps[] = [];

// Sort helpers (rank maps, parseTs, fieldValue, nullTier, comparator
// builder) live in `features/tasks/utils/sortTask.ts` and are shared
// with the sprint board. See that module for the rationale on rank
// values and the field-value resolver.

// Status options for dropdown. `label` doubles as a fallback for the
// rendered display string; the actual UI looks up the label by
// `t.tasks.filters[labelKey]` at render time (see DraggableTaskRow).
export const statusOptions = [
    {
        label: "Open",
        labelKey: "open" as const,
        value: "Open",
        ...statusSolid("Open"),
        icon: <CheckCircleOutlineIcon style={{ color: statusSolid("Open").textColor }} />,
    },
    {
        label: "WIP",
        labelKey: "wip" as const,
        value: "WIP",
        ...statusSolid("WIP"),
        icon: <AutorenewIcon style={{ color: statusSolid("WIP").textColor }} />,
    },
    {
        label: "Blocked",
        labelKey: "blocked" as const,
        value: "Blocked",
        ...statusSolid("Blocked"),
        icon: <BlockIcon style={{ color: statusSolid("Blocked").textColor }} />,
    },
    {
        label: "Pending",
        labelKey: "pending" as const,
        value: "Pending",
        ...statusSolid("Pending"),
        icon: <PendingIcon style={{ color: statusSolid("Pending").textColor }} />,
    },
    {
        label: "Closed",
        labelKey: "closed" as const,
        value: "Closed",
        ...statusSolid("Closed"),
        icon: <CheckCircleOutlineIcon style={{ color: statusSolid("Closed").textColor }} />,
    },
    {
        label: "Deleted",
        labelKey: "deleted" as const,
        value: "Deleted",
        ...statusSolid("Deleted"),
        icon: <HighlightOffIcon style={{ color: statusSolid("Deleted").textColor }} />,
    },
];

// Style helpers
const getTableContainerStyles = (mode: "light" | "dark" | undefined): React.CSSProperties => ({
    width: "100%",
    flex: 1,
    minHeight: 0, // Important: allows flex item to shrink below content size
    overflow: "auto",
    borderRadius: "10px",
    border:
        mode === "dark" ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.1)",
    boxShadow:
        mode === "dark" ? "0 4px 20px rgba(0, 0, 0, 0.3)" : "0 4px 20px rgba(0, 0, 0, 0.08)",
});

const getTableHeaderStyles = (mode: "light" | "dark" | undefined): React.CSSProperties => ({
    display: "flex",
    position: "sticky",
    top: 0,
    zIndex: 100,
    backgroundColor: mode === "dark" ? "#151528" : "#f5f7fa",
    borderBottom:
        mode === "dark" ? "2px solid rgba(255, 255, 255, 0.08)" : "2px solid rgba(0, 0, 0, 0.08)",
    fontWeight: 600,
    fontSize: "0.75rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
});

const getHeaderCellStyles = (
    width: number,
    align?: string,
    mode?: "light" | "dark" | undefined
): React.CSSProperties => ({
    minWidth: width,
    width: width,
    padding: "8px 8px",
    textAlign: (align as "left" | "center" | "right") || "left",
    userSelect: "none",
    color: mode === "dark" ? "#a0a0a0" : "#666666",
    transition: "background-color 0.15s ease, color 0.15s ease",
});

// Leading gutter shared by the header placeholder, every task row
// (28px drag handle + 20px hover open-diagram + 20px hover quick-add
// "+") and the QuickAddTaskRow draft row. All three must agree or the
// cell grid shears sideways.
export const LEADING_GUTTER_WIDTH = 68;

// Drag handle placeholder in header
const headerDragHandlePlaceholderStyles: React.CSSProperties = {
    width: LEADING_GUTTER_WIDTH,
    minWidth: LEADING_GUTTER_WIDTH,
};

// Column resize handle styles
const getResizeHandleStyles = (
    isResizing: boolean,
    mode: "light" | "dark" | undefined
): React.CSSProperties => ({
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 6,
    cursor: "col-resize",
    backgroundColor: isResizing
        ? mode === "dark"
            ? "var(--gp-brandalt-400)"
            : "var(--gp-brand-700)"
        : "transparent",
    transition: isResizing ? "none" : "background-color 0.15s ease",
    zIndex: 10,
});

type DraggableTaskTableProps = {
    teamMembers: UserProps[];
    setTeamMembers: (value: UserProps[]) => void;
    myself: UserProps;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    useSM: SprintMilestoneManagementState;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    setMyself: (value: UserProps) => void;
};

export const DraggableTaskTable = (props: DraggableTaskTableProps) => {
    const {
        teamMembers,
        setTeamMembers,
        myself,
        usePM,
        useTM,
        useSM,
        socket,
        useTEM,
        useCM,
        useUISM,
        setMyself,
    } = props;
    const { mode: colorMode } = useColorScheme();
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const syncFailure = useSyncFailure("tasks");
    const isDark = colorMode === "dark";
    // The table's one tab stop (MIP-1230): see useGridNav.
    const { nav: gridNav, gridRef } = useGridNavController();
    // Normalize mode to only "light" | "dark" | undefined (treat "system" as undefined)
    const mode: "light" | "dark" | undefined =
        colorMode === "light" || colorMode === "dark" ? colorMode : undefined;

    const [currentDisplayingTasks, setCurrentDisplayingTasks] = useState<TaskTableProps[]>([]);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    // Column-settings modal — opened via the gear icon next to the
    // filter menu. The modal itself manages its own form state; we
    // just gate visibility here.
    const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
    // Set of child task ids that pass the active TaskFilterMenu
    // selection (status / tags / priority / effort / milestone). The
    // filter menu computes this in the same pass it builds
    // `currentDisplayingTasks` and pushes it here. `null` = filter has
    // not run yet; treat as permissive so the table is usable on
    // first paint without flashing children in and out.
    const [visibleChildTaskIds, setVisibleChildTaskIds] = useState<Set<string> | null>(null);
    // Milestones the user picked in the MILESTONE filter. Force-expanded
    // below, because narrowing to a milestone is a statement about wanting
    // to see that milestone's work. Deliberately empty for every other
    // filter: expanding on a tag / status / priority / effort / member
    // filter fires across the whole list at once and reorders what the
    // user is reading.
    const [milestoneAutoExpandIds, setMilestoneAutoExpandIds] = useState<Set<string>>(
        () => new Set()
    );
    // True while the Member filter is narrowed to specific members. When on,
    // the table splices the (dimmed, non-interactive) ancestor chain of every
    // matching subtask back into the tree so dependencies stay visible even
    // though those ancestors aren't assigned to the filtered member. See
    // `ghostInfo` / `displayRows` below.
    const [isMemberFilterActive, setIsMemberFilterActive] = useState<boolean>(false);
    // Sort tiers are sourced from `useTaskSortPreferences` so they
    // stay in sync with the Settings modal selectors and persist
    // across reloads via localStorage. Default = `[{priority, desc}]`,
    // matching the long-standing "Critical first" first-paint behaviour.
    //
    // Column-header click sets a TEMPORARY, in-memory override (kept in the
    // provider, scoped to the project, never persisted) — the saved sort only
    // changes from the Task sort modal. Effective tiers = override ?? saved.
    const {
        tableSortTiers: savedSortTiers,
        tableSortOverride,
        setTableSortOverride,
    } = useTaskSortPreferences();
    const sortOverrideProjectId = usePM.currentProject?.projectId ?? null;
    const activeSortOverride = tableSortOverrideFor(tableSortOverride, sortOverrideProjectId);
    const sortTiers = activeSortOverride ?? savedSortTiers;

    const toggleExpand = useCallback((id: string) => {
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    // Inline quick-add child row. `quickAddParentId` anchors the draft
    // row beneath a parent row; only one can be open at a time (opening
    // from another row's "+" replaces the anchor and drops any draft —
    // explicit user action wins). `quickAddDirtyRef` mirrors whether the
    // row holds a typed title so drag-start / stale-anchor cleanup can
    // dismiss a pristine row without ever destroying typed input.
    const [quickAddParentId, setQuickAddParentId] = useState<string | null>(null);
    const quickAddDirtyRef = useRef(false);

    // Passed into the memoized DraggableTaskRow and excluded from its
    // areEqual comparator — MUST stay identity-stable (`useCallback([])`
    // + functional setState only) or memo-skipped rows would invoke a
    // stale closure.
    const openQuickAdd = useCallback((task: TaskTableProps) => {
        if (task.id == null) return;
        const id = String(task.id);
        quickAddDirtyRef.current = false;
        setQuickAddParentId(id);
        // Auto-expand the parent so the draft row (and the child it
        // creates) is visible in the tree.
        setExpandedRows((prev) => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    }, []);

    // Row whose task graph is open (null = diagram closed). One shared
    // ModalTaskDiagram at the table level instead of one per row — rows
    // only request it via the identity-stable callback below (excluded
    // from DraggableTaskRow's areEqual, same contract as openQuickAdd).
    // `scope`: a row nested under a parent opens the graph of just that task and its
    // subtasks; a top-level row opens its whole tree (MIP-1094).
    const [diagramTarget, setDiagramTarget] = useState<{
        task: TaskTableProps;
        scope: TaskGraphScope;
    } | null>(null);

    // Suppresses hover family-focus for the duration of a drag. A boolean (not
    // per-row), flipped twice per drag — so unlike a hovered-row state it can't
    // churn the row map. See `DND_ACTIVE_ATTR`.
    const [isDragActive, setIsDragActive] = useState(false);
    const openDiagram = useCallback((task: TaskTableProps, scope: TaskGraphScope) => {
        if (task.id == null) return;
        setDiagramTarget({ task, scope });
    }, []);

    const closeQuickAdd = useCallback(() => {
        quickAddDirtyRef.current = false;
        setQuickAddParentId(null);
    }, []);

    // When the sidebar scopes the table to a single milestone, auto-
    // expand its backing task row so the milestone's child tasks are
    // visible without an extra click. The backing task is the only
    // top-level row that survives the milestone-scope filter, so
    // without this its children would otherwise stay collapsed.
    useEffect(() => {
        if (useTM.tableMilestoneFilterId == null) return;
        const target = useTM.tableMilestoneFilterId;
        const backing = useTM.allTasks.find(
            (t) => t.isMilestone === true && t.milestoneId === target
        );
        if (backing?.id == null) return;
        setExpandedRows((prev) => {
            if (prev.has(String(backing.id))) return prev;
            const nextSet = new Set(prev);
            nextSet.add(String(backing.id));
            return nextSet;
        });
    }, [useTM.tableMilestoneFilterId, useTM.allTasks]);

    // Order one level of the tree by the user's tiers (milestone-pinning
    // and the default rules live in `sortTableTasks`). Defined above
    // `childrenByParent` because the subtask index sorts each child group
    // through this same function — every level obeys the one rule.
    const sortTasks = useCallback(
        (tasks: TaskTableProps[]) => sortTableTasks(tasks, sortTiers),
        [sortTiers]
    );

    const childrenByParent = useMemo(() => {
        // Include only child tasks with statuses/tags/priorities/effort
        // levels configured in TaskFilterMenu.
        //
        // The menu publishes the matching subtask ids via
        // `visibleChildTaskIds`; we intersect with that set so an
        // expanded parent only reveals children that actually pass the
        // active filter (e.g. selecting status="Open" no longer
        // surfaces a "Closed" subtask under its parent). When the set
        // is `null` the filter pass hasn't run yet — fall through to a
        // permissive build to avoid blanking out children on the very
        // first render before TaskFilterMenu's `useEffect` fires.
        const map = new Map<string, TaskTableProps[]>();
        for (const task of useTM.allTasks) {
            if (task.parentTaskId == null) continue;
            if (visibleChildTaskIds === null) {
                if (task.status === "Deleted") continue;
            } else if (task.id == null || !visibleChildTaskIds.has(String(task.id))) {
                continue;
            }
            const parentId = String(task.parentTaskId);
            const arr = map.get(parentId) || [];
            arr.push(task);
            map.set(parentId, arr);
        }
        // Subtasks obey the user's sort condition too. Without this the
        // groups render in raw `allTasks` order, so changing the sort
        // reorders the root rows while every expanded subtask group sits
        // untouched. `sortTasks` (not a bare comparator) keeps each level
        // of the tree on the identical rule — and having it in the deps is
        // what makes the groups *re-sort* when the condition changes,
        // rather than only ordering correctly on first paint.
        for (const [parentId, children] of map) {
            if (children.length > 1) map.set(parentId, sortTasks(children));
        }
        return map;
    }, [useTM.allTasks, visibleChildTaskIds, sortTasks]);

    // Unfiltered parent → children index used for the drag-and-drop cycle
    // check. The filtered `childrenByParent` above hides rows that don't
    // pass the user's filter, but a filter-hidden descendant still blocks
    // a reparent move — so the cycle check needs the complete tree. Map
    // lookup is O(1), replacing the previous O(N) per-step walk of
    // `useTM.allTasks` inside `isDescendant`.
    const allChildrenByParent = useMemo(() => {
        const map = new Map<string, string[]>();
        for (const task of useTM.allTasks) {
            if (task.parentTaskId == null || task.id == null) continue;
            const parentId = String(task.parentTaskId);
            const arr = map.get(parentId) || [];
            arr.push(String(task.id));
            map.set(parentId, arr);
        }
        return map;
    }, [useTM.allTasks]);

    // Ghost-ancestor computation for the Member filter. When it's active,
    // `currentDisplayingTasks` holds only the MATCHES (tasks/milestones
    // assigned to the filtered member). A matching subtask whose parent
    // ISN'T assigned to that member would otherwise vanish — its parent isn't
    // a match, so the tree has nothing to hang it under. We walk each match
    // up to its root, collecting every ancestor: ancestors that are NOT
    // themselves matches become "ghosts" (rendered dimmed + non-interactive),
    // and the full ancestor set is force-expanded so the match is visible.
    const ghostInfo = useMemo(() => {
        if (!isMemberFilterActive) {
            return {
                ghostIds: EMPTY_GHOST_IDS,
                ancestorIds: EMPTY_GHOST_IDS,
                ghostRoots: EMPTY_GHOST_ROWS,
                ghostChildren: EMPTY_GHOST_ROWS,
            };
        }
        return deriveGhostAncestors(currentDisplayingTasks, useTM.allTasks);
    }, [isMemberFilterActive, currentDisplayingTasks, useTM.allTasks]);

    // `childrenByParent` PLUS the ghost ancestors' own child-links, so a ghost
    // intermediate appears under its (also-ghost) parent. Identical to
    // `childrenByParent` whenever the member filter is inactive, so passing it
    // everywhere keeps the non-filtered path byte-for-byte unchanged.
    const childrenByParentEffective = useMemo(() => {
        if (!isMemberFilterActive || ghostInfo.ghostChildren.length === 0) {
            return childrenByParent;
        }
        const map = new Map(childrenByParent);
        for (const ghost of ghostInfo.ghostChildren) {
            const pid = String(ghost.parentTaskId);
            const existing = map.get(pid) ?? [];
            if (existing.some((c) => String(c.id) === String(ghost.id))) continue;
            const merged = [...existing, ghost];
            map.set(pid, merged.length > 1 ? sortTasks(merged) : merged);
        }
        return map;
    }, [isMemberFilterActive, ghostInfo, childrenByParent, sortTasks]);

    const depthMap = useMemo(() => new Map<string, number>(), []);
    // Row id → its root ancestor's id ("family"). Filled by the same tree walk
    // that fills `depthMap`, which is the only place the root of each rendered
    // row is already known — reading `rootTaskId` off the task instead would
    // miss the optimistic window after a reparent (the server re-derives that
    // field, so the dragged row carries a stale root until the next reload).
    const familyKeyByRow = useMemo(() => new Map<string, string>(), []);

    const displayRows = useMemo(() => {
        depthMap.clear();
        familyKeyByRow.clear();
        const result: TaskTableProps[] = [];

        // Force ghost-ancestor chains open so the matching subtask beneath
        // them actually renders — the user can't be asked to expand a row
        // they can't click. No-op when the member filter is inactive.
        // Two sources of forced expansion. Ghost ancestors are opened
        // because the user CAN'T click them (they're dimmed placeholders
        // around a matching subtask). A milestone picked in the milestone
        // filter is opened because that selection is itself the request to
        // see its tasks.
        const forcedOpen = [...ghostInfo.ancestorIds, ...milestoneAutoExpandIds];
        const effectiveExpanded =
            forcedOpen.length > 0
                ? new Set<string>([...expandedRows, ...forcedOpen])
                : expandedRows;

        // `familyKey` is the id of the root this branch descends from, passed
        // down unchanged so every row in one subtree shares it.
        const insertWithChildren = (task: TaskTableProps, depth: number, familyKey: string) => {
            depthMap.set(String(task.id), depth);
            familyKeyByRow.set(String(task.id), familyKey);
            result.push(task);
            if (task.id && effectiveExpanded.has(String(task.id))) {
                const children = childrenByParentEffective.get(String(task.id)) || [];
                for (const child of children) {
                    insertWithChildren(child, depth + 1, familyKey);
                }
            }
        };

        const rootMatches = currentDisplayingTasks.filter((t) => t.parentTaskId == null);
        // Ghost roots are ancestors that happen to be top-level tasks; merge
        // them with the matching roots and sort so their position is stable.
        const parentRows =
            ghostInfo.ghostRoots.length > 0
                ? sortTasks([...rootMatches, ...ghostInfo.ghostRoots])
                : rootMatches;
        for (const row of parentRows) {
            insertWithChildren(row, 0, String(row.id));
        }
        return result;
    }, [
        currentDisplayingTasks,
        expandedRows,
        childrenByParentEffective,
        ghostInfo,
        milestoneAutoExpandIds,
        sortTasks,
        familyKeyByRow,
        depthMap,
    ]);

    // Hover family-focus: two static rules, added to the document once. The
    // hover itself is a delegated pointer handler on the table body (see
    // `familyFocusCss.ts` for why it is neither React state nor `:has()`).
    useEffect(() => {
        installFamilyFocusStyles();
    }, []);

    // Close a pristine quick-add row whose anchor row left the visible
    // tree (filtered out, ancestor collapsed, project switch). A dirty
    // row keeps its state — it simply doesn't render until the parent
    // reappears; typed input is never destroyed behind the user's back.
    useEffect(() => {
        if (quickAddParentId == null) return;
        if (quickAddDirtyRef.current) return;
        if (!displayRows.some((r) => String(r.id) === quickAddParentId)) {
            closeQuickAdd();
        }
    }, [displayRows, quickAddParentId, closeQuickAdd]);

    // Per-project custom fields → extra table columns. The store hook
    // caches per project with in-flight dedupe, and `fields` keeps a
    // stable identity until a definition actually changes — so the
    // memos (and the TaskTableRows comparator) below don't churn.
    const { fields: customFieldDefs } = useProjectCustomFields(
        usePM.currentProject?.projectId ?? null
    );
    const customColumns = useMemo(
        () => buildCustomFieldColumns(customFieldDefs),
        [customFieldDefs]
    );
    // Built-ins + the current project's custom columns. This is the
    // lookup set for width/resize resolution and the toggleable list —
    // custom columns behave exactly like built-ins from here on.
    const allColumns = useMemo(() => [...defaultColumns, ...customColumns], [customColumns]);

    // Column widths state - initialize from default column widths
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        const widths: Record<string, number> = {};
        defaultColumns.forEach((col) => {
            widths[col.field] = col.width;
        });
        return widths;
    });

    // Resize state - use refs to avoid stale closure issues
    const [resizingColumn, setResizingColumn] = useState<string | null>(null);
    const resizingColumnRef = useRef<string | null>(null);
    const resizeStartX = useRef<number>(0);
    const resizeStartWidth = useRef<number>(0);
    const columnWidthsRef = useRef<Record<string, number>>(columnWidths);
    // Live column set for the resize handlers — they're identity-stable
    // useCallbacks (registered as document listeners), so they read the
    // current columns through a ref instead of closing over `allColumns`.
    const allColumnsRef = useRef<ColumnDef[]>(allColumns);
    useEffect(() => {
        allColumnsRef.current = allColumns;
    }, [allColumns]);

    // Keep ref in sync with state
    useEffect(() => {
        columnWidthsRef.current = columnWidths;
    }, [columnWidths]);

    // Handle column resize move - defined first so it can be referenced
    const handleResizeMove = useCallback((e: MouseEvent) => {
        const currentColumn = resizingColumnRef.current;
        if (!currentColumn) return;

        const delta = e.clientX - resizeStartX.current;
        const column = allColumnsRef.current.find((c) => c.field === currentColumn);
        if (!column) return;

        const newWidth = Math.max(
            column.minWidth || 50,
            Math.min(column.maxWidth || 1000, resizeStartWidth.current + delta)
        );

        setColumnWidths((prev) => ({
            ...prev,
            [currentColumn]: newWidth,
        }));
    }, []);

    // Handle column resize end
    const handleResizeEnd = useCallback(() => {
        resizingColumnRef.current = null;
        setResizingColumn(null);
        document.removeEventListener("mousemove", handleResizeMove);
        document.removeEventListener("mouseup", handleResizeEnd);
    }, [handleResizeMove]);

    // Handle column resize start
    const handleResizeStart = (e: React.MouseEvent, field: string) => {
        e.preventDefault();
        e.stopPropagation();

        // Set both ref and state
        resizingColumnRef.current = field;
        setResizingColumn(field);
        resizeStartX.current = e.clientX;
        resizeStartWidth.current = columnWidthsRef.current[field] || columnWidths[field];

        // Add global mouse event listeners
        document.addEventListener("mousemove", handleResizeMove);
        document.addEventListener("mouseup", handleResizeEnd);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            document.removeEventListener("mousemove", handleResizeMove);
            document.removeEventListener("mouseup", handleResizeEnd);
        };
    }, [handleResizeMove, handleResizeEnd]);

    // Get column width (dynamic or default)
    const getColumnWidth = (field: string): number => {
        return columnWidths[field] || allColumns.find((c) => c.field === field)?.width || 100;
    };

    // Reset column widths to default
    const resetColumnWidths = () => {
        const widths: Record<string, number> = {};
        defaultColumns.forEach((col) => {
            widths[col.field] = col.width;
        });
        setColumnWidths(widths);
    };

    // Load team members on mount
    const getTeamMembers = () => {
        (async () => {
            const poppedTeamMembers: UserProps[] = await popTeamMembers(myself);
            if (poppedTeamMembers.length > 0) {
                setTeamMembers(poppedTeamMembers);
            }
        })();
    };

    useEffect(() => {
        getTeamMembers();
    }, []);

    // Project-tag filters. Tags are already loaded into
    // `usePM.currentProject.projectTags` by TaskSidebarMain whenever the active
    // project changes — read from there instead of refetching the same
    // /api/v2/project/tag/ endpoint on every allTasks change.
    const [predefinedTagsFilters, setPredefinedTagsFilters] = useState<FilterProps[]>([]);
    useEffect(() => {
        const projectTags: TagListProps[] = usePM.currentProject?.projectTags || [];
        if (projectTags.length === 0) {
            setPredefinedTagsFilters([]);
            return;
        }
        const allTagFilter: FilterProps = {
            label: "All",
            labelKey: "all",
            filterModel: { items: [] },
            lightModeColor: "#6b7280",
            darkModeColor: "#9ca3af",
        };
        const tagBasedFilters: FilterProps[] = projectTags.map((tag) => ({
            label: tag.tagName,
            filterModel: {
                items: [
                    {
                        field: "concatTags",
                        operator: "contains",
                        value: `/${tag.tagName}/`,
                    },
                ],
            },
            lightModeColor: tag.tagColor,
            darkModeColor: tag.tagColor,
        }));
        setPredefinedTagsFilters([allTagFilter, ...tagBasedFilters]);
    }, [usePM.currentProject?.projectTags]);

    // Reparent a task by dropping it ONTO another row (the `combine`
    // gesture from react-beautiful-dnd). Milestones can't be moved;
    // tasks can land under any other task — including a milestone
    // row, in which case they inherit that milestone's id too so
    // sprint / milestone-scoped views stay consistent. Optimistic +
    // log-on-error matches the existing `handleRowUpdate` convention.
    const reparentTask = async (draggedId: string, targetId: string) => {
        if (draggedId === targetId) return;

        const dragged =
            currentDisplayingTasks.find((t) => String(t.id) === draggedId) ||
            useTM.allTasks.find((t) => String(t.id) === draggedId);
        const target =
            currentDisplayingTasks.find((t) => String(t.id) === targetId) ||
            useTM.allTasks.find((t) => String(t.id) === targetId);
        if (!dragged || !target) return;

        // Milestones are pinned and never reparented. The Draggable
        // itself is also disabled for milestone rows, so this is a
        // belt-and-braces guard.
        if (dragged.isMilestone === true) return;

        // Already a child of this target — no-op.
        if (dragged.parentTaskId != null && String(dragged.parentTaskId) === String(target.id)) {
            return;
        }

        // Cycle check: target must not be a descendant of dragged.
        // Uses the unfiltered `allChildrenByParent` index (built once per
        // task-set change) so a filter-hidden descendant still blocks the
        // move. The previous implementation scanned `useTM.allTasks`
        // linearly inside the BFS loop — O(N × depth) per drag. With the
        // index this collapses to O(visited).
        const isDescendant = (ancestorId: string, candidateId: string): boolean => {
            const stack: string[] = [ancestorId];
            const visited = new Set<string>();
            while (stack.length > 0) {
                const current = stack.pop();
                if (current == null || visited.has(current)) continue;
                visited.add(current);
                const childIds = allChildrenByParent.get(current);
                if (!childIds) continue;
                for (const cid of childIds) {
                    if (cid === candidateId) return true;
                    stack.push(cid);
                }
            }
            return false;
        };
        if (isDescendant(draggedId, targetId)) return;

        // Where the dragged row now sits. The drop target's milestone,
        // sprint and chain root all transfer to it — and, below, to
        // everything under it, which is what the server does with the
        // same move.
        const position: TreePosition = {
            milestoneId: target.milestoneId ?? null,
            sprintId: target.sprintId ?? null,
            rootTaskId: Number(target.rootTaskId ?? target.id),
        };
        const updated: TaskTableProps = {
            ...dragged,
            parentTaskId: String(target.id),
            ...position,
        };

        // Optimistic state update — mirrors the milestone-edit path
        // in `handleRowUpdate` (see lines ~902 / 905).
        //
        // The sub-tree has to come along: milestone-scoped views filter
        // on `milestoneId`, so descendants left on the old milestone
        // vanish from under their own parent. The PUT doesn't trigger a
        // project refetch, so nothing else would correct them.
        const applyMove = (rows: TaskTableProps[]): TaskTableProps[] =>
            applyTreePositionToDescendants(
                rows.map((t) => (String(t.id) === String(dragged.id) ? updated : t)),
                dragged.id ?? "",
                position
            );
        // What the move is about to change, for putting it back if the server
        // refuses it: the dragged row and everything under it, as each list
        // holds them now. Only those rows go back, so an edit that landed
        // elsewhere in the table while the request was in flight survives.
        const priorPreview = useTM.currentPreviewTask;
        const movedIds = new Set([
            String(dragged.id),
            ...collectDescendantIds(useTM.allTasks, dragged.id ?? ""),
        ]);
        const revertMoveIn = (before: TaskTableProps[]) => {
            const priorRows = new Map(
                before.filter((t) => movedIds.has(String(t.id))).map((t) => [String(t.id), t])
            );
            return (rows: TaskTableProps[]): TaskTableProps[] =>
                rows.map((t) => priorRows.get(String(t.id)) ?? t);
        };
        const revertDisplayed = revertMoveIn(currentDisplayingTasks);
        const revertAll = revertMoveIn(useTM.allTasks);
        setCurrentDisplayingTasks(applyMove);
        useTM.setAllTasks(applyMove);

        // Mirror the move onto the open preview's task object, the same
        // way `handleRowUpdate` mirrors an inline cell edit. Without
        // this the preview keeps the PRE-drag `parentTaskId` /
        // `milestoneId` in its working copy, and the next metadata save
        // from the preview (a tag edit, a status flip, ...) PUTs those
        // stale values back — `sendUpdatedSpecificTask` always sends
        // `parent_task_id` + `milestone` — silently reverting the drag.
        if (useTM.currentPreviewTask && String(useTM.currentPreviewTask.id) === draggedId) {
            useTM.setCurrentPreviewTask({
                ...useTM.currentPreviewTask,
                parentTaskId: Number(target.id),
                milestoneId: target.milestoneId ?? null,
                // Not part of the PUT (the backend re-derives it), but the
                // subtask badge / diagram anchor read it locally.
                rootTaskId: Number(target.rootTaskId ?? target.id),
            });
        }

        // Auto-expand the new parent so the reparented row stays
        // visible — otherwise it disappears into a collapsed subtree.
        setExpandedRows((prev) => {
            if (prev.has(String(target.id))) return prev;
            const next = new Set(prev);
            next.add(String(target.id));
            return next;
        });

        try {
            await updateTaskFromTable(updated, myself, socket || null, accessToken, teamMembers);
        } catch (error) {
            console.error("Error reparenting task:", error);
            // The server refused the move (the reason is on screen). Nothing
            // was stored, so the optimistic move above would otherwise stay on
            // screen as if it had been. Any other failure keeps the old
            // log-only behaviour.
            if (error instanceof TaskSaveRefusedError) {
                setCurrentDisplayingTasks(revertDisplayed);
                useTM.setAllTasks(revertAll);
                if (priorPreview && String(priorPreview.id) === draggedId) {
                    useTM.setCurrentPreviewTask((prev) =>
                        prev && String(prev.id) === draggedId
                            ? {
                                  ...prev,
                                  parentTaskId: priorPreview.parentTaskId,
                                  milestoneId: priorPreview.milestoneId,
                                  rootTaskId: priorPreview.rootTaskId,
                              }
                            : prev
                    );
                }
            }
        }
    };

    // Handle drag end: combine = drop ONTO another row (reparent +
    // persist); destination = drop between rows (local reorder only,
    // matches previous behaviour).
    const handleDragEnd = (result: DropResult) => {
        // Before any early return below — a cancelled drag (Esc, drop outside
        // the list) still has to re-enable hover family-focus.
        setIsDragActive(false);
        if (result.combine) {
            void reparentTask(result.draggableId, result.combine.draggableId);
            return;
        }
        if (!result.destination) return;

        const items = Array.from(currentDisplayingTasks);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        setCurrentDisplayingTasks(items);
    };

    // Handle header click for sorting: a temporary override of the primary
    // tier (see `nextHeaderTiers` for the asc -> desc -> back-to-saved cycle).
    const handleHeaderClick = (field: string) => {
        // Custom-field columns are display-only for sorting — the sort
        // pipeline (sortTask.ts fieldValue) has no resolver for them,
        // so a click would set a tier that compares nothing.
        if (parseCustomFieldColKey(field) != null) return;
        setTableSortOverride(
            nextHeaderTiers(sortTiers, field, activeSortOverride != null),
            sortOverrideProjectId
        );
    };

    // Apply sorting whenever the user's sort tiers change. The deep
    // dep is `sortTiers` (array identity from the hook) — flipping a
    // header re-runs this and re-sorts the currently displayed rows.
    useEffect(() => {
        if (currentDisplayingTasks.length > 0) {
            setCurrentDisplayingTasks(sortTasks(currentDisplayingTasks));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortTiers]);

    // Sorted setter for the filter pipeline. `TaskFilterMenu` calls back
    // into the table whenever filters or the upstream task list change,
    // and previously dropped a raw unsorted array into
    // `currentDisplayingTasks`. The `[sortConfig]` effect above only runs
    // on header-clicks, so the freshly filtered rows would render in
    // whatever order the filter happened to build them — bypassing the
    // milestone-pin / priority / status / due-date comparator entirely
    // on first paint and on every filter toggle. Routing the filter
    // through this setter applies the active sort up-front; drag-end and
    // inline row-update handlers keep using the raw `setCurrentDisplayingTasks`
    // so manual reordering isn't immediately re-sorted.
    const setCurrentDisplayingTasksSorted = useCallback(
        (tasks: TaskTableProps[]) => {
            setCurrentDisplayingTasks(sortTasks(tasks));
        },
        [sortTasks]
    );

    // What `handleRowUpdate` reads AFTER its `await`. A row is memoised and its
    // comparator ignores `onRowUpdate`, so a row that has not re-rendered keeps the
    // callback of the render it last drew in, and everything that callback closed
    // over is as old as that render. Reading the lists from the closure after a
    // save wrote every row edited since back to what that render saw: edit task A,
    // then task B, and A reverted until a reload (MIP-1034).
    const latestForRowUpdate = useRef({
        displaying: currentDisplayingTasks,
        preview: useTM.currentPreviewTask,
    });
    latestForRowUpdate.current = {
        displaying: currentDisplayingTasks,
        preview: useTM.currentPreviewTask,
    };

    // Handle row update
    const handleRowUpdate = async (updatedRow: TaskTableProps): Promise<TaskTableProps> => {
        try {
            // Milestone rows are persisted through the milestone API
            // (PATCH /api/v2/milestone/<id>/), not the task API. Without
            // this branch the row's edit only updates the backing
            // TaskMaster row while the authoritative `MilestoneMaster`
            // record (which `MilestonePreviewInner` reads from via
            // `useSM.projectMilestones`) drifts out of sync.
            //
            // The backend's milestone PATCH handler calls
            // `_sync_backing_task` after saving so the table row stays
            // consistent on the server side too.
            if (updatedRow.isMilestone === true && updatedRow.milestoneId != null) {
                const projectId = Number(updatedRow.projectId);
                if (!Number.isFinite(projectId) || projectId <= 0) {
                    return updatedRow;
                }
                const prevRow = currentDisplayingTasks.find((t) => t.id === updatedRow.id);
                const patch: Parameters<typeof useSM.updateExistingMilestone>[0] = {
                    milestoneId: updatedRow.milestoneId,
                };
                if ((prevRow?.title ?? "") !== (updatedRow.title ?? "")) {
                    patch.title = updatedRow.title || "";
                }
                if ((prevRow?.status ?? null) !== (updatedRow.status ?? null)) {
                    patch.status = updatedRow.status || undefined;
                }
                if ((prevRow?.priority ?? null) !== (updatedRow.priority ?? null)) {
                    patch.priority = updatedRow.priority || null;
                }
                if ((prevRow?.effortLevel ?? null) !== (updatedRow.effortLevel ?? null)) {
                    patch.effortLevel = updatedRow.effortLevel || null;
                }
                if ((prevRow?.dueDate ?? null) !== (updatedRow.dueDate ?? null)) {
                    const nextDue = updatedRow.dueDate
                        ? dayjs(updatedRow.dueDate).format("YYYY-MM-DD")
                        : null;
                    patch.dueDate = nextDue;
                }
                if ((prevRow?.assigneeId ?? null) !== (updatedRow.assigneeId ?? null)) {
                    patch.assigneeIds = updatedRow.assigneeId ? [updatedRow.assigneeId] : [];
                }
                // Tags is an ARRAY — compare by name-set, not identity, or the
                // patch would always be "changed" and defeat the skip-guard
                // below (churning tsUpdatedAt on every milestone row edit).
                const prevTagNames = (prevRow?.tags ?? [])
                    .map((tg) => tg.tagName)
                    .sort()
                    .join("|");
                const nextTagNames = (updatedRow.tags ?? [])
                    .map((tg) => tg.tagName)
                    .sort()
                    .join("|");
                if (prevTagNames !== nextTagNames) {
                    patch.tags = updatedRow.tags ?? [];
                }

                // Nothing actually changed beyond the bookkeeping id; skip
                // the round-trip so we don't churn `tsUpdatedAt`.
                if (Object.keys(patch).length <= 1) {
                    return updatedRow;
                }

                const updated = await useSM.updateExistingMilestone(patch, projectId);
                if (!updated) return updatedRow;

                // Mirror the milestone shape back onto the table-row
                // shape so the table + sprint board (which read
                // `useTM.allTasks` / `currentDisplayingTasks`) re-render
                // immediately. Mirrors `syncMilestoneToAllTasks` in
                // `MilestonePreviewInner` to keep both entry points
                // converging on the same row format.
                const firstAssignee = updated.assignees?.[0];
                const hasAssignee = firstAssignee?.userId != null;
                const tags = (updated.tags as TagListProps[] | null) ?? [];
                const concatTags =
                    tags.length > 0 ? "/" + tags.map((tg) => tg.tagName).join("/") + "/" : null;
                const dueDateStr = updated.dueDate
                    ? dayjs(updated.dueDate).format("YYYY-MM-DD")
                    : null;
                const mirrored: TaskTableProps = {
                    ...updatedRow,
                    title: updated.title ?? updatedRow.title,
                    status: (updated.status as string) ?? updatedRow.status,
                    priority: updated.priority ?? updatedRow.priority,
                    effortLevel: updated.effortLevel ?? updatedRow.effortLevel,
                    dueDate: dueDateStr ?? updatedRow.dueDate,
                    tags,
                    concatTags,
                    updatedAt: updated.tsUpdatedAt ?? updatedRow.updatedAt,
                    assigneeId: hasAssignee ? String(firstAssignee.userId) : null,
                    assigneeName: hasAssignee
                        ? firstAssignee.username || firstAssignee.email || ""
                        : null,
                    assigneeEmail: hasAssignee ? firstAssignee.email || "" : null,
                    assigneeImgPath: hasAssignee ? firstAssignee.profileImageUrl || "" : null,
                    milestoneId: updated.milestoneId,
                    sprintId: updated.sprintId ?? updatedRow.sprintId,
                    isMilestone: true,
                    customFieldValues: updated.customFieldValues ?? updatedRow.customFieldValues,
                };

                setCurrentDisplayingTasks((prev) =>
                    prev.map((t) => (t.id === mirrored.id ? mirrored : t))
                );
                useTM.setAllTasks((prev) =>
                    prev.map((t) => (String(t.id) === String(mirrored.id) ? mirrored : t))
                );

                return mirrored;
            }

            const result = await updateTaskFromTable(
                updatedRow,
                myself,
                socket || null,
                accessToken,
                teamMembers
            );

            // Update local state
            setCurrentDisplayingTasks((prev) =>
                prev.map((task) => (task.id === result.id ? result : task))
            );

            // Update preview task if it's the current one. Read from the ref: the
            // preview open NOW, not the one this callback's render saw.
            const openPreview = latestForRowUpdate.current.preview;
            let editedPreview: TaskProps | undefined;
            if (openPreview && openPreview.id === Number(result.id)) {
                editedPreview = {
                    ...openPreview,
                    title: result.title || openPreview.title,
                    tags: result.tags || openPreview.tags,
                    concatTags: result.concatTags || openPreview.concatTags,
                    assignee:
                        teamMembers.find((member) => member.userId === result.assigneeId) ||
                        openPreview.assignee,
                    status:
                        statuses.find((status) => status.status === result.status) ||
                        openPreview.status,
                    priority:
                        priorities.find((priority) => priority.priority === result.priority) ||
                        openPreview.priority,
                    effortLevel:
                        effortLevels.find(
                            (effortLevel) => effortLevel.level === result.effortLevel
                        ) || openPreview.effortLevel,
                    dueDate: result.dueDate || openPreview.dueDate,
                };
                useTM.setCurrentPreviewTask(editedPreview);
            }

            // Update allTasks. A functional update, so the save lands on the list as
            // it is now and never on the copy this (possibly old) callback captured.
            useTM.setAllTasks((prev) =>
                prev.map((task) => (task.id === result.id ? result : task))
            );

            // The open preview's row also takes the preview's own values (after
            // the write above, as the flag loop did).
            if (editedPreview) {
                useTM.syncPreviewEdit(editedPreview);
            }

            return result;
        } catch (error) {
            console.error("Error updating row:", error);
            // A refused save stored nothing, and every state write above comes
            // after the await, so nothing optimistic landed: hand back the row
            // as the table still holds it, not the edited copy.
            if (error instanceof TaskSaveRefusedError) {
                return (
                    latestForRowUpdate.current.displaying.find((t) => t.id === updatedRow.id) ??
                    updatedRow
                );
            }
            return updatedRow;
        }
    };

    // Create a child task from the inline quick-add row. Single POST via
    // createQuickTask, then an optimistic insert into `allTasks`:
    // `setIsNewTaskCreated(true)` alone is NOT enough — loadUpdatedTask
    // only refetches the currently *previewed* task (and only that path
    // resets the flag), so with no preview pane open the flag sticks
    // `true` and a second quick-add would never surface until the slow
    // (~1-2s) full loadProjectsAndTasks reload. The optimistic row makes
    // the child appear immediately; the background reload reconciles it
    // with the authoritative server row (displayId etc.).
    //
    // Errors are deliberately not caught here — QuickAddTaskRow catches
    // the rejection and shows its inline error while preserving the
    // user's draft.
    const handleQuickAddSubmit = async (parent: TaskTableProps, draft: QuickAddDraft) => {
        const projectId = usePM.currentProject?.projectId ?? parent.projectId;
        if (parent.id == null || projectId == null) {
            throw new Error("Quick add: missing parent id or project id");
        }
        const { taskId, displayId } = await createQuickTask({
            myself,
            accessToken,
            projectId: Number(projectId),
            title: draft.title,
            parentTaskId: Number(parent.id),
            // A top-level parent is its own chain root.
            rootTaskId: parent.rootTaskId ?? Number(parent.id),
            // Children inherit the parent's milestone context (the
            // backend also derives this from parent_task_id).
            milestoneId: parent.milestoneId ?? null,
            assigneeId: draft.assigneeId,
            status: draft.status,
            priority: draft.priority,
            effortLevel: draft.effortLevel,
            dueDate: draft.dueDate,
            tags: draft.tags,
        });

        if (taskId != null) {
            const optimistic = buildOptimisticQuickTask({
                taskId,
                displayId,
                draft,
                parent,
                projectId: Number(projectId),
                teamId: myself.teamId,
                assignee: teamMembers.find((m) => m.userId === draft.assigneeId),
            });
            // Duplicate-guarded against the race where the background
            // reload lands before this insert.
            useTM.setAllTasks((prev) =>
                prev.some((t) => String(t.id) === String(optimistic.id))
                    ? prev
                    : [...prev, optimistic]
            );
        }

        // Refresh any open TaskSubTasksBlock for the same parent, and
        // reconcile the OPEN project's rows with the server's. Not through
        // `isNewTaskCreated`: that reload goes to `localStorage.lastProjectId`,
        // which another tab can have pointed elsewhere, and the open project
        // then flipped away and back with this row lost (MIP-1335).
        emitTaskTouched(Number(parent.id), "children");
        emitTasksBulkChanged(Number(projectId));
    };

    // Rapid row-click coalescing. Mirrors SprintBoard.handleTaskClick:
    // each preview switch fans out a chain of TaskPreview fetches, so clicking
    // many rows in quick succession (id-cell single click or row
    // double-click) used to peg the backend and break the highlight
    // mid-flight. Decouple instant visual selection from the heavy
    // preview load by holding `pendingTaskId` / `pendingMilestoneId`
    // locally. The load itself is LEADING-edge debounced: a click with no
    // other click in the last 150 ms opens right after the next painted frame
    // (the highlight and the pane paint first), and a rapid sequence
    // collapses to the first row plus the row the user lands on.
    const [pendingTaskId, setPendingTaskId] = useState<number | null>(null);
    const [pendingMilestoneId, setPendingMilestoneId] = useState<number | null>(null);

    const {
        setIsTaskPreviewVisible: setIsTaskPreviewVisibleRow,
        setCurrentPreviewKind: setCurrentPreviewKindRow,
        setCurrentPreviewMilestoneId: setCurrentPreviewMilestoneIdRow,
        setCurrentPreviewTaskId: setCurrentPreviewTaskIdRow,
    } = useTM;

    // The heavy half of a click: the writes that start the preview load. The
    // pending highlight is dropped in the same batch (one commit), because
    // the real preview state now says the same thing.
    const switchPreview = useCallback(
        (task: TaskTableProps) => {
            if (task.isMilestone === true && task.milestoneId != null) {
                setCurrentPreviewKindRow("milestone");
                setCurrentPreviewMilestoneIdRow(task.milestoneId);
                setPendingMilestoneId(null);
            } else if (task.id != null) {
                setCurrentPreviewKindRow("task");
                setCurrentPreviewTaskIdRow(Number(task.id));
                setPendingTaskId(null);
            }
        },
        [setCurrentPreviewKindRow, setCurrentPreviewMilestoneIdRow, setCurrentPreviewTaskIdRow]
    );
    const { call: scheduleSwitchPreview } = useLeadingDebouncedCallback(
        switchPreview,
        PREVIEW_SWITCH_DEBOUNCE_MS
    );

    const requestPreview = useCallback(
        (task: TaskTableProps) => {
            const isMile = task.isMilestone === true && task.milestoneId != null;
            // Step 1: instant visual feedback. Pane visibility is cheap;
            // only the heavy fetch-triggering setters are deferred so
            // opening the pane from a closed state never feels delayed.
            if (isMile) {
                setPendingMilestoneId(task.milestoneId as number);
                setPendingTaskId(null);
            } else if (task.id != null) {
                setPendingTaskId(Number(task.id));
                setPendingMilestoneId(null);
            }
            setIsTaskPreviewVisibleRow(true);

            // Step 2: start the load. The first click does it after the next
            // painted frame, not in this batch; successive rapid clicks
            // coalesce into a single load for the last row.
            scheduleSwitchPreview(task);
        },
        [setIsTaskPreviewVisibleRow, scheduleSwitchPreview]
    );

    // Resolve "is this row the selected/previewed one" HERE rather than
    // inside the row. The inputs (pending click IDs + the real
    // useTM.currentPreview* state) all change on every preview switch, so
    // letting the row compare them meant every row failed its memo check
    // and re-rendered — three times per click, once each for the pending
    // set, the debounced real setter and the pending clear. Resolving to a
    // per-row boolean here means only the two rows whose selection
    // actually flipped re-render. Same precedence as before: a pending
    // click wins over the settled useTM state so the highlight tracks the
    // latest click instantly.
    const resolveIsSelected = useCallback(
        (task: TaskTableProps): boolean => {
            if (task.isMilestone === true) {
                if (pendingMilestoneId != null) return pendingMilestoneId === task.milestoneId;
                return (
                    useTM.isTaskPreviewVisible &&
                    useTM.currentPreviewKind === "milestone" &&
                    useTM.currentPreviewMilestoneId === task.milestoneId
                );
            }
            if (pendingTaskId != null) return pendingTaskId === Number(task.id);
            return useTM.isTaskPreviewVisible && useTM.currentPreviewTaskId === Number(task.id);
        },
        [
            pendingTaskId,
            pendingMilestoneId,
            useTM.isTaskPreviewVisible,
            useTM.currentPreviewKind,
            useTM.currentPreviewTaskId,
            useTM.currentPreviewMilestoneId,
        ]
    );

    // Inputs for the inline quick-add draft row, hoisted out of the row map
    // so they keep a stable identity across renders. Both used to be built
    // inline in the JSX; `?? []` in particular minted a fresh array on every
    // render, which would defeat the TaskTableRows memo boundary below.
    const quickAddProjectTags = useMemo(
        () => usePM.currentProject?.projectTags ?? EMPTY_PROJECT_TAGS,
        [usePM.currentProject?.projectTags]
    );
    const quickAddFieldRules = useMemo(
        () =>
            useTM.taskFieldRules?.projectId === usePM.currentProject?.projectId
                ? (useTM.taskFieldRules?.rules ?? null)
                : null,
        [useTM.taskFieldRules, usePM.currentProject?.projectId]
    );
    // Identity-stable so TaskTableRows (which excludes callbacks from its
    // comparator, same contract as DraggableTaskRow) never holds a closure
    // over stale state — the ref it writes is the only state involved.
    const handleQuickAddDirtyChange = useCallback((dirty: boolean) => {
        quickAddDirtyRef.current = dirty;
    }, []);

    // Show the "Sprint" column only when the filtered list actually
    // contains a milestone — for a pure task-only view the sprint linkage
    // adds noise (most tasks don't carry a sprint of their own; they
    // inherit one through their milestone).
    const hasMilestoneInDisplay = useMemo(
        () => currentDisplayingTasks.some((t) => t.isMilestone === true),
        [currentDisplayingTasks]
    );

    // Resolve a sprintId → sprint name lookup scoped to the current
    // project. Passed into each row so the "Sprint" cell can render the
    // human-readable name without each row re-walking the whole sprint
    // list. Falls back to "Sprint #<id>" inside the row when the sprint
    // hasn't been loaded yet (e.g. mid-fetch on project switch).
    const currentProjectId = usePM.currentProject?.projectId ?? null;
    const sprintNamesById = useMemo(() => {
        const map = new Map<number, string>();
        if (currentProjectId == null) return map;
        const sprints = useSM.projectSprints[currentProjectId] ?? [];
        for (const s of sprints) {
            if (s.isDeleted) continue;
            map.set(s.sprintId, s.name);
        }
        return map;
    }, [useSM.projectSprints, currentProjectId]);

    // User-controlled column layout (localStorage-persisted). The hook
    // owns *toggleable* columns only — `__expand` and `id` are always
    // pinned at the front and never appear in the user's pref state.
    const { fieldOrder, visibilityOverrides } = useTaskTableColumnPreferences();

    const visibleColumns = useMemo(() => {
        const byField = new Map<string, ColumnDef>(
            allColumns.map((c): [string, ColumnDef] => [c.field, c])
        );
        // Fixed leading columns — never reorderable, never hideable.
        const fixedLeading = FIXED_LEADING_FIELDS.map((f: string) => byField.get(f)).filter(
            (c: ColumnDef | undefined): c is ColumnDef => !!c
        );

        // Toggleable columns: start with the user's preferred order,
        // then append any defaults not yet in the user's list (so a
        // newly-added column shows up at the end with default
        // visibility on first render after deploy). Custom-field
        // columns ride the same machinery: their keys embed the server
        // fieldId, so saved order/visibility survive reloads, and keys
        // from OTHER projects simply miss the byField lookup and drop
        // out here.
        const toggleableInDefaultOrder = allColumns.filter(
            (c: ColumnDef) => !FIXED_LEADING_FIELDS.includes(c.field)
        );
        const seen = new Set<string>();
        const orderedToggleable: ColumnDef[] = [];
        for (const field of fieldOrder) {
            const col = byField.get(field);
            if (!col || FIXED_LEADING_FIELDS.includes(field)) continue;
            orderedToggleable.push(col);
            seen.add(field);
        }
        for (const col of toggleableInDefaultOrder) {
            if (!seen.has(col.field)) orderedToggleable.push(col);
        }

        // Effective visibility: user override > column default. The
        // `sprint` column also auto-shows when the current list contains
        // a milestone, regardless of either signal — keeps the existing
        // "milestone view always shows sprint" UX.
        const effectivelyVisible = (col: ColumnDef): boolean => {
            if (col.field in visibilityOverrides) {
                if (visibilityOverrides[col.field]) return true;
                // User explicitly hid sprint, but a milestone is in view —
                // honor the override anyway. The auto-show is a default,
                // not a hard rule.
                return false;
            }
            if (col.field === "sprint" && hasMilestoneInDisplay) return true;
            return !col.hidden;
        };

        return [...fixedLeading, ...orderedToggleable.filter(effectivelyVisible)].map((col) => ({
            ...col,
            // Resolve the translated label for this header at render
            // time. Columns without a labelKey (`__expand` and the
            // custom-field columns, whose header IS the user-defined
            // field name) keep their headerName.
            headerName: col.headerLabelKey
                ? t.tasks.table.columns[col.headerLabelKey]
                : col.headerName,
        }));
    }, [allColumns, fieldOrder, visibilityOverrides, hasMilestoneInDisplay, t]);

    // Create columns with dynamic widths for passing to rows. Memoized so
    // that React.memo on DraggableTaskRow isn't defeated by a fresh array
    // identity on every parent render — `columnWidths` only changes when
    // the user actually drag-resizes a column, so most renders skip the
    // recompute.
    const columnsWithWidths = useMemo<ColumnDef[]>(
        () => visibleColumns.map((col) => ({ ...col, width: getColumnWidth(col.field) })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [visibleColumns, columnWidths]
    );

    // Calculate total table width (leading gutter + all columns)
    const totalTableWidth =
        LEADING_GUTTER_WIDTH +
        visibleColumns.reduce((sum, col) => sum + getColumnWidth(col.field), 0);

    // The skeleton replaces the rows while the first read of a project is in flight.
    const showTaskSkeleton =
        displayRows.length === 0 && (useTM.isLoadingTasks || syncFailure.retrying);

    return (
        <>
            <div
                style={{
                    height: "100%",
                    width: "100%",
                    overflow: "hidden",
                    borderRadius: "8px",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <TaskFilterMenu
                    predefinedTagsFilters={predefinedTagsFilters}
                    savedFiltersProjectId={usePM.currentProject?.projectId}
                    savedFiltersTeamId={myself.teamId}
                    setCurrentDisplayingTasks={setCurrentDisplayingTasksSorted}
                    setIsMemberFilterActive={setIsMemberFilterActive}
                    setMilestoneAutoExpandIds={setMilestoneAutoExpandIds}
                    setVisibleChildTaskIds={setVisibleChildTaskIds}
                    teamMembers={teamMembers}
                    useSM={useSM}
                    useTM={useTM}
                    filterStorageKey={taskFilterStorageKey(
                        "table",
                        usePM.currentProject?.projectId
                    )}
                    onOpenColumnSettings={() => setIsColumnSettingsOpen(true)}
                />
                <TaskTableColumnSettings
                    customColumns={customColumns}
                    open={isColumnSettingsOpen}
                    onClose={() => setIsColumnSettingsOpen(false)}
                />
                <Box
                    ref={gridRef}
                    // A treegrid (`role` below): rows expand to show subtasks. One tab
                    // stop for the whole table, arrows between cells (useGridNav).
                    aria-label={t.tasks.table.gridLabel}
                    className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                    role="treegrid"
                    style={{
                        ...getTableContainerStyles(mode),
                        flex: 1,
                        minHeight: 0,
                        width: "100%",
                        backgroundColor: mode === "dark" ? "#0a0a14" : "#ffffff",
                        cursor: resizingColumn ? "col-resize" : "auto",
                    }}
                    // Everything in the table is one step larger than the app's small text
                    // (13 → 14px, 12 → 13px; MIP-1175). Shared pieces read the tokens (status,
                    // priority, tags, chips); Joy's `body-sm` / `body-xs` levels are fixed rem,
                    // so they are matched here. Scoped to the table: the filter bar above and
                    // the rest of the app keep the normal scale.
                    sx={{
                        "--g-type-body-sm-size": "14px",
                        "--g-type-body-sm-line": "20px",
                        "--g-type-body-xs-size": "13px",
                        "--g-type-body-xs-line": "18px",
                        // The tag chip's own size (ProjectTagChip keeps 0.7rem elsewhere).
                        "--table-tag-size": "0.8125rem",
                        "& .MuiTypography-root.MuiTypography-body-sm": {
                            fontSize: "var(--g-type-body-sm-size)",
                        },
                        "& .MuiTypography-root.MuiTypography-body-xs": {
                            fontSize: "var(--g-type-body-xs-size)",
                        },
                        // The cell the keyboard is on. A cell that holds a button shows
                        // the button's own ring; a cell that only shows a value (weight,
                        // dates) and the drag handle get this one. Inset: a cell fills
                        // its row, an outside ring would be cut by the row below.
                        "& [data-grid-col]:focus-visible": {
                            ...focusRing,
                            outlineOffset: "-2px",
                            borderRadius: "4px",
                        },
                        // Moving the keyboard to a cell scrolls it into view: not under the
                        // sticky header (the scroller's padding, so it holds for every target).
                        scrollPaddingTop: "48px",
                    }}
                >
                    {/* Table Header */}
                    <div
                        role="row"
                        style={{ ...getTableHeaderStyles(mode), minWidth: totalTableWidth }}
                        {...{ [GRID_ROW_ATTR]: GRID_HEADER_ROW }}
                    >
                        {/* The leading gutter (drag, graph, +) is one cell in every body row, so it
                            is one header cell too: without it a screen reader counted one more
                            column in a row than in the header (MIP-1239). Named, not marked as a
                            grid column: there is nothing to sort or to stop on. */}
                        <div
                            role="columnheader"
                            aria-label={t.tasks.table.rowActionsHeader}
                            style={headerDragHandlePlaceholderStyles}
                        />

                        {visibleColumns.map((column, index) => (
                            <div
                                key={column.field}
                                role="columnheader"
                                aria-sort={
                                    sortTiers[0]?.field === column.field
                                        ? sortTiers[0].direction === "asc"
                                            ? "ascending"
                                            : "descending"
                                        : undefined
                                }
                                // The expand column has no visible name and nothing to sort by: a
                                // screen reader gets its name from here, and it has no button (a
                                // nameless button in the header was a control that did nothing).
                                {...(column.field === "__expand"
                                    ? { "aria-label": t.tasks.diagram.tooltips.expand }
                                    : { [GRID_COL_ATTR]: column.field })}
                                style={{
                                    ...getHeaderCellStyles(
                                        getColumnWidth(column.field),
                                        column.align,
                                        mode
                                    ),
                                    position: "relative",
                                    cursor: resizingColumn ? "col-resize" : "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent:
                                        column.align === "center"
                                            ? "center"
                                            : column.align === "right"
                                              ? "flex-end"
                                              : "flex-start",
                                    gap: 4,
                                    borderRight:
                                        index === visibleColumns.length - 1
                                            ? "none"
                                            : mode === "dark"
                                              ? "1px solid rgba(255, 255, 255, 0.04)"
                                              : "1px solid rgba(0, 0, 0, 0.04)",
                                }}
                            >
                                {/* Header content - clickable for sorting */}
                                <PlainButton
                                    // The expand column sorts nothing: no tab stop, no click, and out
                                    // of the accessibility tree (the header cell carries the name).
                                    {...(column.field === "__expand"
                                        ? { "aria-hidden": true, disabled: true, tabIndex: -1 }
                                        : {})}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 4,
                                        flex: 1,
                                        overflow: "hidden",
                                    }}
                                    onClick={() => handleHeaderClick(column.field)}
                                    onMouseEnter={(e) => {
                                        if (!resizingColumn) {
                                            e.currentTarget.style.opacity = "0.8";
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.opacity = "1";
                                    }}
                                >
                                    <span
                                        style={{
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {column.headerName}
                                    </span>
                                    {/* Show the indicator only on the
                                        primary tier (tier 0). The
                                        secondary tier from Settings is
                                        intentionally not flagged in the
                                        header to avoid two arrows
                                        competing visually. */}
                                    {sortTiers[0]?.field === column.field && (
                                        <span
                                            style={{
                                                fontSize: "0.7rem",
                                                color:
                                                    mode === "dark"
                                                        ? "var(--gp-brandalt-400)"
                                                        : "var(--gp-brand-700)",
                                                flexShrink: 0,
                                            }}
                                        >
                                            {sortTiers[0].direction === "asc" ? "▲" : "▼"}
                                        </span>
                                    )}
                                </PlainButton>

                                {/* Resize handle */}
                                {column.resizable !== false && (
                                    <div
                                        title={t.tasks.table.dragToResizeColumn}
                                        style={getResizeHandleStyles(
                                            resizingColumn === column.field,
                                            mode
                                        )}
                                        onMouseDown={(e) => handleResizeStart(e, column.field)}
                                        onMouseEnter={(e) => {
                                            if (!resizingColumn) {
                                                e.currentTarget.style.backgroundColor =
                                                    mode === "dark"
                                                        ? "rgba(var(--gp-brandalt-400-rgb), 0.5)"
                                                        : "rgba(var(--gp-brand-700-rgb), 0.3)";
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!resizingColumn) {
                                                e.currentTarget.style.backgroundColor =
                                                    "transparent";
                                            }
                                        }}
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Draggable Table Body */}
                    <DragDropContext
                        onDragEnd={handleDragEnd}
                        onDragStart={() => {
                            // A pristine quick-add row is dismissed before dnd
                            // measures the list (a non-Draggable row between
                            // Draggables makes the gap animation read wrong);
                            // a dirty one is preserved — typed input is never
                            // destroyed by starting a drag.
                            if (!quickAddDirtyRef.current) closeQuickAdd();
                            setIsDragActive(true);
                        }}
                    >
                        <Droppable
                            direction="vertical"
                            droppableId="task-table"
                            ignoreContainerClipping={false}
                            isCombineEnabled={true}
                            isDropDisabled={false}
                        >
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    // Scope for the hover family-focus rules and the
                                    // element their pointer handlers read rows
                                    // from, so the class must sit on the rows'
                                    // common parent. The drag attribute disables
                                    // the rules wholesale while a row is in flight.
                                    className={TASK_BODY_CLASS}
                                    role="rowgroup"
                                    {...(isDragActive ? { [DND_ACTIVE_ATTR]: "" } : {})}
                                    style={{
                                        // The empty drop zone is 100px so a row can be dropped in;
                                        // while the skeleton stands in for the rows it is 0, or the
                                        // skeleton would start 100px below the header.
                                        minHeight: showTaskSkeleton ? 0 : 100,
                                        minWidth: totalTableWidth,
                                        display: "flex",
                                        flexDirection: "column",
                                        backgroundColor: snapshot.isDraggingOver
                                            ? mode === "dark"
                                                ? "rgba(59, 130, 246, 0.08)"
                                                : "rgba(59, 130, 246, 0.04)"
                                            : "transparent",
                                        transition: "background-color 0.25s ease",
                                    }}
                                    onPointerLeave={onFamilyFocusPointerLeave}
                                    onPointerOver={onFamilyFocusPointerOver}
                                >
                                    <GridNavContext.Provider value={gridNav}>
                                        <TaskTableRows
                                            childrenByParent={childrenByParentEffective}
                                            columns={columnsWithWidths}
                                            customFieldDefs={customFieldDefs}
                                            depthMap={depthMap}
                                            displayRows={displayRows}
                                            expandedRows={expandedRows}
                                            familyKeyByRow={familyKeyByRow}
                                            ghostIds={ghostInfo.ghostIds}
                                            mode={mode}
                                            myself={myself}
                                            projectTags={quickAddProjectTags}
                                            quickAddFieldRules={quickAddFieldRules}
                                            quickAddParentId={quickAddParentId}
                                            quickAddProjectTags={quickAddProjectTags}
                                            resolveIsSelected={resolveIsSelected}
                                            setMyself={setMyself}
                                            socket={socket}
                                            sprintNamesById={sprintNamesById}
                                            teamMembers={teamMembers}
                                            toggleExpand={toggleExpand}
                                            useCM={useCM}
                                            useTEM={useTEM}
                                            useTM={useTM}
                                            useUISM={useUISM}
                                            onOpenDiagram={openDiagram}
                                            onQuickAddChild={openQuickAdd}
                                            onQuickAddClose={closeQuickAdd}
                                            onQuickAddDirtyChange={handleQuickAddDirtyChange}
                                            onQuickAddSubmit={handleQuickAddSubmit}
                                            onRequestPreview={requestPreview}
                                            onRowUpdate={handleRowUpdate}
                                        />
                                    </GridNavContext.Provider>
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>

                    {/* Empty state: show a spinner while we are still fetching tasks
                        (initial mount, team switch, or project switch). Once the load
                        completes and there is genuinely nothing to show, fall back to
                        the static "No tasks to display" message, unless the refresh
                        FAILED: then it is the error with Retry, because "No tasks to
                        display" would be a claim nothing checked (MIP-1298). Rows that are
                        cached but all filtered out stay an empty FILTER, not a failure. */}
                    {displayRows.length === 0 && (
                        <DataState
                            error={syncFailure.failed && useTM.allTasks.length === 0}
                            hasData={false}
                            loading={useTM.isLoadingTasks || syncFailure.retrying}
                            empty={{
                                body: t.tasks.table.emptyHint,
                                "data-empty": "task-table",
                                title: t.tasks.table.emptyTitle,
                            }}
                            errorState={{
                                "data-error": "task-table",
                                onRetry: syncFailure.retry,
                                title: t.common.feedback.sync.tasksFailed,
                            }}
                            skeleton={
                                <TaskTableSkeleton
                                    columns={columnsWithWidths}
                                    gutterWidth={LEADING_GUTTER_WIDTH}
                                    label={t.tasks.table.loadingTasks}
                                />
                            }
                        />
                    )}
                </Box>
            </div>

            {/* Shared task-graph modal for the per-row gutter trigger.
                Anchored on the row's OWN id. A top-level row (root task /
                milestone) is already the top of its tree, so the tree scope
                draws everything under it. A nested row uses the task scope:
                only that task and its subtasks, not its milestone or
                siblings. Page-hosted surface, so the diagram's default 9999
                layer applies (no zIndex). */}
            {diagramTarget != null &&
                diagramTarget.task.id != null &&
                (diagramTarget.task.projectId ?? usePM.currentProject?.projectId) != null && (
                    <LazyTaskDiagram
                        myself={myself}
                        open={true}
                        rootTaskId={Number(diagramTarget.task.id)}
                        scope={diagramTarget.scope}
                        usePM={usePM}
                        useSM={useSM}
                        useTM={useTM}
                        projectId={Number(
                            diagramTarget.task.projectId ?? usePM.currentProject?.projectId
                        )}
                        rootLabel={`${formatTaskDisplayId(diagramTarget.task)} · ${
                            diagramTarget.task.title || t.tasks.diagram.untitled
                        }`}
                        onClose={() => setDiagramTarget(null)}
                    />
                )}
        </>
    );
};
