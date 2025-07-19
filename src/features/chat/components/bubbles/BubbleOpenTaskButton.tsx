import { Box, Tooltip, IconButton } from "@mui/joy";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";

type BubbleReplyButtonTypes = {
    taskId: number | null;
    setIsMainChatVisible: (value: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
    setIsTaskPreviewVisible: (value: boolean) => void;
    setIsTaskCreationVisible: (value: boolean) => void;
    setIsOpeningTask: (value: boolean) => void;
};
export const BubbleOpenTaskButton = (props: BubbleReplyButtonTypes) => {
    const {
        taskId,
        setIsMainChatVisible,
        setIsThreadVisible,
        setIsTaskPreviewVisible,
        setIsTaskCreationVisible,
        setIsOpeningTask,
    } = props;
    return (
        <Box sx={{ textAlign: "right" }}>
            <Tooltip title="Open Task" size="sm">
                <IconButton
                    size="sm"
                    color="primary"
                    variant="solid"
                    sx={{
                        top: "5%",
                        right: "5%",
                        p: 0.7,
                    }}
                    onClick={() => {
                        console.log("taskId:", taskId);
                        if (taskId !== null) {
                            setIsMainChatVisible(true);
                            setIsThreadVisible(false);
                            setIsTaskPreviewVisible(true);
                            setIsTaskCreationVisible(false);

                            setIsOpeningTask(true);
                        }
                    }}
                >
                    <AssignmentRoundedIcon />
                    Open
                </IconButton>
            </Tooltip>
        </Box>
    );
};
