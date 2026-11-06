import { memo, useEffect, useMemo } from "react";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { Box, Chip, IconButton, List, ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation } from "../../../../i18n";
import { getMilestoneStatusChipColor } from "../../sprint-milestone/utils/sortMilestones";
import { taskMetaLabel } from "../../utils/taskMeta";
import { Toggler } from "./common";
import { openMilestoneFromSidebar } from "./openMilestone";
import { FAVORITE_COLOR } from "./projects_subs/MilestoneFolderMenus";
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
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
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
        <ListItem data-testid="sidebar-favorites" nested>
            <Toggler
                storageKey="favorites"
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
                        onClick={() => setOpen(!open)}
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
                            }}
                        >
                            <StarRoundedIcon sx={{ fontSize: 16, color: FAVORITE_COLOR }} />
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
                                {t.tasks.sidebar.favorites}
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
                defaultExpanded
            >
                <List sx={{ gap: 0.5, pl: 1 }}>
                    {rows.map((row) => {
                        const tone = getMilestoneStatusChipColor(row.status);
                        const selected =
                            currentPreviewKind === "milestone" &&
                            currentPreviewMilestoneId === row.milestoneId;
                        return (
                            <ListItem
                                key={row.milestoneId}
                                data-testid={`favorite-milestone-${row.milestoneId}`}
                                endAction={
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
                                            sx={{ fontSize: 16, color: FAVORITE_COLOR }}
                                        />
                                    </IconButton>
                                }
                                sx={{
                                    pl: 0,
                                    // The remove star shows with the row's other actions:
                                    // hover, keyboard focus, always on touch.
                                    "& > .MuiListItem-endAction": { pointerEvents: "none" },
                                    "& > .MuiListItem-endAction button": {
                                        opacity: 0,
                                        pointerEvents: "none",
                                        transition: "opacity 0.12s",
                                    },
                                    "&:hover > .MuiListItem-endAction button, & > .Mui-focusVisible ~ .MuiListItem-endAction button, & > .MuiListItem-endAction button:focus-visible":
                                        { opacity: 1, pointerEvents: "auto" },
                                    "@media (hover: none)": {
                                        "& > .MuiListItem-endAction button": {
                                            opacity: 1,
                                            pointerEvents: "auto",
                                        },
                                    },
                                }}
                            >
                                <ListItemButton
                                    selected={selected}
                                    sx={{ borderRadius: 8, py: 0.5, gap: 0.75 }}
                                    onClick={() =>
                                        openMilestoneFromSidebar(
                                            { usePM, useTM },
                                            row.milestoneId,
                                            row.projectId
                                        )
                                    }
                                >
                                    <FlagRoundedIcon sx={{ fontSize: 14, color: "#f97316" }} />
                                    <ListItemContent sx={{ minWidth: 0 }}>
                                        <Typography
                                            level="body-sm"
                                            sx={{
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                color: isDark
                                                    ? "rgba(255,255,255,0.85)"
                                                    : "rgba(0,0,0,0.8)",
                                            }}
                                        >
                                            {row.title}
                                        </Typography>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 0.5,
                                                minWidth: 0,
                                                mt: 0.25,
                                            }}
                                        >
                                            <Chip
                                                size="sm"
                                                variant="solid"
                                                sx={{
                                                    backgroundColor: tone.color,
                                                    color: tone.textColor,
                                                    fontWeight: 600,
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {taskMetaLabel(row.status, t.tasks.filters)}
                                            </Chip>
                                            <Typography
                                                level="body-xs"
                                                sx={{
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                    color: isDark
                                                        ? "rgba(255,255,255,0.5)"
                                                        : "rgba(0,0,0,0.5)",
                                                }}
                                            >
                                                {row.projectName}
                                            </Typography>
                                        </Box>
                                    </ListItemContent>
                                </ListItemButton>
                            </ListItem>
                        );
                    })}
                </List>
            </Toggler>
        </ListItem>
    );
});
