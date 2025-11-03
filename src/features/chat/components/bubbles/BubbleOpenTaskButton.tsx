import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Box, IconButton, Tooltip } from "@mui/joy";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { MessageProps } from "../../../../types/chat";
import { ProjectProps } from "../../../../types/tasks";

type BubbleReplyButtonTypes = {
    message: MessageProps;
    taskId: number | null;
    PM: ProjectManagementState;
    CM: ChatManagementState;
    TM: TaskManagementState;
};
export const BubbleOpenTaskButton = (props: BubbleReplyButtonTypes) => {
    const { message, taskId, PM, CM, TM } = props;
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
                            TM.setIsTaskPreviewVisible(true);
                            TM.setIsCreatingTask({ ...TM.isCreatingTask, flag: false });
                            TM.setCurrentPreviewTaskId(taskId);

                            if (message.project && message.project.projectId) {
                                PM.setCurrentProject(message.project);
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
