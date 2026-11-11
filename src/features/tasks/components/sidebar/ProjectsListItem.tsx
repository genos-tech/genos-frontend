import { memo, useMemo, useState } from "react";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import FilterListIcon from "@mui/icons-material/FilterList";
import WorkIcon from "@mui/icons-material/Work";
import { Box, Dropdown, IconButton, List, ListItem, MenuButton, Typography } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { DataState } from "../../../../components/ui/feedback/DataState";
import { SkeletonRows } from "../../../../components/ui/feedback/Skeleton";
import { MenuDivider, MenuRow, MenuSurface } from "../../../../components/ui/MoreMenu";
import { NavItem } from "../../../../components/ui/nav/NavItem";
import { navNestedListSx } from "../../../../components/ui/nav/navStyles";
import { SectionHeader } from "../../../../components/ui/nav/SectionHeader";
import { useTranslation } from "../../../../i18n";
import { useSyncFailure } from "../../../../services/syncStatus";
import { g } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { buildAvatarSrc } from "../../../../utils/avatarSrc";
import { ProjectIdentityRow } from "../ProjectIdentityRow";
import { Toggler } from "./common";
import { JoinProjectListItem } from "./projects_subs/JoinProjectListItem";
import { MilestonesListItem } from "./projects_subs/MilestonesListItem";
import { NewProjectListItem } from "./projects_subs/NewProjectListItem";
import { distinctProjectLabels, filterAndSortProjects } from "./projectSidebarOrder";
import type {
    SidebarTreeCM,
    SidebarTreePM,
    SidebarTreeSM,
    SidebarTreeTEM,
    SidebarTreeTM,
} from "./useSidebarSlices";

// The managers arrive as slices (MIP-971): TypeScript forbids reading a member
// outside them, and `memo` skips the render of an `AppBody` pass that changed
// none of the values below. Every prop must therefore be referentially stable
// from the parent: slices from `useSidebarSlices`, `myself`, a `useState` setter.
type ProjectsListItemProps = {
    usePM: SidebarTreePM;
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    }) => void;
    useTM: SidebarTreeTM;
    useSM: SidebarTreeSM;
    // `currentTeam` (guest check) here; `teamMemberProfiles` is forwarded so
    // MilestonesListItem can resolve its assignee avatars.
    useTEM: SidebarTreeTEM;
    // Only `allChats`: the project row's avatar is its PM chat's image.
    useCM: SidebarTreeCM;
    myself: UserProps;
};

