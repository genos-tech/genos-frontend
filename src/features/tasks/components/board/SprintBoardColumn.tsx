import React from "react";
import Box from "@mui/joy/Box";
import { useColorScheme } from "@mui/joy/styles";
import Typography from "@mui/joy/Typography";
import { Droppable } from "react-beautiful-dnd";

import { UserProps } from "../../../../types/admin";
import { TaskTableProps } from "../../../../types/tasks";
import { SprintBoardCard } from "./SprintBoardCard";

// Column configuration
export type ColumnConfig = {
    id: string;
    title: string;
    status: string;
    color: string;
    bgColor: string;
    icon?: React.ReactNode;
};

// Style helpers
const getColumnStyles = (
    color: string,
    mode: "light" | "dark" | undefined
): React.CSSProperties => ({
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    height: "100%",
    backgroundColor: mode === "dark" ? "#16161e" : "#ffffff",
    borderRadius: 10,
    boxShadow: mode === "dark" ? "0 2px 8px rgba(0, 0, 0, 0.3)" : "0 2px 8px rgba(0, 0, 0, 0.06)",
    overflow: "hidden",
    borderTop: `3px solid ${color}`,
});

const getColumnHeaderStyles = (mode: "light" | "dark" | undefined): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    flexShrink: 0,
    backgroundColor: mode === "dark" ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.01)",
    borderBottom:
        mode === "dark" ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(0, 0, 0, 0.05)",
});

const getDropAreaStyles = (
    isDraggingOver: boolean,
    mode: "light" | "dark" | undefined
): React.CSSProperties => ({
    flex: 1,
    padding: 8,
    minHeight: 100,
    backgroundColor: isDraggingOver
        ? mode === "dark"
            ? "rgba(167,139,250,0.1)"
            : "rgba(124,58,237,0.06)"
        : "transparent",
    transition: "background-color 0.15s ease",
    overflowY: "auto",
    overflowX: "hidden",
});

type SprintBoardColumnProps = {
    column: ColumnConfig;
    tasks: TaskTableProps[];
    myself: UserProps;
    teamMemberProfiles: Record<string, UserProps>;
    onTaskClick?: (task: TaskTableProps) => void;
    // Selection state passed in from the parent so milestone backing
    // rows can light up against `currentPreviewMilestoneId` while
    // regular rows light up against `currentPreviewTaskId`.
    selectedTaskId?: number;
    selectedMilestoneId?: number | null;
    isMilestonePreviewActive?: boolean;
};

export const SprintBoardColumn = ({
    column,
    tasks,
    myself,
    teamMemberProfiles,
    onTaskClick,
    selectedTaskId,
    selectedMilestoneId,
    isMilestonePreviewActive,
}: SprintBoardColumnProps) => {
    const { mode: colorMode } = useColorScheme();
    const mode: "light" | "dark" | undefined =
        colorMode === "light" || colorMode === "dark" ? colorMode : undefined;
    const isDark = mode === "dark";

    return (
        <div style={getColumnStyles(column.color, mode)}>
            {/* Column Header */}
            <div style={getColumnHeaderStyles(mode)}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Typography
                        level="title-sm"
                        sx={{
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.8px",
                            fontSize: "0.7rem",
                            color: column.color,
                        }}
                    >
                        {column.title}
                    </Typography>
                </Box>
                <span
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 22,
                        height: 20,
                        padding: "0 6px",
                        borderRadius: 10,
                        fontWeight: 700,
                        fontSize: "0.65rem",
                        backgroundColor: column.color,
                        color: "#fff",
                    }}
                >
                    {tasks.length}
                </span>
            </div>

            {/* Droppable Area */}
            <Droppable
                droppableId={column.id}
                direction="vertical"
                isDropDisabled={false}
                isCombineEnabled={false}
                ignoreContainerClipping={false}
            >
                {(provided, snapshot) => (
                    <div
                        className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        style={getDropAreaStyles(snapshot.isDraggingOver, mode)}
                    >
                        {tasks.length === 0 ? (
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flex: 1,
                                    minHeight: 120,
                                    border:
                                        mode === "dark"
                                            ? "1px dashed rgba(255, 255, 255, 0.08)"
                                            : "1px dashed rgba(0, 0, 0, 0.08)",
                                    borderRadius: 6,
                                    color: mode === "dark" ? "#555" : "#aaa",
                                    backgroundColor:
                                        mode === "dark"
                                            ? "rgba(255, 255, 255, 0.01)"
                                            : "rgba(0, 0, 0, 0.01)",
                                }}
                            >
                                <Typography
                                    level="body-xs"
                                    sx={{ fontSize: "0.7rem", fontWeight: 500 }}
                                >
                                    Drop tasks here
                                </Typography>
                            </Box>
                        ) : (
                            tasks.map((task, index) => {
                                // For a milestone backing row, the
                                // matching preview is keyed off the
                                // milestone id, not the backing task's
                                // id, since the click handler routes
                                // through `setCurrentPreviewMilestoneId`.
                                const isMilestoneRow = task.isMilestone === true;
                                const isSelected = isMilestoneRow
                                    ? !!isMilestonePreviewActive &&
                                      selectedMilestoneId != null &&
                                      task.milestoneId === selectedMilestoneId
                                    : selectedTaskId === Number(task.id);
                                return (
                                    <SprintBoardCard
                                        key={task.id}
                                        task={task}
                                        index={index}
                                        myself={myself}
                                        teamMemberProfiles={teamMemberProfiles}
                                        onTaskClick={onTaskClick}
                                        isSelected={isSelected}
                                    />
                                );
                            })
                        )}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </div>
    );
};
