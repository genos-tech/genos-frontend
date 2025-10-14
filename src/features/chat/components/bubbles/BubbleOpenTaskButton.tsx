import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Box, IconButton, Tooltip } from "@mui/joy";

import { MessageProps } from "../../../../types/chat";
import { ProjectProps } from "../../../../types/tasks";

type BubbleReplyButtonTypes = {
    message: MessageProps;
    taskId: number | null;
    setIsMainChatVisible: (value: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
    setIsTaskPreviewVisible: (value: boolean) => void;
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };
    setIsCreatingTask: (value: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    }) => void;
    setCurrentPreviewTaskId: (value: number) => void;
    setCurrentProject: (value: ProjectProps) => void;
};
export const BubbleOpenTaskButton = (props: BubbleReplyButtonTypes) => {
    const {
        message,
        taskId,
        setIsMainChatVisible,
        setIsThreadVisible,
        setIsTaskPreviewVisible,
        isCreatingTask,
        setIsCreatingTask,
        setCurrentPreviewTaskId,
        setCurrentProject,
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
                            setIsCreatingTask({ ...isCreatingTask, flag: false });
                            setCurrentPreviewTaskId(taskId);

                            if (message.project && message.project.projectId) {
                                setCurrentProject(message.project);
                            } else {
                                console.error("Failed to set the current project");
                            }
                        }
                    }}
                >
                    <OpenInNewIcon />
                </IconButton>
            </Tooltip>
        </Box>
    );
};
