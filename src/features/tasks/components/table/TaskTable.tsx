import { useCallback, useEffect, useState } from "react";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useColorScheme } from "@mui/joy/styles";
import { Box, Button, IconButton, Menu, MenuItem, Stack, Typography } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { DataGrid, GridFilterModel, GridToolbar, useGridApiRef } from "@mui/x-data-grid";

import { useAuth } from "../../../../context/AuthContext";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ProjectProps, TagListProps, TaskTableProps, TaskType } from "../../../../types/tasks";
import { popTeamMembers } from "../../../chat/services/popTeamMembers";
import { loadProjectTags } from "../../services/loadProjectTags";
import { getTaskColumns } from "./TaskTableFormat";

const options = [
    { name: "Group By Status", filterId: 1 },
    { name: "Group By Priority", filterId: 3 },
    { name: "Group By Tag", filterId: 2 },
    { name: "Group By Effort Level", filterId: 4 },
];

const theme = createTheme({ cssVariables: true });

type FilterProps = {
    label: string;
    filterModel: GridFilterModel;
    lightModeColor: string;
    darkModeColor: string;
};

const predefinedStatusFilters: FilterProps[] = [
    {
        label: "Open",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "Open" }],
        },
        lightModeColor: "#002bff",
        darkModeColor: "#2b80ffff",
    },
    {
        label: "WIP",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "WIP" }],
        },
        lightModeColor: "#ff8c00ff",
        darkModeColor: "#ff8c00ff",
    },
    {
        label: "Pending",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "Pending" }],
        },
        lightModeColor: "#b900ff",
        darkModeColor: "#b900ff",
    },
];

const predefinedPriorityFilters: FilterProps[] = [
    {
        label: "Low",
        filterModel: {
            items: [{ field: "priority", operator: "equals", value: "Low" }],
        },
        lightModeColor: "#0044c2",
        darkModeColor: "#0044c2",
    },
    {
        label: "Medium",
        filterModel: {
            items: [{ field: "priority", operator: "equals", value: "Medium" }],
        },
        lightModeColor: "#1dc200",
        darkModeColor: "#1dc200",
    },
    {
        label: "High",
        filterModel: {
            items: [{ field: "priority", operator: "equals", value: "High" }],
        },
        lightModeColor: "#ff2323",
        darkModeColor: "#ff2323",
    },
];

const predefinedEffortLevelFilters: FilterProps[] = [
    {
        label: "Low",
        filterModel: {
            items: [{ field: "effortLevel", operator: "equals", value: "Low" }],
        },
        lightModeColor: "#0044c2",
        darkModeColor: "#0044c2",
    },
    {
        label: "Medium",
        filterModel: {
            items: [{ field: "effortLevel", operator: "equals", value: "Medium" }],
        },
        lightModeColor: "#1dc200",
        darkModeColor: "#1dc200",
    },
    {
        label: "High",
        filterModel: {
            items: [{ field: "effortLevel", operator: "equals", value: "High" }],
        },
        lightModeColor: "#ff2323",
        darkModeColor: "#ff2323",
    },
];

