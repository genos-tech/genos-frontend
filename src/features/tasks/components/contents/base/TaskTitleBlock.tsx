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
    setOpenCreateProject: (value: boolean) => void;
    setOpenCreateTag: (value: boolean) => void;
    titleError?: string;
    titleErrorOpen?: boolean;
    setTitleErrorOpen?: (value: boolean) => void;
    setTaskUpdated?: (value: boolean) => void;
    isPreviewMode: boolean;
    setIsMainChatVisible?: (value: boolean) => void;
    setTaskContent?: (value: TaskProps) => void;
    setTaskStatusUpdated?: (value: boolean) => void;
    isTaskNoteVisible?: boolean;
    setIsTaskVisibleInNote?: (value: boolean) => void;
    moveToSpecificChat: (
        chatType: number,
        chatId: number,
        threadId: number,
        openTaskNoteInChat: boolean,
        openThreadTaskPreview: boolean,
        setOpeningService: (service: number) => void,
        setCurrentPreviewTaskId: (id: number) => void,
        setCurrentProject: (project: any) => void
    ) => void;
    openingService: number;
    setOpeningService: (service: number) => void;
    setCurrentProject: (project: any) => void;
    TM: TaskManagementState;
    setIsTaskNoteVisible?: (value: boolean) => void;
    taskNotes: TaskNoteProps[];
    setCurrentTaskNote: (value: TaskNoteProps) => void;
    handleCreateNewTaskNote: (
        parentNoteId: number | null,
        projectId: number,
        taskId: number,
        title?: string
    ) => Promise<void>;
};
export const TaskTitleBlock = (props: TaskTitleBlockProps) => {
    const {
        myself,
        taskContent,
        taskTitle,
        setTaskTitle,
        setOpenCreateProject,
        setOpenCreateTag,
        setTaskUpdated,
        titleError,
        titleErrorOpen,
        setTitleErrorOpen,
        isPreviewMode,
        setIsMainChatVisible,
        setTaskContent,
        setTaskStatusUpdated,
        isTaskNoteVisible,
        setIsTaskVisibleInNote,
        setTaskClosed,
        moveToSpecificChat,
        openingService,
        setOpeningService,
        setCurrentProject,
        TM,
        setIsTaskNoteVisible,
        taskNotes,
        setCurrentTaskNote,
        handleCreateNewTaskNote,
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

                {openingService === 2 && taskContent.threadId !== null && (
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
                                    moveToSpecificChat(
                                        taskContent.chatType,
                                        taskContent.chatId,
                                        taskContent.threadId,
                                        false, // openTaskNoteInChat
                                        true, // openThreadTaskPreview
                                        setOpeningService,
                                        TM.setCurrentPreviewTaskId,
                                        setCurrentProject
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
                                TM.handleCreateTask();
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
                                    if (TM.setIsCreatingTask) {
                                        TM.setIsCreatingTask({
                                            flag: true,
                                            parentTaskId: taskContent.id,
                                            rootTaskId: taskContent.rootTaskId,
                                        });
                                    }

                                    // Close task-home when creating a sub task.
                                    TM.setIsTaskHomeVisible(false);
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
                                if (setIsTaskNoteVisible && taskContent.project) {
                                    TM.setIsTaskHomeVisible(false);
                                    setIsTaskNoteVisible(true);
                                    if (taskNotes.length > 0) {
                                        setCurrentTaskNote(taskNotes[0]);
                                    } else {
                                        if (taskContent.project && taskContent.id) {
                                            handleCreateNewTaskNote(
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
                                setOpenCreateTag(true);
                            }}
                        >
                            <LocalOfferIcon />
                            New Tag
                        </MenuItem>

                        <MenuItem
                            onClick={() => {
                                setOpenCreateProject(true);
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
                            if (isPreviewMode === false && TM.setIsCreatingTask) {
                                TM.setIsCreatingTask({
                                    flag: false,
                                    parentTaskId: null,
                                    rootTaskId: TM.currentPreviewTask?.rootTaskId || null,
                                });
                            }
                            if (isPreviewMode === true && setTaskClosed) {
                                setTaskClosed(true);
                            }

                            if (setIsMainChatVisible) {
                                setIsMainChatVisible(true);
                            }

                            if (TM.setIsTaskPreviewVisible) {
                                if (isPreviewMode === true) {
                                    TM.setIsTaskPreviewVisible(false);
                                    TM.setCurrentPreviewTaskId(-1);
                                }
                                // Open task-home when both task-preview and task-create-form are closed.
                                if (
                                    TM.isCreatingTask.flag === false &&
                                    isTaskNoteVisible === false
                                ) {
                                    TM.setIsTaskHomeVisible(true);
                                }
                            }

                            TM.setIsCreatingTask({
                                flag: false,
                                parentTaskId: null,
                                rootTaskId: null,
                            });
                            // Open task-home when both task-preview and task-create-form are closed.
                            if (TM.isTaskPreviewVisible === false) {
                                TM.setIsTaskHomeVisible(true);
                            }

                            // Close the task preview when the task is visible in the task note.
                            if (setIsTaskVisibleInNote) {
                                setIsTaskVisibleInNote(false);
                            }

                            if (TM.isCreatingTask.flag === true && taskContent.id !== undefined) {
                                deleteEmptyTask({
                                    myself: myself,
                                    taskId: taskContent.id,
                                    accessToken: accessToken,
                                    setInitialEmptyTaskId: TM.setInitialEmptyTaskId,
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
