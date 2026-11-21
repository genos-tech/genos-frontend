import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import { List } from "@mui/joy";

import { NavItem } from "../../../../../components/ui/nav/NavItem";
import { navNestedListSx } from "../../../../../components/ui/nav/navStyles";
import type { ProjectManagementState } from "../../../../../hooks/common/useProjectManagement";
import { useTranslation } from "../../../../../i18n";
import { useArchiveState } from "../../../../archive/archiveState";
import { Toggler } from "../common";

type ArchivedProjectsListItemProps = {
    // Only the open project and the way to open one (MIP-971): the sidebar's slice satisfies it.
    usePM: Pick<ProjectManagementState, "currentProject" | "openProject">;
};

/**
 * The archived projects, under the list and collapsed by default (MIP-1693). Nothing is shown
 * until someone opens the section, so the default sidebar is the same as before. An archived
 * project opens read-only.
 */
export const ArchivedProjectsListItem = ({ usePM }: ArchivedProjectsListItemProps) => {
    const { t } = useTranslation();
    const { archivedProjects } = useArchiveState();

    if (archivedProjects.length === 0) return null;

    return (
        <Toggler
            key="toggler-ArchivedProjects"
            defaultExpanded={false}
            storageKey="archived-projects"
            renderToggle={({ open, setOpen }) => (
                <NavItem
                    expanded={open}
                    icon={<ArchiveOutlinedIcon />}
                    label={`${t.common.archive.archivedSection} (${archivedProjects.length})`}
                    onClick={() => {
                        setOpen(!open);
                    }}
                />
            )}
        >
            <List sx={navNestedListSx}>
                {archivedProjects.map((project) => (
                    <NavItem
                        key={`listitem-archived-project-${project.projectId}`}
                        label={project.projectName}
                        selected={project.projectId === usePM.currentProject?.projectId}
                        onClick={() => usePM.openProject(project)}
                    />
                ))}
            </List>
        </Toggler>
    );
};
