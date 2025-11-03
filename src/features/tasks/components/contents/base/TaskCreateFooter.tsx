import { Button, Stack } from "@mui/joy";
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
    CM: ChatManagementState;
    taskContent: TaskProps;
    taskTitle: string;
    TM: TaskManagementState;
    setIsSubmitted: (value: boolean) => void;
    setTitleError: (value: string) => void;
    setTitleErrorOpen: (value: boolean) => void;
    PM: ProjectManagementState;
};
export const TaskCreateFooter = (props: TaskCreateFooterProps) => {
    const {
        socket,
        myself,
        accessToken,
        CM,
        taskContent,
        taskTitle,
        TM,
        setIsSubmitted,
        setTitleError,
        setTitleErrorOpen,
        PM,
    } = props;

    const DoUploadNewTask = async () => {
        await uploadNewTask({
            socket: socket,
            myself: myself,
            taskContent: taskContent,
            CM: CM,
            accessToken: accessToken || "",
            setTitleError: setTitleError,
            setTitleErrorOpen: setTitleErrorOpen,
            setCurrentPreviewTaskId: TM.setCurrentPreviewTaskId,
        });

        if (taskContent.project && taskContent.project.projectId) {
            localStorage.setItem("lastProjectId", String(taskContent.project.projectId));
            PM.setCurrentProject(taskContent.project);
        } else {
            console.error("Failed to set the current project");
        }

        TM.setIsTaskPreviewVisible(true);

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
                    if (TM.setIsCreatingTask) {
                        TM.setIsCreatingTask({
                            flag: false,
                            parentTaskId: null,
                            rootTaskId: TM.currentPreviewTask?.rootTaskId || null,
                        });
                    }

                    if (taskContent.id !== undefined) {
                        deleteEmptyTask({
                            myself: myself,
                            taskId: taskContent.id,
                            accessToken: accessToken,
                            setInitialEmptyTaskId: TM.setInitialEmptyTaskId,
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
