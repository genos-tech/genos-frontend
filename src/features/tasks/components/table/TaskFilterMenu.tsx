import * as React from "react";
import { useEffect } from "react";
import FilterListIcon from "@mui/icons-material/FilterList";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useColorScheme } from "@mui/joy/styles";
import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import Button from "@mui/material/Button";
import Fade from "@mui/material/Fade";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { tooltipClasses } from "@mui/material/Tooltip";
import { alpha } from "@mui/system";

import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { TaskTableProps } from "../../../../types/tasks";
import {
    FilterProps,
    predefinedEffortLevelFilters,
    predefinedPriorityFilters,
    predefinedStatusFilters,
} from "../../types/TaskTableTypes";

// Modern theme-aware styling
const FILTER_STYLES = {
    dark: {
        containerBg: "linear-gradient(135deg, rgba(30,32,44,0.8) 0%, rgba(20,22,34,0.9) 100%)",
        containerBorder: "rgba(99,102,241,0.2)",
        buttonBg: "rgba(40,42,54,0.8)",
        buttonHoverBg: "rgba(99,102,241,0.2)",
        menuBg: "linear-gradient(180deg, rgba(30,32,44,0.98) 0%, rgba(20,22,34,0.99) 100%)",
        menuBorder: "rgba(99,102,241,0.15)",
        textColor: "#f1f5f9",
        mutedText: "rgba(148,163,184,0.9)",
        resetBg: "linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.15) 100%)",
        resetHover: "linear-gradient(135deg, rgba(239,68,68,0.3) 0%, rgba(220,38,38,0.3) 100%)",
        resetBorder: "rgba(239,68,68,0.3)",
    },
    light: {
        containerBg:
            "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.95) 100%)",
        containerBorder: "rgba(99,102,241,0.15)",
        buttonBg: "rgba(255,255,255,0.9)",
        buttonHoverBg: "rgba(99,102,241,0.1)",
        menuBg: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.99) 100%)",
        menuBorder: "rgba(99,102,241,0.12)",
        textColor: "#1e293b",
        mutedText: "rgba(71,85,105,0.9)",
        resetBg: "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(220,38,38,0.08) 100%)",
        resetHover: "linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.15) 100%)",
        resetBorder: "rgba(239,68,68,0.25)",
    },
};

type TaskFilterMenuProps = {
    isTaskUpdated?: boolean;
    useTM: TaskManagementState;
    predefinedTagsFilters: FilterProps[];
    setCurrentDisplayingTasks: (tasks: TaskTableProps[]) => void;
};

