import { useEffect, useMemo } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import PendingActionsRoundedIcon from "@mui/icons-material/PendingActionsRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import TipsAndUpdatesRoundedIcon from "@mui/icons-material/TipsAndUpdatesRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import ViewKanbanRoundedIcon from "@mui/icons-material/ViewKanbanRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import {
    Box,
    Button,
    Card,
    Chip,
    Grid,
    LinearProgress,
    Option,
    Select,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";

type TaskHomeContentProps = {
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
};

export const TaskHomeContent = ({ useTM, usePM }: TaskHomeContentProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    // Refresh task data when Dashboard is mounted to ensure fresh stats
    useEffect(() => {
        if (usePM.currentProject?.projectId) {
            useTM.fetchProjectTasks(usePM.currentProject.projectId);
        }
    }, []);

    // Calculate task statistics for current project
    const stats = useMemo(() => {
        const allTasks = useTM.allTasks || [];
        const openCount = allTasks.filter((t) => t.status === "Open").length;
        const wipCount = allTasks.filter((t) => t.status === "WIP").length;
        const pendingCount = allTasks.filter((t) => t.status === "Pending").length;
        const closedCount = allTasks.filter((t) => t.status === "Closed").length;
        const totalActive = openCount + wipCount + pendingCount;
        const totalTasks = openCount + wipCount + pendingCount + closedCount;
        const completionRate = totalTasks > 0 ? Math.round((closedCount / totalTasks) * 100) : 0;

        return {
            openCount,
            wipCount,
            pendingCount,
            closedCount,
            totalActive,
            totalTasks,
            completionRate,
        };
    }, [useTM.allTasks]);

    // Get project count
    const projectCount = usePM.teamProjects?.length || 0;

    // Get recent tasks (sorted by updatedAt, take top N active ones)
    const recentTasks = useMemo(() => {
        return (useTM.allTasks || [])
            .filter((t) => t.status !== "Closed" && t.status !== "Deleted")
            .sort((a, b) => {
                const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                return dateB - dateA; // Descending order (most recent first)
            })
            .slice(0, 12);
    }, [useTM.allTasks]);

    const handleTaskClick = (taskId: number) => {
        useTM.setIsTaskPreviewVisible(true);
        useTM.setCurrentPreviewTaskId(taskId);
    };

    const handleGoToTable = () => {
        useTM.setIsDashboardVisible(false);
        useTM.setIsTaskHomeVisible(true);
        useTM.setIsSprintBoardVisible(false);
    };

    const handleGoToBoard = () => {
        useTM.setIsDashboardVisible(false);
        useTM.setIsTaskHomeVisible(false);
        useTM.setIsSprintBoardVisible(true);
    };

    const handleCreateTask = () => {
        useTM.handleCreateTask();
    };

    // Handle project change
    const handleProjectChange = async (projectId: number) => {
        const selectedProject = usePM.teamProjects?.find((p) => p.projectId === projectId);
        if (selectedProject && projectId !== usePM.currentProject?.projectId) {
            // Reset task table
            useTM.setAllTasks([]);
            // Load project and tasks
            await usePM.loadProjectsAndTasks(projectId);
            // Set current project
            usePM.setCurrentProject({
                projectId: selectedProject.projectId,
                projectName: selectedProject.projectName,
                projectTags: selectedProject.projectTags || [],
                isPrivate: selectedProject.isPrivate,
                systemUserId: selectedProject.systemUserId,
            });
        }
    };

    // Get joined projects for the selector
    const joinedProjects = useMemo(() => {
        return (usePM.teamProjects || []).filter((p) => p.isJoined === true);
    }, [usePM.teamProjects]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Open":
                return { bg: "rgba(59,130,246,0.12)", text: "#3b82f6" };
            case "WIP":
                return { bg: "rgba(251,191,36,0.12)", text: "#fbbf24" };
            case "Pending":
                return { bg: "rgba(251,146,60,0.12)", text: "#fb923c" };
            case "Closed":
                return { bg: "rgba(34,197,94,0.12)", text: "#22c55e" };
            default:
                return { bg: "rgba(148,163,184,0.12)", text: "#94a3b8" };
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "Open":
                return <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 14 }} />;
            case "WIP":
                return <PlayCircleOutlineRoundedIcon sx={{ fontSize: 14 }} />;
            case "Pending":
                return <PendingActionsRoundedIcon sx={{ fontSize: 14 }} />;
            case "Closed":
                return <CheckCircleOutlineRoundedIcon sx={{ fontSize: 14 }} />;
            default:
                return <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 14 }} />;
        }
    };

    const statCards = [
        {
            label: "Open",
            count: stats.openCount,
            icon: <RadioButtonUncheckedRoundedIcon />,
            color: "#3b82f6",
            bgColor: isDark ? "rgba(59,130,246,0.08)" : "rgba(59,130,246,0.06)",
        },
        {
            label: "In Progress",
            count: stats.wipCount,
            icon: <PlayCircleOutlineRoundedIcon />,
            color: "#fbbf24",
            bgColor: isDark ? "rgba(251,191,36,0.08)" : "rgba(251,191,36,0.06)",
        },
        {
            label: "Pending",
            count: stats.pendingCount,
            icon: <PendingActionsRoundedIcon />,
            color: "#fb923c",
            bgColor: isDark ? "rgba(251,146,60,0.08)" : "rgba(251,146,60,0.06)",
        },
        {
            label: "Completed",
            count: stats.closedCount,
            icon: <CheckCircleOutlineRoundedIcon />,
            color: "#22c55e",
            bgColor: isDark ? "rgba(34,197,94,0.08)" : "rgba(34,197,94,0.06)",
        },
    ];

    const tips = [
        "Drag and drop tasks in the Sprint Board to change their status",
        "Add tags to tasks for better organization and filtering",
        "Use the filter menu to quickly find specific tasks",
        "Link tasks to chats for seamless team communication",
    ];

    const randomTip = tips[Math.floor(Math.random() * tips.length)];

    return (
        <Box
            sx={{
                height: "100%",
                overflow: "auto",
                p: { xs: 2, md: 4 },
                background: isDark
                    ? "linear-gradient(180deg, rgba(18, 18, 19, 0.95) 0%, rgb(25, 26, 28) 100%)"
                    : "linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(241,245,249,1) 100%)",
            }}
            className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
        >
            <Stack spacing={4} sx={{ maxWidth: 1200, mx: "auto" }}>
                {/* Welcome Header */}
                <Box>
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
                        <Box
                            sx={{
                                width: 40,
                                height: 40,
                                borderRadius: "12px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: isDark
                                    ? "linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(99,102,241,0.2) 100%)"
                                    : "linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(99,102,241,0.15) 100%)",
                            }}
                        >
                            <AutoAwesomeRoundedIcon
                                sx={{ fontSize: 22, color: isDark ? "#60a5fa" : "#3b82f6" }}
                            />
                        </Box>
                        <Typography
                            level="h2"
                            sx={{
                                fontWeight: 700,
                                fontSize: { xs: "1.5rem", md: "1.75rem" },
                                color: isDark ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.87)",
                                letterSpacing: "-0.02em",
                            }}
                        >
                            Task Dashboard
                        </Typography>
                    </Stack>
                    <Typography
                        level="body-md"
                        sx={{
                            color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
                            pl: 6.5,
                        }}
                    >
                        {projectCount} projects in your workspace
                    </Typography>
                </Box>

                {/* Current Project Card */}
                {usePM.currentProject && (
                    <Card
                        variant="soft"
                        sx={{
                            p: 3,
                            background: isDark
                                ? "linear-gradient(135deg, rgba(251,146,60,0.08) 0%, rgba(234,88,12,0.08) 100%)"
                                : "linear-gradient(135deg, rgba(251,146,60,0.06) 0%, rgba(234,88,12,0.06) 100%)",
                            border: "1px solid",
                            borderColor: isDark ? "rgba(251,146,60,0.2)" : "rgba(251,146,60,0.15)",
                        }}
                    >
                        <Stack spacing={2.5}>
                            <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                            >
                                <Stack direction="row" alignItems="center" spacing={1.5}>
                                    <Box
                                        sx={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: "12px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            backgroundColor: isDark
                                                ? "rgba(251,146,60,0.15)"
                                                : "rgba(251,146,60,0.12)",
                                        }}
                                    >
                                        <WorkRoundedIcon
                                            sx={{
                                                fontSize: 24,
                                                color: isDark ? "#fb923c" : "#ea580c",
                                            }}
                                        />
                                    </Box>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography
                                            level="body-xs"
                                            sx={{
                                                color: isDark
                                                    ? "rgba(255,255,255,0.5)"
                                                    : "rgba(0,0,0,0.5)",
                                                fontWeight: 500,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.05em",
                                                mb: 0.5,
                                            }}
                                        >
                                            Current Project
                                        </Typography>
                                        <Select
                                            value={usePM.currentProject.projectId}
                                            onChange={(_, value) => {
                                                if (value) handleProjectChange(value as number);
                                            }}
                                            indicator={<KeyboardArrowDownRoundedIcon />}
                                            startDecorator={
                                                <SwapHorizRoundedIcon sx={{ fontSize: 18 }} />
                                            }
                                            sx={{
                                                minWidth: 200,
                                                maxWidth: 300,
                                                fontWeight: 700,
                                                fontSize: "1.1rem",
                                                color: isDark ? "#fb923c" : "#ea580c",
                                                backgroundColor: isDark
                                                    ? "rgba(251,146,60,0.1)"
                                                    : "rgba(251,146,60,0.08)",
                                                border: "1px solid",
                                                borderColor: isDark
                                                    ? "rgba(251,146,60,0.3)"
                                                    : "rgba(251,146,60,0.2)",
                                                "&:hover": {
                                                    backgroundColor: isDark
                                                        ? "rgba(251,146,60,0.15)"
                                                        : "rgba(251,146,60,0.12)",
                                                },
                                                "& .MuiSelect-indicator": {
                                                    color: isDark ? "#fb923c" : "#ea580c",
                                                },
                                                "& .MuiSelect-startDecorator": {
                                                    color: isDark ? "#fb923c" : "#ea580c",
                                                },
                                            }}
                                            slotProps={{
                                                listbox: {
                                                    sx: {
                                                        backgroundColor: isDark
                                                            ? "rgba(30,30,32,0.98)"
                                                            : "rgba(255,255,255,0.98)",
                                                        border: "1px solid",
                                                        borderColor: isDark
                                                            ? "rgba(255,255,255,0.1)"
                                                            : "rgba(0,0,0,0.1)",
                                                    },
                                                },
                                            }}
                                        >
                                            {joinedProjects.map((project) => (
                                                <Option
                                                    key={project.projectId}
                                                    value={project.projectId}
                                                    sx={{
                                                        fontWeight:
                                                            project.projectId ===
                                                            usePM.currentProject?.projectId
                                                                ? 700
                                                                : 500,
                                                        color:
                                                            project.projectId ===
                                                            usePM.currentProject?.projectId
                                                                ? isDark
                                                                    ? "#fb923c"
                                                                    : "#ea580c"
                                                                : isDark
                                                                  ? "rgba(255,255,255,0.85)"
                                                                  : "rgba(0,0,0,0.8)",
                                                        "&:hover": {
                                                            backgroundColor: isDark
                                                                ? "rgba(251,146,60,0.15)"
                                                                : "rgba(251,146,60,0.1)",
                                                        },
                                                        "&.Mui-selected": {
                                                            backgroundColor: isDark
                                                                ? "rgba(251,146,60,0.2)"
                                                                : "rgba(251,146,60,0.12)",
                                                        },
                                                    }}
                                                >
                                                    {project.projectName}
                                                </Option>
                                            ))}
                                        </Select>
                                    </Box>
                                </Stack>
                                <Chip
                                    size="lg"
                                    variant="soft"
                                    sx={{
                                        backgroundColor: isDark
                                            ? "rgba(34,197,94,0.12)"
                                            : "rgba(34,197,94,0.1)",
                                        color: "#22c55e",
                                        fontWeight: 700,
                                        fontSize: "1rem",
                                        px: 2,
                                    }}
                                >
                                    {stats.completionRate}% Complete
                                </Chip>
                            </Stack>

                            {/* Progress Bar */}
                            <Box>
                                <Stack
                                    direction="row"
                                    justifyContent="space-between"
                                    sx={{ mb: 1 }}
                                >
                                    <Typography
                                        level="body-sm"
                                        sx={{
                                            color: isDark
                                                ? "rgba(255,255,255,0.6)"
                                                : "rgba(0,0,0,0.55)",
                                            fontWeight: 500,
                                        }}
                                    >
                                        Project Progress
                                    </Typography>
                                    <Typography
                                        level="body-sm"
                                        sx={{
                                            color: isDark
                                                ? "rgba(255,255,255,0.6)"
                                                : "rgba(0,0,0,0.55)",
                                            fontWeight: 500,
                                        }}
                                    >
                                        {stats.closedCount} / {stats.totalTasks} tasks
                                    </Typography>
                                </Stack>
                                <LinearProgress
                                    determinate
                                    value={stats.completionRate}
                                    color="success"
                                    sx={{
                                        "--LinearProgress-thickness": "10px",
                                        "--LinearProgress-radius": "5px",
                                        "--LinearProgress-progressRadius": "5px",
                                        backgroundColor: isDark
                                            ? "rgba(255,255,255,0.1)"
                                            : "rgba(0,0,0,0.08)",
                                    }}
                                />
                            </Box>

                            {/* Quick Stats Row */}
                            <Stack direction="row" spacing={2} flexWrap="wrap">
                                <Chip
                                    size="md"
                                    variant="soft"
                                    startDecorator={
                                        <TrendingUpRoundedIcon sx={{ fontSize: 16 }} />
                                    }
                                    sx={{
                                        backgroundColor: isDark
                                            ? "rgba(59,130,246,0.12)"
                                            : "rgba(59,130,246,0.1)",
                                        color: "#3b82f6",
                                    }}
                                >
                                    {stats.totalActive} Active
                                </Chip>
                                <Chip
                                    size="md"
                                    variant="soft"
                                    startDecorator={
                                        <PlayCircleOutlineRoundedIcon sx={{ fontSize: 16 }} />
                                    }
                                    sx={{
                                        backgroundColor: isDark
                                            ? "rgba(251,191,36,0.12)"
                                            : "rgba(251,191,36,0.1)",
                                        color: "#fbbf24",
                                    }}
                                >
                                    {stats.wipCount} In Progress
                                </Chip>
                                <Chip
                                    size="md"
                                    variant="soft"
                                    startDecorator={
                                        <PendingActionsRoundedIcon sx={{ fontSize: 16 }} />
                                    }
                                    sx={{
                                        backgroundColor: isDark
                                            ? "rgba(251,146,60,0.12)"
                                            : "rgba(251,146,60,0.1)",
                                        color: "#fb923c",
                                    }}
                                >
                                    {stats.pendingCount} Pending
                                </Chip>
                            </Stack>
                        </Stack>
                    </Card>
                )}

                {/* No Project Selected State */}
                {!usePM.currentProject && (
                    <Card
                        variant="soft"
                        sx={{
                            p: 4,
                            textAlign: "center",
                            background: isDark
                                ? "rgba(255,255,255,0.02)"
                                : "rgba(255,255,255,0.5)",
                            border: "2px dashed",
                            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                        }}
                    >
                        <Stack spacing={2} alignItems="center">
                            <Box
                                sx={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: "16px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: isDark
                                        ? "rgba(251,146,60,0.1)"
                                        : "rgba(251,146,60,0.08)",
                                }}
                            >
                                <WorkRoundedIcon
                                    sx={{
                                        fontSize: 32,
                                        color: isDark ? "#fb923c" : "#ea580c",
                                    }}
                                />
                            </Box>
                            <Box>
                                <Typography
                                    level="title-lg"
                                    sx={{
                                        fontWeight: 600,
                                        color: isDark
                                            ? "rgba(255,255,255,0.85)"
                                            : "rgba(0,0,0,0.8)",
                                        mb: 0.5,
                                    }}
                                >
                                    No Project Selected
                                </Typography>
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        color: isDark
                                            ? "rgba(255,255,255,0.45)"
                                            : "rgba(0,0,0,0.45)",
                                    }}
                                >
                                    Select a project from the sidebar to view its tasks
                                </Typography>
                            </Box>
                        </Stack>
                    </Card>
                )}

                {/* Stats Grid - Only show when project is selected */}
                {usePM.currentProject && (
                    <Box>
                        <Typography
                            level="title-md"
                            sx={{
                                fontWeight: 600,
                                mb: 2,
                                color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0, 0, 0, 0.75)",
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            <TrendingUpRoundedIcon sx={{ fontSize: 18 }} />
                            Task Breakdown
                        </Typography>
                        <Grid container spacing={2}>
                            {statCards.map((stat) => (
                                <Grid key={stat.label} xs={6} md={3}>
                                    <Card
                                        variant="soft"
                                        sx={{
                                            p: 2.5,
                                            background: stat.bgColor,
                                            border: "1px solid",
                                            borderColor: isDark
                                                ? "rgba(255,255,255,0.04)"
                                                : "rgba(0,0,0,0.04)",
                                            transition: "all 0.2s ease",
                                            "&:hover": {
                                                transform: "translateY(-2px)",
                                                boxShadow: isDark
                                                    ? "0 8px 24px rgba(0,0,0,0.3)"
                                                    : "0 8px 24px rgba(0,0,0,0.08)",
                                            },
                                        }}
                                    >
                                        <Stack spacing={1.5}>
                                            <Box
                                                sx={{
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: "10px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    color: stat.color,
                                                    backgroundColor: isDark
                                                        ? "rgba(255,255,255,0.06)"
                                                        : "rgba(255,255,255,0.8)",
                                                }}
                                            >
                                                {stat.icon}
                                            </Box>
                                            <Box>
                                                <Typography
                                                    level="h3"
                                                    sx={{
                                                        fontWeight: 700,
                                                        fontSize: "1.5rem",
                                                        color: isDark
                                                            ? "rgba(255,255,255,0.9)"
                                                            : "rgba(0,0,0,0.85)",
                                                    }}
                                                >
                                                    {stat.count}
                                                </Typography>
                                                <Typography
                                                    level="body-sm"
                                                    sx={{
                                                        color: isDark
                                                            ? "rgba(255,255,255,0.5)"
                                                            : "rgba(0,0,0,0.5)",
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    {stat.label}
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                )}

                {/* Quick Actions */}
                <Box>
                    <Typography
                        level="title-md"
                        sx={{
                            fontWeight: 600,
                            mb: 2,
                            color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0, 0, 0, 0.75)",
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                        }}
                    >
                        <DashboardRoundedIcon sx={{ fontSize: 18 }} />
                        Quick Actions
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                        <Button
                            variant="soft"
                            startDecorator={<AddRoundedIcon />}
                            onClick={handleCreateTask}
                            disabled={!usePM.currentProject}
                            sx={{
                                flex: 1,
                                py: 1.5,
                                background: isDark
                                    ? "rgba(34,197,94,0.12)"
                                    : "rgba(34,197,94,0.08)",
                                color: "#22c55e",
                                "&:hover": {
                                    background: isDark
                                        ? "rgba(34,197,94,0.2)"
                                        : "rgba(34,197,94,0.15)",
                                },
                                "&:disabled": {
                                    opacity: 0.5,
                                },
                            }}
                        >
                            Create New Task
                        </Button>
                        <Button
                            variant="soft"
                            startDecorator={<FolderOpenRoundedIcon />}
                            onClick={handleGoToTable}
                            disabled={!usePM.currentProject}
                            sx={{
                                flex: 1,
                                py: 1.5,
                                background: isDark
                                    ? "rgba(59,130,246,0.12)"
                                    : "rgba(59,130,246,0.08)",
                                color: "#3b82f6",
                                "&:hover": {
                                    background: isDark
                                        ? "rgba(59,130,246,0.2)"
                                        : "rgba(59,130,246,0.15)",
                                },
                                "&:disabled": {
                                    opacity: 0.5,
                                },
                            }}
                        >
                            Open Task Table
                        </Button>
                        <Button
                            variant="soft"
                            startDecorator={<ViewKanbanRoundedIcon />}
                            onClick={handleGoToBoard}
                            disabled={!usePM.currentProject}
                            sx={{
                                flex: 1,
                                py: 1.5,
                                background: isDark
                                    ? "rgba(147,51,234,0.12)"
                                    : "rgba(147,51,234,0.08)",
                                color: "#a855f7",
                                "&:hover": {
                                    background: isDark
                                        ? "rgba(147,51,234,0.2)"
                                        : "rgba(147,51,234,0.15)",
                                },
                                "&:disabled": {
                                    opacity: 0.5,
                                },
                            }}
                        >
                            Open Sprint Board
                        </Button>
                    </Stack>
                </Box>

                {/* Recent Tasks - Only show when project is selected */}
                {usePM.currentProject && recentTasks.length > 0 && (
                    <Box>
                        <Typography
                            level="title-md"
                            sx={{
                                fontWeight: 600,
                                mb: 2,
                                color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.75)",
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            <AssignmentRoundedIcon sx={{ fontSize: 18 }} />
                            Active Tasks in {usePM.currentProject.projectName}
                        </Typography>
                        <Grid container spacing={1.5}>
                            {recentTasks.map((task) => {
                                const statusColors = getStatusColor(task.status || "");
                                return (
                                    <Grid key={task.id} xs={12} sm={6} md={4}>
                                        <Card
                                            variant="outlined"
                                            sx={{
                                                p: 2,
                                                cursor: "pointer",
                                                background: isDark
                                                    ? "rgba(255,255,255,0.02)"
                                                    : "rgba(255,255,255,0.7)",
                                                borderColor: isDark
                                                    ? "rgba(255,255,255,0.06)"
                                                    : "rgba(0,0,0,0.06)",
                                                transition: "all 0.2s ease",
                                                "&:hover": {
                                                    borderColor: statusColors.text,
                                                    background: isDark
                                                        ? "rgba(255,255,255,0.04)"
                                                        : "rgba(255,255,255,0.9)",
                                                },
                                            }}
                                            onClick={() => handleTaskClick(Number(task.id))}
                                        >
                                            <Stack spacing={1.5}>
                                                <Stack
                                                    direction="row"
                                                    justifyContent="space-between"
                                                    alignItems="flex-start"
                                                >
                                                    <Typography
                                                        level="body-xs"
                                                        sx={{
                                                            fontWeight: 600,
                                                            color: isDark
                                                                ? "rgba(255,255,255,0.5)"
                                                                : "rgba(0,0,0,0.5)",
                                                        }}
                                                    >
                                                        #{task.id}
                                                    </Typography>
                                                    <Chip
                                                        size="sm"
                                                        variant="soft"
                                                        startDecorator={getStatusIcon(
                                                            task.status || ""
                                                        )}
                                                        sx={{
                                                            fontSize: "0.65rem",
                                                            backgroundColor: statusColors.bg,
                                                            color: statusColors.text,
                                                        }}
                                                    >
                                                        {task.status}
                                                    </Chip>
                                                </Stack>
                                                <Typography
                                                    level="title-sm"
                                                    sx={{
                                                        fontWeight: 600,
                                                        color: isDark
                                                            ? "rgba(255,255,255,0.9)"
                                                            : "rgba(0,0,0,0.85)",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {task.title || "Untitled Task"}
                                                </Typography>
                                                {task.priority && (
                                                    <Typography
                                                        level="body-xs"
                                                        sx={{
                                                            color: isDark
                                                                ? "rgba(255,255,255,0.4)"
                                                                : "rgba(0,0,0,0.45)",
                                                        }}
                                                    >
                                                        Priority: {task.priority}
                                                    </Typography>
                                                )}
                                            </Stack>
                                        </Card>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    </Box>
                )}

                {/* Empty State for No Tasks - Only when project selected but no tasks */}
                {usePM.currentProject && recentTasks.length === 0 && (
                    <Card
                        variant="soft"
                        sx={{
                            p: 4,
                            textAlign: "center",
                            background: isDark
                                ? "rgba(255,255,255,0.02)"
                                : "rgba(255,255,255,0.5)",
                            border: "2px dashed",
                            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                        }}
                    >
                        <Stack spacing={2} alignItems="center">
                            <Box
                                sx={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: "16px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: isDark
                                        ? "rgba(59,130,246,0.1)"
                                        : "rgba(59,130,246,0.08)",
                                }}
                            >
                                <AssignmentRoundedIcon
                                    sx={{
                                        fontSize: 32,
                                        color: isDark ? "#60a5fa" : "#3b82f6",
                                    }}
                                />
                            </Box>
                            <Box>
                                <Typography
                                    level="title-lg"
                                    sx={{
                                        fontWeight: 600,
                                        color: isDark
                                            ? "rgba(255,255,255,0.85)"
                                            : "rgba(0,0,0,0.8)",
                                        mb: 0.5,
                                    }}
                                >
                                    No active tasks in {usePM.currentProject.projectName}
                                </Typography>
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        color: isDark
                                            ? "rgba(255,255,255,0.45)"
                                            : "rgba(0,0,0,0.45)",
                                    }}
                                >
                                    Create your first task using the quick actions above
                                </Typography>
                            </Box>
                        </Stack>
                    </Card>
                )}

                {/* Tip Card */}
                <Card
                    variant="soft"
                    sx={{
                        p: 2.5,
                        background: isDark
                            ? "linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(147,51,234,0.08) 100%)"
                            : "linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(147,51,234,0.06) 100%)",
                        border: "1px solid",
                        borderColor: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.1)",
                    }}
                >
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Box
                            sx={{
                                width: 40,
                                height: 40,
                                borderRadius: "10px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: isDark
                                    ? "rgba(99,102,241,0.15)"
                                    : "rgba(99,102,241,0.1)",
                            }}
                        >
                            <TipsAndUpdatesRoundedIcon
                                sx={{
                                    fontSize: 22,
                                    color: isDark ? "#a5b4fc" : "#6366f1",
                                }}
                            />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography
                                level="title-sm"
                                sx={{
                                    fontWeight: 600,
                                    color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)",
                                    mb: 0.25,
                                }}
                            >
                                Pro Tip
                            </Typography>
                            <Typography
                                level="body-sm"
                                sx={{
                                    color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
                                }}
                            >
                                {randomTip}
                            </Typography>
                        </Box>
                    </Stack>
                </Card>
            </Stack>
        </Box>
    );
};
