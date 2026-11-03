import { memo, useMemo } from "react";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { Box, List, ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation } from "../../../../i18n";
import { SearchTeamTasksResponse } from "../../../../types/tasks";
import { groupRecentTasks, RecentTaskGroup } from "../../utils/groupRecentTasks";
import { Toggler } from "./common";
import { RecentProjectGroup } from "./RecentProjectGroup";
import type { SidebarRecentsPM, SidebarRecentsTM } from "./useSidebarSlices";

// The managers arrive as slices (MIP-971): this list needs the open task id (for
// the highlight) and three setters, nothing else.
type RecentsListItemProps = {
    recentTasks: SearchTeamTasksResponse[];
    usePM: SidebarRecentsPM;
    useTM: SidebarRecentsTM;
};

export const RecentsListItem = memo(function RecentsListItem(props: RecentsListItemProps) {
    const { recentTasks, usePM, useTM } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

    // Group by projectId (NOT name: same-named projects must not merge).
    const groupedTasks = useMemo(() => groupRecentTasks(recentTasks), [recentTasks]);

    const openTask = (group: RecentTaskGroup, task: SearchTeamTasksResponse) => {
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
            console.error("Failed to set the current project");
        }
    };

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
                        <RecentProjectGroup
                            key={`project-group-${group.projectId}`}
                            group={group}
                            selectedTaskId={useTM.currentPreviewTaskId}
                            onOpenTask={openTask}
                        />
                    ))}
                </List>
            </Toggler>
        </ListItem>
    );
});
