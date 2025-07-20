import { Box, Tooltip, IconButton, Typography } from "@mui/joy";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";

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
                    color="primary"
                    variant="soft"
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
                    <AssignmentRoundedIcon />
                    <Typography sx={{ fontSize: "15px", fontWeight: "bold" }}>Open</Typography>
                </IconButton>
            </Tooltip>
        </Box>
    );
};
