import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    closestCenter,
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragStartEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import PendingIcon from "@mui/icons-material/Pending";
import { Box, CircularProgress, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import dayjs from "dayjs";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { TagListProps, TaskTableProps } from "../../../../types/tasks";
import { popTeamMembers } from "../../../chat/services/popTeamMembers";
import { loadProjectTags } from "../../services/loadProjectTags";
import { updateTaskFromTable } from "../../services/updateTaskFromTable";
import { FilterProps } from "../../types/TaskTableTypes";
import { effortLevels, priorities, statuses } from "../../utils/taskMeta";
import { DraggableTaskRow } from "./DraggableTaskRow";
import { TaskFilterMenu } from "./TaskFilterMenu";

const materialTheme = createTheme({ cssVariables: true });

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
    { field: "__expand", headerName: "", width: 32, align: "center", resizable: false },
    {
        field: "id",
        headerName: "ID",
        headerLabelKey: "id",
        width: 80,
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
        width: 100,
        minWidth: 80,
        align: "center",
        editable: true,
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

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------
//
// Categorical fields stored as strings (priority / effortLevel / status) are
// what the user perceives as ordered, but `localeCompare` would sort them
// alphabetically — e.g. Priority desc would surface "Normal" above "Low" and
// bury "Critical" below "High" because of the letter ordering. The rank maps
// below give each value an explicit numeric weight so the comparator can do
// the obvious thing. Higher rank = more urgent for priority/effort. For
// status the workflow order Open → WIP → Pending → Closed → Deleted is
// modelled as ascending so "asc" naturally surfaces the most active rows
// first; "desc" shows Deleted/Closed first.
const PRIORITY_RANK: Record<string, number> = {
    Critical: 5,
    High: 4,
    Normal: 3,
    Low: 2,
    Minimal: 1,
};

const EFFORT_RANK: Record<string, number> = {
    Extensive: 5,
    High: 4,
    Moderate: 3,
    Low: 2,
    Minimal: 1,
};

const STATUS_RANK: Record<string, number> = {
    Open: 1,
    WIP: 2,
    Pending: 3,
    Closed: 4,
    Deleted: 5,
};

// Parse a date string into an epoch ms number for numeric comparison.
// `dueDate` is a free-form locale-ish string in the table model, so a plain
// string sort would put "10/2/2025" before "9/30/2025"; using dayjs gives
// the chronological ordering users expect.
const parseTs = (s: string | null | undefined): number | null => {
    if (!s) return null;
    const d = dayjs(s);
    return d.isValid() ? d.valueOf() : null;
};

const numericId = (s: string | number | null | undefined): number | null => {
    if (s == null || s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};

const lowerStr = (s: string | null | undefined): string | null => {
    if (s == null || s === "") return null;
    return s.toLowerCase();
};

// Resolve a row's value for a given sort field, normalizing it into the
// shape the comparator expects:
//   - numeric for id / daysLeft / priority / effortLevel / status / dates
//   - lowercased string for textual columns
//   - null when the row is missing the value (caller pushes nulls to the
//     bottom regardless of direction)
const fieldValue = (task: TaskTableProps, field: string): number | string | null => {
    switch (field) {
        case "id":
            return numericId(task.id);
        case "daysLeft":
            return task.daysLeft ?? null;
        case "title":
            return lowerStr(task.title);
        case "assigneeId":
            // Sort by what the user actually sees in the cell, not the raw
            // user-id UUID, so the column ordering matches their reading.
            return (
                lowerStr(task.assigneeName) ??
                lowerStr(task.assigneeEmail) ??
                lowerStr(task.assigneeId)
            );
        case "priority":
            return PRIORITY_RANK[task.priority ?? ""] ?? null;
        case "effortLevel":
            return EFFORT_RANK[task.effortLevel ?? ""] ?? null;
        case "status":
            return STATUS_RANK[task.status ?? ""] ?? null;
        case "tags":
            return lowerStr(task.concatTags);
        case "sprint":
            // Sort by sprintId so tasks/milestones in the same sprint
            // cluster together. Sprint names live in component state
            // (`sprintNamesById`) and aren't reachable from this
            // module-scope helper; sprintId is monotonically allocated
            // so it correlates with sprint creation/sequence order.
            return task.sprintId ?? null;
        case "dueDate":
        case "updatedAt":
        case "createdDate":
            return parseTs((task as any)[field]);
        default: {
            const raw = (task as any)[field];
            if (raw == null || raw === "") return null;
            return typeof raw === "number" ? raw : String(raw).toLowerCase();
        }
    }
};

// "Null tier" partition: rows missing the sort value always sink to the
// bottom regardless of `asc`/`desc`, which matches what the user expects
// when toggling direction (e.g. "Due Date desc" shouldn't fill the top
// with rows that have no due date).
const nullTier = (a: unknown, b: unknown): number => {
    const aNull = a == null;
    const bNull = b == null;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    return 0;
};

const cmpValues = (a: number | string | null, b: number | string | null): number => {
    if (a == null || b == null) return 0; // null-tier already handled
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b));
};

// Status options for dropdown. `label` doubles as a fallback for the
// rendered display string; the actual UI looks up the label by
// `t.tasks.filters[labelKey]` at render time (see DraggableTaskRow).
export const statusOptions = [
    {
        label: "Open",
        labelKey: "open" as const,
        value: "Open",
        color: "#0044c2",
        textColor: "white",
        icon: <CheckCircleOutlineIcon style={{ color: "white" }} />,
    },
    {
        label: "WIP",
        labelKey: "wip" as const,
        value: "WIP",
        color: "#ff8c00",
        textColor: "white",
        icon: <AutorenewIcon style={{ color: "white" }} />,
    },
    {
        label: "Pending",
        labelKey: "pending" as const,
        value: "Pending",
        color: "#b900ff",
        textColor: "white",
        icon: <PendingIcon style={{ color: "white" }} />,
    },
    {
        label: "Closed",
        labelKey: "closed" as const,
        value: "Closed",
        color: "#1dc200",
        textColor: "white",
        icon: <CheckCircleOutlineIcon style={{ color: "white" }} />,
    },
    {
        label: "Deleted",
        labelKey: "deleted" as const,
        value: "Deleted",
        color: "#ff2323",
        textColor: "white",
        icon: <HighlightOffIcon style={{ color: "white" }} />,
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
    fontSize: "0.7rem",
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

// Drag handle placeholder in header
const headerDragHandlePlaceholderStyles: React.CSSProperties = {
    width: 28,
    minWidth: 28,
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
    backgroundColor: isResizing ? (mode === "dark" ? "#a78bfa" : "#7c3aed") : "transparent",
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
    const isDark = colorMode === "dark";
    // Normalize mode to only "light" | "dark" | undefined (treat "system" as undefined)
    const mode: "light" | "dark" | undefined =
        colorMode === "light" || colorMode === "dark" ? colorMode : undefined;

    const [currentDisplayingTasks, setCurrentDisplayingTasks] = useState<TaskTableProps[]>([]);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    // Set of child task ids that pass the active TaskFilterMenu
    // selection (status / tags / priority / effort / milestone). The
    // filter menu computes this in the same pass it builds
    // `currentDisplayingTasks` and pushes it here. `null` = filter has
    // not run yet; treat as permissive so the table is usable on
    // first paint without flashing children in and out.
    const [visibleChildTaskIds, setVisibleChildTaskIds] = useState<Set<string> | null>(null);
    // Default to "Priority desc" so the comparator's multi-tier ordering
    // (Priority desc → Status asc → DueDate asc) kicks in on first paint:
    // Critical work surfaces above everything else, with Status and Due
    // Date breaking ties. Users can still click any column header to swap
    // the primary tier; the rest stay as tie-breakers.
    const [sortConfig, setSortConfig] = useState<{ field: string; direction: "asc" | "desc" }>({
        field: "priority",
        direction: "desc",
    });

    // @dnd-kit drag state. `combineTargetId` is the row id whose centre
    // the cursor is hovering over — when set, dropping there will
    // reparent. We hold a ref alongside the state so the high-frequency
    // `onDragOver` doesn't trigger a render on every animation frame.
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [combineTargetId, setCombineTargetId] = useState<string | null>(null);
    const combineTargetIdRef = useRef<string | null>(null);

    // 4px activation distance keeps click-without-drag (cell editing,
    // milestone-row openPreview) reaching `onClick`. Keyboard sensor wires
    // accessibility through @dnd-kit/sortable's coordinate getter.
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const toggleExpand = useCallback((id: string) => {
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
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
        return map;
    }, [useTM.allTasks, visibleChildTaskIds]);

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

    const depthMap = useMemo(() => new Map<string, number>(), []);

    const displayRows = useMemo(() => {
        depthMap.clear();
        const result: TaskTableProps[] = [];

        const insertWithChildren = (task: TaskTableProps, depth: number) => {
            depthMap.set(String(task.id), depth);
            result.push(task);
            if (task.id && expandedRows.has(String(task.id))) {
                const children = childrenByParent.get(String(task.id)) || [];
                for (const child of children) {
                    insertWithChildren(child, depth + 1);
                }
            }
        };

        const parentRows = currentDisplayingTasks.filter((t) => t.parentTaskId == null);
        for (const row of parentRows) {
            insertWithChildren(row, 0);
        }
        return result;
    }, [currentDisplayingTasks, expandedRows, childrenByParent]);

    // Stable string-id array for SortableContext. dnd-kit's reorder math
    // walks this list, so it has to be referentially stable when the
    // underlying displayRows array's content hasn't changed.
    const displayRowIds = useMemo(() => displayRows.map((t) => String(t.id ?? "")), [displayRows]);

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

    // Keep ref in sync with state
    useEffect(() => {
        columnWidthsRef.current = columnWidths;
    }, [columnWidths]);

    // Handle column resize move - defined first so it can be referenced
    const handleResizeMove = useCallback((e: MouseEvent) => {
        const currentColumn = resizingColumnRef.current;
        if (!currentColumn) return;

        const delta = e.clientX - resizeStartX.current;
        const column = defaultColumns.find((c) => c.field === currentColumn);
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
        return columnWidths[field] || defaultColumns.find((c) => c.field === field)?.width || 100;
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

    // Get Project tags
    const [predefinedTagsFilters, setPredefinedTagsFilters] = useState<FilterProps[]>([]);
    const updateTagOptions = async () => {
        if (useTM.allTasks.length > 0) {
            const loadedProjectTags: TagListProps[] = await loadProjectTags(
                myself,
                useTM.allTasks[0].projectId || -1,
                accessToken
            );
            if (loadedProjectTags.length > 0) {
                const allTagFilter: FilterProps = {
                    label: "All",
                    labelKey: "all",
                    filterModel: { items: [] },
                    lightModeColor: "#6b7280",
                    darkModeColor: "#9ca3af",
                };
                const tagBasedFilters: FilterProps[] = loadedProjectTags.map((tag) => ({
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
            }
        }
    };

    useEffect(() => {
        updateTagOptions();
    }, [usePM.currentProject, useTM.allTasks]);

    // Sort tasks.
    //
    // Layered comparator, in order:
    //   1. Milestone vs. task — milestones are higher-level work items and
    //      are always pinned above regular tasks regardless of which column
    //      / direction the user picked. Among the pinned milestones we sort
    //      by sprint asc → due date asc → id asc so the next-up milestone
    //      surfaces first. Filtering hides milestones; sorting never does.
    //   2. Primary tier — the column the user clicked, with field-aware
    //      comparison (numeric for ids/daysLeft, semantic-rank for
    //      priority/status/effort, real date parsing for date columns,
    //      locale-aware for text columns). Nulls always sink to the
    //      bottom regardless of `asc`/`desc`.
    //   3. "Always-on" multi-tier tie-breakers — Priority desc (Critical
    //      first) → Status asc (Open → WIP → Pending → Closed → Deleted) →
    //      Due Date asc (expired first). Each tier is skipped if it's
    //      already the primary so the user's column click stays the
    //      dominant signal.
    //   4. Final deterministic tie-break by id so equal rows don't
    //      visually shuffle on re-render.
    const sortTasks = useCallback(
        (tasks: TaskTableProps[]) => {
            const dir = sortConfig.direction === "asc" ? 1 : -1;
            const primary = sortConfig.field;

            const idTieBreak = (a: TaskTableProps, b: TaskTableProps) =>
                (numericId(a.id) ?? Number.MAX_SAFE_INTEGER) -
                (numericId(b.id) ?? Number.MAX_SAFE_INTEGER);

            const compareMilestones = (a: TaskTableProps, b: TaskTableProps) => {
                // Sort milestones primarily by `daysLeft` ascending so the
                // ordering naturally reads as:
                //   - Expired milestones (negative daysLeft) at the top,
                //   - then due-soon, then later,
                //   - with future-sprint milestones (large daysLeft) sinking
                //     to the bottom of the milestone group (but still above
                //     every regular task — that's enforced by the milestone
                //     pin in the outer comparator).
                // Milestones with no due date are unscheduled, so they sink
                // below all dated milestones.
                const aDays = a.daysLeft ?? null;
                const bDays = b.daysLeft ?? null;
                const daysTier = nullTier(aDays, bDays);
                if (daysTier !== 0) return daysTier;
                if (aDays != null && bDays != null && aDays !== bDays) {
                    return aDays - bDays;
                }
                // `daysLeft` is a derived/cached value — fall back to the
                // raw due date in case a row has one set without the other.
                const aDue = parseTs(a.dueDate);
                const bDue = parseTs(b.dueDate);
                const dueTier = nullTier(aDue, bDue);
                if (dueTier !== 0) return dueTier;
                if (aDue != null && bDue != null && aDue !== bDue) return aDue - bDue;
                // Group same-due milestones by their sprint so a planning
                // window stays visually coherent, then id for determinism.
                const aSprint = a.sprintId ?? null;
                const bSprint = b.sprintId ?? null;
                const sprintTier = nullTier(aSprint, bSprint);
                if (sprintTier !== 0) return sprintTier;
                if (aSprint != null && bSprint != null && aSprint !== bSprint) {
                    return aSprint - bSprint;
                }
                return idTieBreak(a, b);
            };

            const tieBreakers = (a: TaskTableProps, b: TaskTableProps) => {
                if (primary !== "priority") {
                    const ap = PRIORITY_RANK[a.priority ?? ""] ?? null;
                    const bp = PRIORITY_RANK[b.priority ?? ""] ?? null;
                    const t = nullTier(ap, bp);
                    if (t !== 0) return t;
                    if (ap != null && bp != null && ap !== bp) return bp - ap; // desc
                }
                if (primary !== "status") {
                    const as = STATUS_RANK[a.status ?? ""] ?? null;
                    const bs = STATUS_RANK[b.status ?? ""] ?? null;
                    const t = nullTier(as, bs);
                    if (t !== 0) return t;
                    if (as != null && bs != null && as !== bs) return as - bs; // asc
                }
                if (primary !== "dueDate") {
                    const ad = parseTs(a.dueDate);
                    const bd = parseTs(b.dueDate);
                    const t = nullTier(ad, bd);
                    if (t !== 0) return t;
                    if (ad != null && bd != null && ad !== bd) return ad - bd; // asc (expired first)
                }
                return idTieBreak(a, b);
            };

            return [...tasks].sort((a, b) => {
                // 1. Pin milestones to the top.
                const aMile = a.isMilestone === true;
                const bMile = b.isMilestone === true;
                if (aMile !== bMile) return aMile ? -1 : 1;
                if (aMile && bMile) return compareMilestones(a, b);

                // 2. Primary column.
                const av = fieldValue(a, primary);
                const bv = fieldValue(b, primary);
                const primaryNullTier = nullTier(av, bv);
                if (primaryNullTier !== 0) return primaryNullTier;
                const primaryCmp = cmpValues(av, bv) * dir;
                if (primaryCmp !== 0) return primaryCmp;

                // 3 + 4. Multi-tier tie-breakers, then id.
                return tieBreakers(a, b);
            });
        },
        [sortConfig]
    );

    // Reparent a task by dropping it ONTO another row (the "combine"
    // gesture; replaces rbd's built-in `combine` via @dnd-kit's
    // pointer-vs-rect midpoint test in `handleDragOver` below).
    // Milestones can't be moved;
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

        const updated: TaskTableProps = {
            ...dragged,
            parentTaskId: String(target.id),
            milestoneId: target.milestoneId ?? null,
        };

        // Optimistic state update — mirrors the milestone-edit path
        // in `handleRowUpdate` (see lines ~902 / 905).
        setCurrentDisplayingTasks((prev) =>
            prev.map((t) => (String(t.id) === String(dragged.id) ? updated : t))
        );
        useTM.setAllTasks((prev) =>
            prev.map((t) => (String(t.id) === String(dragged.id) ? updated : t))
        );

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
        }
    };

    // Reorder a flat list of tasks by id. Operates on `currentDisplayingTasks`
    // so the visible order updates immediately; the displayRows tree is
    // re-derived in the next render. We only consider top-level rows (since
    // those are the ones SortableContext orders); a drop onto a child row
    // is interpreted as "reparent under" via the combine path instead.
    const reorderTopLevel = (activeId: string, overId: string) => {
        const items = Array.from(currentDisplayingTasks);
        const from = items.findIndex((t) => String(t.id) === activeId);
        const to = items.findIndex((t) => String(t.id) === overId);
        if (from === -1 || to === -1 || from === to) return;
        const [moved] = items.splice(from, 1);
        items.splice(to, 0, moved);
        setCurrentDisplayingTasks(items);
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragId(String(event.active.id));
        combineTargetIdRef.current = null;
        setCombineTargetId(null);
    };

    // Distinguish "drop between rows" (reorder) from "drop onto a row"
    // (reparent / combine). rbd had this baked in; @dnd-kit doesn't —
    // we infer it from the geometry of the active vs over rect. Centre
    // 50% of the over row = combine. The cycle index (`allChildrenByParent`)
    // built in Phase 5.4 lets us silently suppress the combine cue when
    // it would create a cycle, so the user only sees the cue when the
    // drop is actually accepted.
    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) {
            if (combineTargetIdRef.current !== null) {
                combineTargetIdRef.current = null;
                setCombineTargetId(null);
            }
            return;
        }
        const activeRect = active.rect.current.translated;
        const overRect = over.rect;
        if (!activeRect) return;
        const dragMidY = activeRect.top + activeRect.height / 2;
        const overMidY = overRect.top + overRect.height / 2;
        const combineThreshold = overRect.height * 0.25;
        const wouldCombine = Math.abs(dragMidY - overMidY) < combineThreshold;
        const overId = String(over.id);

        // Disallow combine onto self or onto descendants (would create
        // a cycle). Cheap O(visited) lookup via the index from 5.4.
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

        let next: string | null = null;
        if (wouldCombine && !isDescendant(String(active.id), overId)) {
            next = overId;
        }
        if (combineTargetIdRef.current !== next) {
            combineTargetIdRef.current = next;
            setCombineTargetId(next);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        const activeId = String(active.id);
        const combineTarget = combineTargetIdRef.current;
        combineTargetIdRef.current = null;
        setCombineTargetId(null);
        setActiveDragId(null);

        if (combineTarget && combineTarget !== activeId) {
            void reparentTask(activeId, combineTarget);
            return;
        }
        if (!over || over.id === active.id) return;
        reorderTopLevel(activeId, String(over.id));
    };

    // Handle header click for sorting
    const handleHeaderClick = (field: string) => {
        setSortConfig((prev) => ({
            field,
            direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
        }));
    };

    // Apply sorting when sort config changes
    useEffect(() => {
        if (currentDisplayingTasks.length > 0) {
            setCurrentDisplayingTasks(sortTasks(currentDisplayingTasks));
        }
    }, [sortConfig]);

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

            // Update preview task if it's the current one
            if (useTM.currentPreviewTask && useTM.currentPreviewTask.id === Number(result.id)) {
                useTM.setCurrentPreviewTask({
                    ...useTM.currentPreviewTask,
                    title: result.title || useTM.currentPreviewTask.title,
                    tags: result.tags || useTM.currentPreviewTask.tags,
                    concatTags: result.concatTags || useTM.currentPreviewTask.concatTags,
                    assignee:
                        teamMembers.find((member) => member.userId === result.assigneeId) ||
                        useTM.currentPreviewTask.assignee,
                    status:
                        statuses.find((status) => status.status === result.status) ||
                        useTM.currentPreviewTask.status,
                    priority:
                        priorities.find((priority) => priority.priority === result.priority) ||
                        useTM.currentPreviewTask.priority,
                    effortLevel:
                        effortLevels.find(
                            (effortLevel) => effortLevel.level === result.effortLevel
                        ) || useTM.currentPreviewTask.effortLevel,
                    dueDate: result.dueDate || useTM.currentPreviewTask.dueDate,
                });
            }

            // Update allTasks
            const updatedAllTasks = useTM.allTasks.map((task) =>
                task.id === result.id ? result : task
            );
            useTM.setAllTasks(updatedAllTasks);

            // Trigger task update
            if (useTM.currentPreviewTask && useTM.currentPreviewTask.id === Number(result.id)) {
                useTM.setIsTaskUpdated(true);
            }

            return result;
        } catch (error) {
            console.error("Error updating row:", error);
            return updatedRow;
        }
    };

    // Handle row click for preview
    const handleRowDoubleClick = (taskId: number) => {
        useTM.setIsTaskPreviewVisible(true);
        useTM.setCurrentPreviewTaskId(taskId);
    };

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

    const visibleColumns = useMemo(
        () =>
            defaultColumns
                .filter((col) => {
                    if (col.hidden) return false;
                    if (col.field === "sprint" && !hasMilestoneInDisplay) return false;
                    return true;
                })
                .map((col) => ({
                    ...col,
                    // Resolve the translated label for this header at render
                    // time. Columns without a labelKey (only `__expand`) keep
                    // their empty headerName.
                    headerName: col.headerLabelKey
                        ? t.tasks.table.columns[col.headerLabelKey]
                        : col.headerName,
                })),
        [hasMilestoneInDisplay, t]
    );

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

    // Calculate total table width (drag handle + all columns)
    const dragHandleWidth = 28;
    const totalTableWidth =
        dragHandleWidth + visibleColumns.reduce((sum, col) => sum + getColumnWidth(col.field), 0);

    return (
        <ThemeProvider theme={{ [THEME_ID]: materialTheme }}>
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
                    isTaskUpdated={useTM.isTaskUpdated}
                    predefinedTagsFilters={predefinedTagsFilters}
                    setCurrentDisplayingTasks={setCurrentDisplayingTasksSorted}
                    setVisibleChildTaskIds={setVisibleChildTaskIds}
                    useSM={useSM}
                    useTM={useTM}
                />
                <div
                    className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                    style={{
                        ...getTableContainerStyles(mode),
                        flex: 1,
                        minHeight: 0,
                        width: "100%",
                        backgroundColor: mode === "dark" ? "#0a0a14" : "#ffffff",
                        cursor: resizingColumn ? "col-resize" : "auto",
                    }}
                >
                    {/* Table Header */}
                    <div style={{ ...getTableHeaderStyles(mode), minWidth: totalTableWidth }}>
                        {/* Drag handle placeholder */}
                        <div style={headerDragHandlePlaceholderStyles} />

                        {visibleColumns.map((column, index) => (
                            <div
                                key={column.field}
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
                                <div
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
                                    {sortConfig.field === column.field && (
                                        <span
                                            style={{
                                                fontSize: "0.7rem",
                                                color: mode === "dark" ? "#a78bfa" : "#7c3aed",
                                                flexShrink: 0,
                                            }}
                                        >
                                            {sortConfig.direction === "asc" ? "▲" : "▼"}
                                        </span>
                                    )}
                                </div>

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
                                                        ? "rgba(167,139,250,0.5)"
                                                        : "rgba(124,58,237,0.3)";
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
                    <DndContext
                        collisionDetection={closestCenter}
                        sensors={sensors}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDragStart={handleDragStart}
                    >
                        <SortableContext
                            items={displayRowIds}
                            strategy={verticalListSortingStrategy}
                        >
                            <div
                                style={{
                                    minHeight: 100,
                                    minWidth: totalTableWidth,
                                    display: "flex",
                                    flexDirection: "column",
                                    backgroundColor: activeDragId
                                        ? mode === "dark"
                                            ? "rgba(59, 130, 246, 0.08)"
                                            : "rgba(59, 130, 246, 0.04)"
                                        : "transparent",
                                    transition: "background-color 0.25s ease",
                                }}
                            >
                                {displayRows.map((task) => {
                                    const idStr = String(task.id);
                                    return (
                                        <DraggableTaskRow
                                            key={task.id}
                                            childrenByParent={childrenByParent}
                                            columns={columnsWithWidths}
                                            depth={depthMap.get(idStr) ?? 0}
                                            expandedRows={expandedRows}
                                            isCombineTarget={combineTargetId === idStr}
                                            mode={mode}
                                            myself={myself}
                                            setMyself={setMyself}
                                            socket={socket}
                                            sprintNamesById={sprintNamesById}
                                            task={task}
                                            teamMembers={teamMembers}
                                            toggleExpand={toggleExpand}
                                            useCM={useCM}
                                            useTEM={useTEM}
                                            useTM={useTM}
                                            useUISM={useUISM}
                                            isCombineSource={
                                                !!combineTargetId && activeDragId === idStr
                                            }
                                            onRowDoubleClick={handleRowDoubleClick}
                                            onRowUpdate={handleRowUpdate}
                                        />
                                    );
                                })}
                            </div>
                        </SortableContext>
                    </DndContext>

                    {/* Empty state: show a spinner while we are still fetching tasks
                        (initial mount, team switch, or project switch). Once the load
                        completes and there is genuinely nothing to show, fall back to
                        the static "No tasks to display" message. */}
                    {displayRows.length === 0 &&
                        (useTM.isLoadingTasks ? (
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    height: "200px",
                                    gap: 1.5,
                                    color: mode === "dark" ? "#9aa0c4" : "#6b7280",
                                }}
                            >
                                <CircularProgress
                                    size="md"
                                    variant="soft"
                                    sx={{
                                        "--CircularProgress-size": "36px",
                                        "--CircularProgress-trackThickness": "3px",
                                        "--CircularProgress-progressThickness": "3px",
                                        color: mode === "dark" ? "#a78bfa" : "#7c3aed",
                                    }}
                                />
                                <Typography
                                    level="body-md"
                                    sx={{ fontWeight: 500, color: "inherit" }}
                                >
                                    Waiting to load tasks...
                                </Typography>
                            </Box>
                        ) : (
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    height: "200px",
                                    color: mode === "dark" ? "#666" : "#999",
                                    gap: 1,
                                }}
                            >
                                <Typography
                                    level="body-lg"
                                    sx={{ fontWeight: 500, color: "inherit" }}
                                >
                                    No tasks to display
                                </Typography>
                                <Typography
                                    level="body-sm"
                                    sx={{ color: mode === "dark" ? "#555" : "#bbb" }}
                                >
                                    Try adjusting your filters
                                </Typography>
                            </Box>
                        ))}
                </div>
            </div>
        </ThemeProvider>
    );
};
