import { useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import {
    Box,
    Button,
    Chip,
    Dropdown,
    FormControl,
    IconButton,
    Input,
    Menu,
    MenuButton,
    MenuItem,
    Snackbar,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";
import { useLocation } from "react-router-dom";

import { useAuth } from "../../../../../context/AuthContext";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../../hooks/common/useProjectManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../../types/admin";
import { TaskNoteProps } from "../../../../../types/notes";
import { TaskProps } from "../../../../../types/tasks";
import { deleteEmptyTask } from "../../../services/deleteEmptyTask";
import { ModalDeleteTask } from "../../modals/ModalDeleteTask";

type TaskTitleBlockProps = {
    myself: UserProps;
    taskContent: TaskProps;
    taskTitle: string;
    setTaskTitle: (value: string) => void;
    setTaskClosed?: (value: boolean) => void;
    titleError?: string;
    titleErrorOpen?: boolean;
    setTitleErrorOpen?: (value: boolean) => void;
    setTaskUpdated?: (value: boolean) => void;
    isPreviewMode: boolean;
    setTaskContent?: (value: TaskProps) => void;
    setTaskStatusUpdated?: (value: boolean) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    useTM: TaskManagementState;
    useNM: NoteManagementState;
    usePM: ProjectManagementState;
    // When true, the create-mode badge reads "Milestone" instead of
    // "New Task". Only meaningful when `isPreviewMode` is false.
    isMilestone?: boolean;
    isSubTask?: boolean;
};

export const TaskTitleBlock = (props: TaskTitleBlockProps) => {
    const {
        myself,
        taskContent,
        taskTitle,
        setTaskTitle,
        setTaskUpdated,
        titleError,
        titleErrorOpen,
        setTitleErrorOpen,
        isPreviewMode,
        setTaskContent,
        setTaskStatusUpdated,
        setTaskClosed,
        useCM,
        useUISM,
        useTM,
        useNM,
        usePM,
        isMilestone,
        isSubTask,
    } = props;

    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const location = useLocation();
    // True when the user is currently inside the Tasks service (any URL
    // under `/Home/tasks`). Mirrors the active-route detection used by the
    // sidebar so we don't depend on `openingService` for a check the URL
    // already encodes.
    const isOnTasksRoute = location.pathname.includes("/Home/tasks");
    const [openDeleteTask, setOpenDeleteTask] = useState<boolean>(false);
    const titleInputRef = useRef<HTMLInputElement | null>(null);

    const handleStatusChange = (newStatus: string, color: string) => {
        if (setTaskContent) {
            setTaskContent({
                ...taskContent,
                status: {
                    code: 0,
                    status: newStatus,
                    color: color,
                    textColor: "white",
                },
            });
        }
        if (setTaskUpdated) {
            setTaskUpdated(true);
        }
        if (setTaskStatusUpdated) {
            setTaskStatusUpdated(true);
        }
    };

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
            }}
        >
            {/* Top row: Chips and Actions */}
            <Stack
                direction="row"
                sx={{
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                {/* Left side: ID and Status chips (preview mode) or New Task badge (create mode) */}
                {isPreviewMode ? (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {/* Status Transition Buttons */}
                        {isPreviewMode &&
                            (taskContent.status.status === "Open" ||
                                taskContent.status.status === "Pending") && (
                                <Button
                                    size="sm"
                                    variant="soft"
                                    startDecorator={<PlayArrowRoundedIcon sx={{ fontSize: 16 }} />}
                                    onClick={() => handleStatusChange("WIP", "#ff8c00")}
                                    sx={{
                                        fontWeight: 600,
                                        fontSize: "12px",
                                        borderRadius: "8px",
                                        px: 1.5,
                                        py: 0.5,
                                        background:
                                            "linear-gradient(135deg, #ff9500 0%, #ff6b00 100%)",
                                        color: "white",
                                        boxShadow: "0 2px 8px rgba(255, 140, 0, 0.25)",
                                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                        "&:hover": {
                                            background:
                                                "linear-gradient(135deg, #ffa726 0%, #ff7043 100%)",
                                            boxShadow: "0 4px 12px rgba(255, 140, 0, 0.35)",
                                            transform: "translateY(-1px)",
                                        },
                                        "&:active": {
                                            transform: "translateY(0)",
                                            boxShadow: "0 2px 6px rgba(255, 140, 0, 0.2)",
                                        },
                                    }}
                                >
                                    Start Task
                                </Button>
                            )}

                        {isPreviewMode && taskContent.status.status === "WIP" && (
                            <Button
                                size="sm"
                                variant="soft"
                                startDecorator={<TaskAltRoundedIcon sx={{ fontSize: 16 }} />}
                                onClick={() => handleStatusChange("Closed", "#1dc200")}
                                sx={{
                                    fontWeight: 600,
                                    fontSize: "12px",
                                    borderRadius: "8px",
                                    px: 1.5,
                                    py: 0.5,
                                    background:
                                        "linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)",
                                    color: "white",
                                    boxShadow: "0 2px 8px rgba(76, 175, 80, 0.25)",
                                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                    "&:hover": {
                                        background:
                                            "linear-gradient(135deg, #66bb6a 0%, #388e3c 100%)",
                                        boxShadow: "0 4px 12px rgba(76, 175, 80, 0.35)",
                                        transform: "translateY(-1px)",
                                    },
                                    "&:active": {
                                        transform: "translateY(0)",
                                        boxShadow: "0 2px 6px rgba(76, 175, 80, 0.2)",
                                    },
                                }}
                            >
                                Complete Task
                            </Button>
                        )}
                        <Chip
                            key={`task-title-block-${taskContent.id}`}
                            size="md"
                            variant="soft"
                            sx={{
                                borderRadius: "8px",
                                fontWeight: 700,
                                fontSize: "0.75rem",
                                px: 1.5,
                                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                                border: "1px solid",
                                borderColor: isDark
                                    ? "rgba(255,255,255,0.08)"
                                    : "rgba(0,0,0,0.06)",
                                color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)",
                            }}
                        >
                            #{taskContent.id || "N/A"}
                        </Chip>
                        <Chip
                            key={`task-title-block-status-${taskContent.status.status}`}
                            size="md"
                            variant="soft"
                            sx={{
                                borderRadius: "8px",
                                fontWeight: 600,
                                fontSize: "0.75rem",
                                px: 1.5,
                                backgroundColor: taskContent.status.color
                                    ? alpha(taskContent.status.color, isDark ? 0.25 : 0.65)
                                    : "transparent",
                                color: taskContent.status.textColor || "#ffffff",
                                border: "1px solid",
                                borderColor: alpha(
                                    taskContent.status.color || "#666",
                                    isDark ? 0.3 : 0.25
                                ),
                            }}
                        >
                            {taskContent.status.status || "Open"}
                        </Chip>
                    </Box>
                ) : (
                    <Box
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 1,
                            px: 1.5,
                            py: 0.5,
                            borderRadius: "8px",
                            background: isDark
                                ? "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)"
                                : "linear-gradient(135deg, rgba(79,70,229,0.1) 0%, rgba(124,58,237,0.06) 100%)",
                            border: "1px solid",
                            borderColor: isDark ? "rgba(139,92,246,0.2)" : "rgba(124,58,237,0.15)",
                        }}
                    >
                        <Box
                            sx={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: isDark
                                    ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
                                    : "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                                animation: "pulse 2s infinite",
                                "@keyframes pulse": {
                                    "0%, 100%": { opacity: 1 },
                                    "50%": { opacity: 0.5 },
                                },
                            }}
                        />
                        <Typography
                            level="body-xs"
                            sx={{
                                fontWeight: 700,
                                fontSize: "0.7rem",
                                color: isDark ? "#a78bfa" : "#7c3aed",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                            }}
                        >
                            {isMilestone ? "Milestone" : isSubTask ? "Sub Task" : "New Task"}
                        </Typography>
                    </Box>
                )}

                {/* Right side: Action buttons */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: "auto" }}>
                    {isOnTasksRoute && taskContent.threadId !== null && (
                        <Tooltip size="sm" title="Check Thread" variant="outlined">
                            <IconButton
                                size="sm"
                                variant="plain"
                                sx={{
                                    borderRadius: "8px",
                                    color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
                                    "&:hover": {
                                        background: isDark
                                            ? "rgba(255,255,255,0.08)"
                                            : "rgba(0,0,0,0.06)",
                                        color: isDark
                                            ? "rgba(255,255,255,0.9)"
                                            : "rgba(0,0,0,0.8)",
                                    },
                                }}
                                onClick={() => {
                                    if (
                                        taskContent.chatType &&
                                        taskContent.chatId &&
                                        taskContent.threadId &&
                                        taskContent.threadId !== null
                                    ) {
                                        useCM.moveToSpecificChat(
                                            taskContent.chatType,
                                            taskContent.chatId,
                                            taskContent.threadId,
                                            false,
                                            true,
                                            useTM.setCurrentPreviewTaskId,
                                            usePM.setCurrentProject
                                        );
                                    }
                                }}
                            >
                                <QuestionAnswerRoundedIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Tooltip>
                    )}

                    {isOnTasksRoute && (
                        <Dropdown>
                            <MenuButton
                                size="sm"
                                slots={{ root: IconButton }}
                                slotProps={{
                                    root: {
                                        sx: {
                                            borderRadius: "8px",
                                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                            color: isDark
                                                ? "rgba(255,255,255,0.55)"
                                                : "rgba(0,0,0,0.45)",
                                            "&:hover": {
                                                background: isDark
                                                    ? "rgba(99,102,241,0.2)"
                                                    : "rgba(99,102,241,0.1)",
                                                color: isDark ? "#a5b4fc" : "#6366f1",
                                                transform: "scale(1.05)",
                                            },
                                        },
                                    },
                                }}
                            >
                                <MoreHorizRoundedIcon sx={{ fontSize: 18 }} />
                            </MenuButton>
                            <Menu
                                size="sm"
                                sx={{
                                    minWidth: 200,
                                    py: 0.75,
                                    borderRadius: "14px",
                                    background: isDark
                                        ? "linear-gradient(145deg, rgba(32,32,42,0.98) 0%, rgba(24,24,34,0.98) 100%)"
                                        : "linear-gradient(145deg, rgba(255,255,255,0.99) 0%, rgba(250,251,253,0.99) 100%)",
                                    backdropFilter: "blur(24px) saturate(180%)",
                                    boxShadow: isDark
                                        ? "0 12px 48px rgba(0,0,0,0.65), 0 4px 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)"
                                        : "0 12px 48px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)",
                                    border: "1px solid",
                                    borderColor: isDark
                                        ? "rgba(255,255,255,0.1)"
                                        : "rgba(0,0,0,0.08)",
                                }}
                            >
                                {/* Copy Task Link */}
                                <MenuItem
                                    sx={{
                                        mx: 0.75,
                                        my: 0.25,
                                        borderRadius: "10px",
                                        gap: 1.5,
                                        minHeight: 40,
                                        transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                                        color: isDark
                                            ? "rgba(255,255,255,0.9)"
                                            : "rgba(15,23,42,0.85)",
                                        "&:hover": {
                                            background: isDark
                                                ? "rgba(52,211,153,0.18)"
                                                : "rgba(5,150,105,0.12)",
                                            color: isDark ? "#34d399" : "#059669",
                                            transform: "translateX(3px)",
                                        },
                                    }}
                                    onClick={async () => {
                                        if (taskContent.project && taskContent.id) {
                                            const taskUrl = `${window.location.origin}/Home/tasks/project/${taskContent.project.projectId}/task/${taskContent.id}`;
                                            try {
                                                await navigator.clipboard.writeText(taskUrl);
                                            } catch (err) {
                                                console.error("Failed to copy link:", err);
                                            }
                                        }
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: 30,
                                            height: 30,
                                            borderRadius: "8px",
                                        }}
                                    >
                                        <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />
                                    </Box>
                                    <Typography
                                        level="body-sm"
                                        sx={{
                                            fontWeight: 500,
                                            fontSize: "0.875rem",
                                            color: "inherit",
                                        }}
                                    >
                                        Copy task link
                                    </Typography>
                                </MenuItem>

                                {/* Open Thread - only show if task was created from a thread */}
                                {taskContent.threadId !== null &&
                                taskContent.chatType !== null &&
                                taskContent.chatId !== null ? (
                                    <MenuItem
                                        sx={{
                                            mx: 0.75,
                                            my: 0.25,
                                            borderRadius: "10px",
                                            gap: 1.5,
                                            minHeight: 40,
                                            transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                                            color: isDark
                                                ? "rgba(255,255,255,0.9)"
                                                : "rgba(15,23,42,0.85)",
                                            "&:hover": {
                                                background: isDark
                                                    ? "rgba(96,165,250,0.18)"
                                                    : "rgba(59,130,246,0.12)",
                                                color: isDark ? "#60a5fa" : "#2563eb",
                                                transform: "translateX(3px)",
                                            },
                                        }}
                                        onClick={() => {
                                            useCM.moveToSpecificChat(
                                                taskContent.chatType!,
                                                taskContent.chatId!,
                                                taskContent.threadId!,
                                                false,
                                                true,
                                                useTM.setCurrentPreviewTaskId,
                                                usePM.setCurrentProject
                                            );
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                width: 30,
                                                height: 30,
                                                borderRadius: "8px",
                                            }}
                                        >
                                            <QuestionAnswerRoundedIcon sx={{ fontSize: 18 }} />
                                        </Box>
                                        <Typography
                                            level="body-sm"
                                            sx={{
                                                fontWeight: 500,
                                                fontSize: "0.875rem",
                                                color: "inherit",
                                            }}
                                        >
                                            Open Thread
                                        </Typography>
                                    </MenuItem>
                                ) : null}

                                {/* New Task */}
                                <MenuItem
                                    sx={{
                                        mx: 0.75,
                                        my: 0.25,
                                        borderRadius: "10px",
                                        gap: 1.5,
                                        minHeight: 40,
                                        transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                                        color: isDark
                                            ? "rgba(255,255,255,0.9)"
                                            : "rgba(15,23,42,0.85)",
                                        "&:hover": {
                                            background: isDark
                                                ? "rgba(129,140,248,0.18)"
                                                : "rgba(79,70,229,0.12)",
                                            color: isDark ? "#818cf8" : "#4f46e5",
                                            transform: "translateX(3px)",
                                        },
                                    }}
                                    onClick={() => {
                                        useTM.handleCreateTask();
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: 30,
                                            height: 30,
                                            borderRadius: "8px",
                                        }}
                                    >
                                        <AssignmentRoundedIcon sx={{ fontSize: 18 }} />
                                    </Box>
                                    <Typography
                                        level="body-sm"
                                        sx={{
                                            fontWeight: 500,
                                            fontSize: "0.875rem",
                                            color: "inherit",
                                        }}
                                    >
                                        New Task
                                    </Typography>
                                </MenuItem>

                                {/* New Sub Task */}
                                <MenuItem
                                    sx={{
                                        mx: 0.75,
                                        my: 0.25,
                                        borderRadius: "10px",
                                        gap: 1.5,
                                        minHeight: 40,
                                        transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                                        color: isDark
                                            ? "rgba(255,255,255,0.9)"
                                            : "rgba(15,23,42,0.85)",
                                        "&:hover": {
                                            background: isDark
                                                ? "rgba(34,211,238,0.18)"
                                                : "rgba(8,145,178,0.12)",
                                            color: isDark ? "#22d3ee" : "#0891b2",
                                            transform: "translateX(3px)",
                                        },
                                    }}
                                    onClick={() => {
                                        if (
                                            taskContent.id !== undefined &&
                                            taskContent.rootTaskId != null
                                        ) {
                                            if (useTM.setIsCreatingTask) {
                                                useTM.setIsCreatingTask({
                                                    flag: true,
                                                    parentTaskId: taskContent.id,
                                                    rootTaskId: taskContent.rootTaskId,
                                                    creationKind: "task",
                                                    milestoneId:
                                                        (taskContent as any).milestoneId ?? null,
                                                });
                                            }
                                            useTM.setIsTaskHomeVisible(false);
                                        } else {
                                            console.error("Task ID not defined error.");
                                        }
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: 30,
                                            height: 30,
                                            borderRadius: "8px",
                                        }}
                                    >
                                        <AssignmentRoundedIcon sx={{ fontSize: 18 }} />
                                    </Box>
                                    <Typography
                                        level="body-sm"
                                        sx={{
                                            fontWeight: 500,
                                            fontSize: "0.875rem",
                                            color: "inherit",
                                        }}
                                    >
                                        New Sub Task
                                    </Typography>
                                </MenuItem>

                                {/* Open Note */}
                                <MenuItem
                                    key="open-note"
                                    sx={{
                                        mx: 0.75,
                                        my: 0.25,
                                        borderRadius: "10px",
                                        gap: 1.5,
                                        minHeight: 40,
                                        transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                                        color: isDark
                                            ? "rgba(255,255,255,0.9)"
                                            : "rgba(15,23,42,0.85)",
                                        "&:hover": {
                                            background: isDark
                                                ? "rgba(251,191,36,0.18)"
                                                : "rgba(245,158,11,0.12)",
                                            color: isDark ? "#fbbf24" : "#f59e0b",
                                            transform: "translateX(3px)",
                                        },
                                    }}
                                    onClick={() => {
                                        if (useNM.setIsTaskNoteVisible && taskContent.project) {
                                            useTM.setIsTaskHomeVisible(false);
                                            useNM.setIsTaskNoteVisible(true);
                                            if (useNM.taskNoteMeta.length > 0) {
                                                useNM.setCurrentTaskNote(
                                                    useNM.taskNoteMeta[0] as TaskNoteProps
                                                );
                                            } else {
                                                if (taskContent.project && taskContent.id) {
                                                    useNM.handleCreateNewTaskNote(
                                                        null,
                                                        taskContent.project.projectId,
                                                        taskContent.id,
                                                        taskContent.title
                                                    );
                                                }
                                            }
                                        }
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: 30,
                                            height: 30,
                                            borderRadius: "8px",
                                        }}
                                    >
                                        <NoteAltRoundedIcon sx={{ fontSize: 18 }} />
                                    </Box>
                                    <Typography
                                        level="body-sm"
                                        sx={{
                                            fontWeight: 500,
                                            fontSize: "0.875rem",
                                            color: "inherit",
                                        }}
                                    >
                                        Open Note
                                    </Typography>
                                </MenuItem>

                                {/* New Tag */}
                                <MenuItem
                                    sx={{
                                        mx: 0.75,
                                        my: 0.25,
                                        borderRadius: "10px",
                                        gap: 1.5,
                                        minHeight: 40,
                                        transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                                        color: isDark
                                            ? "rgba(255,255,255,0.9)"
                                            : "rgba(15,23,42,0.85)",
                                        "&:hover": {
                                            background: isDark
                                                ? "rgba(192,132,252,0.18)"
                                                : "rgba(147,51,234,0.12)",
                                            color: isDark ? "#c084fc" : "#9333ea",
                                            transform: "translateX(3px)",
                                        },
                                    }}
                                    onClick={() => {
                                        useTM.setOpenCreateTag(true);
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: 30,
                                            height: 30,
                                            borderRadius: "8px",
                                        }}
                                    >
                                        <LocalOfferRoundedIcon sx={{ fontSize: 18 }} />
                                    </Box>
                                    <Typography
                                        level="body-sm"
                                        sx={{
                                            fontWeight: 500,
                                            fontSize: "0.875rem",
                                            color: "inherit",
                                        }}
                                    >
                                        New Tag
                                    </Typography>
                                </MenuItem>

                                {/* New Project */}
                                <MenuItem
                                    sx={{
                                        mx: 0.75,
                                        my: 0.25,
                                        borderRadius: "10px",
                                        gap: 1.5,
                                        minHeight: 40,
                                        transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                                        color: isDark
                                            ? "rgba(255,255,255,0.9)"
                                            : "rgba(15,23,42,0.85)",
                                        "&:hover": {
                                            background: isDark
                                                ? "rgba(45,212,191,0.18)"
                                                : "rgba(13,148,136,0.12)",
                                            color: isDark ? "#2dd4bf" : "#0d9488",
                                            transform: "translateX(3px)",
                                        },
                                    }}
                                    onClick={() => {
                                        usePM.setOpenCreateProject(true);
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: 30,
                                            height: 30,
                                            borderRadius: "8px",
                                        }}
                                    >
                                        <AddIcon sx={{ fontSize: 18 }} />
                                    </Box>
                                    <Typography
                                        level="body-sm"
                                        sx={{
                                            fontWeight: 500,
                                            fontSize: "0.875rem",
                                            color: "inherit",
                                        }}
                                    >
                                        New Project
                                    </Typography>
                                </MenuItem>

                                {taskContent.status.status !== "Closed" && (
                                    <Box
                                        sx={{
                                            height: "1px",
                                            mx: 1.5,
                                            my: 0.5,
                                            background: isDark
                                                ? "rgba(255,255,255,0.08)"
                                                : "rgba(0,0,0,0.06)",
                                        }}
                                    />
                                )}
                                {taskContent.status.status !== "Closed" && (
                                    <MenuItem
                                        sx={{
                                            mx: 0.75,
                                            my: 0.25,
                                            borderRadius: "10px",
                                            gap: 1.5,
                                            minHeight: 40,
                                            transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                                            color: isDark ? "#f87171" : "#dc2626",
                                            "&:hover": {
                                                background: isDark
                                                    ? "rgba(248,113,113,0.18)"
                                                    : "rgba(220,38,38,0.12)",
                                                color: isDark ? "#fca5a5" : "#ef4444",
                                                transform: "translateX(3px)",
                                            },
                                        }}
                                        onClick={() => {
                                            setOpenDeleteTask(true);
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                width: 30,
                                                height: 30,
                                                borderRadius: "8px",
                                            }}
                                        >
                                            <DeleteRoundedIcon sx={{ fontSize: 18 }} />
                                        </Box>
                                        <Typography
                                            level="body-sm"
                                            sx={{
                                                fontWeight: 500,
                                                fontSize: "0.875rem",
                                                color: "inherit",
                                            }}
                                        >
                                            Delete Task
                                        </Typography>
                                    </MenuItem>
                                )}
                            </Menu>
                        </Dropdown>
                    )}

                    <Tooltip size="sm" title="Close" variant="outlined">
                        <IconButton
                            size="sm"
                            variant="plain"
                            sx={{
                                borderRadius: "8px",
                                color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
                                "&:hover": {
                                    background: isDark
                                        ? "rgba(239,68,68,0.15)"
                                        : "rgba(239,68,68,0.1)",
                                    color: "#ef4444",
                                },
                            }}
                            onClick={() => {
                                if (isPreviewMode === false && useTM.setIsCreatingTask) {
                                    useTM.setIsCreatingTask({
                                        flag: false,
                                        parentTaskId: null,
                                        rootTaskId: useTM.currentPreviewTask?.rootTaskId || null,
                                        creationKind: "task",
                                        milestoneId: null,
                                    });
                                }
                                if (isPreviewMode === true && setTaskClosed) {
                                    setTaskClosed(true);
                                }

                                useCM.setIsMainChatVisible(true);

                                if (useTM.setIsTaskPreviewVisible) {
                                    if (isPreviewMode === true) {
                                        useTM.setIsTaskPreviewVisible(false);
                                        useTM.setCurrentPreviewTaskId(-1);
                                    }
                                    if (
                                        useTM.isCreatingTask.flag === false &&
                                        useNM.isTaskNoteVisible === false
                                    ) {
                                        if (useTM.isTaskHomeVisible === false) {
                                            if (useTM.isSprintBoardVisible === false) {
                                                useTM.setIsTaskHomeVisible(true);
                                            } else {
                                                useTM.setIsSprintBoardVisible(true);
                                            }
                                        }
                                    }
                                }

                                useTM.setIsCreatingTask({
                                    flag: false,
                                    parentTaskId: null,
                                    rootTaskId: null,
                                    creationKind: "task",
                                    milestoneId: null,
                                });

                                if (useTM.isTaskPreviewVisible === false) {
                                    if (useTM.isTaskHomeVisible === false) {
                                        if (useTM.isSprintBoardVisible === false) {
                                            if (useTM.isDashboardVisible === false) {
                                                useTM.setIsTaskHomeVisible(true);
                                            } else {
                                                useTM.setIsDashboardVisible(true);
                                            }
                                        } else {
                                            useTM.setIsSprintBoardVisible(true);
                                        }
                                    }
                                }

                                if (useNM.setIsTaskVisibleInNote) {
                                    useNM.setIsTaskVisibleInNote(false);
                                }

                                if (
                                    useTM.isCreatingTask.flag === true &&
                                    taskContent.id !== undefined
                                ) {
                                    deleteEmptyTask({
                                        myself: myself,
                                        taskId: taskContent.id,
                                        accessToken: accessToken,
                                        setInitialEmptyTaskId: useTM.setInitialEmptyTaskId,
                                    });
                                }
                            }}
                        >
                            <CancelRoundedIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Stack>

            {/* Title Input */}
            <FormControl sx={{ width: "100%" }} required>
                <Input
                    key={"taskTitle"}
                    placeholder="Enter task title..."
                    value={taskTitle}
                    variant="plain"
                    slotProps={{
                        input: {
                            ref: titleInputRef,
                            onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    titleInputRef.current?.blur();
                                }
                            },
                        },
                    }}
                    sx={{
                        width: "100%",
                        fontSize: "1.35rem",
                        fontWeight: 700,
                        backgroundColor: "transparent",
                        p: 0,
                        "--Input-focusedInset": "none",
                        "--Input-focusedThickness": "0",
                        "&::before": { display: "none" },
                        color: isDark ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.9)",
                        "&:hover": {
                            backgroundColor: isDark
                                ? "rgba(255,255,255,0.02)"
                                : "rgba(0,0,0,0.02)",
                        },
                        "&:focus-within": {
                            backgroundColor: isDark
                                ? "rgba(255,255,255,0.03)"
                                : "rgba(0,0,0,0.02)",
                        },
                        "& input::placeholder": {
                            color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
                            fontWeight: 500,
                        },
                    }}
                    onBlur={() => {
                        if (setTaskUpdated) {
                            setTaskUpdated(true);
                        }
                    }}
                    onChange={(e) => {
                        setTaskTitle(e.target.value);
                    }}
                />
            </FormControl>

            <ModalDeleteTask
                currentTaskContent={taskContent}
                openDeleteTask={openDeleteTask}
                setCurrentTaskContent={setTaskContent}
                setOpenDeleteTask={setOpenDeleteTask}
                setTaskStatusUpdated={setTaskStatusUpdated}
                setTaskUpdated={setTaskUpdated}
            />

            {isPreviewMode === false && titleError && titleErrorOpen !== undefined && (
                <Snackbar
                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                    autoHideDuration={5000}
                    color="danger"
                    open={titleErrorOpen}
                    variant="soft"
                    onClose={(event, reason) => {
                        if (reason === "clickaway") {
                            return;
                        }
                        if (setTitleErrorOpen) {
                            setTitleErrorOpen(false);
                        }
                    }}
                >
                    {titleError}
                </Snackbar>
            )}
        </Box>
    );
};
