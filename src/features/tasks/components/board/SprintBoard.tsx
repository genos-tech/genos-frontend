import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    closestCorners,
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragOverlay,
    DragStartEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useColorScheme } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { TagListProps, TaskTableProps } from "../../../../types/tasks";
import { loadProjectTags } from "../../services/loadProjectTags";
import { updateTaskFromTable } from "../../services/updateTaskFromTable";
import { FilterProps } from "../../types/TaskTableTypes";
import { TaskFilterMenu } from "../table/TaskFilterMenu";
import { SprintBoardCard } from "./SprintBoardCard";
import { ColumnConfig, SprintBoardColumn } from "./SprintBoardColumn";

const materialTheme = createTheme({ cssVariables: true });

// Column definitions. `title` is filled in at render time from the
// `titleKey` so the board columns stay localizable while `status` stays
// the backend enum value the filterModel keys off.
const COLUMNS: ColumnConfig[] = [
    {
        id: "open",
        title: "Open",
        titleKey: "columnOpen",
        status: "Open",
        color: "#0044c2",
        bgColor: "rgba(0, 68, 194, 0.1)",
    },
    {
        id: "wip",
        title: "Work In Progress",
        titleKey: "columnWip",
        status: "WIP",
        color: "#ff8c00",
        bgColor: "rgba(255, 140, 0, 0.1)",
    },
    {
        id: "closed",
        title: "Closed",
        titleKey: "columnClosed",
        status: "Closed",
        color: "#1dc200",
        bgColor: "rgba(29, 194, 0, 0.1)",
    },
    {
        id: "pending",
        title: "Pending",
        titleKey: "columnPending",
        status: "Pending",
        color: "#b900ff",
        bgColor: "rgba(185, 0, 255, 0.1)",
    },
];

// Style helpers
const getBoardContainerStyles = (mode: "light" | "dark" | undefined): React.CSSProperties => ({
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)", // Fixed 4 equal columns
    gap: 12,
    padding: 12,
    flex: 1,
    minHeight: 0,
    width: "100%",
    overflow: "hidden",
    backgroundColor: mode === "dark" ? "#0a0a10" : "#f4f5f7",
    borderRadius: 12,
});

type SprintBoardProps = {
    teamMembers: UserProps[];
    setTeamMembers: (value: UserProps[]) => void;
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    usePM: ProjectManagementState;
    useSM: SprintMilestoneManagementState;
    useTM: TaskManagementState;
    socket?: Socket | null;
};

