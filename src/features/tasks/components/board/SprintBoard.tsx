import React, { useEffect, useState } from "react";
import { useColorScheme } from "@mui/joy/styles";
import { DragDropContext, DropResult } from "react-beautiful-dnd";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { TaskTableProps } from "../../../../types/tasks";
import { updateTaskFromTable } from "../../services/updateTaskFromTable";
import { ColumnConfig, SprintBoardColumn } from "./SprintBoardColumn";

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
    useTM: TaskManagementState;
    socket?: Socket | null;
};

export const SprintBoard = (props: SprintBoardProps) => {
    const { teamMembers, teamMemberProfiles, myself, usePM, useTM, socket } = props;
    const { mode: colorMode } = useColorScheme();
    const { accessToken } = useAuth();

    // Normalize mode
    const mode: "light" | "dark" | undefined =
        colorMode === "light" || colorMode === "dark" ? colorMode : undefined;

    // Local state for board tasks organized by column
    const [boardTasks, setBoardTasks] = useState<Record<string, TaskTableProps[]>>({
        open: [],
        wip: [],
        pending: [],
        closed: [],
    });

    // Initialize board tasks from all tasks
    useEffect(() => {
        const tasks = useTM.allTasks || [];
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
            // Ignore "Deleted" tasks in the board view
        });

        setBoardTasks(organized);
    }, [useTM.allTasks]);

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

    // Handle task click
    const handleTaskClick = (taskId: string) => {
        useTM.setCurrentPreviewTaskId(parseInt(taskId));
        useTM.setIsTaskPreviewVisible(true);
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div style={getBoardContainerStyles(mode)}>
                {COLUMNS.map((column) => (
                    <SprintBoardColumn
                        key={column.id}
                        column={column}
                        tasks={boardTasks[column.id] || []}
                        myself={myself}
                        teamMemberProfiles={teamMemberProfiles}
                        onTaskClick={handleTaskClick}
                        selectedTaskId={useTM.currentPreviewTaskId}
                    />
                ))}
            </div>
        </DragDropContext>
    );
};
