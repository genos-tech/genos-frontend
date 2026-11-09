import { memo, useEffect, useMemo } from "react";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { Box, IconButton, List, ListItem } from "@mui/joy";

import { NavItem } from "../../../../components/ui/nav/NavItem";
import { navNestedListSx } from "../../../../components/ui/nav/navStyles";
import { SectionHeader } from "../../../../components/ui/nav/SectionHeader";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { projectAvatarSrcMap } from "../../utils/projectAvatar";
import { parseServerTime } from "../../utils/relativeAge";
import { StatusLabel } from "../meta/StatusLabel";
import { ProjectAvatar } from "../ProjectIdentityRow";
import { Toggler } from "./common";
import { openMilestoneFromSidebar } from "./openMilestone";
import type {
    SidebarTreeCM,
    SidebarTreePM,
    SidebarTreeSM,
    SidebarTreeTM,
} from "./useSidebarSlices";

// The managers arrive as slices (MIP-971), like every other part of the sidebar.
type FavoritesListItemProps = {
    /** Only for the project avatars: a project's image is its PM chat's. */
    useCM: SidebarTreeCM;
    usePM: SidebarTreePM;
    useTM: SidebarTreeTM;
    useSM: SidebarTreeSM;
};

/**
 * "Favorites" (MIP-1053): the milestones the user starred, above Recents, the one
 * with the most recent PROGRESS first (MIP-1352): `lastProgressAt`, when it or
 * anything under it last changed, so the milestones that are moving are at the top.
 * The live milestone's value wins over the one the favorites list was read with
 * when it is newer, so a milestone moves up as its project reloads. A milestone with
 * none recorded goes after those that have, and ties keep the order the server gave
 * (most recently opened first). Opening one still records the open, but no longer
 * lifts it.
 *
 * Each row carries its project's image (the project's PM chat avatar, or the generic
 * project icon), so a milestone can be told apart by project at a glance.
 *
 * A row does what clicking the milestone in its project does
 * (`openMilestoneFromSidebar`). Only favorites of a project this sidebar lists
 * are shown: the list is the user's across teams, and a project the sidebar
 * does not know cannot be switched to. The title and status prefer the live
 * milestone when its project is loaded, so a rename shows without a reload.
 */
export const FavoritesListItem = memo(function FavoritesListItem({
    useCM,
    usePM,
    useTM,
    useSM,
}: FavoritesListItemProps) {
    const { t } = useTranslation();

    const { teamProjects } = usePM;
    const { milestoneFavorites, projectMilestones } = useSM;

    const { allChats } = useCM;
    const avatarByProject = useMemo(() => projectAvatarSrcMap(allChats), [allChats]);

    const rows = useMemo(() => {
        const names = new Map(teamProjects.map((p) => [p.projectId, p.projectName]));
        return milestoneFavorites
            .filter((f) => names.has(f.projectId))
            .map((f, index) => {
                const live = projectMilestones[f.projectId]?.find(
                    (m) => m.milestoneId === f.milestoneId
                );
                // Whichever is newer: the list's value, or the live milestone's.
                const progressAt = Math.max(
                    parseServerTime(f.lastProgressAt) ?? -Infinity,
                    parseServerTime(live?.lastProgressAt) ?? -Infinity
                );
                return {
                    index,
                    progressAt,
                    milestoneId: f.milestoneId,
                    projectId: f.projectId,
                    title: live?.title ?? f.title,
                    status: live?.status ?? f.status,
                    projectName: names.get(f.projectId) ?? f.projectName,
                    avatarSrc: avatarByProject.get(f.projectId),
                };
            })
            .sort(
                // Newest progress first; none recorded (-Infinity) last; the server's
                // order for ties (`index`), so the sort is stable by construction.
                (a, b) =>
                    a.progressAt === b.progressAt
                        ? a.index - b.index
                        : a.progressAt > b.progressAt
                          ? -1
                          : 1
            );
    }, [teamProjects, milestoneFavorites, projectMilestones, avatarByProject]);

    // Opening a favorite by ANY route (a link, the board, a chip) moves it to
    // the top, not just a click here. Keyed on the open milestone only: the
    // list changing under an unchanged preview must not re-bump it.
    const { currentPreviewKind, currentPreviewMilestoneId } = useTM;
    const { noteMilestoneOpened } = useSM;
    useEffect(() => {
        if (currentPreviewKind === "milestone" && currentPreviewMilestoneId > 0) {
            noteMilestoneOpened(currentPreviewMilestoneId);
        }
    }, [currentPreviewKind, currentPreviewMilestoneId, noteMilestoneOpened]);

    if (rows.length === 0) return null;

    return (
        <ListItem data-testid="sidebar-favorites" sx={{ p: 0 }} nested>
            <Toggler
                storageKey="favorites"
                renderToggle={({ open, setOpen }) => (
                    <SectionHeader
                        as="div"
                        expanded={open}
                        icon={<StarRoundedIcon sx={{ color: g.warning.solid }} />}
                        label={t.tasks.sidebar.favorites}
                        onToggleExpanded={() => setOpen(!open)}
                    />
                )}
                defaultExpanded
            >
                <List sx={{ ...navNestedListSx, "--List-gap": "0px" }}>
                    {rows.map((row) => {
                        const selected =
                            currentPreviewKind === "milestone" &&
                            currentPreviewMilestoneId === row.milestoneId;
                        return (
                            <NavItem
                                key={row.milestoneId}
                                icon={<FlagRoundedIcon sx={{ color: g.warning.solid }} />}
                                label={row.title}
                                lines={2}
                                actions={
                                    <IconButton
                                        aria-label={`${t.tasks.sidebar.removeFromFavorites}: ${row.title}`}
                                        color="neutral"
                                        size="sm"
                                        title={t.tasks.sidebar.removeFromFavorites}
                                        variant="plain"
                                        onClick={() =>
                                            void useSM.toggleMilestoneFavorite({
                                                milestoneId: row.milestoneId,
                                                title: row.title,
                                                projectId: row.projectId,
                                                status: row.status,
                                            })
                                        }
                                    >
                                        <StarRoundedIcon
                                            sx={{ fontSize: 16, color: g.warning.solid }}
                                        />
                                    </IconButton>
                                }
                                rootProps={{
                                    "data-testid": `favorite-milestone-${row.milestoneId}`,
                                }}
                                selected={selected}
                                // The remove star shows with the row's other actions:
                                // hover, keyboard focus, always on touch.
                                secondary={
                                    <Box
                                        component="span"
                                        sx={{ display: "flex", alignItems: "center", gap: 0.75 }}
                                    >
                                        <StatusLabel status={row.status} iconOnly />
                                        <Box
                                            component="span"
                                            data-testid={`favorite-project-icon-${row.milestoneId}`}
                                            sx={{ display: "flex", flexShrink: 0 }}
                                        >
                                            <ProjectAvatar avatarSrc={row.avatarSrc} />
                                        </Box>
                                        <Box
                                            component="span"
                                            sx={{
                                                minWidth: 0,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            }}
                                        >
                                            {row.projectName}
                                        </Box>
                                    </Box>
                                }
                                onClick={() =>
                                    openMilestoneFromSidebar(
                                        { usePM, useTM },
                                        row.milestoneId,
                                        row.projectId
                                    )
                                }
                            />
                        );
                    })}
                </List>
            </Toggler>
        </ListItem>
    );
});