export const SprintBoard = (props: SprintBoardProps) => {
    const { teamMembers, teamMemberProfiles, myself, usePM, useSM, useTM, socket } = props;
    const { mode: colorMode } = useColorScheme();
    const { accessToken } = useAuth();

    // Normalize mode
    const mode: "light" | "dark" | undefined =
        colorMode === "light" || colorMode === "dark" ? colorMode : undefined;

    // Filtered tasks from TaskFilterMenu
    const [filteredTasks, setFilteredTasks] = useState<TaskTableProps[]>([]);

    // Tag filter setup
    const [predefinedTagsFilters, setPredefinedTagsFilters] = useState<FilterProps[]>([]);
    useEffect(() => {
        (async () => {
            if (useTM.allTasks.length > 0) {
                const loadedProjectTags: TagListProps[] = await loadProjectTags(
                    myself,
                    useTM.allTasks[0].projectId || -1,
                    accessToken
                );
                if (loadedProjectTags.length > 0) {
                    const allTagFilter: FilterProps = {
                        label: "All",
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
        })();
    }, [usePM.currentProject, useTM.allTasks]);

    // Local state for board tasks organized by column
    const [boardTasks, setBoardTasks] = useState<Record<string, TaskTableProps[]>>({
        open: [],
        wip: [],
        pending: [],
        closed: [],
    });

    // Organize filtered tasks into board columns. We deliberately do
    // NOT restrict by sprint binding here:
    //   1. Without a milestone scope, the board should show every
    //      milestone (backing tasks) AND every regular root task so
    //      users can see the full project at a glance — not just the
    //      handful of things tied to the current sprint. The user's
    //      sprint scoping happens in the dashboard / sidebar.
    //   2. With a milestone scope active (clicked from the sidebar),
    //      `TaskFilterMenu` already narrows `filteredTasks` to the
    //      milestone's children, so we just trust its output.
    // Dropping the milestone/sprint deps also means a milestone preview
    // refreshing its data no longer rebuilds the board's columns, so a
    // just-clicked card stays put instead of being filtered away by the
    // momentary state churn.
    useEffect(() => {
        const milestoneScopeActive = useTM.tableMilestoneFilterId != null;
        const tasks = (filteredTasks || []).filter((task) => {
            if (milestoneScopeActive) return true;
            return task.parentTaskId === null;
        });

        const organized: Record<string, TaskTableProps[]> = {
            open: [],
            wip: [],
            pending: [],
            closed: [],
        };

        tasks.forEach((task: TaskTableProps) => {
            const status = task.status?.toLowerCase() || "open";
            if (status === "open") organized.open.push(task);
            else if (status === "wip") organized.wip.push(task);
            else if (status === "pending") organized.pending.push(task);
            else if (status === "closed") organized.closed.push(task);
        });

        setBoardTasks(organized);
    }, [filteredTasks, useTM.tableMilestoneFilterId]);

    // PointerSensor with a tiny activation distance so a click-without-drag
    // still reaches `onClick` on the card (matches rbd's default behaviour).
    // Keyboard accessibility is handled by @dnd-kit's KeyboardSensor — the
    // sortable plugin's coordinate getter sequences cells correctly.
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Drag state. `activeTask` drives the DragOverlay (the floating ghost
    // that follows the cursor — portal-rendered so it doesn't get clipped
    // by column `overflow: hidden`). `dragSourceColumnRef` captures the
    // ORIGINAL column at dragStart so we can persist a status change even
    // after `onDragOver` has already mutated the card's position to a new
    // column for the live preview.
    const [activeTask, setActiveTask] = useState<TaskTableProps | null>(null);
    const dragSourceColumnRef = useRef<string | null>(null);

    // Given an `over.id` (card id or `column-${id}`), find the column that
    // currently owns it. Walks `boardTasks` (which `onDragOver` keeps in
    // sync with the live drag preview).
    const findContainer = useCallback(
        (id: string): string | null => {
            if (id.startsWith("column-")) {
                const columnId = id.slice("column-".length);
                return columnId in boardTasks ? columnId : null;
            }
            for (const columnId of Object.keys(boardTasks)) {
                if (boardTasks[columnId].some((t) => String(t.id) === id)) {
                    return columnId;
                }
            }
            return null;
        },
        [boardTasks]
    );

    const handleDragStart = (event: DragStartEvent) => {
        const activeId = String(event.active.id);
        const sourceColumn = findContainer(activeId);
        if (!sourceColumn) return;
        dragSourceColumnRef.current = sourceColumn;
        const task = boardTasks[sourceColumn].find((t) => String(t.id) === activeId) ?? null;
        setActiveTask(task);
    };

    // Move the active card between columns DURING drag so the destination
    // column visually accepts it and the user sees a live preview. This is
    // the canonical @dnd-kit kanban pattern — without it, cross-context
    // drops can land in ambiguous states because the active item visually
    // never leaves its source SortableContext.
    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;
        const activeId = String(active.id);
        const overId = String(over.id);
        const sourceCol = findContainer(activeId);
        const destCol = findContainer(overId);
        if (!sourceCol || !destCol || sourceCol === destCol) return;

        setBoardTasks((prev) => {
            const sourceItems = [...prev[sourceCol]];
            const destItems = [...prev[destCol]];
            const fromIdx = sourceItems.findIndex((t) => String(t.id) === activeId);
            if (fromIdx === -1) return prev;
            const [moved] = sourceItems.splice(fromIdx, 1);
            // Insert at the over-card's slot if over is a card, otherwise
            // append (over is the column wrapper).
            const overIdx = destItems.findIndex((t) => String(t.id) === overId);
            const insertAt = overIdx === -1 ? destItems.length : overIdx;
            destItems.splice(insertAt, 0, moved);
            return { ...prev, [sourceCol]: sourceItems, [destCol]: destItems };
        });
    };

    const handleDragCancel = () => {
        dragSourceColumnRef.current = null;
        setActiveTask(null);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        const activeId = String(active.id);
        const sourceColumn = dragSourceColumnRef.current;
        dragSourceColumnRef.current = null;
        setActiveTask(null);

        if (!over) return;
        const finalColumn = findContainer(activeId);
        if (!finalColumn || !sourceColumn) return;

        // Same column: dnd-kit already gave us the new order via the items
        // shift during drag. For within-column reorder, splice using the
        // over.id index to commit the visual reorder to state.
        if (finalColumn === sourceColumn) {
            const overId = String(over.id);
            if (activeId === overId) return;
            const items = [...boardTasks[finalColumn]];
            const fromIdx = items.findIndex((t) => String(t.id) === activeId);
            const overIdx = items.findIndex((t) => String(t.id) === overId);
            if (fromIdx === -1 || overIdx === -1 || fromIdx === overIdx) return;
            const [moved] = items.splice(fromIdx, 1);
            items.splice(overIdx, 0, moved);
            setBoardTasks({ ...boardTasks, [finalColumn]: items });
            return;
        }

        // Cross-column: the card has already been moved into `finalColumn`
        // by `onDragOver`. Now update its status to match the destination
        // and persist to the backend.
        const newStatus = COLUMNS.find((col) => col.id === finalColumn)?.status ?? null;
        const movedTask = boardTasks[finalColumn].find((t) => String(t.id) === activeId);
        if (!movedTask || !newStatus) return;

        const updatedMovedTask = { ...movedTask, status: newStatus };
        setBoardTasks((prev) => ({
            ...prev,
            [finalColumn]: prev[finalColumn].map((t) =>
                String(t.id) === activeId ? updatedMovedTask : t
            ),
        }));

        if (!accessToken) {
            console.warn("[SprintBoard] Cannot persist status: no accessToken");
            return;
        }
        try {
            await updateTaskFromTable(
                updatedMovedTask,
                myself,
                socket || null,
                accessToken,
                teamMembers
            );
            useTM.setAllTasks((prev) =>
                prev.map((task: TaskTableProps) =>
                    String(task.id) === activeId ? { ...task, status: newStatus } : task
                )
            );
        } catch (error) {
            console.error("[SprintBoard] Failed to update task status:", error);
        }
    };

    // Handle task click. Milestone backing rows must route through
    // `setCurrentPreviewMilestoneId` so the preview pane opens directly
    // in MilestonePreviewInner instead of briefly mounting TaskPreview
    // with `currentPreviewKind === "task"` before the reroute kicks in
    // (which also re-runs the `setIsTaskUpdated` cascade and mutates
    // `useTM.allTasks`). Regular tasks keep the old path.
    // Stabilize the click handler so `SprintBoardCard` (now React.memo) can
    // skip re-renders when nothing about a card has changed. Destructuring
    // pins the underlying useState setters — those are guaranteed stable by
    // React regardless of how often `useTM` is re-constructed by its hook.
    const { setIsTaskPreviewVisible, setCurrentPreviewMilestoneId, setCurrentPreviewTaskId } =
        useTM;
    const handleTaskClick = useCallback(
        (task: TaskTableProps) => {
            setIsTaskPreviewVisible(true);
            if (task.isMilestone === true && task.milestoneId != null) {
                setCurrentPreviewMilestoneId(task.milestoneId);
                return;
            }
            if (task.id) {
                setCurrentPreviewTaskId(parseInt(task.id));
            }
        },
        [setIsTaskPreviewVisible, setCurrentPreviewMilestoneId, setCurrentPreviewTaskId]
    );

    return (
        <ThemeProvider theme={{ [THEME_ID]: materialTheme }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                <TaskFilterMenu
                    isTaskUpdated={useTM.isTaskUpdated}
                    predefinedTagsFilters={predefinedTagsFilters}
                    setCurrentDisplayingTasks={setFilteredTasks}
                    useSM={useSM}
                    useTM={useTM}
                    hideStatusFilter
                />
                <DndContext
                    collisionDetection={closestCorners}
                    sensors={sensors}
                    onDragCancel={handleDragCancel}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDragStart={handleDragStart}
                >
                    <div style={getBoardContainerStyles(mode)}>
                        {COLUMNS.map((column) => (
                            <SprintBoardColumn
                                key={column.id}
                                column={column}
                                isMilestonePreviewActive={useTM.currentPreviewKind === "milestone"}
                                myself={myself}
                                selectedMilestoneId={useTM.currentPreviewMilestoneId}
                                selectedTaskId={useTM.currentPreviewTaskId}
                                tasks={boardTasks[column.id] || []}
                                teamMemberProfiles={teamMemberProfiles}
                                onTaskClick={handleTaskClick}
                            />
                        ))}
                    </div>
                    {/* DragOverlay portal-renders the dragged card so it's
                        not clipped by the column wrappers' `overflow: hidden`.
                        Without this the card visually disappears behind the
                        adjacent columns during a cross-column drag. */}
                    <DragOverlay>
                        {activeTask ? (
                            <SprintBoardCard
                                isSelected={false}
                                myself={myself}
                                task={activeTask}
                                teamMemberProfiles={teamMemberProfiles}
                            />
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>
        </ThemeProvider>
    );
};
