import AccessTimeIcon from "@mui/icons-material/AccessTime";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { Box, Chip, List, ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { SearchTeamTasksResponse } from "../../../../types/tasks";
import { Toggler } from "./common";

type RecentsListItemProps = {
    recentTasks: SearchTeamTasksResponse[];
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
};

export const RecentsListItem = (props: RecentsListItemProps) => {
    const { recentTasks, usePM, useTM } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    return (
        <ListItem nested>
            <Toggler
                defaultExpanded={false}
                renderToggle={({ open, setOpen }) => (
                    <ListItemButton
                        onClick={() => {
                            setOpen(!open);
                            useTM.setIsDashboardVisible(false);
                        }}
                        sx={{
                            borderRadius: "10px",
                            py: 1,
                            px: 1.5,
                            gap: 1.5,
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            "&:hover": {
                                backgroundColor: isDark
                                    ? "rgba(255,255,255,0.06)"
                                    : "rgba(0,0,0,0.04)",
                            },
                        }}
                    >
                        <Box
                            sx={{
                                width: 28,
                                height: 28,
                                borderRadius: "8px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: isDark
                                    ? "rgba(255,255,255,0.08)"
                                    : "rgba(0,0,0,0.05)",
                                transition: "all 0.2s ease",
                            }}
                        >
                            <AccessTimeIcon
                                sx={{
                                    fontSize: 16,
                                    color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.65)",
                                }}
                            />
                        </Box>
                        <ListItemContent>
                            <Typography
                                level="body-sm"
                                sx={{
                                    fontWeight: 500,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.8)",
                                }}
                            >
                                Recents
                            </Typography>
                        </ListItemContent>
                        <KeyboardArrowDownIcon
                            sx={{
                                fontSize: 18,
                                color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)",
                                transition: "transform 0.2s ease",
                                transform: open ? "rotate(180deg)" : "none",
                            }}
                        />
                    </ListItemButton>
                )}
            >
                <List sx={{ gap: 0.25 }}>
                    {recentTasks.map(
                        (
                            { projectId, projectName, systemUserId, taskId, title, status },
                            index
                        ) => {
                            return (
                                <ListItem key={`recent-task-${taskId}`}>
                                    <ListItemButton
                                        onClick={() => {
                                            if (projectId) {
                                                usePM.setCurrentProject({
                                                    projectId: projectId,
                                                    projectName: projectName,
                                                    projectTags: [],
                                                    systemUserId: systemUserId,
                                                });
                                                useTM.setCurrentPreviewTaskId(taskId);
                                                useTM.setIsTaskPreviewVisible(true);
                                            } else {
                                                console.error("Failed to set the current project");
                                            }
                                        }}
                                        sx={{
                                            overflow: "hidden",
                                            borderRadius: "8px",
                                            px: 1.25,
                                            ml: 0,
                                            gap: 0.75,
                                            transition: "all 0.15s ease",
                                            "&:hover": {
                                                backgroundColor: isDark
                                                    ? "rgba(255,255,255,0.04)"
                                                    : "rgba(0,0,0,0.03)",
                                            },
                                        }}
                                    >
                                        <Chip
                                            key={`recent-task-project-chip-${taskId}`}
                                            color="neutral"
                                            size="sm"
                                            variant="outlined"
                                            sx={{
                                                borderRadius: "4px",
                                                fontWeight: 600,
                                                fontSize: 10,
                                                minHeight: 20,
                                                px: 0.5,
                                            }}
                                        >
                                            {projectName.toUpperCase().slice(0, 2)}
                                        </Chip>
                                        <Chip
                                            key={`status-chip-${taskId}-${index}`}
                                            size="sm"
                                            variant="soft"
                                            sx={{
                                                backgroundColor: status.color
                                                    ? alpha(status.color, isDark ? 0.4 : 0.6)
                                                    : "transparent",
                                                color: status.textColor,
                                                fontWeight: 600,
                                                borderRadius: "4px",
                                                fontSize: 10,
                                                minHeight: 20,
                                                px: 0.5,
                                            }}
                                        >
                                            {status.status}
                                        </Chip>
                                        <Typography
                                            level="body-sm"
                                            sx={{
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                flex: 1,
                                                color: isDark
                                                    ? "rgba(255,255,255,0.8)"
                                                    : "rgba(0,0,0,0.7)",
                                            }}
                                            noWrap
                                        >
                                            {title}
                                        </Typography>
                                    </ListItemButton>
                                </ListItem>
                            );
                        }
                    )}
                </List>
            </Toggler>
        </ListItem>
    );
};
