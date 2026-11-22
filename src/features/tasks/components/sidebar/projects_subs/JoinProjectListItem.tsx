import { useMemo, useState } from "react";
import LoginIcon from "@mui/icons-material/Login";
import { Box, Input, List, ListItem, Typography } from "@mui/joy";

import { NavItem } from "../../../../../components/ui/nav/NavItem";
import { navNestedListSx } from "../../../../../components/ui/nav/navStyles";
import type { ProjectManagementState } from "../../../../../hooks/common/useProjectManagement";
import { useTranslation } from "../../../../../i18n";
import { useSyncFailure } from "../../../../../services/syncStatus";
import { g } from "../../../../../theme/tokens";
import { ProjectIdentityRow } from "../../ProjectIdentityRow";
import { Toggler } from "../common";
import { distinctProjectLabels, filterAndSortProjects } from "../projectSidebarOrder";
import { ProjectLabelFilterMenu } from "./ProjectLabelFilterMenu";

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

    const unjoined = useMemo(
        () => usePM.teamProjects.filter((project) => project.isJoined === false),
        [usePM.teamProjects]
    );

    // Same grouping as the joined list (MIP-1700): the label filter and the
    // label-then-name sort come from the shared helpers, and the rows carry
    // their label chips. The name search narrows on top of that.
    const [activeLabelIds, setActiveLabelIds] = useState<number[]>([]);
    const [query, setQuery] = useState("");
    const allLabels = useMemo(() => distinctProjectLabels(unjoined), [unjoined]);
    // Drop a selected label that no longer exists on any unjoined project, so a
    // stale id cannot hide every row.
    const effectiveActiveIds = useMemo(
        () => activeLabelIds.filter((id) => allLabels.some((l) => l.labelId === id)),
        [activeLabelIds, allLabels]
    );
    const trimmedQuery = query.trim().toLocaleLowerCase();
    const visibleProjects = useMemo(() => {
        const grouped = filterAndSortProjects(unjoined, effectiveActiveIds);
        if (trimmedQuery === "") return grouped;
        return grouped.filter((p) =>
            (p.projectName ?? "").toLocaleLowerCase().includes(trimmedQuery)
        );
    }, [unjoined, effectiveActiveIds, trimmedQuery]);
    const filterActive = effectiveActiveIds.length > 0 || trimmedQuery !== "";
    const toggleLabel = (labelId: number) =>
        setActiveLabelIds((prev) =>
            prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
        );

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
                    as="div"
                    expanded={open}
                    icon={<LoginIcon />}
                    label={t.tasks.sidebar.joinProject}
                    onClick={() => {
                        setOpen(!open);
                    }}
                />
            )}
            asListItem
        >
            <List sx={navNestedListSx}>
                {unjoined.length > 0 && (
                    <ListItem sx={{ px: 1, py: 0.5, gap: 0.5 }}>
                        <Input
                            autoComplete="off"
                            name="joinProjectFilter"
                            placeholder={t.tasks.sidebar.filterProjectsPlaceholder}
                            size="sm"
                            spellCheck={false}
                            sx={{ flex: 1, minWidth: 0 }}
                            type="search"
                            value={query}
                            slotProps={{
                                input: {
                                    "aria-label": t.tasks.sidebar.filterProjectsPlaceholder,
                                },
                            }}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        <ProjectLabelFilterMenu
                            activeIds={effectiveActiveIds}
                            labels={allLabels}
                            onClear={() => setActiveLabelIds([])}
                            onToggle={toggleLabel}
                        />
                    </ListItem>
                )}
                {visibleProjects.map((project) => {
                    const { projectId, projectName, isPrivate, systemUserId } = project;
                    return (
                        <NavItem
                            key={`listitem-team-project-${projectId}`}
                            selected={projectId === usePM.currentProject?.projectId}
                            label={
                                // The joined list lays its identity row out in a flex box
                                // (ProjectsListItem); without it the chip stacks above the name.
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        minWidth: 0,
                                    }}
                                >
                                    <ProjectIdentityRow
                                        maxLabels={1}
                                        nameColor="inherit"
                                        nameWeight={400}
                                        project={project}
                                    />
                                </Box>
                            }
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
                    );
                })}

                {unjoined.length === 0 && !listUnread && (
                    <ListItem sx={{ px: 1, py: 0.5 }}>
                        <Typography level="body-sm" sx={{ color: g.text.tertiary }} noWrap>
                            {t.tasks.sidebar.noProjectsAvailable}
                        </Typography>
                    </ListItem>
                )}
                {unjoined.length > 0 && filterActive && visibleProjects.length === 0 && (
                    <ListItem sx={{ px: 1, py: 0.5 }}>
                        <Typography
                            level="body-xs"
                            sx={{ fontStyle: "italic", color: g.text.tertiary }}
                        >
                            {t.tasks.sidebar.noProjectsMatchFilter}
                        </Typography>
                    </ListItem>
                )}
            </List>
        </Toggler>
    );
};
