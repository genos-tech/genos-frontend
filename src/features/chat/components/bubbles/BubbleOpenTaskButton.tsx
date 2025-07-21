import { Box, Tooltip, IconButton, Typography } from "@mui/joy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

type BubbleReplyButtonTypes = {
    taskId: number | null;
    setIsMainChatVisible: (value: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
    setIsTaskPreviewVisible: (value: boolean) => void;
    setIsTaskCreationVisible: (value: boolean) => void;
    setIsOpeningTask: (value: boolean) => void;
    setCurrentPreviewTaskId: (value: number) => void;
};
export const BubbleOpenTaskButton = (props: BubbleReplyButtonTypes) => {
    const {
        taskId,
        setIsMainChatVisible,
        setIsThreadVisible,
        setIsTaskPreviewVisible,
        setIsTaskCreationVisible,
        setIsOpeningTask,
        setCurrentPreviewTaskId,
    } = props;
    return (
        <Box sx={{ textAlign: "right" }}>
            <Tooltip title="Open Task" size="sm">
                <IconButton
                    size="sm"
                    sx={{
                        top: "5%",
                        right: "5%",
                        p: 0.7,
                    }}
                    onClick={() => {
                        if (taskId !== null) {
                            setIsMainChatVisible(true);
                            setIsThreadVisible(false);
                            setIsTaskPreviewVisible(true);
                            setIsTaskCreationVisible(false);
                            setCurrentPreviewTaskId(taskId);

                            setIsOpeningTask(true);
                        }
                    }}
                >
                    <OpenInNewIcon />
                </IconButton>
            </Tooltip>
        </Box>
    );
};
