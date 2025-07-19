import { Box, Tooltip, IconButton } from "@mui/joy";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";

type BubbleReplyButtonTypes = {
    taskId: number | null;
    setIsTaskPreviewVisible: (value: boolean) => void;
    setIsOpeningTask: (value: boolean) => void;
};
export const BubbleOpenTaskButton = (props: BubbleReplyButtonTypes) => {
    const { taskId, setIsTaskPreviewVisible, setIsOpeningTask } = props;
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
                            setIsTaskPreviewVisible(true);
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