export const TaskFilterMenu = (props: TaskFilterMenuProps) => {
    const { isTaskUpdated, useTM, predefinedTagsFilters, setCurrentDisplayingTasks } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? FILTER_STYLES.dark : FILTER_STYLES.light;

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
        let filteredTasks = useTM.allTasks;

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
        setSelectedStatus(predefinedStatusFilters.slice(1, 4));
        setSelectedTags([predefinedTagsFilters[0]]);
        setSelectedPriorities([predefinedPriorityFilters[0]]);
        setSelectedEffortLevels([predefinedEffortLevelFilters[0]]);
        applyFilters(
            predefinedStatusFilters.slice(1, 4),
            [predefinedTagsFilters[0]],
            [predefinedPriorityFilters[0]],
            [predefinedEffortLevelFilters[0]]
        );
    };

    useEffect(() => {
        applyFilters(selectedStatus, selectedTags, selectedPriorities, selectedEffortLevels);
    }, [useTM.allTasks]);

    useEffect(() => {
        if (isTaskUpdated) {
            applyFilters(selectedStatus, selectedTags, selectedPriorities, selectedEffortLevels);
        }
    }, [isTaskUpdated]);

    // Modern filter button style generator
    const getFilterButtonStyle = (filter: FilterProps, isAllSelected: boolean) => ({
        color: isAllSelected ? styles.textColor : "#fff",
        background: isDark
            ? `linear-gradient(135deg, ${alpha(filter.darkModeColor, 0.4)} 0%, ${alpha(filter.darkModeColor, 0.6)} 100%)`
            : `linear-gradient(135deg, ${alpha(filter.lightModeColor, 0.7)} 0%, ${alpha(filter.lightModeColor, 0.9)} 100%)`,
        border: `1px solid ${isDark ? alpha(filter.darkModeColor, 0.5) : alpha(filter.lightModeColor, 0.6)}`,
        borderRadius: "10px",
        fontSize: "12px",
        fontWeight: 600,
        height: "32px",
        whiteSpace: "nowrap",
        px: 1.5,
        textTransform: "none" as const,
        boxShadow: isDark
            ? `0 2px 8px ${alpha(filter.darkModeColor, 0.3)}`
            : `0 2px 8px ${alpha(filter.lightModeColor, 0.25)}`,
        transition: "all 0.2s ease",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxHeight: "2.7em", // show up to ~2 lines, then cut
        lineHeight: 1.35,
        display: "-webkit-box",
        WebkitLineClamp: 2, // limit lines for better UX
        WebkitBoxOrient: "vertical",
        "& span, & .MuiChip-label, & .MuiButton-label, & .MuiTypography-root": {
            overflow: "hidden",
            whiteSpace: "normal",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
        },
        "&::after": {
            content: '""',
        },
        "&:hover": {
            background: isDark
                ? `linear-gradient(135deg, ${alpha(filter.darkModeColor, 0.5)} 0%, ${alpha(filter.darkModeColor, 0.7)} 100%)`
                : `linear-gradient(135deg, ${alpha(filter.lightModeColor, 0.8)} 0%, ${alpha(filter.lightModeColor, 1)} 100%)`,
            transform: "translateY(-1px)",
            boxShadow: isDark
                ? `0 4px 12px ${alpha(filter.darkModeColor, 0.4)}`
                : `0 4px 12px ${alpha(filter.lightModeColor, 0.35)}`,
        },
    });

    return (
        <Box
            sx={{
                background: styles.containerBg,
                border: `1px solid ${styles.containerBorder}`,
                borderRadius: "14px",
                px: 2,
                py: 1,
                mb: 1,
                boxShadow: isDark
                    ? "0 4px 20px rgba(0,0,0,0.3)"
                    : "0 4px 20px rgba(99,102,241,0.08)",
            }}
        >
            <Stack
                direction="row"
                alignItems="center"
                sx={{ overflowX: "auto" }}
                className="custom-scrollbar"
                gap={1.5}
            >
                {/* Filter Icon Label */}
                <Stack direction="row" alignItems="center" gap={0.5} sx={{ flexShrink: 0 }}>
                    <FilterListIcon
                        sx={{
                            fontSize: "18px",
                            color: isDark ? "#818cf8" : "#4f46e5",
                        }}
                    />
                    <Typography
                        variant="caption"
                        sx={{
                            color: styles.mutedText,
                            fontWeight: 600,
                            fontSize: "11px",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                        }}
                    >
                        Filters
                    </Typography>
                </Stack>

                {/* Divider */}
                <Box
                    sx={{
                        width: "1px",
                        height: "24px",
                        background: styles.containerBorder,
                        flexShrink: 0,
                    }}
                />

                {/* Status Filter */}
                <Tooltip
                    placement="top"
                    title={selectedStatus.map((status) => status.label).join(", ")}
                    slotProps={{
                        popper: {
                            sx: {
                                [`& .${tooltipClasses.tooltip}`]: {
                                    background: styles.menuBg,
                                    color: styles.textColor,
                                    border: `1px solid ${styles.menuBorder}`,
                                    boxShadow: isDark
                                        ? "0 4px 12px rgba(0,0,0,0.4)"
                                        : "0 4px 12px rgba(0,0,0,0.1)",
                                    fontSize: 11,
                                    borderRadius: "8px",
                                    px: 1.5,
                                    py: 0.5,
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
                        variant="contained"
                        sx={getFilterButtonStyle(
                            selectedStatus[0],
                            selectedStatus[0].label === "All"
                        )}
                        onClick={handleClickStatusFilter}
                    >
                        Status: {selectedStatus[0].label}
                        {selectedStatus.length > 1 && (
                            <Chip
                                label={`+${selectedStatus.length - 1}`}
                                size="small"
                                sx={{
                                    ml: 0.5,
                                    height: "18px",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    background: "rgba(255,255,255,0.2)",
                                    color: "inherit",
                                }}
                            />
                        )}
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
                                background: styles.menuBg,
                                border: `1px solid ${styles.menuBorder}`,
                                borderRadius: "12px",
                                boxShadow: isDark
                                    ? "0 8px 32px rgba(0,0,0,0.5)"
                                    : "0 8px 32px rgba(0,0,0,0.15)",
                                mt: 1,
                                minWidth: "160px",
                            },
                        },
                    }}
                    onClose={() => setAnchorElStatusFilter(null)}
                >
                    {predefinedStatusFilters.map((status) => {
                        const isSelected = selectedStatus.some(
                            (items) => items.label === status.label
                        );
                        return (
                            <MenuItem
                                key={status.label}
                                onClick={() => handleCloseStatusFilter(status)}
                                sx={{
                                    borderRadius: "8px",
                                    mx: 0.5,
                                    my: 0.25,
                                    transition: "all 0.2s ease",
                                    "&:hover": {
                                        background: styles.buttonHoverBg,
                                    },
                                }}
                            >
                                <Box
                                    sx={{
                                        width: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: "50%",
                                            background: isDark
                                                ? status.darkModeColor
                                                : status.lightModeColor,
                                            boxShadow: `0 0 6px ${isDark ? status.darkModeColor : status.lightModeColor}`,
                                        }}
                                    />
                                    <Typography
                                        sx={{
                                            fontSize: "13px",
                                            fontWeight: isSelected ? 700 : 500,
                                            color: isSelected
                                                ? isDark
                                                    ? status.darkModeColor
                                                    : status.lightModeColor
                                                : styles.textColor,
                                            flex: 1,
                                        }}
                                    >
                                        {status.label}
                                    </Typography>
                                    {isSelected && (
                                        <Box
                                            sx={{
                                                width: 16,
                                                height: 16,
                                                borderRadius: "4px",
                                                background: isDark
                                                    ? status.darkModeColor
                                                    : status.lightModeColor,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "10px",
                                                color: "#fff",
                                                fontWeight: 700,
                                            }}
                                        >
                                            ✓
                                        </Box>
                                    )}
                                </Box>
                            </MenuItem>
                        );
                    })}
                </Menu>

                {/* Tags Filter */}
                {selectedTags.length > 0 && (
                    <>
                        <Tooltip
                            placement="top"
                            title={selectedTags.map((tag) => tag.label).join(", ")}
                            slotProps={{
                                popper: {
                                    sx: {
                                        [`& .${tooltipClasses.tooltip}`]: {
                                            background: styles.menuBg,
                                            color: styles.textColor,
                                            border: `1px solid ${styles.menuBorder}`,
                                            boxShadow: isDark
                                                ? "0 4px 12px rgba(0,0,0,0.4)"
                                                : "0 4px 12px rgba(0,0,0,0.1)",
                                            fontSize: 11,
                                            borderRadius: "8px",
                                            px: 1.5,
                                            py: 0.5,
                                        },
                                    },
                                },
                            }}
                        >
                            <Button
                                aria-controls={openTagsFilter ? "fade-menu" : undefined}
                                aria-expanded={openTagsFilter ? "true" : undefined}
                                aria-haspopup="true"
                                variant="contained"
                                sx={getFilterButtonStyle(
                                    selectedTags[0],
                                    selectedTags.some((tag) => tag.label === "All")
                                )}
                                onClick={handleClickTagsFilter}
                            >
                                Tags: {selectedTags[0].label}
                                {selectedTags.length > 1 && (
                                    <Chip
                                        label={`+${selectedTags.length - 1}`}
                                        size="small"
                                        sx={{
                                            ml: 0.5,
                                            height: "18px",
                                            fontSize: "10px",
                                            fontWeight: 700,
                                            background: "rgba(255,255,255,0.2)",
                                            color: "inherit",
                                        }}
                                    />
                                )}
                            </Button>
                        </Tooltip>
                        <Menu
                            anchorEl={anchorElTagsFilter}
                            open={openTagsFilter}
                            slots={{ transition: Fade }}
                            slotProps={{
                                paper: {
                                    className: "custom-scrollbar",
                                    sx: {
                                        background: styles.menuBg,
                                        border: `1px solid ${styles.menuBorder}`,
                                        borderRadius: "12px",
                                        boxShadow: isDark
                                            ? "0 8px 32px rgba(0,0,0,0.5)"
                                            : "0 8px 32px rgba(0,0,0,0.15)",
                                        mt: 1,
                                        minWidth: "160px",
                                        maxHeight: "300px",
                                    },
                                },
                            }}
                            onClose={() => setAnchorElTagsFilter(null)}
                        >
                            {predefinedTagsFilters.map((tag) => {
                                const isSelected = selectedTags.some(
                                    (items) => items.label === tag.label
                                );
                                return (
                                    <MenuItem
                                        key={tag.label}
                                        onClick={() => handleCloseTagsFilter(tag)}
                                        sx={{
                                            borderRadius: "8px",
                                            mx: 0.5,
                                            my: 0.25,
                                            transition: "all 0.2s ease",
                                            "&:hover": {
                                                background: styles.buttonHoverBg,
                                            },
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                width: "100%",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: "50%",
                                                    background: isDark
                                                        ? tag.darkModeColor
                                                        : tag.lightModeColor,
                                                    boxShadow: `0 0 6px ${isDark ? tag.darkModeColor : tag.lightModeColor}`,
                                                }}
                                            />
                                            <Typography
                                                sx={{
                                                    fontSize: "13px",
                                                    fontWeight: isSelected ? 700 : 500,
                                                    color: isSelected
                                                        ? isDark
                                                            ? tag.darkModeColor
                                                            : tag.lightModeColor
                                                        : styles.textColor,
                                                    flex: 1,
                                                }}
                                            >
                                                {tag.label}
                                            </Typography>
                                            {isSelected && (
                                                <Box
                                                    sx={{
                                                        width: 16,
                                                        height: 16,
                                                        borderRadius: "4px",
                                                        background: isDark
                                                            ? tag.darkModeColor
                                                            : tag.lightModeColor,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        fontSize: "10px",
                                                        color: "#fff",
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    ✓
                                                </Box>
                                            )}
                                        </Box>
                                    </MenuItem>
                                );
                            })}
                        </Menu>
                    </>
                )}

                {/* Priority Filter */}
                <Tooltip
                    placement="top"
                    title={selectedPriorities.map((priority) => priority.label).join(", ")}
                    slotProps={{
                        popper: {
                            sx: {
                                [`& .${tooltipClasses.tooltip}`]: {
                                    background: styles.menuBg,
                                    color: styles.textColor,
                                    border: `1px solid ${styles.menuBorder}`,
                                    boxShadow: isDark
                                        ? "0 4px 12px rgba(0,0,0,0.4)"
                                        : "0 4px 12px rgba(0,0,0,0.1)",
                                    fontSize: 11,
                                    borderRadius: "8px",
                                    px: 1.5,
                                    py: 0.5,
                                },
                            },
                        },
                    }}
                >
                    <Button
                        aria-controls={openPriorityFilter ? "fade-menu" : undefined}
                        aria-expanded={openPriorityFilter ? "true" : undefined}
                        aria-haspopup="true"
                        variant="contained"
                        sx={getFilterButtonStyle(
                            selectedPriorities[0],
                            selectedPriorities.some((priority) => priority.label === "All")
                        )}
                        onClick={handleClickPriorityFilter}
                    >
                        Priority: {selectedPriorities[0].label}
                        {selectedPriorities.length > 1 && (
                            <Chip
                                label={`+${selectedPriorities.length - 1}`}
                                size="small"
                                sx={{
                                    ml: 0.5,
                                    height: "18px",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    background: "rgba(255,255,255,0.2)",
                                    color: "inherit",
                                }}
                            />
                        )}
                    </Button>
                </Tooltip>
                <Menu
                    anchorEl={anchorElPriorityFilter}
                    open={openPriorityFilter}
                    slots={{ transition: Fade }}
                    slotProps={{
                        paper: {
                            sx: {
                                background: styles.menuBg,
                                border: `1px solid ${styles.menuBorder}`,
                                borderRadius: "12px",
                                boxShadow: isDark
                                    ? "0 8px 32px rgba(0,0,0,0.5)"
                                    : "0 8px 32px rgba(0,0,0,0.15)",
                                mt: 1,
                                minWidth: "160px",
                            },
                        },
                    }}
                    onClose={() => setAnchorElPriorityFilter(null)}
                >
                    {predefinedPriorityFilters.map((priority) => {
                        const isSelected = selectedPriorities.some(
                            (items) => items.label === priority.label
                        );
                        return (
                            <MenuItem
                                key={priority.label}
                                onClick={() => handleClosePriorityFilter(priority)}
                                sx={{
                                    borderRadius: "8px",
                                    mx: 0.5,
                                    my: 0.25,
                                    transition: "all 0.2s ease",
                                    "&:hover": {
                                        background: styles.buttonHoverBg,
                                    },
                                }}
                            >
                                <Box
                                    sx={{
                                        width: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: "50%",
                                            background: isDark
                                                ? priority.darkModeColor
                                                : priority.lightModeColor,
                                            boxShadow: `0 0 6px ${isDark ? priority.darkModeColor : priority.lightModeColor}`,
                                        }}
                                    />
                                    <Typography
                                        sx={{
                                            fontSize: "13px",
                                            fontWeight: isSelected ? 700 : 500,
                                            color: isSelected
                                                ? isDark
                                                    ? priority.darkModeColor
                                                    : priority.lightModeColor
                                                : styles.textColor,
                                            flex: 1,
                                        }}
                                    >
                                        {priority.label}
                                    </Typography>
                                    {isSelected && (
                                        <Box
                                            sx={{
                                                width: 16,
                                                height: 16,
                                                borderRadius: "4px",
                                                background: isDark
                                                    ? priority.darkModeColor
                                                    : priority.lightModeColor,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "10px",
                                                color: "#fff",
                                                fontWeight: 700,
                                            }}
                                        >
                                            ✓
                                        </Box>
                                    )}
                                </Box>
                            </MenuItem>
                        );
                    })}
                </Menu>

                {/* Effort Level Filter */}
                <Tooltip
                    placement="top"
                    title={selectedEffortLevels.map((effortLevel) => effortLevel.label).join(", ")}
                    slotProps={{
                        popper: {
                            sx: {
                                [`& .${tooltipClasses.tooltip}`]: {
                                    background: styles.menuBg,
                                    color: styles.textColor,
                                    border: `1px solid ${styles.menuBorder}`,
                                    boxShadow: isDark
                                        ? "0 4px 12px rgba(0,0,0,0.4)"
                                        : "0 4px 12px rgba(0,0,0,0.1)",
                                    fontSize: 11,
                                    borderRadius: "8px",
                                    px: 1.5,
                                    py: 0.5,
                                },
                            },
                        },
                    }}
                >
                    <Button
                        aria-controls={openEffortLevelFilter ? "fade-menu" : undefined}
                        aria-expanded={openEffortLevelFilter ? "true" : undefined}
                        aria-haspopup="true"
                        variant="contained"
                        sx={getFilterButtonStyle(
                            selectedEffortLevels[0],
                            selectedEffortLevels.some((effortLevel) => effortLevel.label === "All")
                        )}
                        onClick={handleClickEffortLevelFilter}
                    >
                        Effort: {selectedEffortLevels[0].label}
                        {selectedEffortLevels.length > 1 && (
                            <Chip
                                label={`+${selectedEffortLevels.length - 1}`}
                                size="small"
                                sx={{
                                    ml: 0.5,
                                    height: "18px",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    background: "rgba(255,255,255,0.2)",
                                    color: "inherit",
                                }}
                            />
                        )}
                    </Button>
                </Tooltip>
                <Menu
                    anchorEl={anchorElEffortLevelFilter}
                    open={openEffortLevelFilter}
                    slots={{ transition: Fade }}
                    slotProps={{
                        paper: {
                            sx: {
                                background: styles.menuBg,
                                border: `1px solid ${styles.menuBorder}`,
                                borderRadius: "12px",
                                boxShadow: isDark
                                    ? "0 8px 32px rgba(0,0,0,0.5)"
                                    : "0 8px 32px rgba(0,0,0,0.15)",
                                mt: 1,
                                minWidth: "160px",
                            },
                        },
                    }}
                    onClose={() => setAnchorElEffortLevelFilter(null)}
                >
                    {predefinedEffortLevelFilters.map((effortLevel) => {
                        const isSelected = selectedEffortLevels.some(
                            (items) => items.label === effortLevel.label
                        );
                        return (
                            <MenuItem
                                key={effortLevel.label}
                                onClick={() => handleCloseEffortLevelFilter(effortLevel)}
                                sx={{
                                    borderRadius: "8px",
                                    mx: 0.5,
                                    my: 0.25,
                                    transition: "all 0.2s ease",
                                    "&:hover": {
                                        background: styles.buttonHoverBg,
                                    },
                                }}
                            >
                                <Box
                                    sx={{
                                        width: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: "50%",
                                            background: isDark
                                                ? effortLevel.darkModeColor
                                                : effortLevel.lightModeColor,
                                            boxShadow: `0 0 6px ${isDark ? effortLevel.darkModeColor : effortLevel.lightModeColor}`,
                                        }}
                                    />
                                    <Typography
                                        sx={{
                                            fontSize: "13px",
                                            fontWeight: isSelected ? 700 : 500,
                                            color: isSelected
                                                ? isDark
                                                    ? effortLevel.darkModeColor
                                                    : effortLevel.lightModeColor
                                                : styles.textColor,
                                            flex: 1,
                                        }}
                                    >
                                        {effortLevel.label}
                                    </Typography>
                                    {isSelected && (
                                        <Box
                                            sx={{
                                                width: 16,
                                                height: 16,
                                                borderRadius: "4px",
                                                background: isDark
                                                    ? effortLevel.darkModeColor
                                                    : effortLevel.lightModeColor,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "10px",
                                                color: "#fff",
                                                fontWeight: 700,
                                            }}
                                        >
                                            ✓
                                        </Box>
                                    )}
                                </Box>
                            </MenuItem>
                        );
                    })}
                </Menu>

                {/* Spacer */}
                <Box sx={{ flex: 1 }} />

                {/* Reset Filters Button */}
                <Tooltip
                    placement="top"
                    title="Reset all filters to default"
                    slotProps={{
                        popper: {
                            sx: {
                                [`& .${tooltipClasses.tooltip}`]: {
                                    background: styles.menuBg,
                                    color: styles.textColor,
                                    border: `1px solid ${styles.menuBorder}`,
                                    fontSize: 11,
                                    borderRadius: "8px",
                                    px: 1.5,
                                    py: 0.5,
                                },
                            },
                        },
                    }}
                >
                    <Button
                        variant="outlined"
                        startIcon={<RestartAltIcon sx={{ fontSize: "16px" }} />}
                        sx={{
                            color: isDark ? "#f87171" : "#dc2626",
                            background: styles.resetBg,
                            border: `1px solid ${styles.resetBorder}`,
                            borderRadius: "10px",
                            fontSize: "12px",
                            fontWeight: 600,
                            height: "32px",
                            px: 1.5,
                            textTransform: "none",
                            flexShrink: 0,
                            transition: "all 0.2s ease",
                            "&:hover": {
                                background: styles.resetHover,
                                border: `1px solid ${isDark ? "rgba(239,68,68,0.5)" : "rgba(239,68,68,0.4)"}`,
                                transform: "translateY(-1px)",
                                boxShadow: isDark
                                    ? "0 4px 12px rgba(239,68,68,0.2)"
                                    : "0 4px 12px rgba(239,68,68,0.15)",
                            },
                        }}
                        onClick={resetFilters}
                    >
                        Reset
                    </Button>
                </Tooltip>
            </Stack>
        </Box>
    );
};
