import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Box, IconButton, Tooltip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { MessageProps } from "../../../../types/chat";

type BubbleOpenTaskButtonTypes = {
    message: MessageProps;
    usePM: ProjectManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
};

export const BubbleOpenTaskButton = (props: BubbleOpenTaskButtonTypes) => {
    const { message, usePM, useCM, useTM } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    return (
        <Box sx={{ textAlign: "right" }}>
            <Tooltip
                size="sm"
                title="Open Task"
                placement="top"
                sx={{
                    borderRadius: "8px",
                    fontSize: "0.75rem",
                }}
            >
                <IconButton
                    size="sm"
                    onClick={() => {
                        if (message.taskId !== null) {
                            useCM.setIsMainChatVisible(true);
                            useCM.setIsThreadVisible(false);
                            useTM.setIsTaskPreviewVisible(true);
                            useTM.setIsCreatingTask({ ...useTM.isCreatingTask, flag: false });
                            useTM.setCurrentPreviewTaskId(message.taskId);

                            if (message.project && message.project.projectId) {
                                usePM.setCurrentProject(message.project);
                            } else {
                                console.error("Failed to set the current project");
                            }
                        }
                    }}
                    sx={{
                        width: 28,
                        height: 28,
                        borderRadius: "8px",
                        transition: "all 0.15s ease",
                        color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
                        background: "transparent",
                        "&:hover": {
                            background: isDark ? "rgba(34,211,238,0.15)" : "rgba(6,182,212,0.1)",
                            color: isDark ? "#22d3ee" : "#06b6d4",
                            transform: "scale(1.05)",
                        },
                        "&:active": {
                            transform: "scale(0.95)",
                        },
                    }}
                >
                    <OpenInNewIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </Tooltip>
        </Box>
    );
};
