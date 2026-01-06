import { useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import {
    Box,
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
    } = props;

    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const [openDeleteTask, setOpenDeleteTask] = useState<boolean>(false);
    const titleInputRef = useRef<HTMLInputElement | null>(null);

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
                {/* Left side: ID and Status chips */}
                {isPreviewMode && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
                                    ? alpha(taskContent.status.color, isDark ? 0.25 : 0.15)
                                    : "transparent",
                                color: isDark
                                    ? alpha(taskContent.status.color || "#fff", 0.9)
                                    : taskContent.status.color || "#000",
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
                )}

                {/* Right side: Action buttons */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: "auto" }}>
                    {useUISM.openingService === 2 && taskContent.threadId !== null && (
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
                                            useUISM.setOpeningService,
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

                    <Dropdown>
                        <MenuButton
                            size="sm"
                            slots={{ root: IconButton }}
                            slotProps={{
                                root: {
                                    sx: {
                                        borderRadius: "8px",
                                        color: isDark
                                            ? "rgba(255,255,255,0.6)"
                                            : "rgba(0,0,0,0.5)",
                                        "&:hover": {
                                            background: isDark
                                                ? "rgba(255,255,255,0.08)"
                                                : "rgba(0,0,0,0.06)",
                                            color: isDark
                                                ? "rgba(255,255,255,0.9)"
                                                : "rgba(0,0,0,0.8)",
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
                                borderRadius: "12px",
                                boxShadow: isDark
                                    ? "0 8px 32px rgba(0,0,0,0.5)"
                                    : "0 8px 32px rgba(0,0,0,0.12)",
                                border: "1px solid",
                                borderColor: isDark
                                    ? "rgba(255,255,255,0.08)"
                                    : "rgba(0,0,0,0.08)",
                                p: 0.5,
                            }}
                        >
                            <MenuItem
                                sx={{ borderRadius: "8px", gap: 1.5 }}
                                onClick={() => {
                                    useTM.handleCreateTask();
                                }}
                            >
                                <AssignmentRoundedIcon sx={{ fontSize: 18 }} />
                                New Task
                            </MenuItem>

                            <MenuItem
                                sx={{ borderRadius: "8px", gap: 1.5 }}
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
                                            });
                                        }
                                        useTM.setIsTaskHomeVisible(false);
                                    } else {
                                        console.error("Task ID not defined error.");
                                    }
                                }}
                            >
                                <AssignmentRoundedIcon sx={{ fontSize: 18 }} />
                                New Sub Task
                            </MenuItem>

                            <MenuItem
                                key="open-note"
                                sx={{ borderRadius: "8px", gap: 1.5 }}
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
                                <NoteAltRoundedIcon sx={{ fontSize: 18 }} />
                                Open Note
                            </MenuItem>

                            <MenuItem
                                sx={{ borderRadius: "8px", gap: 1.5 }}
                                onClick={() => {
                                    useTM.setOpenCreateTag(true);
                                }}
                            >
                                <LocalOfferRoundedIcon sx={{ fontSize: 18 }} />
                                New Tag
                            </MenuItem>

                            <MenuItem
                                sx={{ borderRadius: "8px", gap: 1.5 }}
                                onClick={() => {
                                    usePM.setOpenCreateProject(true);
                                }}
                            >
                                <AddIcon sx={{ fontSize: 18 }} />
                                New Project
                            </MenuItem>

                            {taskContent.status.status !== "Closed" && (
                                <>
                                    <Box
                                        sx={{
                                            mx: 1,
                                            my: 0.5,
                                            borderTop: "1px solid",
                                            borderColor: isDark
                                                ? "rgba(255,255,255,0.08)"
                                                : "rgba(0,0,0,0.08)",
                                        }}
                                    />
                                    <MenuItem
                                        sx={{
                                            borderRadius: "8px",
                                            gap: 1.5,
                                            color: "#ef4444",
                                            "&:hover": {
                                                background: "rgba(239,68,68,0.1)",
                                            },
                                        }}
                                        onClick={() => {
                                            setOpenDeleteTask(true);
                                        }}
                                    >
                                        <DeleteRoundedIcon sx={{ fontSize: 18 }} />
                                        <Typography level="title-sm" sx={{ color: "#ef4444" }}>
                                            Delete Task
                                        </Typography>
                                    </MenuItem>
                                </>
                            )}
                        </Menu>
                    </Dropdown>

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
                                });

                                if (useTM.isTaskPreviewVisible === false) {
                                    if (useTM.isTaskHomeVisible === false) {
                                        if (useTM.isSprintBoardVisible === false) {
                                            useTM.setIsTaskHomeVisible(true);
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