export const ProjectsListItem = memo(function ProjectsListItem(props: ProjectsListItemProps) {
    const { usePM, setOpenJoinProject, useTM, useSM, useTEM, useCM, myself } = props;
    const { t } = useTranslation();
    // The project list is read once for the whole app (cache first). When that read failed
    // and nothing is cached, "no projects" is not what happened (MIP-1308).
    const projectsSync = useSyncFailure("projects");

    // --- Project-label filter + always-on sort -------------------------
    // The label filter (by `projectLabels`, the team-catalog labels applied
    // to the PROJECT itself — NOT the per-task `projectTags`) and the sort
    // are purely presentational: they reshape the displayed list without
    // touching which projects are loaded.
    const [activeLabelIds, setActiveLabelIds] = useState<number[]>([]);

    // Only joined projects render in this section (the map used to gate on
    // `isJoined === true` inline); do it once up front so the filter/sort
    // below operate on the same set.
    const joinedProjects = useMemo(
        () => usePM.teamProjects.filter((p) => p.isJoined === true),
        [usePM.teamProjects]
    );

    // Distinct labels across the joined projects — the filter menu's options.
    const allLabels = useMemo(() => distinctProjectLabels(joinedProjects), [joinedProjects]);

    // Drop any selected id whose label no longer exists (label deleted, or
    // the last project carrying it left) so the active count stays honest
    // and a stale id can't hide every project.
    const effectiveActiveIds = useMemo(
        () => activeLabelIds.filter((id) => allLabels.some((l) => l.labelId === id)),
        [activeLabelIds, allLabels]
    );

    // Filter (OR across selected labels) then sort by label(asc), name(asc).
    const visibleProjects = useMemo(
        () => filterAndSortProjects(joinedProjects, effectiveActiveIds),
        [joinedProjects, effectiveActiveIds]
    );

    const filterActive = effectiveActiveIds.length > 0;
    const toggleLabel = (labelId: number) =>
        setActiveLabelIds((prev) =>
            prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
        );

    return (
        <ListItem sx={{ p: 0 }} nested>
            <Toggler
                key={`toggler-TeamProjects`}
                defaultExpanded={true}
                storageKey="projects"
                renderToggle={({ open, setOpen }) => (
                    // Header row = the section toggle + a SIBLING filter
                    // dropdown (the header's `actions` slot is beside the toggle,
                    // not inside it). Opening the filter can never toggle the
                    // section, with no stopPropagation juggling.
                    <SectionHeader
                        as="div"
                        expanded={open}
                        icon={<WorkIcon />}
                        label={t.tasks.sidebar.projects}
                        actions={
                            <>
                                {/* Filter projects by label. A Joy Dropdown (NOT a
                            Material Menu — that crashes under the Joy theme)
                            so clickaway + Escape close it for free; MenuItem
                            selection closes it too (per user: it should close
                            on select). Multi-label OR-filtering still works
                            cumulatively across reopens. */}
                                <Dropdown>
                                    <AppTooltip title={t.tasks.sidebar.filterByLabel}>
                                        <MenuButton
                                            slots={{ root: IconButton }}
                                            slotProps={{
                                                root: {
                                                    size: "sm",
                                                    variant: filterActive ? "soft" : "plain",
                                                    color: filterActive ? "primary" : "neutral",
                                                    sx: {
                                                        "--IconButton-size": "30px",
                                                        borderRadius: "6px",
                                                        px: filterActive ? 0.5 : 0,
                                                        flexShrink: 0,
                                                    },
                                                },
                                            }}
                                        >
                                            <FilterListIcon sx={{ fontSize: 16 }} />
                                            {filterActive && (
                                                <Typography
                                                    level="body-xs"
                                                    sx={{
                                                        ml: 0.25,
                                                        fontWeight: 700,
                                                        color: "inherit",
                                                    }}
                                                >
                                                    {effectiveActiveIds.length}
                                                </Typography>
                                            )}
                                        </MenuButton>
                                    </AppTooltip>
                                    <MenuSurface
                                        placement="bottom-end"
                                        sx={{ maxHeight: 320, minWidth: 147 }}
                                    >
                                        {allLabels.length === 0 ? (
                                            <MenuRow disabled>{t.tasks.sidebar.noLabels}</MenuRow>
                                        ) : (
                                            allLabels.map((label) => {
                                                const selected = effectiveActiveIds.includes(
                                                    label.labelId
                                                );
                                                return (
                                                    <MenuRow
                                                        key={label.labelId}
                                                        mark="none"
                                                        selected={selected}
                                                        onClick={() => toggleLabel(label.labelId)}
                                                    >
                                                        <CheckRoundedIcon
                                                            sx={{
                                                                fontSize: 16,
                                                                flexShrink: 0,
                                                                // Always visible; faint
                                                                // when unselected so the
                                                                // toggle affordance reads.
                                                                opacity: selected ? 1 : 0.25,
                                                                color: selected
                                                                    ? g.accent.text
                                                                    : "inherit",
                                                            }}
                                                        />
                                                        <Box
                                                            sx={{
                                                                px: 0.75,
                                                                py: 0.15,
                                                                borderRadius: "5px",
                                                                backgroundColor: label.color,
                                                                color: label.textColor,
                                                                fontWeight: 600,
                                                                fontSize: "0.7rem",
                                                                maxWidth: 110,
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                                whiteSpace: "nowrap",
                                                            }}
                                                        >
                                                            {label.name}
                                                        </Box>
                                                    </MenuRow>
                                                );
                                            })
                                        )}
                                        {filterActive && <MenuDivider />}
                                        {filterActive && (
                                            <MenuRow
                                                sx={{ justifyContent: "center" }}
                                                onClick={() => setActiveLabelIds([])}
                                            >
                                                {t.tasks.sidebar.clearLabelFilter}
                                            </MenuRow>
                                        )}
                                    </MenuSurface>
                                </Dropdown>
                            </>
                        }
                        onToggleExpanded={() => setOpen(!open)}
                    />
                )}
            >
                <List sx={navNestedListSx}>
                    {joinedProjects.length === 0 && projectsSync.failed && (
                        <ListItem sx={{ px: 1, py: 0.5 }}>
                            <DataState
                                error
                                hasData={false}
                                loading={projectsSync.retrying}
                                size="xs"
                                skeleton={<SkeletonRows count={3} />}
                                errorState={{
                                    title: t.common.feedback.sync.projectsFailed,
                                    onRetry: projectsSync.retry,
                                    "data-error": "sidebar-projects",
                                }}
                            />
                        </ListItem>
                    )}
                    {filterActive && visibleProjects.length === 0 && (
                        <ListItem sx={{ px: 1, py: 0.5 }}>
                            <Typography
                                level="body-xs"
                                sx={{ fontStyle: "italic", color: g.text.tertiary }}
                            >
                                {t.tasks.sidebar.noProjectsMatchFilter}
                            </Typography>
                        </ListItem>
                    )}
                    {visibleProjects.map(
                        ({
                            projectId,
                            projectName,
                            projectTags,
                            projectLabels,
                            isPrivate,
                            systemUserId,
                            isExternal,
                            hostTeamName,
                        }) => {
                            const isSelected = projectId === usePM.currentProject?.projectId;
                            // Resolve this project's PM chat (chatType 3) so we
                            // can show its uploaded avatar image. Same canonical
                            // lookup TaskHeader / HistoryModal use. When the PM
                            // chat isn't hydrated or has no image, `buildAvatarSrc`
                            // returns undefined and the <Avatar> falls back to the
                            // AssignmentIcon child — i.e. the prior look.
                            const pmChat = useCM.allChats.find(
                                (chat) =>
                                    chat.chatType === 3 && chat.project?.projectId === projectId
                            );
                            const avatarSrc = buildAvatarSrc(pmChat?.profileImagePath);
                            return (
                                <Toggler
                                    key={`toggler-TeamProjects-${projectId}`}
                                    defaultExpanded={false}
                                    storageKey={`project:${projectId}`}
                                    renderToggle={({ open, setOpen }) => (
                                        <NavItem
                                            expanded={open}
                                            selected={isSelected}
                                            // Avatar + labels + lock + name. Shared with
                                            // the project pickers via `ProjectIdentityRow`
                                            // so the dropdown and this row can't drift
                                            // apart.
                                            label={
                                                // The identity row is a fragment laid out by its parent
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 1,
                                                        minWidth: 0,
                                                    }}
                                                >
                                                    <ProjectIdentityRow
                                                        avatarSrc={avatarSrc}
                                                        maxLabels={1}
                                                        nameColor="inherit"
                                                        nameWeight={isSelected ? 500 : 400}
                                                        iconColor={
                                                            isSelected ? g.accent.text : undefined
                                                        }
                                                        project={{
                                                            projectId,
                                                            projectName,
                                                            projectLabels,
                                                            isPrivate,
                                                            isExternal,
                                                            hostTeamName,
                                                        }}
                                                    />
                                                </Box>
                                            }
                                            onClick={() => {
                                                setOpen(!open);
                                                // Only if the clicked project id is not the same as the current one,
                                                // reset the project (and load tasks in the downstream step.)
                                                if (
                                                    projectId !== usePM.currentProject?.projectId
                                                ) {
                                                    // Close any task/milestone preview from the
                                                    // previous project so we never carry stale
                                                    // ids across project boundaries.
                                                    useTM.closeTaskPreview();
                                                    useTM.setTableMilestoneFilter(null);
                                                    // Switch out of the global "Home" dashboard
                                                    // view when a specific project is opened.
                                                    // Without this, clicking a project from the
                                                    // Home view would leave the dashboard flag
                                                    // on, and on mobile the dashboard would
                                                    // remain showing instead of the project's
                                                    // task list.
                                                    useTM.setIsTaskDashboardVisible(false);
                                                    useTM.setIsTaskTableVisible(true);
                                                    // The project is the open one in this very
                                                    // click, and its rows are refreshed from the
                                                    // server in the background. The table swaps
                                                    // to the project's remembered rows (or to
                                                    // none) in the same render, so the previous
                                                    // project's rows never show under this one
                                                    // (see useTaskManagement). This used to
                                                    // await `loadProjectsAndTasks`: the whole
                                                    // project list first, then the tasks, then
                                                    // set the project: two round trips in series
                                                    // before anything changed, plus an IndexedDB
                                                    // pre-read of its own.
                                                    usePM.openProject({
                                                        projectId: projectId,
                                                        projectName: projectName,
                                                        projectTags: projectTags,
                                                        projectLabels: projectLabels,
                                                        isPrivate: isPrivate,
                                                        systemUserId: systemUserId,
                                                        isExternal: isExternal,
                                                        hostTeamName: hostTeamName,
                                                    });
                                                }
                                            }}
                                        />
                                    )}
                                >
                                    <MilestonesListItem
                                        currentProjectId={projectId}
                                        myself={myself}
                                        usePM={usePM}
                                        useSM={useSM}
                                        useTEM={useTEM}
                                        useTM={useTM}
                                    />
                                </Toggler>
                            );
                        }
                    )}

                    {/* Both are member-only on the server: creating a project
                        in someone else's team, and joining one by id, are
                        refused for a guest. A guest is here to work in the one
                        project that was shared with their team, so offering
                        either can only produce an error. */}
                    {!useTEM.currentTeam.isGuest && (
                        <>
                            <JoinProjectListItem
                                setOpenJoinProject={setOpenJoinProject}
                                usePM={usePM}
                            />

                            <NewProjectListItem usePM={usePM} />
                        </>
                    )}
                </List>
            </Toggler>
        </ListItem>
    );
});
