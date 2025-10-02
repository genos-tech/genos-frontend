import { alpha } from "@mui/system";
import { useState, useRef } from "react";
import {
    Box,
    Chip,
    Snackbar,
    Stack,
    FormControl,
    Input,
    IconButton,
    Dropdown,
    MenuButton,
    Menu,
    MenuItem,
    Tooltip,
} from "@mui/joy";
import MoreVert from "@mui/icons-material/MoreVert";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AddIcon from "@mui/icons-material/Add";
import { useColorScheme } from "@mui/joy/styles";

import { TaskProps } from "../../../../../types/tasks";
import { ModalDeleteTask } from "../../modals/ModalDeleteTask";

type TaskTitleBlockProps = {
    taskContents: TaskProps;
    taskTitle: string;
    setTaskTitle: (value: string) => void;
    setIsCreatingTask: (value: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    }) => void;
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
    isThreadVisible?: boolean;
    setIsTaskPreviewVisible?: (value: boolean) => void;
    setIsTaskHomeVisible?: (value: boolean) => void;
    isTaskPreviewVisible?: boolean;
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };
    setCurrentTaskContent?: (value: TaskProps) => void;
    setTaskStatusUpdated?: (value: boolean) => void;
    isTaskNoteVisible?: boolean;
    setIsTaskVisibleInNote?: (value: boolean) => void;
};
export const TaskTitleBlock = (props: TaskTitleBlockProps) => {
    const {
        taskContents,
        taskTitle,
        setTaskTitle,
        setIsCreatingTask,
        setTaskClosed,
        setOpenCreateProject,
        setOpenCreateTag,
        titleError,
        titleErrorOpen,
        setTitleErrorOpen,
        setTaskUpdated,
        isPreviewMode,
        setIsMainChatVisible,
        setIsThreadVisible,
        isThreadVisible,
        setIsTaskPreviewVisible,
        setIsTaskHomeVisible,
        isTaskPreviewVisible,
        isCreatingTask,
        setCurrentTaskContent,
        setTaskStatusUpdated,
        isTaskNoteVisible,
        setIsTaskVisibleInNote,
    } = props;

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
                                variant="soft"
                                color="neutral"
                                sx={{
                                    borderRadius: "5px",
                                    fontWeight: "bold",
                                }}
                                size="lg"
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
                    <FormControl required sx={{ width: "100%" }}>
                        <Input
                            key={"taskTitle"}
                            variant="soft"
                            placeholder="Task Title"
                            value={taskTitle}
                            onChange={(e) => {
                                setTaskTitle(e.target.value);
                            }}
                            onBlur={() => {
                                if (setTaskUpdated) {
                                    setTaskUpdated(true);
                                }
                            }}
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
                        />
                    </FormControl>
                </Box>

                {/* If the task is visible in the task note, do not show the expand button. */}
                {isPreviewMode === true && setIsTaskVisibleInNote === undefined && (
                    <Tooltip title="Expand">
                        <IconButton
                            size="sm"
                            variant="plain"
                            color="neutral"
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

                <Dropdown>
                    <MenuButton
                        size="sm"
                        slots={{ root: IconButton }}
                        slotProps={{ root: { color: "neutral" } }}
                    >
                        <MoreVert />
                    </MenuButton>
                    <Menu size="sm">
                        <MenuItem
                            onClick={() => {
                                setOpenCreateProject(true);
                            }}
                        >
                            <AddIcon />
                            New Project
                        </MenuItem>
                        <MenuItem
                            onClick={() => {
                                setOpenCreateTag(true);
                            }}
                        >
                            <AddIcon />
                            New Tag
                        </MenuItem>
                        {taskContents.status.status !== "Closed" && (
                            <MenuItem
                                onClick={() => {
                                    setOpenDeleteTask(true);
                                }}
                                sx={{
                                    color: "red",
                                    fontWeight: "bold",
                                }}
                            >
                                <DeleteIcon sx={{ color: "red" }} />
                                Delete Task
                            </MenuItem>
                        )}
                    </Menu>
                </Dropdown>

                <IconButton
                    size="sm"
                    variant="plain"
                    color="neutral"
                    onClick={() => {
                        if (isPreviewMode === false && setIsCreatingTask) {
                            setIsCreatingTask({
                                flag: false,
                                parentTaskId: null,
                                rootTaskId: null,
                            });
                        }
                        if (isPreviewMode === true && setTaskClosed) {
                            setTaskClosed(true);
                        }

                        if (setIsMainChatVisible) {
                            setIsMainChatVisible(true);
                        }

                        // setIsThreadVisible(); // Not update, keep as it is !!!
                        if (setIsTaskPreviewVisible) {
                            if (isPreviewMode === true) {
                                setIsTaskPreviewVisible(false);
                            }
                            // Open task-home when both task-preview and task-create-form are closed.
                            if (isCreatingTask.flag === false && isTaskNoteVisible === false) {
                                if (setIsTaskHomeVisible) {
                                    setIsTaskHomeVisible(true);
                                }
                            }
                        }

                        setIsCreatingTask({
                            flag: false,
                            parentTaskId: null,
                            rootTaskId: null,
                        });
                        // Open task-home when both task-preview and task-create-form are closed.
                        if (isTaskPreviewVisible === false) {
                            if (setIsTaskHomeVisible) {
                                setIsTaskHomeVisible(true);
                            }
                        }

                        // Close the task preview when the task is visible in the task note.
                        if (setIsTaskVisibleInNote) {
                            setIsTaskVisibleInNote(false);
                        }
                    }}
                >
                    <CancelIcon />
                </IconButton>

                <ModalDeleteTask
                    openDeleteTask={openDeleteTask}
                    setOpenDeleteTask={setOpenDeleteTask}
                    currentTaskContent={taskContents}
                    setCurrentTaskContent={setCurrentTaskContent}
                    setTaskUpdated={setTaskUpdated}
                    setTaskStatusUpdated={setTaskStatusUpdated}
                />

                {isPreviewMode === false && titleError && titleErrorOpen !== undefined && (
                    <Snackbar
                        autoHideDuration={5000}
                        open={titleErrorOpen}
                        variant="soft"
                        color="danger"
                        anchorOrigin={{ vertical: "top", horizontal: "right" }}
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
