import { memo, useMemo } from "react";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { List, ListItem } from "@mui/joy";

import { navNestedListSx } from "../../../../components/ui/nav/navStyles";
import { SectionHeader } from "../../../../components/ui/nav/SectionHeader";
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
        <ListItem nested sx={{ p: 0 }}>
            <Toggler
                defaultExpanded={false}
                storageKey="recents"
                renderToggle={({ open, setOpen }) => (
                    <SectionHeader
                        as="div"
                        expanded={open}
                        icon={<AccessTimeIcon />}
                        label={t.tasks.sidebar.recents}
                        onToggleExpanded={() => setOpen(!open)}
                    />
                )}
            >
                <List sx={navNestedListSx}>
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
