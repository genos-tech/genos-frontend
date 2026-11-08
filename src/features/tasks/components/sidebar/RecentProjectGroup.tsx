import { useEffect, useState } from "react";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { Box, List, ListItem } from "@mui/joy";

import { NavItem } from "../../../../components/ui/nav/NavItem";
import { navNestedListSx } from "../../../../components/ui/nav/navStyles";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { SearchTeamTasksResponse } from "../../../../types/tasks";
import {
    nextRecentsVisible,
    RECENTS_INITIAL_VISIBLE,
    recentsVisibleToReveal,
    RecentTaskGroup,
} from "../../utils/groupRecentTasks";
import { TaskIdText } from "../card";
import { StatusLabel } from "../meta/StatusLabel";
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

    return (
        <ListItem sx={{ gap: 0, p: 0 }} nested>
            <NavItem
                as="div"
                // How many recent tasks are loaded for this project. It stops
                // at RECENTS_PER_PROJECT: a busier project shows that cap.
                count={group.tasks.length}
                expanded={open}
                icon={<FolderOpenIcon />}
                label={group.projectName}
                labelSx={{ fontWeight: 500 }}
                onClick={() => setOpen(!open)}
            />

            {/* Same grid-rows collapse as `Toggler`. */}
            <Box
                sx={{
                    display: "grid",
                    transition: "0.2s ease",
                    gridTemplateRows: open ? "1fr" : "0fr",
                    "& > *": { overflow: "hidden" },
                }}
            >
                <List sx={navNestedListSx}>
                    {open &&
                        shown.map((task) => {
                            const isSelected = task.taskId === selectedTaskId;
                            return (
                                <NavItem
                                    selected={isSelected}
                                    label={
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 0.75,
                                                minWidth: 0,
                                            }}
                                        >
                                            <TaskIdText copyable={false} task={task} />
                                            <StatusLabel iconOnly status={task.status.status} />
                                            <Box
                                                component="span"
                                                sx={{
                                                    minWidth: 0,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                }}
                                            >
                                                {task.title}
                                            </Box>
                                        </Box>
                                    }
                                    onClick={() => onOpenTask(group, task)}
                                    key={`recent-task-${task.taskId}`}
                                    // Milestone rows get the flag glyph on the far left.
                                    icon={
                                        task.isMilestone === true ? (
                                            <FlagRoundedIcon sx={{ color: g.warning.solid }} />
                                        ) : undefined
                                    }
                                />
                            );
                        })}

                    {open && hasMore && (
                        <NavItem
                            // Several folders can be open at once; the project name
                            // tells a screen reader which "More" this is.
                            aria-label={`${t.tasks.sidebar.recentsMore} (${group.projectName})`}
                            label={t.tasks.sidebar.recentsMore}
                            labelSx={{ fontWeight: 500 }}
                            onClick={() =>
                                setVisibleCount((count) =>
                                    nextRecentsVisible(count, group.tasks.length)
                                )
                            }
                        />
                    )}
                </List>
            </Box>
        </ListItem>
    );
};
