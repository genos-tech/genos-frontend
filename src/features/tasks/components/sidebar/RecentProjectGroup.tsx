import { useEffect, useState } from "react";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import { Box, Chip, List, ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { useTranslation } from "../../../../i18n";
import { SearchTeamTasksResponse } from "../../../../types/tasks";
import {
    nextRecentsVisible,
    RECENTS_INITIAL_VISIBLE,
    recentsVisibleToReveal,
    RecentTaskGroup,
} from "../../utils/groupRecentTasks";
import { taskMetaLabel } from "../../utils/taskMeta";
import { CopyableTaskIdChip } from "../CopyableTaskId";
import { useSidebarOpen } from "./useSidebarOpen";

type RecentProjectGroupProps = {
    group: RecentTaskGroup;
    /** `useTM.currentPreviewTaskId`; -1 when nothing is open. */
    selectedTaskId: number;
    onOpenTask: (group: RecentTaskGroup, task: SearchTeamTasksResponse) => void;
};

/**
 * One project's folder under the sidebar's Recents.
 *
 * Starts closed and shows `RECENTS_INITIAL_VISIBLE` tasks once opened; the
 * "More" row reveals the rest of what is already loaded, a page at a time.
 *
 * This owns its open state instead of using `Toggler` because the folder must
 * also open on its own when the task the user has open lives in it, and
 * `Toggler` reads `defaultExpanded` only on mount. Its rows are not mounted
 * while the folder is closed, so a closed folder costs one header row and its
 * tasks are not reachable by Tab.
 */
export const RecentProjectGroup = ({
    group,
    selectedTaskId,
    onOpenTask,
}: RecentProjectGroupProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

    // The user's choice is remembered on this device (MIP-1055). The reveal below
    // is NOT part of it: opening the folder of the task they have open is
    // passing, and saving it would reopen the folder on every later visit.
    const [chosenOpen, setChosenOpen] = useSidebarOpen(`recents:${group.projectId}`, false);
    const [revealed, setRevealed] = useState(false);
    const open = chosenOpen || revealed;
    const setOpen = (next: boolean) => {
        setChosenOpen(next);
        // Closing wins over a reveal that happened earlier.
        if (!next) setRevealed(false);
    };
    const [visibleCount, setVisibleCount] = useState(RECENTS_INITIAL_VISIBLE);

    const selectedIndex =
        selectedTaskId === -1
            ? -1
            : group.tasks.findIndex((task) => task.taskId === selectedTaskId);
    const hasSelected = selectedIndex >= 0;

    // Sticky auto-reveal, the same rule as the notes sidebar's
    // `GroupedNoteSection`: when the open task is in this folder, open the
    // folder and widen it to include that row. It fires when the selection
    // moves into this folder (a task opened from the table, a link or a
    // search) or the row first arrives (Recents reloads after the selection
    // changes, so the task is often not in the list on the first render).
    //
    // Only ever opens, and is keyed on the id rather than the row's index: the
    // list reloads after a save and the open task floats to the top, which
    // must not re-open a folder the user has just closed.
    useEffect(() => {
        if (!hasSelected) return;
        setRevealed(true);
        setVisibleCount((count) => recentsVisibleToReveal(count, selectedIndex));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasSelected, selectedTaskId]);

    const shown = group.tasks.slice(0, visibleCount);
    const hasMore = group.tasks.length > visibleCount;
    const chevronColor = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)";

    return (
        <ListItem sx={{ gap: 0 }} nested>
            <ListItemButton
                aria-expanded={open}
                sx={{
                    borderRadius: "8px",
                    py: 0.75,
                    px: 1,
                    gap: 1,
                    transition: "all 0.15s ease",
                    "&:hover": {
                        backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                    },
                }}
                onClick={() => setOpen(!open)}
            >
                {open ? (
                    <KeyboardArrowDownIcon sx={{ fontSize: 16, color: chevronColor }} />
                ) : (
                    <KeyboardArrowRightIcon sx={{ fontSize: 16, color: chevronColor }} />
                )}
                <FolderOpenIcon
                    sx={{
                        fontSize: 16,
                        color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
                    }}
                />
                <Typography
                    level="body-sm"
                    sx={{
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                        color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)",
                    }}
                >
                    {group.projectName}
                </Typography>
                {/* How many recent tasks are loaded for this project. It stops
                    at RECENTS_PER_PROJECT: a busier project shows that cap. */}
                <Chip
                    color="neutral"
                    size="sm"
                    variant="soft"
                    sx={{
                        borderRadius: "4px",
                        fontSize: 10,
                        minHeight: 18,
                        px: 0.5,
                    }}
                >
                    {group.tasks.length}
                </Chip>
            </ListItemButton>

            {/* Same grid-rows collapse as `Toggler`. */}
            <Box
                sx={{
                    display: "grid",
                    transition: "0.2s ease",
                    gridTemplateRows: open ? "1fr" : "0fr",
                    "& > *": { overflow: "hidden" },
                }}
            >
                <List sx={{ gap: 0, pl: 2.5 }}>
                    {open &&
                        shown.map((task, index) => {
                            const isSelected = task.taskId === selectedTaskId;
                            return (
                                <ListItem key={`recent-task-${task.taskId}`}>
                                    <ListItemButton
                                        aria-current={isSelected ? "true" : undefined}
                                        selected={isSelected}
                                        sx={{
                                            overflow: "hidden",
                                            borderRadius: "6px",
                                            py: 0.5,
                                            px: 1,
                                            gap: 0.75,
                                            transition: "all 0.15s ease",
                                            "&:hover": {
                                                backgroundColor: isDark
                                                    ? "rgba(255,255,255,0.04)"
                                                    : "rgba(0,0,0,0.03)",
                                            },
                                            // Same tint as the selected project row.
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
                                        onClick={() => onOpenTask(group, task)}
                                    >
                                        {/* Milestone rows get the flag
                                            glyph on the far left — same
                                            orange as the header's "New
                                            Milestone" menu item. */}
                                        {task.isMilestone === true && (
                                            <FlagRoundedIcon
                                                sx={{
                                                    color: "#f97316",
                                                    flexShrink: 0,
                                                    fontSize: 14,
                                                }}
                                            />
                                        )}
                                        <CopyableTaskIdChip
                                            key={`task-id-chip-${task.taskId}`}
                                            color="neutral"
                                            task={task}
                                            variant="outlined"
                                            sx={{
                                                borderRadius: "4px",
                                                fontWeight: 600,
                                                fontSize: 10,
                                                minHeight: 18,
                                                px: 0.5,
                                            }}
                                        />
                                        <Chip
                                            key={`status-chip-${task.taskId}-${index}`}
                                            variant="soft"
                                            sx={{
                                                backgroundColor: task.status.color
                                                    ? alpha(task.status.color, isDark ? 0.4 : 0.6)
                                                    : "transparent",
                                                color: task.status.textColor,
                                                fontWeight: 600,
                                                borderRadius: "4px",
                                                fontSize: 12,
                                                minHeight: 18,
                                                px: 0.5,
                                            }}
                                        >
                                            {taskMetaLabel(task.status.status, t.tasks.filters)}
                                        </Chip>
                                        <Typography
                                            level="body-sm"
                                            sx={{
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                flex: 1,
                                                color: isDark
                                                    ? "rgba(255,255,255,0.75)"
                                                    : "rgba(0,0,0,0.65)",
                                            }}
                                            noWrap
                                        >
                                            {task.title}
                                        </Typography>
                                    </ListItemButton>
                                </ListItem>
                            );
                        })}

                    {open && hasMore && (
                        <ListItem>
                            <ListItemButton
                                // Several folders can be open at once; the
                                // project name tells a screen reader which
                                // "More" this is.
                                aria-label={`${t.tasks.sidebar.recentsMore} (${group.projectName})`}
                                sx={{
                                    borderRadius: "6px",
                                    py: 0.5,
                                    px: 1,
                                    gap: 0.75,
                                    transition: "all 0.15s ease",
                                    "&:hover": {
                                        backgroundColor: isDark
                                            ? "rgba(255,255,255,0.04)"
                                            : "rgba(0,0,0,0.03)",
                                    },
                                }}
                                onClick={() =>
                                    setVisibleCount((count) =>
                                        nextRecentsVisible(count, group.tasks.length)
                                    )
                                }
                            >
                                <ListItemContent>
                                    <Typography
                                        level="body-xs"
                                        sx={{
                                            fontWeight: 600,
                                            color: isDark
                                                ? "rgba(255,255,255,0.55)"
                                                : "rgba(0,0,0,0.5)",
                                        }}
                                    >
                                        {t.tasks.sidebar.recentsMore}
                                    </Typography>
                                </ListItemContent>
                            </ListItemButton>
                        </ListItem>
                    )}
                </List>
            </Box>
        </ListItem>
    );
};
