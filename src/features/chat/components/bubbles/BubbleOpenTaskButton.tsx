import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Box, IconButton, Tooltip } from "@mui/joy";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { MessageProps } from "../../../../types/chat";

type BubbleReplyButtonTypes = {
    message: MessageProps;
    taskId: number | null;
    usePM: ProjectManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
};
export const BubbleOpenTaskButton = (props: BubbleReplyButtonTypes) => {
    const { message, taskId, usePM, useCM, useTM } = props;
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
                            useCM.setIsMainChatVisible(true);
                            useCM.setIsThreadVisible(false);
                            useTM.setIsTaskPreviewVisible(true);
                            useTM.setIsCreatingTask({ ...useTM.isCreatingTask, flag: false });
                            useTM.setCurrentPreviewTaskId(taskId);

                            if (message.project && message.project.projectId) {
                                usePM.setCurrentProject(message.project);
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
