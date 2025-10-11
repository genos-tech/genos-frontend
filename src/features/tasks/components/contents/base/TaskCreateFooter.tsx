import { Socket } from "socket.io-client";
import { Button, Stack } from "@mui/joy";

import { uploadNewTask } from "../../../services/uploadNewTask";
import { UserProps } from "../../../../../types/admin";
import { TaskProps, ProjectProps } from "../../../../../types/tasks";
import { ChatProps, ThreadProps } from "../../../../../types/chat";
import { deleteEmptyTask } from "../../../services/deleteEmptyTask";

type TaskCreateFooterProps = {
    socket: Socket | null;
    myself: UserProps;
    accessToken: string | null;
    currentMainChat?: ChatProps;
    currentThreadChat?: ThreadProps;
    isThreadVisible?: boolean;
    taskContents: TaskProps;
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
        taskContents,
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
            taskContents: taskContents,
            currentMainChat: currentMainChat,
            currentThreadChat: currentThreadChat,
            isThreadVisible: isThreadVisible || false,
            accessToken: accessToken || "",
            setTitleError: setTitleError,
            setTitleErrorOpen: setTitleErrorOpen,
            setCurrentPreviewTaskId: setCurrentPreviewTaskId,
        });

        if (taskContents.project && taskContents.project.projectId) {
            localStorage.setItem("lastProjectId", String(taskContents.project.projectId));
            setCurrentProject(taskContents.project);
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
                component="button"
                variant="outlined"
                color="danger"
                size="sm"
                onClick={() => {
                    if (setIsCreatingTask) {
                        setIsCreatingTask({
                            flag: false,
                            parentTaskId: null,
                            rootTaskId: null,
                        });
                    }

                    if (taskContents.id !== undefined) {
                        deleteEmptyTask({
                            myself: myself,
                            taskId: taskContents.id,
                            accessToken: accessToken,
                            setInitialEmptyTaskId: setInitialEmptyTaskId,
                        });
                    }
                }}
            >
                Cancel
            </Button>
            <Button
                component="button"
                type="submit"
                variant="solid"
                color="primary"
                onClick={() => {
                    DoUploadNewTask();
                }}
                disabled={taskTitle === "" || taskContents.project?.projectId === null}
            >
                Create
            </Button>
        </Stack>
    );
};
