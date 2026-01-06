import { useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import MoreVert from "@mui/icons-material/MoreVert";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
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
    const [openDeleteTask, setOpenDeleteTask] = useState<boolean>(false);
    const titleInputRef = useRef<HTMLInputElement | null>(null);
    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
            }}
        >
            <Stack direction="row" sx={{ width: "100%", alignItems: "center" }}>
                {/* Wrap the title and task status in the same Box */}
                <Box
                    sx={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 0.3,
                        flexGrow: 1,
                    }}
                >
                    {isPreviewMode && (
                        <>
                            <Chip
                                key={`task-title-block-${taskContent.id}`}
                                color="neutral"
                                size="lg"
                                variant="soft"
                                sx={{
                                    borderRadius: "5px",
                                    fontWeight: "bold",
                                }}
                            >
                                ID: {taskContent.id || "N/A"}
                            </Chip>
                            <Chip
                                key={`task-title-block-status-${taskContent.status.status}`}
                                size="lg"
                                variant="soft"
                                sx={{
                                    backgroundColor: taskContent.status.color
                                        ? alpha(
                                              taskContent.status.color,
                                              mode === "dark" ? 0.5 : 0.75
                                          )
                                        : "transparent",
                                    color: taskContent.status.textColor,
                                    fontWeight: "bold",
                                    borderRadius: "5px",
                                }}
                            >
                                {taskContent.status.status || "Open"}
                            </Chip>
                        </>
                    )}
                    <FormControl sx={{ width: "100%" }} required>
                        <Input
                            key={"taskTitle"}
                            placeholder="Task Title"
                            value={taskTitle}
                            variant="soft"
                            slotProps={{
                                input: {
                                    ref: titleInputRef,
                                    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault(); // stop form submission if inside <form>
                                            titleInputRef.current?.blur();
                                        }
                                    },
                                },
                            }}
                            sx={{
                                width: "100%",
                                fontSize: "20px",
                                fontWeight: "bold",
                                backgroundColor: "transparent",
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
                </Box>

                {useUISM.openingService === 2 && taskContent.threadId !== null && (
                    <Tooltip size="sm" title="Check Thread" variant="outlined">
                        <IconButton
                            color="neutral"
                            size="sm"
                            variant="plain"
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
                                        false, // openTaskNoteInChat
                                        true, // openThreadTaskPreview
                                        useUISM.setOpeningService,
                                        useTM.setCurrentPreviewTaskId,
                                        usePM.setCurrentProject
                                    );
                                }
                            }}
                        >
                            <QuestionAnswerIcon />
                        </IconButton>
                    </Tooltip>
                )}

                <Dropdown>
                    <MenuButton
                        size="sm"
                        slotProps={{ root: { color: "neutral" } }}
                        slots={{ root: IconButton }}
                    >
                        <MoreVert />
                    </MenuButton>
                    <Menu size="sm">
                        <MenuItem
                            onClick={() => {
                                useTM.handleCreateTask();
                            }}
                        >
                            <AssignmentRoundedIcon />
                            New Task
                        </MenuItem>

                        <MenuItem
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

                                    // Close task-home when creating a sub task.
                                    useTM.setIsTaskHomeVisible(false);
                                } else {
                                    console.error("Task ID nod defined error.");
                                }
                            }}
                        >
                            <AssignmentRoundedIcon />
                            New Sub Task
                        </MenuItem>

                        <MenuItem
                            key="open-note"
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
                                } else {
                                    console.error(
                                        "Can't parent note ID to create a child note. Project ID is not defined."
                                    );
                                }
                            }}
                        >
                            <NoteAltIcon />
                            Open Note
                        </MenuItem>

                        <MenuItem
                            onClick={() => {
                                useTM.setOpenCreateTag(true);
                            }}
                        >
                            <LocalOfferIcon />
                            New Tag
                        </MenuItem>

                        <MenuItem
                            onClick={() => {
                                usePM.setOpenCreateProject(true);
                            }}
                        >
                            <AddIcon />
                            New Project
                        </MenuItem>

                        {taskContent.status.status !== "Closed" && (
                            <MenuItem
                                sx={{
                                    color: "red",
                                    fontSize: "14px",
                                }}
                                onClick={() => {
                                    setOpenDeleteTask(true);
                                }}
                            >
                                <DeleteIcon sx={{ color: "red" }} />
                                <Typography color="danger" level="title-sm">
                                    Delete Task
                                </Typography>
                            </MenuItem>
                        )}
                    </Menu>
                </Dropdown>

                <Tooltip size="sm" title="Close" variant="outlined">
                    <IconButton
                        color="neutral"
                        size="sm"
                        variant="plain"
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
                                // Open task-home when both task-preview and task-create-form are closed.
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
                            // Open task-home when both task-preview and task-create-form are closed.
                            if (useTM.isTaskPreviewVisible === false) {
                                if (useTM.isTaskHomeVisible === false) {
                                    if (useTM.isSprintBoardVisible === false) {
                                        useTM.setIsTaskHomeVisible(true);
                                    } else {
                                        useTM.setIsSprintBoardVisible(true);
                                    }
                                }
                            }

                            // Close the task preview when the task is visible in the task note.
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
                        <CancelIcon />
                    </IconButton>
                </Tooltip>

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
            </Stack>
        </Box>
    );
};
