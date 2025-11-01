import * as React from "react";
import { useEffect } from "react";
import { useColorScheme } from "@mui/joy/styles";
import { Stack, Tooltip, Typography } from "@mui/material";
import Button from "@mui/material/Button";
import Fade from "@mui/material/Fade";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { styled } from "@mui/material/styles";
import { tooltipClasses, TooltipProps } from "@mui/material/Tooltip";
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
    isTaskUpdated?: boolean;
    TM: TaskManagementState;
    predefinedTagsFilters: FilterProps[];
    setCurrentDisplayingTasks: (tasks: TaskTableProps[]) => void;
};

export const TaskFilterMenu = (props: TaskFilterMenuProps) => {
    const { isTaskUpdated, TM, predefinedTagsFilters, setCurrentDisplayingTasks } = props;
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
    const handleCloseStatusFilter = (status: FilterProps) => {
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

        applyFilters(newStatuses, selectedTags, selectedPriorities, selectedEffortLevels);
    };

    // Tags filter
    const [selectedTags, setSelectedTags] = React.useState<FilterProps[]>(
        predefinedTagsFilters.length > 0 ? [predefinedTagsFilters[0]] : []
    );
    const [anchorElTagsFilter, setAnchorElTagsFilter] = React.useState<null | HTMLElement>(null);
    const openTagsFilter = Boolean(anchorElTagsFilter);
    const handleClickTagsFilter = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorElTagsFilter(event.currentTarget);
    };
    const handleCloseTagsFilter = (tag: FilterProps) => {
        let newTags: FilterProps[];
        if (tag.label === "All") {
            // If the tag is "All", set it to "All". Remove all other tags.
            newTags = [predefinedTagsFilters[0]];
            setSelectedTags(newTags);
            setAnchorElTagsFilter(null);
        } else if (selectedTags.some((items) => items.label === tag.label) === true) {
            // If the tag is already selected, remove it
            newTags = selectedTags.filter((item) => item.label != tag.label);
            setSelectedTags(newTags);
        } else {
            // If the tag is not selected, add it. Remove "All" if it exists.
            newTags = [...selectedTags.filter((item) => item.label != "All"), tag];
            setSelectedTags(newTags);
        }

        if (newTags.length === 0) {
            newTags = [predefinedTagsFilters[0]];
            setSelectedTags(newTags);
            setAnchorElTagsFilter(null);
        }

        applyFilters(selectedStatus, newTags, selectedPriorities, selectedEffortLevels);
    };

    React.useEffect(() => {
        if (predefinedTagsFilters.length > 0) {
            setSelectedTags([predefinedTagsFilters[0]]);
        }
    }, [predefinedTagsFilters]);

    // Priority filter
    const [selectedPriorities, setSelectedPriorities] = React.useState<FilterProps[]>([
        predefinedPriorityFilters[0],
    ]);
    const [anchorElPriorityFilter, setAnchorElPriorityFilter] = React.useState<null | HTMLElement>(
        null
    );
    const openPriorityFilter = Boolean(anchorElPriorityFilter);
    const handleClickPriorityFilter = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorElPriorityFilter(event.currentTarget);
    };
    const handleClosePriorityFilter = (priority: FilterProps) => {
        let newPriorities: FilterProps[];
        if (priority.label === "All") {
            // If the priority is "All", set it to "All". Remove all other priorities.
            newPriorities = [predefinedPriorityFilters[0]];
            setSelectedPriorities(newPriorities);
            setAnchorElPriorityFilter(null);
        } else if (selectedPriorities.some((items) => items.label === priority.label) === true) {
            // If the priority is already selected, remove it
            newPriorities = selectedPriorities.filter((item) => item.label != priority.label);
            setSelectedPriorities(newPriorities);
        } else {
            // If the priority is not selected, add it. Remove "All" if it exists.
            newPriorities = [
                ...selectedPriorities.filter((item) => item.label != "All"),
                priority,
            ];
            setSelectedPriorities(newPriorities);
        }

        if (newPriorities.length === 0) {
            newPriorities = [predefinedPriorityFilters[0]];
            setSelectedPriorities(newPriorities);
            setAnchorElPriorityFilter(null);
        }

        applyFilters(selectedStatus, selectedTags, newPriorities, selectedEffortLevels);
    };

    // Effort level filter
    const [selectedEffortLevels, setSelectedEffortLevels] = React.useState<FilterProps[]>([
        predefinedEffortLevelFilters[0],
    ]);
    const [anchorElEffortLevelFilter, setAnchorElEffortLevelFilter] =
        React.useState<null | HTMLElement>(null);
    const openEffortLevelFilter = Boolean(anchorElEffortLevelFilter);
    const handleClickEffortLevelFilter = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorElEffortLevelFilter(event.currentTarget);
    };
    const handleCloseEffortLevelFilter = (effortLevel: FilterProps) => {
        let newEffortLevels: FilterProps[];
        if (effortLevel.label === "All") {
            // If the effort level is "All", set it to "All". Remove all other effort levels.
            newEffortLevels = [predefinedEffortLevelFilters[0]];
            setSelectedEffortLevels(newEffortLevels);
            setAnchorElEffortLevelFilter(null);
        } else if (
            selectedEffortLevels.some((items) => items.label === effortLevel.label) === true
        ) {
            // If the effort level is already selected, remove it
            newEffortLevels = selectedEffortLevels.filter(
                (item) => item.label != effortLevel.label
            );
            setSelectedEffortLevels(newEffortLevels);
        } else {
            // If the effort level is not selected, add it. Remove "All" if it exists.
            newEffortLevels = [
                ...selectedEffortLevels.filter((item) => item.label != "All"),
                effortLevel,
            ];
            setSelectedEffortLevels(newEffortLevels);
        }

        if (newEffortLevels.length === 0) {
            newEffortLevels = [predefinedEffortLevelFilters[0]];
            setSelectedEffortLevels(newEffortLevels);
            setAnchorElEffortLevelFilter(null);
        }

        applyFilters(selectedStatus, selectedTags, selectedPriorities, newEffortLevels);
    };

    // Apply filters
    const applyFilters = (
        statuses: FilterProps[],
        tags: FilterProps[],
        priority: FilterProps[],
        effortLevel: FilterProps[]
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
        if (tags.length > 0) {
            if (tags.length === 1 && tags[0].label === "All") {
                // Include all tasks
                filteredTasks = filteredTasks.filter((task) => task.parentTaskId === null);
            } else {
                // Include tasks with the selected tags
                filteredTasks = filteredTasks.filter((task) =>
                    tags.some((tag) => task.concatTags?.includes(tag.label))
                );
            }
        }

        // Filter by priority
        if (priority.length === 1 && priority[0].label === "All") {
            filteredTasks = filteredTasks.filter((task) => task.parentTaskId === null);
        } else {
            filteredTasks = filteredTasks.filter((task) =>
                priority.some((priority) => priority.label === task.priority)
            );
        }

        // Filter by effort level
        if (effortLevel.length === 1 && effortLevel[0].label === "All") {
            filteredTasks = filteredTasks.filter((task) => task.parentTaskId === null);
        } else {
            filteredTasks = filteredTasks.filter((task) =>
                effortLevel.some((effortLevel) => effortLevel.label === task.effortLevel)
            );
        }

        if (filteredTasks.length > 0) {
            setCurrentDisplayingTasks(filteredTasks);
        } else {
            setCurrentDisplayingTasks([]);
        }
    };

    const resetFilters = () => {
        setSelectedStatus([predefinedStatusFilters[0]]);
        setSelectedTags([predefinedTagsFilters[0]]);
        setSelectedPriorities([predefinedPriorityFilters[0]]);
        setSelectedEffortLevels([predefinedEffortLevelFilters[0]]);
        applyFilters(
            [predefinedStatusFilters[0]],
            [predefinedTagsFilters[0]],
            [predefinedPriorityFilters[0]],
            [predefinedEffortLevelFilters[0]]
        );
    };

    useEffect(() => {
        applyFilters(selectedStatus, selectedTags, selectedPriorities, selectedEffortLevels);
    }, [TM.allTasks]);

    useEffect(() => {
        if (isTaskUpdated) {
            applyFilters(selectedStatus, selectedTags, selectedPriorities, selectedEffortLevels);
        }
    }, [isTaskUpdated]);

    return (
        <Stack direction="row" gap={1} m={1}>
            <Stack direction="row" gap={1}>
                <Tooltip
                    placement="top"
                    title={selectedStatus.map((status) => status.label).join(", ")}
                    slotProps={{
                        popper: {
                            sx: {
                                [`& .${tooltipClasses.tooltip}`]: {
                                    backgroundColor: mode === "dark" ? "#121212" : "#ffffff",
                                    color: mode === "dark" ? "lightgrey" : "#2B2B2B",
                                    boxShadow: 1,
                                    fontSize: 12,
                                },
                            },
                        },
                    }}
                >
                    <Button
                        aria-controls={openStatusFilter ? "fade-menu" : undefined}
                        aria-expanded={openStatusFilter ? "true" : undefined}
                        aria-haspopup="true"
                        id="fade-button"
                        variant={"contained"}
                        sx={{
                            color:
                                selectedStatus[0].label === "All"
                                    ? mode === "dark"
                                        ? "white"
                                        : "black"
                                    : "white",
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
                                        ? alpha(selectedStatus[0].darkModeColor, 0.6)
                                        : alpha(selectedStatus[0].lightModeColor, 0.9),
                                color:
                                    selectedStatus[0].label === "All"
                                        ? mode === "dark"
                                            ? "white"
                                            : "black"
                                        : "white",
                            },
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                        onClick={handleClickStatusFilter}
                    >
                        Status: {selectedStatus[0].label}{" "}
                        {selectedStatus.length > 1 && `+${selectedStatus.length - 1}`}
                    </Button>
                </Tooltip>
                <Menu
                    anchorEl={anchorElStatusFilter}
                    id="fade-menu"
                    open={openStatusFilter}
                    slots={{ transition: Fade }}
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
                                <Typography fontWeight="bold" variant="body2">
                                    {status.label}
                                </Typography>
                            </Button>
                        </MenuItem>
                    ))}
                </Menu>

                {selectedTags.length > 0 && (
                    <>
                        <Tooltip
                            placement="top"
                            title={selectedTags.map((tag) => tag.label).join(", ")}
                            slotProps={{
                                popper: {
                                    sx: {
                                        [`& .${tooltipClasses.tooltip}`]: {
                                            backgroundColor:
                                                mode === "dark" ? "#121212" : "#ffffff",
                                            color: mode === "dark" ? "lightgrey" : "#2B2B2B",
                                            boxShadow: 1,
                                            fontSize: 12,
                                        },
                                    },
                                },
                            }}
                        >
                            <Button
                                aria-controls={openTagsFilter ? "fade-menu" : undefined}
                                aria-expanded={openTagsFilter ? "true" : undefined}
                                aria-haspopup="true"
                                id="fade-button"
                                variant={"contained"}
                                sx={{
                                    color: selectedTags.some((tag) => tag.label === "All")
                                        ? mode === "dark"
                                            ? "white"
                                            : "black"
                                        : "white",
                                    backgroundColor:
                                        mode === "dark"
                                            ? alpha(selectedTags[0].darkModeColor, 0.5)
                                            : alpha(selectedTags[0].lightModeColor, 0.8),
                                    borderWidth: "3px",
                                    fontSize: "13px",
                                    fontWeight: "bold",
                                    opacity: 0.85,
                                    height: "25px",
                                    "&:hover": {
                                        backgroundColor:
                                            mode === "dark"
                                                ? alpha(selectedTags[0].darkModeColor, 0.6)
                                                : alpha(selectedTags[0].lightModeColor, 0.9),
                                        color: selectedTags.some((tag) => tag.label === "All")
                                            ? mode === "dark"
                                                ? "white"
                                                : "black"
                                            : "white",
                                    },
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                                onClick={handleClickTagsFilter}
                            >
                                Tags: {selectedTags[0].label}{" "}
                                {selectedTags.length > 1 && `+${selectedTags.length - 1}`}
                            </Button>
                        </Tooltip>
                        <Menu
                            anchorEl={anchorElTagsFilter}
                            id="fade-menu"
                            open={openTagsFilter}
                            slots={{ transition: Fade }}
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
                            onClose={() => setAnchorElTagsFilter(null)}
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
                                            selectedTags.some(
                                                (items) => items.label === tag.label
                                            ) === true
                                                ? "info"
                                                : "inherit"
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
                                            selectedTags.some(
                                                (items) => items.label === tag.label
                                            ) === true
                                                ? "contained"
                                                : "outlined"
                                        }
                                        onClick={() => {
                                            handleCloseTagsFilter(tag);
                                        }}
                                    >
                                        <Typography fontWeight="bold" variant="body2">
                                            {tag.label}
                                        </Typography>
                                    </Button>
                                </MenuItem>
                            ))}
                        </Menu>
                    </>
                )}

                <Tooltip
                    placement="top"
                    title={selectedPriorities.map((priority) => priority.label).join(", ")}
                    slotProps={{
                        popper: {
                            sx: {
                                [`& .${tooltipClasses.tooltip}`]: {
                                    backgroundColor: mode === "dark" ? "#121212" : "#ffffff",
                                    color: mode === "dark" ? "lightgrey" : "#2B2B2B",
                                    boxShadow: 1,
                                    fontSize: 12,
                                },
                            },
                        },
                    }}
                >
                    <Button
                        aria-controls={openPriorityFilter ? "fade-menu" : undefined}
                        aria-expanded={openPriorityFilter ? "true" : undefined}
                        aria-haspopup="true"
                        id="fade-button"
                        variant={"contained"}
                        sx={{
                            color: selectedPriorities.some((priority) => priority.label === "All")
                                ? mode === "dark"
                                    ? "white"
                                    : "black"
                                : "white",
                            backgroundColor:
                                mode === "dark"
                                    ? alpha(selectedPriorities[0].darkModeColor, 0.5)
                                    : alpha(selectedPriorities[0].lightModeColor, 0.8),
                            borderWidth: "3px",
                            fontSize: "13px",
                            fontWeight: "bold",
                            opacity: 0.85,
                            height: "25px",
                            "&:hover": {
                                backgroundColor:
                                    mode === "dark"
                                        ? alpha(selectedPriorities[0].darkModeColor, 0.6)
                                        : alpha(selectedPriorities[0].lightModeColor, 0.9),
                                color: selectedPriorities.some(
                                    (priority) => priority.label === "All"
                                )
                                    ? mode === "dark"
                                        ? "white"
                                        : "black"
                                    : "white",
                            },
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                        onClick={handleClickPriorityFilter}
                    >
                        Priority: {selectedPriorities[0].label}{" "}
                        {selectedPriorities.length > 1 && `+${selectedPriorities.length - 1}`}
                    </Button>
                </Tooltip>
                <Menu
                    anchorEl={anchorElPriorityFilter}
                    id="fade-menu"
                    open={openPriorityFilter}
                    slots={{ transition: Fade }}
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
                    onClose={() => setAnchorElPriorityFilter(null)}
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
                                    selectedPriorities.some(
                                        (items) => items.label === priority.label
                                    ) === true
                                        ? "info"
                                        : "inherit"
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
                                    selectedPriorities.some(
                                        (items) => items.label === priority.label
                                    ) === true
                                        ? "contained"
                                        : "outlined"
                                }
                                onClick={() => {
                                    handleClosePriorityFilter(priority);
                                }}
                            >
                                <Typography fontWeight="bold" variant="body2">
                                    {priority.label}
                                </Typography>
                            </Button>
                        </MenuItem>
                    ))}
                </Menu>

                <Tooltip
                    placement="top"
                    title={selectedEffortLevels.map((effortLevel) => effortLevel.label).join(", ")}
                    slotProps={{
                        popper: {
                            sx: {
                                [`& .${tooltipClasses.tooltip}`]: {
                                    backgroundColor: mode === "dark" ? "#121212" : "#ffffff",
                                    color: mode === "dark" ? "lightgrey" : "#2B2B2B",
                                    boxShadow: 1,
                                    fontSize: 12,
                                },
                            },
                        },
                    }}
                >
                    <Button
                        aria-controls={openEffortLevelFilter ? "fade-menu" : undefined}
                        aria-expanded={openEffortLevelFilter ? "true" : undefined}
                        aria-haspopup="true"
                        id="fade-button"
                        variant={"contained"}
                        sx={{
                            color: selectedEffortLevels.some(
                                (effortLevel) => effortLevel.label === "All"
                            )
                                ? mode === "dark"
                                    ? "white"
                                    : "black"
                                : "white",
                            backgroundColor:
                                mode === "dark"
                                    ? alpha(selectedEffortLevels[0].darkModeColor, 0.5)
                                    : alpha(selectedEffortLevels[0].lightModeColor, 0.8),
                            borderWidth: "3px",
                            fontSize: "13px",
                            fontWeight: "bold",
                            opacity: 0.85,
                            height: "25px",
                            "&:hover": {
                                backgroundColor:
                                    mode === "dark"
                                        ? alpha(selectedEffortLevels[0].darkModeColor, 0.6)
                                        : alpha(selectedEffortLevels[0].lightModeColor, 0.9),
                                color: selectedEffortLevels.some(
                                    (effortLevel) => effortLevel.label === "All"
                                )
                                    ? mode === "dark"
                                        ? "white"
                                        : "black"
                                    : "white",
                            },
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                        onClick={handleClickEffortLevelFilter}
                    >
                        Effort Level: {selectedEffortLevels[0].label}{" "}
                        {selectedEffortLevels.length > 1 && `+${selectedEffortLevels.length - 1}`}
                    </Button>
                </Tooltip>
                <Menu
                    anchorEl={anchorElEffortLevelFilter}
                    id="fade-menu"
                    open={openEffortLevelFilter}
                    slots={{ transition: Fade }}
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
                    onClose={() => setAnchorElEffortLevelFilter(null)}
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
                                    selectedEffortLevels.some(
                                        (items) => items.label === effortLevel.label
                                    ) === true
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
                                    selectedEffortLevels.some(
                                        (items) => items.label === effortLevel.label
                                    ) === true
                                        ? "contained"
                                        : "outlined"
                                }
                                onClick={() => {
                                    handleCloseEffortLevelFilter(effortLevel);
                                }}
                            >
                                <Typography fontWeight="bold" variant="body2">
                                    {effortLevel.label}
                                </Typography>
                            </Button>
                        </MenuItem>
                    ))}
                </Menu>
            </Stack>

            <Stack direction="row" flex={1} justifyContent="flex-end">
                <Button
                    variant="contained"
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
                    onClick={resetFilters}
                >
                    Reset Filters
                </Button>
            </Stack>
        </Stack>
    );
};
