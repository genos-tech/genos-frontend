import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Box, IconButton, Tooltip } from "@mui/joy";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { MessageProps } from "../../../../types/chat";
import { ProjectProps } from "../../../../types/tasks";

type BubbleReplyButtonTypes = {
    message: MessageProps;
    taskId: number | null;
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
    CM: ChatManagementState;
};
export const BubbleOpenTaskButton = (props: BubbleReplyButtonTypes) => {
    const {
        message,
        taskId,
        setIsTaskPreviewVisible,
        isCreatingTask,
        setIsCreatingTask,
        setCurrentPreviewTaskId,
        setCurrentProject,
        CM,
    } = props;
    return (
        <Box sx={{ textAlign: "right" }}>
            <Tooltip size="sm" title="Open Task" variant="outlined">
                <IconButton
                    size="sm"
                    sx={{
                        top: "5%",
                        right: "5%",
                        p: 0.7,
                    }}
                    onClick={() => {
                        if (taskId !== null) {
                            CM.setIsMainChatVisible(true);
                            CM.setIsThreadVisible(false);
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
