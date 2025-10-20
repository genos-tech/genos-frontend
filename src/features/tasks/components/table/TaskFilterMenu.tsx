import * as React from "react";
import { useEffect } from "react";
import { useColorScheme } from "@mui/joy/styles";
import { Stack, Tooltip, Typography } from "@mui/material";
import Button from "@mui/material/Button";
import Fade from "@mui/material/Fade";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { alpha } from "@mui/system";

import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { TaskTableProps } from "../../../../types/tasks";
import {
    FilterProps,
    predefinedEffortLevelFilters,
    predefinedPriorityFilters,
    predefinedStatusFilters,
} from "../../types/TaskTableTypes";

type TaskFilterMenuProps = {
    TM: TaskManagementState;
    predefinedTagsFilters: FilterProps[];
    setCurrentDisplayingTasks: (tasks: TaskTableProps[]) => void;
};

export const TaskFilterMenu = (props: TaskFilterMenuProps) => {
    const { TM, predefinedTagsFilters, setCurrentDisplayingTasks } = props;
    const { mode } = useColorScheme();

    // Status filter
    const [selectedStatus, setSelectedStatus] = React.useState<FilterProps[]>(
        predefinedStatusFilters.slice(1, 4)
    );
    const [anchorElStatusFilter, setAnchorElStatusFilter] = React.useState<null | HTMLElement>(
        null
    );
    const openStatusFilter = Boolean(anchorElStatusFilter);
    const handleClickStatusFilter = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorElStatusFilter(event.currentTarget);
    };
    const handleCloseStatusFilter = (status: FilterProps | null) => {
        if (status) {
            let newStatuses: FilterProps[];
            if (status.label === "All") {
                // If the status is "All", set it to "All". Remove all other statuses.
                newStatuses = [predefinedStatusFilters[0]];
                setSelectedStatus(newStatuses);
                setAnchorElStatusFilter(null);
            } else if (selectedStatus.some((items) => items.label === status.label) === true) {
                // If the status is already selected, remove it
                newStatuses = selectedStatus.filter((item) => item.label != status.label);
                setSelectedStatus(newStatuses);
            } else {
                // If the status is not selected, add it. Remove "All" if it exists.
                newStatuses = [...selectedStatus.filter((item) => item.label != "All"), status];
                setSelectedStatus(newStatuses);
            }

            // If no status is selected, set it to "All"
            if (newStatuses.length === 0) {
                newStatuses = [predefinedStatusFilters[0]];
                setSelectedStatus(newStatuses);
                setAnchorElStatusFilter(null);
            }

            applyFilters(newStatuses, selectedTags, selectedPriority, selectedEffortLevel);
        }
    };

    // Tags filter
    const [selectedTags, setSelectedTags] = React.useState<FilterProps | undefined>(
        predefinedTagsFilters.length > 0 ? predefinedTagsFilters[0] : undefined
    );
    const [anchorElTagsFilter, setAnchorElTagsFilter] = React.useState<null | HTMLElement>(null);
    const openTagsFilter = Boolean(anchorElTagsFilter);
    const handleClickTagsFilter = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorElTagsFilter(event.currentTarget);
    };
    const handleCloseTagsFilter = (tag: FilterProps | null) => {
        if (tag) {
            setSelectedTags(tag);
            applyFilters(selectedStatus, tag, selectedPriority, selectedEffortLevel);
        }
        setAnchorElTagsFilter(null);
    };

    React.useEffect(() => {
        if (predefinedTagsFilters.length > 0) {
            setSelectedTags(predefinedTagsFilters[0]);
        }
    }, [predefinedTagsFilters]);

    // Priority filter
    const [selectedPriority, setSelectedPriority] = React.useState<FilterProps>(
        predefinedPriorityFilters[0]
    );
    const [anchorElPriorityFilter, setAnchorElPriorityFilter] = React.useState<null | HTMLElement>(
        null
    );
    const openPriorityFilter = Boolean(anchorElPriorityFilter);
    const handleClickPriorityFilter = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorElPriorityFilter(event.currentTarget);
    };
    const handleClosePriorityFilter = (priority: FilterProps | null) => {
        if (priority) {
            setSelectedPriority(priority);
            applyFilters(selectedStatus, selectedTags, priority, selectedEffortLevel);
        }
        setAnchorElPriorityFilter(null);
    };

    // Effort level filter
    const [selectedEffortLevel, setSelectedEffortLevel] = React.useState<FilterProps>(
        predefinedEffortLevelFilters[0]
    );
    const [anchorElEffortLevelFilter, setAnchorElEffortLevelFilter] =
        React.useState<null | HTMLElement>(null);
    const openEffortLevelFilter = Boolean(anchorElEffortLevelFilter);
    const handleClickEffortLevelFilter = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorElEffortLevelFilter(event.currentTarget);
    };
    const handleCloseEffortLevelFilter = (effortLevel: FilterProps | null) => {
        if (effortLevel) {
            setSelectedEffortLevel(effortLevel);
            applyFilters(selectedStatus, selectedTags, selectedPriority, effortLevel);
        }
        setAnchorElEffortLevelFilter(null);
    };

    // Apply filters
    const applyFilters = (
        statuses: FilterProps[],
        tags: FilterProps | undefined,
        priority: FilterProps,
        effortLevel: FilterProps
    ) => {
        // Apply all filters and set the displaying tasks
        // Filters: status, tags, priority, effort level
        let filteredTasks = TM.allTasks;

        // Filter by status
        if (statuses.length === 1) {
            if (statuses[0].label === "All") {
                filteredTasks = filteredTasks.filter((task) => task.parentTaskId === null);
            } else if (statuses[0].label === "Expired") {
                filteredTasks = filteredTasks.filter(
                    (task) => task.dueDate && new Date(task.dueDate) < new Date()
                );
            } else {
                filteredTasks = filteredTasks.filter((task) => task.status === statuses[0].label);
            }
        } else {
            filteredTasks = filteredTasks.filter((task) =>
                statuses.some((status) => status.label === task.status)
            );

            if (statuses.some((status) => status.label === "Expired")) {
                filteredTasks = filteredTasks.filter(
                    (task) => task.dueDate && new Date(task.dueDate) < new Date()
                );
            }
        }

        // Filter by tags
        if (tags) {
            if (tags.label === "All") {
                filteredTasks = filteredTasks.filter((task) => task.parentTaskId === null);
            } else {
                filteredTasks = filteredTasks.filter((task) =>
                    task.concatTags?.includes(tags.label)
                );
            }
        }

        // Filter by priority
        if (priority.label === "All") {
            filteredTasks = filteredTasks.filter((task) => task.parentTaskId === null);
        } else {
            filteredTasks = filteredTasks.filter((task) => task.priority === priority.label);
        }

        // Filter by effort level
        if (effortLevel.label === "All") {
            filteredTasks = filteredTasks.filter((task) => task.parentTaskId === null);
        } else {
            filteredTasks = filteredTasks.filter((task) => task.effortLevel === effortLevel.label);
        }

        if (filteredTasks.length > 0) {
            setCurrentDisplayingTasks(filteredTasks);
        } else {
            setCurrentDisplayingTasks([]);
        }
    };

    const resetFilters = () => {
        setSelectedStatus([predefinedStatusFilters[0]]);
        setSelectedTags(predefinedTagsFilters[0]);
        setSelectedPriority(predefinedPriorityFilters[0]);
        setSelectedEffortLevel(predefinedEffortLevelFilters[0]);
        applyFilters(
            [predefinedStatusFilters[0]],
            predefinedTagsFilters[0],
            predefinedPriorityFilters[0],
            predefinedEffortLevelFilters[0]
        );
    };

    useEffect(() => {
        applyFilters(selectedStatus, selectedTags, selectedPriority, selectedEffortLevel);
    }, [TM.allTasks]);

    return (
        <Stack direction="row" gap={1} m={1}>
            <Stack direction="row" gap={1}>
                <Button
                    id="fade-button"
                    sx={{
                        color: selectedStatus[0].label === "All" ? "black" : "white",
                        backgroundColor:
                            mode === "dark"
                                ? alpha(selectedStatus[0].darkModeColor, 0.5)
                                : alpha(selectedStatus[0].lightModeColor, 0.8),
                        borderWidth: "3px",
                        fontSize: "13px",
                        fontWeight: "bold",
                        opacity: 0.85,
                        height: "25px",
                        "&:hover": {
                            backgroundColor:
                                mode === "dark"
                                    ? alpha(selectedStatus[0].darkModeColor, 0.5)
                                    : alpha(selectedStatus[0].lightModeColor, 0.8),
                            color: selectedStatus[0].label === "All" ? "black" : "white",
                        },
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                    variant={"contained"}
                    aria-controls={openStatusFilter ? "fade-menu" : undefined}
                    aria-haspopup="true"
                    aria-expanded={openStatusFilter ? "true" : undefined}
                    onClick={handleClickStatusFilter}
                >
                    Status: {selectedStatus[0].label}
                    {selectedStatus.length > 1 && `+${selectedStatus.length - 1}`}
                </Button>
                <Menu
                    id="fade-menu"
                    slotProps={{
                        list: {
                            "aria-labelledby": "fade-button",
                        },
                        paper: {
                            sx: {
                                backgroundColor: mode === "dark" ? "#121212" : "#f0f0f0",
                            },
                        },
                    }}
                    slots={{ transition: Fade }}
                    anchorEl={anchorElStatusFilter}
                    open={openStatusFilter}
                    onClose={() => setAnchorElStatusFilter(null)}
                >
                    {predefinedStatusFilters.map((status) => (
                        <MenuItem
                            key={status.label}
                            onClick={() => handleCloseStatusFilter(status)}
                        >
                            <Button
                                key={`status-filter-${status.label}`}
                                component="button"
                                color={
                                    selectedStatus.some(
                                        (items) => items.label === status.label
                                    ) === true
                                        ? "info"
                                        : "inherit"
                                }
                                sx={{
                                    color: mode === "dark" ? "white" : "Black",
                                    borderColor:
                                        mode === "dark"
                                            ? status.darkModeColor
                                            : status.lightModeColor,
                                    borderWidth: "3px",
                                    fontSize: "13px",
                                    fontWeight: "bold",
                                    opacity: 0.85,
                                    height: "25px",
                                }}
                                variant={
                                    selectedStatus.some(
                                        (items) => items.label === status.label
                                    ) === true
                                        ? "contained"
                                        : "outlined"
                                }
                                onClick={() => {
                                    handleCloseStatusFilter(status);
                                }}
                            >
                                <Typography variant="body2" fontWeight="bold">
                                    {status.label}
                                </Typography>
                            </Button>
                        </MenuItem>
                    ))}
                </Menu>

                {selectedTags && (
                    <>
                        <Button
                            id="fade-button"
                            sx={{
                                color: selectedTags.label === "All" ? "black" : "white",
                                backgroundColor:
                                    mode === "dark"
                                        ? alpha(selectedTags.darkModeColor, 0.5)
                                        : alpha(selectedTags.lightModeColor, 0.8),
                                borderWidth: "3px",
                                fontSize: "13px",
                                fontWeight: "bold",
                                opacity: 0.85,
                                height: "25px",
                                "&:hover": {
                                    backgroundColor:
                                        mode === "dark"
                                            ? alpha(selectedTags.darkModeColor, 0.5)
                                            : alpha(selectedTags.lightModeColor, 0.8),
                                    color: selectedTags.label === "All" ? "black" : "white",
                                },
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                            variant={"contained"}
                            aria-controls={openTagsFilter ? "fade-menu" : undefined}
                            aria-haspopup="true"
                            aria-expanded={openTagsFilter ? "true" : undefined}
                            onClick={handleClickTagsFilter}
                        >
                            Tags: {selectedTags.label}
                        </Button>
                        <Menu
                            id="fade-menu"
                            slotProps={{
                                list: {
                                    "aria-labelledby": "fade-button",
                                },
                                paper: {
                                    sx: {
                                        backgroundColor: mode === "dark" ? "#121212" : "#f0f0f0",
                                    },
                                },
                            }}
                            slots={{ transition: Fade }}
                            anchorEl={anchorElTagsFilter}
                            open={openTagsFilter}
                            onClose={() => handleCloseTagsFilter(null)}
                        >
                            {predefinedTagsFilters.map((tag) => (
                                <MenuItem
                                    key={tag.label}
                                    onClick={() => handleCloseTagsFilter(tag)}
                                >
                                    <Button
                                        key={`tags-filter-${tag.label}`}
                                        component="button"
                                        color={
                                            selectedTags?.label === tag.label ? "info" : "inherit"
                                        }
                                        sx={{
                                            color: mode === "dark" ? "white" : "Black",
                                            borderColor:
                                                mode === "dark"
                                                    ? tag.darkModeColor
                                                    : tag.lightModeColor,
                                            borderWidth: "3px",
                                            fontSize: "13px",
                                            fontWeight: "bold",
                                            opacity: 0.85,
                                            height: "25px",
                                        }}
                                        variant={
                                            selectedTags?.label === tag.label
                                                ? "contained"
                                                : "outlined"
                                        }
                                        onClick={() => {
                                            handleCloseTagsFilter(tag);
                                        }}
                                    >
                                        <Typography variant="body2" fontWeight="bold">
                                            {tag.label}
                                        </Typography>
                                    </Button>
                                </MenuItem>
                            ))}
                        </Menu>
                    </>
                )}

                <Button
                    id="fade-button"
                    sx={{
                        color: selectedPriority.label === "All" ? "black" : "white",
                        backgroundColor:
                            mode === "dark"
                                ? alpha(selectedPriority.darkModeColor, 0.5)
                                : alpha(selectedPriority.lightModeColor, 0.8),
                        borderWidth: "3px",
                        fontSize: "13px",
                        fontWeight: "bold",
                        opacity: 0.85,
                        height: "25px",
                        "&:hover": {
                            backgroundColor:
                                mode === "dark"
                                    ? alpha(selectedPriority.darkModeColor, 0.5)
                                    : alpha(selectedPriority.lightModeColor, 0.8),
                            color: selectedPriority.label === "All" ? "black" : "white",
                        },
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                    variant={"contained"}
                    aria-controls={openPriorityFilter ? "fade-menu" : undefined}
                    aria-haspopup="true"
                    aria-expanded={openPriorityFilter ? "true" : undefined}
                    onClick={handleClickPriorityFilter}
                >
                    Priority: {selectedPriority.label}
                </Button>
                <Menu
                    id="fade-menu"
                    slotProps={{
                        list: {
                            "aria-labelledby": "fade-button",
                        },
                        paper: {
                            sx: {
                                backgroundColor: mode === "dark" ? "#121212" : "#f0f0f0",
                            },
                        },
                    }}
                    slots={{ transition: Fade }}
                    anchorEl={anchorElPriorityFilter}
                    open={openPriorityFilter}
                    onClose={() => handleClosePriorityFilter(null)}
                >
                    {predefinedPriorityFilters.map((priority) => (
                        <MenuItem
                            key={priority.label}
                            onClick={() => handleClosePriorityFilter(priority)}
                        >
                            <Button
                                key={`priority-filter-${priority.label}`}
                                component="button"
                                color={
                                    selectedPriority?.label === priority.label ? "info" : "inherit"
                                }
                                sx={{
                                    color: mode === "dark" ? "white" : "Black",
                                    borderColor:
                                        mode === "dark"
                                            ? priority.darkModeColor
                                            : priority.lightModeColor,
                                    borderWidth: "3px",
                                    fontSize: "13px",
                                    fontWeight: "bold",
                                    opacity: 0.85,
                                    height: "25px",
                                }}
                                variant={
                                    selectedPriority?.label === priority.label
                                        ? "contained"
                                        : "outlined"
                                }
                                onClick={() => {
                                    handleClosePriorityFilter(priority);
                                }}
                            >
                                <Typography variant="body2" fontWeight="bold">
                                    {priority.label}
                                </Typography>
                            </Button>
                        </MenuItem>
                    ))}
                </Menu>

                <Button
                    id="fade-button"
                    sx={{
                        color: selectedEffortLevel.label === "All" ? "black" : "white",
                        backgroundColor:
                            mode === "dark"
                                ? alpha(selectedEffortLevel.darkModeColor, 0.5)
                                : alpha(selectedEffortLevel.lightModeColor, 0.8),
                        borderWidth: "3px",
                        fontSize: "13px",
                        fontWeight: "bold",
                        opacity: 0.85,
                        height: "25px",
                        "&:hover": {
                            backgroundColor:
                                mode === "dark"
                                    ? alpha(selectedEffortLevel.darkModeColor, 0.5)
                                    : alpha(selectedEffortLevel.lightModeColor, 0.8),
                            color: selectedEffortLevel.label === "All" ? "black" : "white",
                        },
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                    variant={"contained"}
                    aria-controls={openEffortLevelFilter ? "fade-menu" : undefined}
                    aria-haspopup="true"
                    aria-expanded={openEffortLevelFilter ? "true" : undefined}
                    onClick={handleClickEffortLevelFilter}
                >
                    Effort Level: {selectedEffortLevel.label}
                </Button>
                <Menu
                    id="fade-menu"
                    slotProps={{
                        list: {
                            "aria-labelledby": "fade-button",
                        },
                        paper: {
                            sx: {
                                backgroundColor: mode === "dark" ? "#121212" : "#f0f0f0",
                            },
                        },
                    }}
                    slots={{ transition: Fade }}
                    anchorEl={anchorElEffortLevelFilter}
                    open={openEffortLevelFilter}
                    onClose={() => handleCloseEffortLevelFilter(null)}
                >
                    {predefinedEffortLevelFilters.map((effortLevel) => (
                        <MenuItem
                            key={effortLevel.label}
                            onClick={() => handleCloseEffortLevelFilter(effortLevel)}
                        >
                            <Button
                                key={`effort-level-filter-${effortLevel.label}`}
                                component="button"
                                color={
                                    selectedEffortLevel?.label === effortLevel.label
                                        ? "info"
                                        : "inherit"
                                }
                                sx={{
                                    color: mode === "dark" ? "white" : "Black",
                                    borderColor:
                                        mode === "dark"
                                            ? effortLevel.darkModeColor
                                            : effortLevel.lightModeColor,
                                    borderWidth: "3px",
                                    fontSize: "13px",
                                    fontWeight: "bold",
                                    opacity: 0.85,
                                    height: "25px",
                                }}
                                variant={
                                    selectedEffortLevel?.label === effortLevel.label
                                        ? "contained"
                                        : "outlined"
                                }
                                onClick={() => {
                                    handleCloseEffortLevelFilter(effortLevel);
                                }}
                            >
                                <Typography variant="body2" fontWeight="bold">
                                    {effortLevel.label}
                                </Typography>
                            </Button>
                        </MenuItem>
                    ))}
                </Menu>
            </Stack>

            <Stack flex={1} direction="row" justifyContent="flex-end">
                <Button
                    variant="contained"
                    onClick={resetFilters}
                    sx={{
                        color: "black",
                        backgroundColor: "white",
                        borderWidth: "3px",
                        fontSize: "13px",
                        fontWeight: "bold",
                        opacity: 0.85,
                        height: "25px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    Reset Filters
                </Button>
            </Stack>
        </Stack>
    );
};
