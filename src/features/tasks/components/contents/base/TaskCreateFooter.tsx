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
        setIsSubmitted,
        setTitleError,
        setTitleErrorOpen,
        usePM,
    } = props;

    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const isDisabled = taskTitle === "" || taskContent.project?.projectId === null;

    const DoUploadNewTask = async () => {
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

        useTM.setIsTaskPreviewVisible(true);

        setIsSubmitted(true);
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
                size="sm"
                variant="plain"
                startDecorator={<CloseRoundedIcon sx={{ fontSize: 16 }} />}
                onClick={handleCancel}
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
            >
                Cancel
            </Button>
            <Button
                size="sm"
                variant="solid"
                disabled={isDisabled}
                startDecorator={<AddTaskRoundedIcon sx={{ fontSize: 16 }} />}
                onClick={DoUploadNewTask}
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
            >
                Create Task
            </Button>
        </Stack>
    );
};
