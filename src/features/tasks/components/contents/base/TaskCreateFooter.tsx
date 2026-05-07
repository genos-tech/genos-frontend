import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Button, Stack } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../../types/admin";
import { TaskProps } from "../../../../../types/tasks";
import { deleteEmptyTask } from "../../../services/deleteEmptyTask";
import { uploadNewTask } from "../../../services/uploadNewTask";

type TaskCreateFooterProps = {
    socket: Socket | null;
    myself: UserProps;
    accessToken: string | null;
    useCM: ChatManagementState;
    taskContent: TaskProps;
    taskTitle: string;
    useTM: TaskManagementState;
    /** Lifted into `CreateTaskForm` so the attachment block can render
     *  its overlay during the same upload window the button is locked. */
    isCreatingTask?: boolean;
    setIsCreatingTask?: (value: boolean) => void;
    setIsSubmitted: (value: boolean) => void;
    setTitleError: (value: string) => void;
    setTitleErrorOpen: (value: boolean) => void;
    usePM: ProjectManagementState;
};

export const TaskCreateFooter = (props: TaskCreateFooterProps) => {
    const {
        socket,
        myself,
        accessToken,
        useCM,
        taskContent,
        taskTitle,
        useTM,
        isCreatingTask = false,
        setIsCreatingTask,
        setIsSubmitted,
        setTitleError,
        setTitleErrorOpen,
        usePM,
    } = props;

    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const isDisabled =
        isCreatingTask || taskTitle === "" || taskContent.project?.projectId === null;

    const DoUploadNewTask = async () => {
        // Guard against a double-click sending two creates in parallel
        // (the button is also visually locked via `isDisabled`).
        if (isCreatingTask) return;

        setIsCreatingTask?.(true);
        try {
            await uploadNewTask({
                socket: socket,
                myself: myself,
                taskContent: taskContent,
                useCM: useCM,
                accessToken: accessToken || "",
                setTitleError: setTitleError,
                setTitleErrorOpen: setTitleErrorOpen,
                setCurrentPreviewTaskId: useTM.setCurrentPreviewTaskId,
            });

            if (taskContent.project && taskContent.project.projectId) {
                localStorage.setItem("lastProjectId", String(taskContent.project.projectId));
                usePM.setCurrentProject(taskContent.project);
            } else {
                console.error("Failed to set the current project");
            }

            setIsSubmitted(true);
        } finally {
            // Always release the lock — `uploadNewTask` already reports
            // failures through `setTitleError`, so leaving the form
            // wedged on a transient backend hiccup would be worse than
            // letting the user retry.
            setIsCreatingTask?.(false);
        }
    };

    const handleCancel = () => {
        if (useTM.setIsCreatingTask) {
            useTM.setIsCreatingTask({
                flag: false,
                parentTaskId: null,
                rootTaskId: useTM.currentPreviewTask?.rootTaskId || null,
                creationKind: "task",
                milestoneId: null,
            });
        }

        if (taskContent.id !== undefined) {
            deleteEmptyTask({
                myself: myself,
                taskId: taskContent.id,
                accessToken: accessToken,
                setInitialEmptyTaskId: useTM.setInitialEmptyTaskId,
            });
        }
    };

    return (
        <Stack direction="row" sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
            <Button
                disabled={isCreatingTask}
                size="sm"
                startDecorator={<CloseRoundedIcon sx={{ fontSize: 16 }} />}
                variant="plain"
                sx={{
                    fontWeight: 600,
                    fontSize: "13px",
                    borderRadius: "10px",
                    px: 2,
                    py: 0.75,
                    color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)",
                    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                    border: "1px solid",
                    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": {
                        background: isDark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)",
                        borderColor: isDark ? "rgba(239,68,68,0.3)" : "rgba(239,68,68,0.25)",
                        color: "#ef4444",
                    },
                    "&:active": {
                        transform: "scale(0.98)",
                    },
                }}
                onClick={handleCancel}
            >
                Cancel
            </Button>
            <Button
                disabled={isDisabled}
                loading={isCreatingTask}
                loadingPosition="start"
                size="sm"
                startDecorator={<AddTaskRoundedIcon sx={{ fontSize: 16 }} />}
                variant="solid"
                sx={{
                    fontWeight: 600,
                    fontSize: "13px",
                    borderRadius: "10px",
                    px: 2.5,
                    py: 0.75,
                    background: isDisabled
                        ? isDark
                            ? "rgba(255,255,255,0.08)"
                            : "rgba(0,0,0,0.08)"
                        : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                    color: isDisabled
                        ? isDark
                            ? "rgba(255,255,255,0.3)"
                            : "rgba(0,0,0,0.3)"
                        : "white",
                    boxShadow: isDisabled ? "none" : "0 2px 8px rgba(99, 102, 241, 0.3)",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": {
                        background: isDisabled
                            ? isDark
                                ? "rgba(255,255,255,0.08)"
                                : "rgba(0,0,0,0.08)"
                            : "linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)",
                        boxShadow: isDisabled ? "none" : "0 4px 12px rgba(99, 102, 241, 0.4)",
                        transform: isDisabled ? "none" : "translateY(-1px)",
                    },
                    "&:active": {
                        transform: isDisabled ? "none" : "translateY(0)",
                        boxShadow: isDisabled ? "none" : "0 2px 6px rgba(99, 102, 241, 0.25)",
                    },
                    "&:disabled": {
                        background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                        color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
                    },
                }}
                onClick={() => {
                    // Open task table if the current location is task.
                    if (location.pathname.includes("/home/tasks")) {
                        useTM.setIsTaskTableVisible(true);
                    }
                    useTM.setIsTaskPreviewVisible(true);
                    DoUploadNewTask();
                }}
            >
                {isCreatingTask ? "Creating…" : "Create Task"}
            </Button>
        </Stack>
    );
};
