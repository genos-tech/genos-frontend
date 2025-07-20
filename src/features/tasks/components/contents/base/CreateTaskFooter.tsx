import { Socket } from "socket.io-client";
import { Button, Stack } from "@mui/joy";

import { uploadNewTask } from "../../../services/uploadNewTask";
import { UserProps } from "../../../../../types/admin";
import { TaskProps } from "../../../../../types/tasks";

type CreateTaskFooterProps = {
    socket: Socket | null;
    myself: UserProps;
    accessToken: string | null;
    isDm: boolean | null;
    chatType: number | null;
    chatId: number | null;
    threadId: number | null;
    taskContents: TaskProps;
    taskTitle: string;
    setIsSubmitted: (value: boolean) => void;
    setTitleError: (value: string) => void;
    setTitleErrorOpen: (value: boolean) => void;
    setIsMainChatVisible?: (value: boolean) => void;
    setIsThreadVisible?: (value: boolean) => void;
    setIsTaskPreviewVisible?: (value: boolean) => void;
    setIsTaskCreationVisible?: (value: boolean) => void;
    setIsCreatingTask?: (value: any) => void;
    setCurrentPreviewTaskId: (value: number) => void;
};
export const CreateTaskFooter = (props: CreateTaskFooterProps) => {
    const {
        socket,
        myself,
        accessToken,
        isDm,
        chatType,
        chatId,
        threadId,
        taskContents,
        taskTitle,
        setIsSubmitted,
        setTitleError,
        setTitleErrorOpen,
        setIsMainChatVisible,
        setIsThreadVisible,
        setIsTaskPreviewVisible,
        setIsTaskCreationVisible,
        setIsCreatingTask,
        setCurrentPreviewTaskId,
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
                        isDm: isDm,
                        chatType: chatType,
                        chatId: chatId,
                        threadId: threadId,
                        accessToken: accessToken || "",
                        setIsSubmitted: setIsSubmitted,
                        setTitleError: setTitleError,
                        setTitleErrorOpen: setTitleErrorOpen,
                        setCurrentPreviewTaskId: setCurrentPreviewTaskId,
                    });
                    // if (setIsMainChatVisible) {
                    //     setIsMainChatVisible(); // Keep as it is
                    // }
                    // if (setIsThreadVisible) {
                    //     setIsThreadVisible(false); // Keep as it is
                    // }
                    if (setIsTaskPreviewVisible) {
                        setIsTaskPreviewVisible(true);
                    }
                    if (setIsTaskCreationVisible) {
                        setIsTaskCreationVisible(false);
                    }
                }}
                disabled={taskTitle === ""}
            >
                Create
            </Button>
        </Stack>
    );
};
