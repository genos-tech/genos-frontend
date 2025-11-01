import { Button, Stack } from "@mui/joy";
import { Socket } from "socket.io-client";

import { UserProps } from "../../../../../types/admin";
import { ChatProps, ThreadProps } from "../../../../../types/chat";
import { ProjectProps, TaskProps } from "../../../../../types/tasks";
import { deleteEmptyTask } from "../../../services/deleteEmptyTask";
import { uploadNewTask } from "../../../services/uploadNewTask";

type TaskCreateFooterProps = {
    socket: Socket | null;
    myself: UserProps;
    accessToken: string | null;
    currentMainChat?: ChatProps;
    currentThreadChat?: ThreadProps;
    isThreadVisible?: boolean;
    taskContent: TaskProps;
    taskTitle: string;
    setIsSubmitted: (value: boolean) => void;
    setTitleError: (value: string) => void;
    setTitleErrorOpen: (value: boolean) => void;
    setIsTaskPreviewVisible?: (value: boolean) => void;
    setIsCreatingTask: (value: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    }) => void;
    setCurrentPreviewTaskId: (value: number) => void;
    setCurrentProject: (value: ProjectProps) => void;
    setInitialEmptyTaskId: (value: number | undefined) => void;
};
export const TaskCreateFooter = (props: TaskCreateFooterProps) => {
    const {
        socket,
        myself,
        accessToken,
        currentMainChat,
        currentThreadChat,
        isThreadVisible,
        taskContent,
        taskTitle,
        setIsSubmitted,
        setTitleError,
        setTitleErrorOpen,
        setIsTaskPreviewVisible,
        setIsCreatingTask,
        setCurrentPreviewTaskId,
        setCurrentProject,
        setInitialEmptyTaskId,
    } = props;

    const DoUploadNewTask = async () => {
        await uploadNewTask({
            socket: socket,
            myself: myself,
            taskContent: taskContent,
            currentMainChat: currentMainChat,
            currentThreadChat: currentThreadChat,
            isThreadVisible: isThreadVisible || false,
            accessToken: accessToken || "",
            setTitleError: setTitleError,
            setTitleErrorOpen: setTitleErrorOpen,
            setCurrentPreviewTaskId: setCurrentPreviewTaskId,
        });

        if (taskContent.project && taskContent.project.projectId) {
            localStorage.setItem("lastProjectId", String(taskContent.project.projectId));
            setCurrentProject(taskContent.project);
        } else {
            console.error("Failed to set the current project");
        }

        if (setIsTaskPreviewVisible) {
            setIsTaskPreviewVisible(true);
        }

        setIsSubmitted(true);
    };

    return (
        <Stack direction="row" sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button
                color="danger"
                component="button"
                size="sm"
                variant="outlined"
                onClick={() => {
                    if (setIsCreatingTask) {
                        setIsCreatingTask({
                            flag: false,
                            parentTaskId: null,
                            rootTaskId: null,
                        });
                    }

                    if (taskContent.id !== undefined) {
                        deleteEmptyTask({
                            myself: myself,
                            taskId: taskContent.id,
                            accessToken: accessToken,
                            setInitialEmptyTaskId: setInitialEmptyTaskId,
                        });
                    }
                }}
            >
                Cancel
            </Button>
            <Button
                color="primary"
                component="button"
                disabled={taskTitle === "" || taskContent.project?.projectId === null}
                type="submit"
                variant="solid"
                onClick={() => {
                    DoUploadNewTask();
                }}
            >
                Create
            </Button>
        </Stack>
    );
};
