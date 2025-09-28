import { Socket } from "socket.io-client";
import { Button, Stack } from "@mui/joy";

import { uploadNewTask } from "../../../services/uploadNewTask";
import { UserProps } from "../../../../../types/admin";
import { TaskProps, ProjectProps } from "../../../../../types/tasks";
import { ChatProps, ThreadProps } from "../../../../../types/chat";

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
    } = props;
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
                }}
            >
                Cancel
            </Button>
            <Button
                component="button"
                type="submit"
                variant="solid"
                color="primary"
                onClick={async () => {
                    await uploadNewTask({
                        socket: socket,
                        myself: myself,
                        taskContents: taskContents,
                        currentMainChat: currentMainChat,
                        currentThreadChat: currentThreadChat,
                        isThreadVisible: isThreadVisible || false,
                        accessToken: accessToken || "",
                        setIsSubmitted: setIsSubmitted,
                        setTitleError: setTitleError,
                        setTitleErrorOpen: setTitleErrorOpen,
                        setCurrentPreviewTaskId: setCurrentPreviewTaskId,
                    });

                    if (taskContents.project) {
                        setCurrentProject(taskContents.project);
                    }

                    if (setIsTaskPreviewVisible) {
                        setIsTaskPreviewVisible(true);
                    }
                    if (setIsCreatingTask) {
                        setIsCreatingTask({
                            flag: false,
                            parentTaskId: null,
                            rootTaskId: null,
                        });
                    }
                }}
                disabled={taskTitle === "" || taskContents.project?.projectId === null}
            >
                Create
            </Button>
        </Stack>
    );
};
