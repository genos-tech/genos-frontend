import { useMemo, useState } from "react";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import FilterListIcon from "@mui/icons-material/FilterList";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import WorkIcon from "@mui/icons-material/Work";
import {
    Box,
    Dropdown,
    IconButton,
    List,
    ListDivider,
    ListItem,
    ListItemContent,
    Menu,
    MenuButton,
    MenuItem,
    Typography,
} from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { buildAvatarSrc } from "../../../../utils/avatarSrc";
import { ProjectIdentityRow } from "../ProjectIdentityRow";
import { Toggler } from "./common";
import { JoinProjectListItem } from "./projects_subs/JoinProjectListItem";
import { MilestonesListItem } from "./projects_subs/MilestonesListItem";
import { NewProjectListItem } from "./projects_subs/NewProjectListItem";
import { distinctProjectLabels, filterAndSortProjects } from "./projectSidebarOrder";

type ProjectsListItemProps = {
    usePM: ProjectManagementState;
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    }) => void;
    useTM: TaskManagementState;
    useSM: SprintMilestoneManagementState;
    // Forwarded so MilestonesListItem can render `AvatarWithStatus`
    // (which needs the team profile lookup, online-status presence,
    // user-profile modal hook, and the dispatch socket).
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
};

export const ProjectsListItem = (props: ProjectsListItemProps) => {
    const {
        usePM,
        setOpenJoinProject,
        useTM,
        useSM,
        useTEM,
        useCM,
        useUISM,
        myself,
        setMyself,
        socket,
    } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

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
        <ListItem nested>
            <Toggler
                key={`toggler-TeamProjects`}
                defaultExpanded={true}
                renderToggle={({ open, setOpen }) => (
                    // Header row = the section toggle + a SIBLING filter
                    // dropdown. The filter lives outside the ListItemButton
                    // (not nested) so opening it can never toggle the section
                    // — no stopPropagation juggling.
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, mb: 0.5 }}>
                        <ListItemButton
                            sx={{
                                flex: 1,
                                minWidth: 0,
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
                                <WorkIcon
                                    sx={{
                                        fontSize: 16,
                                        color: isDark
                                            ? "rgba(255,255,255,0.75)"
                                            : "rgba(0,0,0,0.65)",
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
                                        color: isDark
                                            ? "rgba(255,255,255,0.9)"
                                            : "rgba(0,0,0,0.8)",
                                    }}
                                >
                                    {t.tasks.sidebar.projects}
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
                                            sx={{ ml: 0.25, fontWeight: 700, color: "inherit" }}
                                        >
                                            {effectiveActiveIds.length}
                                        </Typography>
                                    )}
                                </MenuButton>
                            </AppTooltip>
                            <Menu
                                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                                placement="bottom-end"
                                size="sm"
                                sx={{
                                    maxHeight: 320,
                                    minWidth: 147,
                                    overflowY: "auto",
                                    borderRadius: "10px",
                                }}
                            >
                                {allLabels.length === 0 ? (
                                    <MenuItem sx={{ fontSize: "0.8rem", opacity: 0.7 }} disabled>
                                        {t.tasks.sidebar.noLabels}
                                    </MenuItem>
                                ) : (
                                    allLabels.map((label) => {
                                        const selected = effectiveActiveIds.includes(
                                            label.labelId
                                        );
                                        return (
                                            <MenuItem
                                                key={label.labelId}
                                                sx={{ gap: 1, fontSize: "0.8rem" }}
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
                                                            ? "var(--joy-palette-primary-500)"
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
                                            </MenuItem>
                                        );
                                    })
                                )}
                                {filterActive && <ListDivider />}
                                {filterActive && (
                                    <MenuItem
                                        sx={{ justifyContent: "center", fontSize: "0.8rem" }}
                                        onClick={() => setActiveLabelIds([])}
                                    >
                                        {t.tasks.sidebar.clearLabelFilter}
                                    </MenuItem>
                                )}
                            </Menu>
                        </Dropdown>
                    </Box>
                )}
            >
                <List sx={{ gap: 0.25 }}>
                    {filterActive && visibleProjects.length === 0 && (
                        <ListItem sx={{ pl: 4.5, py: 0.5 }}>
                            <Typography
                                level="body-xs"
                                sx={{
                                    fontStyle: "italic",
                                    color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                                }}
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
                            // Selected-project emphasis. Lives here, not in
                            // ProjectIdentityRow: only the sidebar has an
                            // "active project" — a dropdown option has none.
                            const accent = isSelected
                                ? isDark
                                    ? "#fb923c"
                                    : "#ea580c"
                                : undefined;
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
                                    renderToggle={({ open, setOpen }) => (
                                        <ListItemButton
                                            selected={isSelected}
                                            sx={{
                                                overflow: "hidden",
                                                borderRadius: "8px",
                                                py: 0.75,
                                                px: 1.25,
                                                ml: 4.5,
                                                gap: 1,
                                                transition: "all 0.15s ease",
                                                "&:hover": {
                                                    backgroundColor: isDark
                                                        ? "rgba(255,255,255,0.04)"
                                                        : "rgba(0,0,0,0.03)",
                                                },
                                                "&.Mui-selected": {
                                                    backgroundColor: isDark
                                                        ? "rgba(251,146,60,0.15)"
                                                        : "rgba(234,88,12,0.1)",
                                                    "&:hover": {
                                                        backgroundColor: isDark
                                                            ? "rgba(251,146,60,0.2)"
                                                            : "rgba(234,88,12,0.15)",
                                                    },
                                                },
                                            }}
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
                                        >
                                            {/* Avatar + labels + lock + name. Shared with
                                                the project pickers via
                                                `ProjectIdentityRow` so the dropdown and
                                                this row can't drift apart; the selected
                                                emphasis stays here because only the
                                                sidebar has an "active project". */}
                                            <ProjectIdentityRow
                                                avatarSrc={avatarSrc}
                                                iconColor={accent}
                                                maxLabels={1}
                                                nameColor={accent}
                                                nameWeight={isSelected ? 600 : 500}
                                                project={{
                                                    projectId,
                                                    projectName,
                                                    projectLabels,
                                                    isPrivate,
                                                    isExternal,
                                                    hostTeamName,
                                                }}
                                            />
                                            <KeyboardArrowDownIcon
                                                sx={{
                                                    fontSize: 16,
                                                    color: isDark
                                                        ? "rgba(255,255,255,0.4)"
                                                        : "rgba(0,0,0,0.35)",
                                                    transition: "transform 0.2s ease",
                                                    transform: open ? "rotate(180deg)" : "none",
                                                }}
                                            />
                                        </ListItemButton>
                                    )}
                                >
                                    <MilestonesListItem
                                        currentProjectId={projectId}
                                        myself={myself}
                                        setMyself={setMyself}
                                        socket={socket}
                                        useCM={useCM}
                                        usePM={usePM}
                                        useSM={useSM}
                                        useTEM={useTEM}
                                        useTM={useTM}
                                        useUISM={useUISM}
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
};
