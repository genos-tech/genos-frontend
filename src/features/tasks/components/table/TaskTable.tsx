import { useColorScheme } from "@mui/joy/styles";
import { Box } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { DataGrid, useGridApiRef } from "@mui/x-data-grid";
import { useEffect, useState } from "react";

import { useAuth } from "../../../../context/AuthContext";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ProjectProps, TagListProps, TaskTableProps, TaskType } from "../../../../types/tasks";
import { popTeamMembers } from "../../../chat/services/popTeamMembers";
import { loadProjectTags } from "../../services/loadProjectTags";
import { FilterProps } from "../../types/TaskTableTypes";
import { TaskFilterMenu } from "./TaskFilterMenu";
import { getTaskColumns } from "./TaskTableFormat";

const theme = createTheme({ cssVariables: true });

type ProjectTaskTableProps = {
    teamMembers: UserProps[];
    setTeamMembers: (value: UserProps[]) => void;
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    currentProject: ProjectProps | null;
    displayTaskType: TaskType;
    TM: TaskManagementState;
};

export const ProjectTaskTable = (props: ProjectTaskTableProps) => {
    const {
        teamMembers,
        setTeamMembers,
        teamMemberProfiles,
        myself,
        currentProject,
        displayTaskType,
        TM,
    } = props;
    const { mode } = useColorScheme();
    const { accessToken } = useAuth();
    const className = `task-datagrid-${mode}`;
    const apiRef = useGridApiRef();

    const [currentDisplayingTasks, setCurrentDisplayingTasks] = useState<TaskTableProps[]>([]);

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
        if (TM.allTasks.length > 0) {
            const loadedProjectTags: TagListProps[] = await loadProjectTags(
                myself,
                TM.allTasks[0].projectId || -1,
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
    }, [currentProject, TM.allTasks]);

    // Reset filter
    useEffect(() => {
        apiRef.current.setFilterModel({ items: [] });
    }, [displayTaskType, currentProject]);

    return (
        <ThemeProvider theme={theme}>
            <div style={{ height: "100%", overflow: "hidden", borderRadius: "5px" }}>
                <TaskFilterMenu
                    predefinedTagsFilters={predefinedTagsFilters}
                    setCurrentDisplayingTasks={setCurrentDisplayingTasks}
                    TM={TM}
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
                        rows={currentDisplayingTasks}
                        columns={getTaskColumns({
                            teamMemberProfiles: teamMemberProfiles,
                            myself: myself,
                            accessToken: accessToken,
                            teamMembers: teamMembers,
                        })}
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
                                    id: true,
                                    summary: true,
                                    priority: true,
                                    effortLevel: true,
                                    createdDate: true,
                                    updatedAt: false,
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
                        sx={{
                            "& .MuiDataGrid-columnHeaderTitle": {
                                fontSize: "0.875rem",
                                fontWeight: "bold",
                            },
                            "& .MuiDataGrid-row.Mui-selected": {
                                backgroundColor: "rgba(0, 123, 255, 0.2) !important", // light blue
                            },
                            "& .MuiDataGrid-row.Mui-selected:hover": {
                                backgroundColor: "rgba(0, 123, 255, 0.3) !important", // slightly darker on hover
                            },
                        }}
                        // disableRowSelectionOnClick
                        keepNonExistentRowsSelected
                        onCellClick={(params) => {
                            // setIsTaskPreviewVisible(true);
                            // TM.setCurrentPreviewTaskId(Number(params.id));
                        }}
                        onCellDoubleClick={(params) => {
                            // TM.setIsTaskPreviewVisible(true);
                            // setCurrentPreviewTaskId(Number(params.id));
                        }}
                        onRowClick={(params, event, detail) => {
                            TM.setIsTaskPreviewVisible(true);
                            TM.setCurrentPreviewTaskId(Number(params.id));
                        }}
                    />
                </Box>
            </div>
        </ThemeProvider>
    );
};
