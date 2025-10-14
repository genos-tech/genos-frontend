import { alpha } from "@mui/system";
import { List, ListItem, ListItemContent, Typography, Chip } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useColorScheme } from "@mui/joy/styles";

import { ProjectProps, SearchTeamTasksResponse } from "../../../../types/tasks";
import { Toggler } from "./common";

type RecentsListItemProps = {
    recentTasks: SearchTeamTasksResponse[];
    setIsDashboardVisible: (value: boolean) => void;
    setCurrentProject: (value: ProjectProps) => void;
    setCurrentPreviewTaskId: (value: number) => void;
    setIsTaskPreviewVisible: (value: boolean) => void;
};
export const RecentsListItem = (props: RecentsListItemProps) => {
    const {
        recentTasks,
        setIsDashboardVisible,
        setCurrentProject,
        setCurrentPreviewTaskId,
        setIsTaskPreviewVisible,
    } = props;
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
                            setIsDashboardVisible(false);
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
                                        onClick={() => {
                                            if (projectId) {
                                                setCurrentProject({
                                                    projectId: projectId,
                                                    projectName: projectName,
                                                    projectTags: [],
                                                    systemUserId: systemUserId,
                                                });
                                                setCurrentPreviewTaskId(taskId);
                                                setIsTaskPreviewVisible(true);
                                            } else {
                                                console.error("Failed to set the current project");
                                            }
                                        }}
                                        sx={{ overflow: "hidden" }} // ensure children don't overflow
                                    >
                                        <Chip
                                            key={`recent-task-project-chip-${taskId}`}
                                            variant="outlined"
                                            color="neutral"
                                            sx={{
                                                borderRadius: "5px",
                                                fontWeight: "bold",
                                                marginX: "-10px",
                                            }}
                                            size="sm"
                                        >
                                            {projectName.toUpperCase().slice(0, 2)}
                                        </Chip>
                                        <Chip
                                            key={`recent-task-chip-${taskId}`}
                                            variant="soft"
                                            color="neutral"
                                            sx={{
                                                borderRadius: "5px",
                                                fontWeight: "bold",
                                            }}
                                            size="sm"
                                        >
                                            ID: {taskId || "N/A"}
                                        </Chip>
                                        <Chip
                                            key={`status-chip-${taskId}-${index}`} // pass the key directly
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
                                            size="sm"
                                        >
                                            {`${status.status}`}
                                        </Chip>
                                        <Typography
                                            noWrap
                                            sx={{
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                width: "100%", // take full width of button
                                                fontSize: "15px",
                                            }}
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