type ProjectTaskTableProps = {
    teamMembers: UserProps[];
    setTeamMembers: (value: UserProps[]) => void;
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    currentProject: ProjectProps | null;
    displayTaskType: TaskType;
    setFilterBy: (value: number) => void;
    filterBy: number;
    setSelectedTagForFiltering: (value: string | undefined) => void;
    selectedTagForFiltering: string | undefined;
    currentFilterName: string;
    setCurrentFilterName: (value: string) => void;
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
        setFilterBy,
        filterBy,
        setSelectedTagForFiltering,
        selectedTagForFiltering,
        currentFilterName,
        setCurrentFilterName,
        TM,
    } = props;
    const { mode } = useColorScheme();
    const { accessToken } = useAuth();
    const className = `task-datagrid-${mode}`;
    const apiRef = useGridApiRef();

    const [currentDisplayingTasks, setCurrentDisplayingTasks] = useState<TaskTableProps[]>(
        TM.ongoingTasks.filter((task) => task.parentTaskId === null)
    );
    const [predefinedFilters, setPredefinedFilters] =
        useState<FilterProps[]>(predefinedStatusFilters);
    const [predefinedFiltersRowCount, setPredefinedFiltersRowCount] = useState<number[]>([]);

    const [showOnlyExpiredTasks, setShowOnlyExpiredTasks] = useState(false);

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

    const getFilteredRowsCount = useCallback(
        (filterModel: GridFilterModel) => {
            const rowIds = apiRef.current?.getAllRowIds();
            const filterState = apiRef.current?.getFilterState(filterModel);
            if (!rowIds || !filterState) {
                return 0;
            }

            const { filteredRowsLookup } = filterState;
            return rowIds.filter((rowId) => filteredRowsLookup[rowId] !== false).length;
        },
        [apiRef]
    );

    // Get Project tags
    const updateTagOptions = () => {
        (async () => {
            const loadedProjectTags: TagListProps[] = await loadProjectTags(
                myself,
                TM.ongoingTasks[0].projectId || -1,
                accessToken
            );
            if (loadedProjectTags.length > 0) {
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
                setPredefinedFilters(tagBasedFilters);
            }
        })();
    };

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    const updateFilterModel = () => {
        if (filterBy === 1) {
            setPredefinedFilters(predefinedStatusFilters);
        } else if (filterBy === 2) {
            updateTagOptions();
            if (selectedTagForFiltering) {
                apiRef.current.setFilterModel({
                    items: [
                        {
                            field: "concatTags",
                            operator: "contains",
                            value: selectedTagForFiltering,
                        },
                    ],
                });
                setSelectedTagForFiltering(undefined);
            }
        } else if (filterBy === 3) {
            setPredefinedFilters(predefinedPriorityFilters);
        } else if (filterBy === 4) {
            setPredefinedFilters(predefinedEffortLevelFilters);
        }
        setAnchorEl(null);
    };

    useEffect(() => {
        updateFilterModel();
    }, [filterBy, selectedTagForFiltering]);

    useEffect(() => {
        // Calculate the row count for predefined filters
        setPredefinedFiltersRowCount(
            predefinedFilters.map(({ filterModel }) => {
                return getFilteredRowsCount(filterModel);
            })
        );
    }, [predefinedFilters, currentDisplayingTasks]);

    useEffect(() => {
        // displayTaskType: ongoing, closed, deleted
        if (displayTaskType.id === 1) {
            setCurrentDisplayingTasks(
                TM.ongoingTasks.filter((task) => task.parentTaskId === null)
            );
            updateFilterModel();
        } else if (displayTaskType.id === 2) {
            setCurrentDisplayingTasks(TM.closedTasks.filter((task) => task.parentTaskId === null));
            updateTagOptions();
        } else if (displayTaskType.id === 3) {
            setCurrentDisplayingTasks(
                TM.deletedTasks.filter((task) => task.parentTaskId === null)
            );
            updateTagOptions();
        }
    }, [displayTaskType, currentProject, TM.ongoingTasks, TM.closedTasks, TM.deletedTasks]);

    // Reset filter
    useEffect(() => {
        apiRef.current.setFilterModel({ items: [] });
    }, [displayTaskType, currentProject]);

    return (
        <ThemeProvider theme={theme}>
            <div style={{ height: "100%", overflow: "hidden", borderRadius: "5px" }}>
                <Stack direction="row">
                    <Stack
                        direction="row"
                        gap={1}
                        mb={1}
                        flexWrap="wrap"
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                    >
                        {predefinedFilters.map(
                            ({ label, filterModel, lightModeColor, darkModeColor }, index) => {
                                const count = predefinedFiltersRowCount[index];
                                return (
                                    <Button
                                        key={`${label}-${count}`}
                                        onClick={() => {
                                            apiRef.current?.setFilterModel(filterModel);
                                            setCurrentFilterName(label);
                                        }}
                                        variant={
                                            currentFilterName === label ? "contained" : "outlined"
                                        }
                                        color={currentFilterName === label ? "info" : "inherit"}
                                        sx={{
                                            color: mode === "dark" ? "white" : "Black",
                                            borderColor:
                                                mode === "dark" ? darkModeColor : lightModeColor,
                                            borderWidth: "2px",
                                            fontSize: "13px",
                                            fontWeight: "bold",
                                            opacity: 0.85,
                                            height: "25px",
                                        }}
                                    >
                                        {label} {count !== undefined ? `(${count})` : ""}
                                    </Button>
                                );
                            }
                        )}

                        <IconButton
                            component="p"
                            onClick={handleClick}
                            size="small"
                            sx={{
                                color: mode === "dark" ? "#ffffff" : "#000000",
                                borderRadius: 1, // removes the circular style
                                padding: 1, // optional, adjust to taste
                            }}
                        >
                            <MoreVertIcon />
                        </IconButton>
                        <Menu
                            id="long-menu"
                            MenuListProps={{
                                "aria-labelledby": "long-button",
                            }}
                            anchorEl={anchorEl}
                            open={open}
                            onClose={handleClose}
                            slotProps={{
                                paper: {
                                    style: {
                                        maxHeight: 300,
                                    },
                                },
                            }}
                        >
                            {options.slice(displayTaskType.id - 1).map((option) => (
                                <MenuItem
                                    key={option.filterId}
                                    onClick={() => {
                                        setFilterBy(option.filterId);
                                        setCurrentFilterName("");
                                    }}
                                >
                                    {option.name}
                                </MenuItem>
                            ))}
                        </Menu>
                    </Stack>

                    {TM.expiredTasks.length > 0 && displayTaskType.id === 1 && (
                        <Stack
                            direction="row"
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-end", // push to right
                                flex: 1, // take up available space
                            }}
                        >
                            <Button
                                component="button"
                                variant={showOnlyExpiredTasks ? "contained" : "outlined"}
                                color="error"
                                size="small"
                                onClick={() => {
                                    if (showOnlyExpiredTasks) {
                                        setCurrentDisplayingTasks(
                                            TM.ongoingTasks.filter(
                                                (task) => task.parentTaskId === null
                                            )
                                        );
                                    } else {
                                        setCurrentDisplayingTasks(TM.expiredTasks);
                                    }
                                    setShowOnlyExpiredTasks(!showOnlyExpiredTasks);
                                }}
                            >
                                <Typography sx={{ fontSize: "13px", fontWeight: "bold" }}>
                                    Expired ({TM.expiredTasks.length})
                                </Typography>
                            </Button>
                        </Stack>
                    )}
                </Stack>

                <Box
                    sx={{
                        height: "97%",
                        width: "100%",
                    }}
                >
                    <DataGrid
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
                        className={className}
                        apiRef={apiRef}
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
                        style={{
                            color: mode === "dark" ? "#fbfcfc" : "#373737",
                            borderColor: "transparent",
                            fontWeight: "bold",
                        }}
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
                        slots={{
                            toolbar: GridToolbar,
                        }}
                        slotProps={{
                            toolbar: {
                                showQuickFilter: true,
                            },
                        }}
                        keepNonExistentRowsSelected
                        checkboxSelection
                        disableRowSelectionOnClick
                    />
                </Box>
            </div>
        </ThemeProvider>
    );
};
