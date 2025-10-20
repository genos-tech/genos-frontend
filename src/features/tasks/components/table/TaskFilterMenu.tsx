import * as React from "react";
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
    predefinedCategoryFilters,
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

    // Category filter
    const [selectedCategory, setSelectedCategory] = React.useState<FilterProps>(
        predefinedCategoryFilters[0]
    );
    const [anchorElCategoryFilter, setAnchorElCategoryFilter] = React.useState<null | HTMLElement>(
        null
    );
    const openCategoryFilter = Boolean(anchorElCategoryFilter);
    const handleClickCategoryFilter = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorElCategoryFilter(event.currentTarget);
    };
    const handleCloseCategoryFilter = (category: FilterProps | null) => {
        if (category) {
            setSelectedCategory(category);
            applyFilters(
                category,
                selectedStatus,
                selectedTags,
                selectedPriority,
                selectedEffortLevel
            );
        }
        setAnchorElCategoryFilter(null);
    };

    // Status filter
    const [selectedStatus, setSelectedStatus] = React.useState<FilterProps>(
        predefinedStatusFilters[0]
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
            setSelectedStatus(status);
            applyFilters(
                selectedCategory,
                status,
                selectedTags,
                selectedPriority,
                selectedEffortLevel
            );
        }
        setAnchorElStatusFilter(null);
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
            applyFilters(
                selectedCategory,
                selectedStatus,
                tag,
                selectedPriority,
                selectedEffortLevel
            );
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
            applyFilters(
                selectedCategory,
                selectedStatus,
                selectedTags,
                priority,
                selectedEffortLevel
            );
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
            applyFilters(
                selectedCategory,
                selectedStatus,
                selectedTags,
                selectedPriority,
                effortLevel
            );
        }
        setAnchorElEffortLevelFilter(null);
    };

    // Apply filters
    const applyFilters = (
        category: FilterProps,
        status: FilterProps,
        tags: FilterProps | undefined,
        priority: FilterProps,
        effortLevel: FilterProps
    ) => {
        // Apply all filters and set the displaying tasks
        // Filters: status, tags, priority, effort level
        let filteredTasks = TM.allTasks;

        // Filter by category
        if (category.label === "Ongoing") {
            filteredTasks = filteredTasks.filter(
                (task) =>
                    task.status === "Open" || task.status === "WIP" || task.status === "Pending"
            );
        } else {
            filteredTasks = filteredTasks.filter((task) => task.status === status.label);
        }

        // Filter by status
        if (status.label === "All") {
            filteredTasks = filteredTasks.filter((task) => task.parentTaskId === null);
        } else if (status.label === "Expired") {
            filteredTasks = filteredTasks.filter(
                (task) => task.dueDate && new Date(task.dueDate) < new Date()
            );
        } else {
            filteredTasks = filteredTasks.filter((task) => task.status === status.label);
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
        setSelectedCategory(predefinedCategoryFilters[0]);
        setSelectedStatus(predefinedStatusFilters[0]);
        setSelectedTags(predefinedTagsFilters[0]);
        setSelectedPriority(predefinedPriorityFilters[0]);
        setSelectedEffortLevel(predefinedEffortLevelFilters[0]);
        applyFilters(
            predefinedCategoryFilters[0],
            predefinedStatusFilters[0],
            predefinedTagsFilters[0],
            predefinedPriorityFilters[0],
            predefinedEffortLevelFilters[0]
        );
    };

    return (
        <Stack direction="row" gap={1} m={1}>
            <Stack direction="row" gap={1}>
                <Button
                    id="fade-button"
                    sx={{
                        color: selectedCategory.label === "All" ? "black" : "white",
                        backgroundColor:
                            mode === "dark"
                                ? alpha(selectedCategory.darkModeColor, 0.5)
                                : alpha(selectedCategory.lightModeColor, 0.8),
                        borderWidth: "3px",
                        fontSize: "13px",
                        fontWeight: "bold",
                        opacity: 0.85,
                        height: "25px",
                        "&:hover": {
                            backgroundColor:
                                mode === "dark"
                                    ? alpha(selectedCategory.darkModeColor, 0.5)
                                    : alpha(selectedCategory.lightModeColor, 0.8),
                            color: selectedCategory.label === "All" ? "black" : "white",
                        },
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                    variant={"contained"}
                    aria-controls={openCategoryFilter ? "fade-menu" : undefined}
                    aria-haspopup="true"
                    aria-expanded={openCategoryFilter ? "true" : undefined}
                    onClick={handleClickCategoryFilter}
                >
                    Category: {selectedCategory.label}
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
                    anchorEl={anchorElCategoryFilter}
                    open={openCategoryFilter}
                    onClose={() => handleCloseCategoryFilter(null)}
                >
                    {predefinedCategoryFilters.map((status) => (
                        <MenuItem
                            key={status.label}
                            onClick={() => handleCloseCategoryFilter(status)}
                        >
                            <Button
                                key={`status-filter-${status.label}`}
                                component="button"
                                color={
                                    selectedCategory?.label === status.label ? "info" : "inherit"
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
                                    selectedCategory?.label === status.label
                                        ? "contained"
                                        : "outlined"
                                }
                                onClick={() => {
                                    handleCloseCategoryFilter(status);
                                }}
                            >
                                {status.label === "Ongoing" && (
                                    <Tooltip title="Open, WIP, and Pending" placement="top">
                                        <Typography variant="body2" fontWeight="bold">
                                            {status.label}
                                        </Typography>
                                    </Tooltip>
                                )}
                                {status.label !== "Ongoing" && (
                                    <Typography variant="body2" fontWeight="bold">
                                        {status.label}
                                    </Typography>
                                )}
                            </Button>
                        </MenuItem>
                    ))}
                </Menu>

                <Button
                    id="fade-button"
                    sx={{
                        color: selectedStatus.label === "All" ? "black" : "white",
                        backgroundColor:
                            mode === "dark"
                                ? alpha(selectedStatus.darkModeColor, 0.5)
                                : alpha(selectedStatus.lightModeColor, 0.8),
                        borderWidth: "3px",
                        fontSize: "13px",
                        fontWeight: "bold",
                        opacity: 0.85,
                        height: "25px",
                        "&:hover": {
                            backgroundColor:
                                mode === "dark"
                                    ? alpha(selectedStatus.darkModeColor, 0.5)
                                    : alpha(selectedStatus.lightModeColor, 0.8),
                            color: selectedStatus.label === "All" ? "black" : "white",
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
                    Status: {selectedStatus.label}
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
                    onClose={() => handleCloseStatusFilter(null)}
                >
                    {predefinedStatusFilters.map((status) => (
                        <MenuItem
                            key={status.label}
                            onClick={() => handleCloseStatusFilter(status)}
                        >
                            <Button
                                key={`status-filter-${status.label}`}
                                component="button"
                                color={selectedStatus?.label === status.label ? "info" : "inherit"}
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
                                    selectedStatus?.label === status.label
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
