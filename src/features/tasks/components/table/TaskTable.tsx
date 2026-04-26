import { useCallback, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "@mui/joy/styles";
import { Box } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { DataGrid, GridRowModel, useGridApiRef } from "@mui/x-data-grid";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { TagListProps, TaskTableProps } from "../../../../types/tasks";
import { popTeamMembers } from "../../../chat/services/popTeamMembers";
import { loadProjectTags } from "../../services/loadProjectTags";
import { updateTaskFromTable } from "../../services/updateTaskFromTable";
import { FilterProps } from "../../types/TaskTableTypes";
import { effortLevels, priorities, statuses } from "../../utils/taskMeta";
import { TaskFilterMenu } from "./TaskFilterMenu";
import { getTaskColumns } from "./TaskTableFormat";

const theme = createTheme({ cssVariables: true });

type ProjectTaskTableProps = {
    teamMembers: UserProps[];
    setTeamMembers: (value: UserProps[]) => void;
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    socket?: Socket | null;
};

export const ProjectTaskTable = (props: ProjectTaskTableProps) => {
    const { teamMembers, setTeamMembers, teamMemberProfiles, myself, usePM, useTM, socket } =
        props;
    const { mode } = useColorScheme();
    const { accessToken } = useAuth();
    const className = `task-datagrid-${mode}`;
    const apiRef = useGridApiRef();

    const [currentDisplayingTasks, setCurrentDisplayingTasks] = useState<TaskTableProps[]>([]);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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
            if (task.parentTaskId) {
                const arr = map.get(task.parentTaskId) || [];
                arr.push(task);
                map.set(task.parentTaskId, arr);
            }
        }
        return map;
    }, [useTM.allTasks]);

    const displayRows = useMemo(() => {
        const parentRows = currentDisplayingTasks.filter((t) => !t.parentTaskId);
        const result: TaskTableProps[] = [];
        for (const row of parentRows) {
            result.push(row);
            if (row.id && expandedRows.has(row.id)) {
                const children = childrenByParent.get(row.id) || [];
                result.push(...children);
            }
        }
        return result;
    }, [currentDisplayingTasks, expandedRows, childrenByParent]);

    // Update Project and Tag list
    const getTeamMembers = () => {
        // Load the latest project as initial process
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
                    filterModel: {
                        items: [],
                    },
                    lightModeColor: "#ffffff",
                    darkModeColor: "#ffffff",
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

    // Reset filter and expanded rows
    useEffect(() => {
        apiRef.current.setFilterModel({ items: [] });
        setExpandedRows(new Set());
    }, [usePM.currentProject]);

    // Handle row update when cells are edited
    const processRowUpdate = async (
        newRow: GridRowModel,
        oldRow: GridRowModel
    ): Promise<GridRowModel> => {
        // send updated task only if the task is not the same as the old task
        if (JSON.stringify(newRow) === JSON.stringify(oldRow)) {
            return oldRow;
        }

        try {
            // Update the task via the backend
            const updatedRow = await updateTaskFromTable(
                newRow as TaskTableProps,
                myself,
                socket || null,
                accessToken,
                teamMembers
            );

            // Update the local state of task table
            setCurrentDisplayingTasks((prevTasks) =>
                prevTasks.map((task) => (task.id === updatedRow.id ? updatedRow : task))
            );

            // Update the preview task by overwriting if the updated task is the current preview task
            if (
                useTM.currentPreviewTask &&
                useTM.currentPreviewTask.id === Number(updatedRow.id)
            ) {
                useTM.setCurrentPreviewTask({
                    ...useTM.currentPreviewTask,
                    title: updatedRow.title || useTM.currentPreviewTask.title,
                    tags: updatedRow.tags || useTM.currentPreviewTask.tags,
                    concatTags: updatedRow.concatTags || useTM.currentPreviewTask.concatTags,
                    assignee:
                        teamMembers.find((member) => member.userId === updatedRow.assigneeId) ||
                        useTM.currentPreviewTask.assignee,
                    status:
                        statuses.find((status) => status.status === updatedRow.status) ||
                        useTM.currentPreviewTask.status,
                    priority:
                        priorities.find((priority) => priority.priority === updatedRow.priority) ||
                        useTM.currentPreviewTask.priority,
                    effortLevel:
                        effortLevels.find(
                            (effortLevel) => effortLevel.level === updatedRow.effortLevel
                        ) || useTM.currentPreviewTask.effortLevel,
                    dueDate: updatedRow.dueDate || useTM.currentPreviewTask.dueDate,
                });
            }

            // Update the allTasks state in task management
            const updatedAllTasks = useTM.allTasks.map((task) =>
                task.id === updatedRow.id ? updatedRow : task
            );
            useTM.setAllTasks(updatedAllTasks);

            // Trigger task update to refresh preview if open
            if (
                useTM.currentPreviewTask &&
                useTM.currentPreviewTask.id === Number(updatedRow.id)
            ) {
                useTM.setIsTaskUpdated(true);
            }

            return updatedRow;
        } catch (error) {
            console.error("Error processing row update:", error);
            return oldRow;
        }
    };

    const handleProcessRowUpdateError = (error: Error) => {
        console.error("Row update error:", error);
    };

    return (
        <ThemeProvider theme={theme}>
            <div style={{ height: "100%", overflow: "hidden", borderRadius: "5px" }}>
                <TaskFilterMenu
                    isTaskUpdated={useTM.isTaskUpdated}
                    predefinedTagsFilters={predefinedTagsFilters}
                    setCurrentDisplayingTasks={setCurrentDisplayingTasks}
                    useTM={useTM}
                />
                <Box
                    sx={{
                        height: "97%",
                        width: "100%",
                    }}
                >
                    <DataGrid
                        apiRef={apiRef}
                        className={className}
                        rows={displayRows}
                        columns={getTaskColumns({
                            useTM: useTM,
                            teamMemberProfiles: teamMemberProfiles,
                            myself: myself,
                            accessToken: accessToken,
                            teamMembers: teamMembers,
                            expandedRows: expandedRows,
                            toggleExpand: toggleExpand,
                            childrenByParent: childrenByParent,
                        })}
                        processRowUpdate={processRowUpdate}
                        onProcessRowUpdateError={handleProcessRowUpdateError}
                        initialState={{
                            density: "compact",
                            filter: {
                                filterModel: {
                                    items: [],
                                },
                            },
                            sorting: {
                                sortModel: [{ field: "updatedAt", sort: "desc" }],
                            },
                            pagination: {
                                paginationModel: {
                                    pageSize: 50,
                                },
                            },
                            columns: {
                                columnVisibilityModel: {
                                    __expand: true,
                                    id: true,
                                    summary: true,
                                    priority: true,
                                    effortLevel: true,
                                    createdDate: true,
                                    updatedAt: true,
                                    dueDate: true,
                                    daysLeft: true,
                                    status: true,
                                    assigneeEmail: true,
                                    assigneeName: true,
                                    threadId: false,
                                    parentTaskId: false,
                                    concatTags: false,
                                },
                            },
                        }}
                        style={{
                            color: mode === "dark" ? "#fbfcfc" : "#373737",
                            borderColor: "transparent",
                            fontWeight: "bold",
                        }}
                        getRowClassName={(params) =>
                            params.row.parentTaskId ? "child-task-row" : ""
                        }
                        sx={{
                            "& .MuiDataGrid-columnHeaderTitle": {
                                fontSize: "0.875rem",
                                fontWeight: "bold",
                            },
                            "& .MuiDataGrid-row.Mui-selected": {
                                backgroundColor: "rgba(0, 123, 255, 0.2) !important",
                            },
                            "& .MuiDataGrid-row.Mui-selected:hover": {
                                backgroundColor: "rgba(0, 123, 255, 0.3) !important",
                            },
                            "& .child-task-row": {
                                backgroundColor:
                                    mode === "dark"
                                        ? "rgba(99, 102, 241, 0.06)"
                                        : "rgba(99, 102, 241, 0.04)",
                            },
                            "& .child-task-row:hover": {
                                backgroundColor:
                                    mode === "dark"
                                        ? "rgba(99, 102, 241, 0.12) !important"
                                        : "rgba(99, 102, 241, 0.08) !important",
                            },
                        }}
                        // disableRowSelectionOnClick
                        keepNonExistentRowsSelected
                        onCellClick={(params, event) => {
                            // Check if the cell is editable
                            const isEditable = params.colDef.editable;

                            if (isEditable) {
                                // Check if the cell is already in edit mode
                                const cellMode = apiRef.current.getCellMode(
                                    params.id,
                                    params.field
                                );

                                // Only start edit mode if the cell is currently in view mode
                                if (cellMode === "view") {
                                    apiRef.current.startCellEditMode({
                                        id: params.id,
                                        field: params.field,
                                    });
                                }
                            }
                        }}
                        // onRowClick={(params, event, detail) => {
                        //     useTM.setIsTaskPreviewVisible(true);
                        //     useTM.setCurrentPreviewTaskId(Number(params.id));
                        // }}
                        onCellDoubleClick={(params) => {
                            // Open task preview on double click
                            useTM.setIsTaskPreviewVisible(true);
                            useTM.setCurrentPreviewTaskId(Number(params.id));
                        }}
                    />
                </Box>
            </div>
        </ThemeProvider>
    );
};
