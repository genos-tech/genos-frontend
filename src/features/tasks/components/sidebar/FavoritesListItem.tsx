import { memo, useEffect, useMemo } from "react";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { Box, IconButton, List, ListItem } from "@mui/joy";

import { NavItem } from "../../../../components/ui/nav/NavItem";
import { navNestedListSx } from "../../../../components/ui/nav/navStyles";
import { SectionHeader } from "../../../../components/ui/nav/SectionHeader";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { StatusLabel } from "../meta/StatusLabel";
import { Toggler } from "./common";
import { openMilestoneFromSidebar } from "./openMilestone";
import type { SidebarTreePM, SidebarTreeSM, SidebarTreeTM } from "./useSidebarSlices";

// The managers arrive as slices (MIP-971), like every other part of the sidebar.
type FavoritesListItemProps = {
    usePM: SidebarTreePM;
    useTM: SidebarTreeTM;
    useSM: SidebarTreeSM;
};

/**
 * "Favorites" (MIP-1053): the milestones the user starred, above Recents, most
 * recently opened first (the order comes from the server and is kept in step
 * locally when a favorite is opened).
 *
 * A row does what clicking the milestone in its project does
 * (`openMilestoneFromSidebar`). Only favorites of a project this sidebar lists
 * are shown: the list is the user's across teams, and a project the sidebar
 * does not know cannot be switched to. The title and status prefer the live
 * milestone when its project is loaded, so a rename shows without a reload.
 */
export const FavoritesListItem = memo(function FavoritesListItem({
    usePM,
    useTM,
    useSM,
}: FavoritesListItemProps) {
    const { t } = useTranslation();

    const { teamProjects } = usePM;
    const { milestoneFavorites, projectMilestones } = useSM;

    const rows = useMemo(() => {
        const names = new Map(teamProjects.map((p) => [p.projectId, p.projectName]));
        return milestoneFavorites
            .filter((f) => names.has(f.projectId))
            .map((f) => {
                const live = projectMilestones[f.projectId]?.find(
                    (m) => m.milestoneId === f.milestoneId
                );
                return {
                    milestoneId: f.milestoneId,
                    projectId: f.projectId,
                    title: live?.title ?? f.title,
                    status: live?.status ?? f.status,
                    projectName: names.get(f.projectId) ?? f.projectName,
                };
            });
    }, [teamProjects, milestoneFavorites, projectMilestones]);

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
        <ListItem data-testid="sidebar-favorites" nested sx={{ p: 0 }}>
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
                                rootProps={{
                                    "data-testid": `favorite-milestone-${row.milestoneId}`,
                                }}
                                secondary={
                                    <Box
                                        component="span"
                                        sx={{ display: "flex", alignItems: "center", gap: 0.75 }}
                                    >
                                        <StatusLabel status={row.status} />
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
                                selected={selected}
                                // The remove star shows with the row's other actions:
                                // hover, keyboard focus, always on touch.
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
