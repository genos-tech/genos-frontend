import React, { useCallback, useEffect, useState } from "react";
import {
    closestCenter,
    DndContext,
    DragEndEvent,
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

    // Map an `over.id` (either a card id or a `column-${id}` droppable id)
    // back to the column id it sits under, plus the index within that
    // column. Cards live inside columns via SortableContext; the column
    // wrapper itself is also a Droppable so empty columns still accept
    // drops.
    const resolveOverColumn = useCallback(
        (overId: string): { columnId: string; index: number } | null => {
            if (overId.startsWith("column-")) {
                const columnId = overId.slice("column-".length);
                if (!(columnId in boardTasks)) return null;
                return { columnId, index: boardTasks[columnId].length };
            }
            for (const columnId of Object.keys(boardTasks)) {
                const idx = boardTasks[columnId].findIndex((t) => String(t.id) === overId);
                if (idx !== -1) return { columnId, index: idx };
            }
            return null;
        },
        [boardTasks]
    );

    const findActiveTaskColumn = useCallback(
        (activeId: string): { columnId: string; index: number } | null => {
            for (const columnId of Object.keys(boardTasks)) {
                const idx = boardTasks[columnId].findIndex((t) => String(t.id) === activeId);
                if (idx !== -1) return { columnId, index: idx };
            }
            return null;
        },
        [boardTasks]
    );

    // Handle drag end (dnd-kit). No `source.index` / `destination.index`
    // — we derive both from the items array via `arrayMove`-style splice.
    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;
        const activeId = String(active.id);
        const overId = String(over.id);
        if (activeId === overId) return;

        const from = findActiveTaskColumn(activeId);
        const to = resolveOverColumn(overId);
        if (!from || !to) return;

        const sourceColumn = from.columnId;
        const destColumn = to.columnId;

        if (sourceColumn === destColumn) {
            // Reorder within the same column
            if (from.index === to.index) return;
            const columnTasks = [...boardTasks[sourceColumn]];
            const [movedTask] = columnTasks.splice(from.index, 1);
            columnTasks.splice(to.index, 0, movedTask);
            setBoardTasks({ ...boardTasks, [sourceColumn]: columnTasks });
            return;
        }

        // Cross-column move: update status, mirror into allTasks, persist.
        const sourceTasks = [...boardTasks[sourceColumn]];
        const destTasks = [...boardTasks[destColumn]];
        const [movedTask] = sourceTasks.splice(from.index, 1);
        const newStatus = COLUMNS.find((col) => col.id === destColumn)?.status || movedTask.status;
        const updatedMovedTask = { ...movedTask, status: newStatus };
        destTasks.splice(to.index, 0, updatedMovedTask);

        const newBoardTasks = {
            ...boardTasks,
            [sourceColumn]: sourceTasks,
            [destColumn]: destTasks,
        };
        setBoardTasks(newBoardTasks);

        if (newStatus && accessToken) {
            try {
                await updateTaskFromTable(
                    updatedMovedTask,
                    myself,
                    socket || null,
                    accessToken,
                    teamMembers
                );

                const updatedAllTasks = useTM.allTasks.map((task: TaskTableProps) =>
                    String(task.id) === activeId ? { ...task, status: newStatus } : task
                );
                useTM.setAllTasks(updatedAllTasks);
            } catch (error) {
                console.error("[SprintBoard] Failed to update task status:", error);
            }
        } else {
            console.warn(
                `[SprintBoard] Cannot update task: newStatus=${newStatus}, accessToken=${!!accessToken}`
            );
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
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
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
                </DndContext>
            </div>
        </ThemeProvider>
    );
};
