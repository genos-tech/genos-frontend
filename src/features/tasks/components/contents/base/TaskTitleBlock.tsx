import { useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVert from "@mui/icons-material/MoreVert";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
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
    taskContents: TaskProps;
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
    setIsThreadVisible?: (value: boolean) => void;
    setIsTaskHomeVisible?: (value: boolean) => void;
    setCurrentTaskContent?: (value: TaskProps) => void;
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
        taskContents,
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
        setIsThreadVisible,
        setIsTaskHomeVisible,
        setCurrentTaskContent,
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
                                key={`task-title-block-${taskContents.id}`}
                                color="neutral"
                                size="lg"
                                variant="soft"
                                sx={{
                                    borderRadius: "5px",
                                    fontWeight: "bold",
                                }}
                            >
                                ID: {taskContents.id || "N/A"}
                            </Chip>
                            <Chip
                                key={`task-title-block-status-${taskContents.status.status}`}
                                size="lg"
                                variant="soft"
                                sx={{
                                    backgroundColor: taskContents.status.color
                                        ? alpha(
                                              taskContents.status.color,
                                              mode === "dark" ? 0.5 : 0.75
                                          )
                                        : "transparent",
                                    color: taskContents.status.textColor,
                                    fontWeight: "bold",
                                    borderRadius: "5px",
                                }}
                            >
                                {taskContents.status.status || "Open"}
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

                {/* If the task is visible in the task note, do not show the expand button. */}
                {isPreviewMode === true && setIsTaskVisibleInNote === undefined && (
                    <Tooltip size="sm" title="Expand">
                        <IconButton
                            color="neutral"
                            size="sm"
                            variant="plain"
                            onClick={() => {
                                setIsTaskHomeVisible && setIsTaskHomeVisible(false);
                                setIsMainChatVisible && setIsMainChatVisible(false);
                                setIsThreadVisible && setIsThreadVisible(false);
                            }}
                        >
                            <OpenInNewIcon />
                        </IconButton>
                    </Tooltip>
                )}

                {openingService === 2 && taskContents.threadId !== null && (
                    <Tooltip size="sm" title="Check Thread">
                        <IconButton
                            color="neutral"
                            size="sm"
                            variant="plain"
                            onClick={() => {
                                if (
                                    taskContents.chatType &&
                                    taskContents.chatId &&
                                    taskContents.threadId &&
                                    taskContents.threadId !== null
                                ) {
                                    moveToSpecificChat(
                                        taskContents.chatType,
                                        taskContents.chatId,
                                        taskContents.threadId,
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
                    <Tooltip size="sm" title="More Options" placement="left">
                        <MenuButton
                            size="sm"
                            slotProps={{ root: { color: "neutral" } }}
                            slots={{ root: IconButton }}
                        >
                            <MoreVert />
                        </MenuButton>
                    </Tooltip>
                    <Menu size="sm">
                        <MenuItem
                            key="open-note"
                            onClick={() => {
                                if (
                                    setIsTaskHomeVisible &&
                                    setIsTaskNoteVisible &&
                                    taskContents.project
                                ) {
                                    setIsTaskHomeVisible(false);
                                    setIsTaskNoteVisible(true);
                                    if (taskNotes.length > 0) {
                                        setCurrentTaskNote(taskNotes[0]);
                                    } else {
                                        if (taskContents.project && taskContents.id) {
                                            handleCreateNewTaskNote(
                                                null,
                                                taskContents.project.projectId,
                                                taskContents.id,
                                                taskContents.title
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
                            <AddIcon />
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
                        {taskContents.status.status !== "Closed" && (
                            <MenuItem
                                sx={{
                                    color: "red",
                                    fontWeight: "bold",
                                }}
                                onClick={() => {
                                    setOpenDeleteTask(true);
                                }}
                            >
                                <DeleteIcon sx={{ color: "red" }} />
                                Delete Task
                            </MenuItem>
                        )}
                    </Menu>
                </Dropdown>

                <Tooltip size="sm" title="Close">
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

                            // setIsThreadVisible(); // Not update, keep as it is !!!
                            if (TM.setIsTaskPreviewVisible) {
                                if (isPreviewMode === true) {
                                    TM.setIsTaskPreviewVisible(false);
                                }
                                // Open task-home when both task-preview and task-create-form are closed.
                                if (
                                    TM.isCreatingTask.flag === false &&
                                    isTaskNoteVisible === false
                                ) {
                                    if (setIsTaskHomeVisible) {
                                        setIsTaskHomeVisible(true);
                                    }
                                }
                            }

                            TM.setIsCreatingTask({
                                flag: false,
                                parentTaskId: null,
                                rootTaskId: null,
                            });
                            // Open task-home when both task-preview and task-create-form are closed.
                            if (TM.isTaskPreviewVisible === false) {
                                if (setIsTaskHomeVisible) {
                                    setIsTaskHomeVisible(true);
                                }
                            }

                            // Close the task preview when the task is visible in the task note.
                            if (setIsTaskVisibleInNote) {
                                setIsTaskVisibleInNote(false);
                            }

                            if (TM.isCreatingTask.flag === true && taskContents.id !== undefined) {
                                deleteEmptyTask({
                                    myself: myself,
                                    taskId: taskContents.id,
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
                    currentTaskContent={taskContents}
                    openDeleteTask={openDeleteTask}
                    setCurrentTaskContent={setCurrentTaskContent}
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
