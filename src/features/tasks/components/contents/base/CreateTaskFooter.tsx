import { Button, Stack } from "@mui/joy";

import { uploadTask } from "../../../services/uploadTask";
import { UserProps } from "../../../../../types/admin";
import { TaskProps } from "../../../../../types/tasks";

type CreateTaskFooterProps = {
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
    setIsCreatingTask?: (value: any) => void;
    setCurrentPreviewTaskId: (value: number) => void;
};
export const CreateTaskFooter = (props: CreateTaskFooterProps) => {
    const {
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
                onClick={() => {
                    uploadTask({
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
                }}
                disabled={taskTitle === ""}
            >
                Create
            </Button>
        </Stack>
    );
};
