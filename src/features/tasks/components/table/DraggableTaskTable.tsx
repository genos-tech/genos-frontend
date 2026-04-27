import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import PendingIcon from "@mui/icons-material/Pending";
import { Box, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { DragDropContext, Droppable, DropResult } from "react-beautiful-dnd";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { TagListProps, TaskTableProps } from "../../../../types/tasks";
import { popTeamMembers } from "../../../chat/services/popTeamMembers";
import { loadProjectTags } from "../../services/loadProjectTags";
import { updateTaskFromTable } from "../../services/updateTaskFromTable";
import { FilterProps } from "../../types/TaskTableTypes";
import { effortLevels, priorities, statuses } from "../../utils/taskMeta";
import { DraggableTaskRow } from "./DraggableTaskRow";
import { TaskFilterMenu } from "./TaskFilterMenu";

const theme = createTheme({ cssVariables: true });

// Column definitions for the table
export type ColumnDef = {
    field: string;
    headerName: string;
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
    { field: "id", headerName: "ID", width: 80, align: "center", resizable: false },
    {
        field: "status",
        headerName: "Status",
        width: 105,
        minWidth: 80,
        align: "center",
        editable: true,
        resizable: true,
    },
    {
        field: "tags",
        headerName: "Tags",
        width: 110,
        minWidth: 80,
        align: "center",
        resizable: true,
    },
    {
        field: "title",
        headerName: "Title",
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
        width: 250,
        minWidth: 150,
        maxWidth: 400,
        align: "left",
        editable: true,
        resizable: true,
    },
    {
        field: "priority",
        headerName: "Priority",
        width: 100,
        minWidth: 80,
        align: "center",
        editable: true,
        resizable: true,
    },
    {
        field: "effortLevel",
        headerName: "Effort Level",
        width: 100,
        minWidth: 80,
        align: "center",
        editable: true,
        resizable: true,
    },
    {
        field: "daysLeft",
        headerName: "Days Left",
        width: 100,
        minWidth: 80,
        align: "center",
        resizable: true,
    },
    {
        field: "dueDate",
        headerName: "Due Date",
        width: 100,
        minWidth: 80,
        align: "center",
        editable: true,
        resizable: true,
    },
    {
        field: "updatedAt",
        headerName: "Last Updated",
        width: 180,
        minWidth: 120,
        align: "center",
        resizable: true,
    },
    {
        field: "createdDate",
        headerName: "Created Date",
        width: 120,
        minWidth: 100,
        align: "center",
        resizable: true,
    },
];

// For backwards compatibility
export const columns = defaultColumns;

// Status options for dropdown
export const statusOptions = [
    {
        label: "Open",
        value: "Open",
        color: "#0044c2",
        textColor: "white",
        icon: <CheckCircleOutlineIcon style={{ color: "white" }} />,
    },
    {
        label: "WIP",
        value: "WIP",
        color: "#ff8c00",
        textColor: "white",
        icon: <AutorenewIcon style={{ color: "white" }} />,
    },
    {
        label: "Pending",
        value: "Pending",
        color: "#b900ff",
        textColor: "white",
        icon: <PendingIcon style={{ color: "white" }} />,
    },
    {
        label: "Closed",
        value: "Closed",
        color: "#1dc200",
        textColor: "white",
        icon: <CheckCircleOutlineIcon style={{ color: "white" }} />,
    },
    {
        label: "Deleted",
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
    backgroundColor: isResizing ? (mode === "dark" ? "#90caf9" : "#1976d2") : "transparent",
    transition: isResizing ? "none" : "background-color 0.15s ease",
    zIndex: 10,
});

type DraggableTaskTableProps = {
    teamMembers: UserProps[];
    setTeamMembers: (value: UserProps[]) => void;
    myself: UserProps;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
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
        socket,
        useTEM,
        useCM,
        useUISM,
        setMyself,
    } = props;
    const { mode: colorMode } = useColorScheme();
    const { accessToken } = useAuth();
    const isDark = colorMode === "dark";
    // Normalize mode to only "light" | "dark" | undefined (treat "system" as undefined)
    const mode: "light" | "dark" | undefined =
        colorMode === "light" || colorMode === "dark" ? colorMode : undefined;

    const [currentDisplayingTasks, setCurrentDisplayingTasks] = useState<TaskTableProps[]>([]);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ field: string; direction: "asc" | "desc" }>({
        field: "updatedAt",
        direction: "desc",
    });

    const toggleExpand = useCallback((id: string) => {
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const childrenByParent = useMemo(() => {
        const map = new Map<string, TaskTableProps[]>();
        for (const task of useTM.allTasks) {
            if (task.parentTaskId != null) {
                const parentId = String(task.parentTaskId);
                const arr = map.get(parentId) || [];
                arr.push(task);
                map.set(parentId, arr);
            }
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

    // Sort tasks
    const sortTasks = useCallback(
        (tasks: TaskTableProps[]) => {
            return [...tasks].sort((a, b) => {
                const aValue = a[sortConfig.field as keyof TaskTableProps];
                const bValue = b[sortConfig.field as keyof TaskTableProps];

                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;

                let comparison = 0;
                if (typeof aValue === "string" && typeof bValue === "string") {
                    comparison = aValue.localeCompare(bValue);
                } else if (typeof aValue === "number" && typeof bValue === "number") {
                    comparison = aValue - bValue;
                } else {
                    comparison = String(aValue).localeCompare(String(bValue));
                }

                return sortConfig.direction === "asc" ? comparison : -comparison;
            });
        },
        [sortConfig]
    );

    // Handle drag end for reordering
    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return;

        const items = Array.from(currentDisplayingTasks);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        setCurrentDisplayingTasks(items);
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

    // Handle row update
    const handleRowUpdate = async (updatedRow: TaskTableProps): Promise<TaskTableProps> => {
        try {
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

    const visibleColumns = defaultColumns.filter((col) => !col.hidden);

    // Create columns with dynamic widths for passing to rows
    const columnsWithWidths: ColumnDef[] = visibleColumns.map((col) => ({
        ...col,
        width: getColumnWidth(col.field),
    }));

    // Calculate total table width (drag handle + all columns)
    const dragHandleWidth = 28;
    const totalTableWidth =
        dragHandleWidth + visibleColumns.reduce((sum, col) => sum + getColumnWidth(col.field), 0);

    return (
        <ThemeProvider theme={theme}>
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
                    setCurrentDisplayingTasks={setCurrentDisplayingTasks}
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
                                    onClick={() => handleHeaderClick(column.field)}
                                    onMouseEnter={(e) => {
                                        if (!resizingColumn) {
                                            e.currentTarget.style.opacity = "0.8";
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.opacity = "1";
                                    }}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 4,
                                        flex: 1,
                                        overflow: "hidden",
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
                                                color: mode === "dark" ? "#90caf9" : "#1976d2",
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
                                        onMouseDown={(e) => handleResizeStart(e, column.field)}
                                        onMouseEnter={(e) => {
                                            if (!resizingColumn) {
                                                e.currentTarget.style.backgroundColor =
                                                    mode === "dark"
                                                        ? "rgba(144, 202, 249, 0.5)"
                                                        : "rgba(25, 118, 210, 0.3)";
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!resizingColumn) {
                                                e.currentTarget.style.backgroundColor =
                                                    "transparent";
                                            }
                                        }}
                                        style={getResizeHandleStyles(
                                            resizingColumn === column.field,
                                            mode
                                        )}
                                        title="Drag to resize column"
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Draggable Table Body */}
                    <DragDropContext onDragEnd={handleDragEnd}>
                        <Droppable
                            droppableId="task-table"
                            direction="vertical"
                            isDropDisabled={false}
                            isCombineEnabled={false}
                            ignoreContainerClipping={false}
                        >
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    style={{
                                        minHeight: 100,
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
                                >
                                    {displayRows.map((task, index) => (
                                        <DraggableTaskRow
                                            key={task.id}
                                            task={task}
                                            index={index}
                                            columns={columnsWithWidths}
                                            mode={mode}
                                            myself={myself}
                                            teamMembers={teamMembers}
                                            onRowUpdate={handleRowUpdate}
                                            onRowDoubleClick={handleRowDoubleClick}
                                            useTM={useTM}
                                            useTEM={useTEM}
                                            useCM={useCM}
                                            useUISM={useUISM}
                                            socket={socket}
                                            setMyself={setMyself}
                                            expandedRows={expandedRows}
                                            toggleExpand={toggleExpand}
                                            childrenByParent={childrenByParent}
                                            depth={depthMap.get(String(task.id)) ?? 0}
                                        />
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>

                    {/* Empty state */}
                    {displayRows.length === 0 && (
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
                            <Typography level="body-lg" sx={{ fontWeight: 500, color: "inherit" }}>
                                No tasks to display
                            </Typography>
                            <Typography
                                level="body-sm"
                                sx={{ color: mode === "dark" ? "#555" : "#bbb" }}
                            >
                                Try adjusting your filters
                            </Typography>
                        </Box>
                    )}
                </div>
            </div>
        </ThemeProvider>
    );
};
