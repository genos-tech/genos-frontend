import LockOutlineIcon from "@mui/icons-material/LockOutline";
import LoginIcon from "@mui/icons-material/Login";
import { List, ListItem, Typography } from "@mui/joy";

import { NavItem } from "../../../../../components/ui/nav/NavItem";
import { navNestedListSx } from "../../../../../components/ui/nav/navStyles";
import type { ProjectManagementState } from "../../../../../hooks/common/useProjectManagement";
import { useTranslation } from "../../../../../i18n";
import { useSyncFailure } from "../../../../../services/syncStatus";
import { g } from "../../../../../theme/tokens";
import { Toggler } from "../common";

type JoinProjectListItemProps = {
    // Only the list and the open project (MIP-971): the sidebar's slice satisfies it.
    usePM: Pick<ProjectManagementState, "teamProjects" | "currentProject">;
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    }) => void;
};
export const JoinProjectListItem = (props: JoinProjectListItemProps) => {
    const { usePM, setOpenJoinProject } = props;
    const { t } = useTranslation();

    const unjoined = usePM.teamProjects.filter((project) => project.isJoined === false);
    // The project list was never read: "No projects available" would be a claim nothing
    // checked. The Projects section above already says "Couldn't load your projects" with
    // Retry, so this one says nothing (MIP-1323).
    const projectsSync = useSyncFailure("projects");
    const listUnread = projectsSync.failed && usePM.teamProjects.length === 0;

    return (
        <Toggler
            key="toggler-OtherProjects"
            defaultExpanded={false}
            storageKey="join-project"
            renderToggle={({ open, setOpen }) => (
                <NavItem
                    expanded={open}
                    icon={<LoginIcon />}
                    label={t.tasks.sidebar.joinProject}
                    onClick={() => {
                        setOpen(!open);
                    }}
                />
            )}
        >
            <List sx={navNestedListSx}>
                {unjoined.map(({ projectId, projectName, isPrivate, systemUserId }, index) => (
                    <NavItem
                        key={`listitem-team-project-${projectId}-${index}`}
                        icon={isPrivate ? <LockOutlineIcon /> : undefined}
                        label={projectName}
                        selected={projectId === usePM.currentProject?.projectId}
                        onClick={() => {
                            setOpenJoinProject({
                                flag: true,
                                projectId: projectId,
                                projectName: projectName,
                                isPrivate: isPrivate !== undefined ? isPrivate : true,
                                systemUserId: systemUserId || "",
                            });
                        }}
                    />
                ))}

                {unjoined.length === 0 && !listUnread && (
                    <ListItem sx={{ px: 1, py: 0.5 }}>
                        <Typography level="body-sm" sx={{ color: g.text.tertiary }} noWrap>
                            {t.tasks.sidebar.noProjectsAvailable}
                        </Typography>
                    </ListItem>
                )}
            </List>
        </Toggler>
    );
};
