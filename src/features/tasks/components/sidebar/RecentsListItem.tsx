import AccessTimeIcon from "@mui/icons-material/AccessTime";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { Chip, List, ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { SearchTeamTasksResponse } from "../../../../types/tasks";
import { Toggler } from "./common";

type RecentsListItemProps = {
    recentTasks: SearchTeamTasksResponse[];
    PM: ProjectManagementState;
    TM: TaskManagementState;
};
export const RecentsListItem = (props: RecentsListItemProps) => {
    const { recentTasks, PM, TM } = props;
    const { mode } = useColorScheme();

    return (
        <ListItem nested>
            <Toggler
                defaultExpanded={false}
                renderToggle={({ open, setOpen }) => (
                    <ListItemButton
                        color="primary"
                        onClick={() => {
                            setOpen(!open);
                            TM.setIsDashboardVisible(false);
                        }}
                    >
                        <AccessTimeIcon />
                        <ListItemContent>
                            <Typography
                                level="title-sm"
                                sx={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                Recents
                            </Typography>
                        </ListItemContent>
                        <KeyboardArrowDownIcon
                            sx={[
                                open
                                    ? {
                                          transform: "rotate(180deg)",
                                      }
                                    : {
                                          transform: "none",
                                      },
                            ]}
                        />
                    </ListItemButton>
                )}
            >
                <List>
                    {recentTasks.map(
                        (
                            { projectId, projectName, systemUserId, taskId, title, status },
                            index
                        ) => {
                            return (
                                <ListItem key={`recent-task-${taskId}`}>
                                    <ListItemButton
                                        sx={{ overflow: "hidden" }} // ensure children don't overflow
                                        onClick={() => {
                                            if (projectId) {
                                                PM.setCurrentProject({
                                                    projectId: projectId,
                                                    projectName: projectName,
                                                    projectTags: [],
                                                    systemUserId: systemUserId,
                                                });
                                                TM.setCurrentPreviewTaskId(taskId);
                                                TM.setIsTaskPreviewVisible(true);
                                            } else {
                                                console.error("Failed to set the current project");
                                            }
                                        }}
                                    >
                                        <Chip
                                            key={`recent-task-project-chip-${taskId}`}
                                            color="neutral"
                                            size="sm"
                                            variant="outlined"
                                            sx={{
                                                borderRadius: "5px",
                                                fontWeight: "bold",
                                                marginX: "-10px",
                                            }}
                                        >
                                            {projectName.toUpperCase().slice(0, 2)}
                                        </Chip>
                                        <Chip
                                            key={`recent-task-chip-${taskId}`}
                                            color="neutral"
                                            size="sm"
                                            variant="soft"
                                            sx={{
                                                borderRadius: "5px",
                                                fontWeight: "bold",
                                            }}
                                        >
                                            ID: {taskId || "N/A"}
                                        </Chip>
                                        <Chip
                                            key={`status-chip-${taskId}-${index}`} // pass the key directly
                                            size="sm"
                                            variant="soft"
                                            sx={{
                                                backgroundColor: status.color
                                                    ? alpha(
                                                          status.color,
                                                          mode === "dark" ? 0.5 : 0.75
                                                      )
                                                    : "transparent",
                                                color: status.textColor,
                                                fontWeight: "bold",
                                                borderRadius: "5px",
                                                marginX: "-10px",
                                            }}
                                        >
                                            {`${status.status}`}
                                        </Chip>
                                        <Typography
                                            sx={{
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                width: "100%", // take full width of button
                                                fontSize: "15px",
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
