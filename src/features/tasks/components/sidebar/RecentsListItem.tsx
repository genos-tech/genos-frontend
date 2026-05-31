import { useMemo } from "react";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import { Box, Chip, List, ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { SearchTeamTasksResponse } from "../../../../types/tasks";
import { CopyableTaskIdChip } from "../CopyableTaskId";
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
    const { t } = useTranslation();

    // Group tasks by projectName and sort by tsUpdated descending
    const groupedTasks = useMemo(() => {
        const groups: Record<
            string,
            {
                projectId: number;
                projectName: string;
                systemUserId: string;
                tasks: SearchTeamTasksResponse[];
            }
        > = {};

        recentTasks.forEach((task) => {
            const key = task.projectName;
            if (!groups[key]) {
                groups[key] = {
                    projectId: task.projectId,
                    projectName: task.projectName,
                    systemUserId: task.systemUserId,
                    tasks: [],
                };
            }
            groups[key].tasks.push(task);
        });

        // Sort tasks within each group by tsUpdated descending
        Object.values(groups).forEach((group) => {
            group.tasks.sort(
                (a, b) => new Date(b.tsUpdated).getTime() - new Date(a.tsUpdated).getTime()
            );
        });

        // Sort groups by most recent task's tsUpdated descending
        return Object.values(groups).sort((a, b) => {
            const aLatest = a.tasks[0]?.tsUpdated ?? "";
            const bLatest = b.tasks[0]?.tsUpdated ?? "";
            return new Date(bLatest).getTime() - new Date(aLatest).getTime();
        });
    }, [recentTasks]);

    return (
        <ListItem nested>
            <Toggler
                defaultExpanded={false}
                renderToggle={({ open, setOpen }) => (
                    <ListItemButton
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
                        onClick={() => {
                            setOpen(!open);
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
                                {t.tasks.sidebar.recents}
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
                <List sx={{ gap: 0.5, pl: 1 }}>
                    {groupedTasks.map((group) => (
                        <ListItem key={`project-group-${group.projectId}`} sx={{ gap: 0 }} nested>
                            <Toggler
                                defaultExpanded={true}
                                renderToggle={({ open, setOpen }) => (
                                    <ListItemButton
                                        sx={{
                                            borderRadius: "8px",
                                            py: 0.75,
                                            px: 1,
                                            gap: 1,
                                            transition: "all 0.15s ease",
                                            "&:hover": {
                                                backgroundColor: isDark
                                                    ? "rgba(255,255,255,0.04)"
                                                    : "rgba(0,0,0,0.03)",
                                            },
                                        }}
                                        onClick={() => setOpen(!open)}
                                    >
                                        {open ? (
                                            <KeyboardArrowDownIcon
                                                sx={{
                                                    fontSize: 16,
                                                    color: isDark
                                                        ? "rgba(255,255,255,0.5)"
                                                        : "rgba(0,0,0,0.4)",
                                                }}
                                            />
                                        ) : (
                                            <KeyboardArrowRightIcon
                                                sx={{
                                                    fontSize: 16,
                                                    color: isDark
                                                        ? "rgba(255,255,255,0.5)"
                                                        : "rgba(0,0,0,0.4)",
                                                }}
                                            />
                                        )}
                                        <FolderOpenIcon
                                            sx={{
                                                fontSize: 16,
                                                color: isDark
                                                    ? "rgba(255,255,255,0.6)"
                                                    : "rgba(0,0,0,0.5)",
                                            }}
                                        />
                                        <Typography
                                            level="body-sm"
                                            sx={{
                                                fontWeight: 600,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                flex: 1,
                                                color: isDark
                                                    ? "rgba(255,255,255,0.85)"
                                                    : "rgba(0,0,0,0.75)",
                                            }}
                                        >
                                            {group.projectName}
                                        </Typography>
                                        <Chip
                                            color="neutral"
                                            size="sm"
                                            variant="soft"
                                            sx={{
                                                borderRadius: "4px",
                                                fontSize: 10,
                                                minHeight: 18,
                                                px: 0.5,
                                            }}
                                        >
                                            {group.tasks.length}
                                        </Chip>
                                    </ListItemButton>
                                )}
                            >
                                <List sx={{ gap: 0, pl: 2.5 }}>
                                    {group.tasks.map((task, index) => (
                                        <ListItem key={`recent-task-${task.taskId}`}>
                                            <ListItemButton
                                                sx={{
                                                    overflow: "hidden",
                                                    borderRadius: "6px",
                                                    py: 0.5,
                                                    px: 1,
                                                    gap: 0.75,
                                                    transition: "all 0.15s ease",
                                                    "&:hover": {
                                                        backgroundColor: isDark
                                                            ? "rgba(255,255,255,0.04)"
                                                            : "rgba(0,0,0,0.03)",
                                                    },
                                                }}
                                                onClick={() => {
                                                    if (group.projectId) {
                                                        usePM.setCurrentProject({
                                                            projectId: group.projectId,
                                                            projectName: group.projectName,
                                                            projectTags: [],
                                                            systemUserId: group.systemUserId,
                                                        });
                                                        useTM.setCurrentPreviewTaskId(task.taskId);
                                                        useTM.setIsTaskPreviewVisible(true);
                                                    } else {
                                                        console.error(
                                                            "Failed to set the current project"
                                                        );
                                                    }
                                                }}
                                            >
                                                <CopyableTaskIdChip
                                                    key={`task-id-chip-${task.taskId}`}
                                                    color="neutral"
                                                    task={task}
                                                    variant="outlined"
                                                    sx={{
                                                        borderRadius: "4px",
                                                        fontWeight: 600,
                                                        fontSize: 10,
                                                        minHeight: 18,
                                                        px: 0.5,
                                                    }}
                                                />
                                                <Chip
                                                    key={`status-chip-${task.taskId}-${index}`}
                                                    variant="soft"
                                                    sx={{
                                                        backgroundColor: task.status.color
                                                            ? alpha(
                                                                  task.status.color,
                                                                  isDark ? 0.4 : 0.6
                                                              )
                                                            : "transparent",
                                                        color: task.status.textColor,
                                                        fontWeight: 600,
                                                        borderRadius: "4px",
                                                        fontSize: 12,
                                                        minHeight: 18,
                                                        px: 0.5,
                                                    }}
                                                >
                                                    {task.status.status}
                                                </Chip>
                                                <Typography
                                                    level="body-sm"
                                                    sx={{
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        flex: 1,
                                                        color: isDark
                                                            ? "rgba(255,255,255,0.75)"
                                                            : "rgba(0,0,0,0.65)",
                                                    }}
                                                    noWrap
                                                >
                                                    {task.title}
                                                </Typography>
                                            </ListItemButton>
                                        </ListItem>
                                    ))}
                                </List>
                            </Toggler>
                        </ListItem>
                    ))}
                </List>
            </Toggler>
        </ListItem>
    );
};
