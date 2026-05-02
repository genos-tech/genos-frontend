import React, { useEffect, useState } from "react";
import { useColorScheme } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { DragDropContext, DropResult } from "react-beautiful-dnd";
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

// Column definitions
const COLUMNS: ColumnConfig[] = [
    {
        id: "open",
        title: "Open",
        status: "Open",
        color: "#0044c2",
        bgColor: "rgba(0, 68, 194, 0.1)",
    },
    {
        id: "wip",
        title: "Work In Progress",
        status: "WIP",
        color: "#ff8c00",
        bgColor: "rgba(255, 140, 0, 0.1)",
    },
    {
        id: "closed",
        title: "Closed",
        status: "Closed",
        color: "#1dc200",
        bgColor: "rgba(29, 194, 0, 0.1)",
    },
    {
        id: "pending",
        title: "Pending",
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

    // Handle drag end
    const handleDragEnd = async (result: DropResult) => {
        const { source, destination, draggableId } = result;

        // Dropped outside a droppable area
        if (!destination) return;

        // Dropped in the same position
        if (source.droppableId === destination.droppableId && source.index === destination.index) {
            return;
        }

        const sourceColumn = source.droppableId;
        const destColumn = destination.droppableId;

        // Handle reordering within the same column
        if (sourceColumn === destColumn) {
            const columnTasks = [...boardTasks[sourceColumn]];
            const [movedTask] = columnTasks.splice(source.index, 1);
            columnTasks.splice(destination.index, 0, movedTask);

            setBoardTasks({
                ...boardTasks,
                [sourceColumn]: columnTasks,
            });
            return;
        }

        // Handle moving between different columns
        const sourceTasks = [...boardTasks[sourceColumn]];
        const destTasks = [...boardTasks[destColumn]];

        // Remove task from source
        const [movedTask] = sourceTasks.splice(source.index, 1);

        // Get the new status for the destination column
        const newStatus = COLUMNS.find((col) => col.id === destColumn)?.status || movedTask.status;

        // Update the moved task with new status
        const updatedMovedTask = { ...movedTask, status: newStatus };

        // Add task to destination
        destTasks.splice(destination.index, 0, updatedMovedTask);

        // Update local state immediately for responsiveness
        const newBoardTasks = {
            ...boardTasks,
            [sourceColumn]: sourceTasks,
            [destColumn]: destTasks,
        };
        setBoardTasks(newBoardTasks);

        // If moved to a different column, update the task status on the server
        if (sourceColumn !== destColumn && newStatus && accessToken) {
            try {
                await updateTaskFromTable(
                    updatedMovedTask,
                    myself,
                    socket || null,
                    accessToken,
                    teamMembers
                );

                // Update allTasks in useTM
                const updatedAllTasks = useTM.allTasks.map((task: TaskTableProps) =>
                    task.id === draggableId ? { ...task, status: newStatus } : task
                );
                useTM.setAllTasks(updatedAllTasks);
            } catch (error) {
                // Revert on error
                setBoardTasks(newBoardTasks); // Use newBoardTasks instead of stale boardTasks
            }
        } else if (sourceColumn !== destColumn) {
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
    const handleTaskClick = (task: TaskTableProps) => {
        useTM.setIsTaskPreviewVisible(true);
        if (task.isMilestone === true && task.milestoneId != null) {
            useTM.setCurrentPreviewMilestoneId(task.milestoneId);
            return;
        }
        if (task.id) {
            useTM.setCurrentPreviewTaskId(parseInt(task.id));
        }
    };

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
                <DragDropContext onDragEnd={handleDragEnd}>
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
                </DragDropContext>
            </div>
        </ThemeProvider>
    );
};
