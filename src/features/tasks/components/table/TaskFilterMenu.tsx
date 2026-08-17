import * as React from "react";
import { useEffect, useMemo } from "react";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import DirectionsRunRoundedIcon from "@mui/icons-material/DirectionsRunRounded";
import FilterListIcon from "@mui/icons-material/FilterList";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { useColorScheme } from "@mui/joy/styles";
import { Avatar, Box, Chip, Stack, Typography } from "@mui/material";
import Button from "@mui/material/Button";
import Fade from "@mui/material/Fade";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { alpha } from "@mui/system";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { TaskFilterMenuStyles } from "../../../../components/ui/styles/commonStyle";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { TaskTableProps } from "../../../../types/tasks";
import { buildAvatarSrc } from "../../../../utils/avatarSrc";
import { SavedFilterPayload } from "../../services/projectSavedFilters";
import { Milestone, Sprint } from "../../sprint-milestone/types";
import {
    getMilestoneStatusChipColor,
    getOutdatedMilestoneIds,
    groupMilestonesByYearAndSprint,
    selectEndedSprints,
    selectOutdatedMilestones,
    selectVisibleMilestones,
    selectVisibleSprints,
} from "../../sprint-milestone/utils/sortMilestones";
import {
    FilterProps,
    predefinedEffortLevelFilters,
    predefinedPriorityFilters,
    predefinedStatusFilters,
    taskTypes,
} from "../../types/TaskTableTypes";
import {
    selectMilestoneRowsForSelection,
    selectMilestonesWithMatchingChildren,
} from "../../utils/milestoneChildFilter";
import {
    buildSavedFilterPayload,
    resolveSavedFilter,
    savedFilterMatchesSelection,
} from "../../utils/savedFilterPayload";
import {
    remapTagSelection,
    sameTagSelection,
    tagSelectionDefault,
} from "../../utils/tagFilterSelection";
import {
    clearStoredFilters,
    readStoredFilters,
    rehydrateFilters,
    rehydrateKeys,
    StoredTaskFilters,
    writeStoredFilters,
} from "../../utils/taskFilterStorage";
import { taskMetaLabel } from "../../utils/taskMeta";
import { SavedFiltersMenu } from "./SavedFiltersMenu";

// Default status selection = the "ongoing" statuses (Open, WIP, Blocked,
// Pending) — everything except Closed / Expired / Deleted. Derived by label
// from the canonical `taskTypes.ongoing` set rather than a positional
// `predefinedStatusFilters.slice(1, 4)`: that slice silently dropped Pending
// when "Blocked" was inserted into the status list, so the default must not
// depend on ordering.
const defaultStatusFilters: FilterProps[] = predefinedStatusFilters.filter((f) =>
    taskTypes.ongoing.statuses.includes(f.label)
);

// Sentinels used by the milestone filter alongside numeric milestone
// ids. Mirrors the `NO_MILESTONE` pattern in `SprintMilestonePicker`
// so unattached tasks (`task.milestoneId == null`) can be filtered for
// or against explicitly.
type MilestoneFilterKey = "all" | "none" | number;
const MILESTONE_ALL: MilestoneFilterKey = "all";
const MILESTONE_NONE: MilestoneFilterKey = "none";
// Accent colour echoes the sidebar's `FlagRoundedIcon` and the
// existing milestone-scope chip so the new filter visually belongs to
// the same family.
const MILESTONE_ACCENT_DARK = "#fb923c";
const MILESTONE_ACCENT_LIGHT = "#c2410c";
const MILESTONE_ACCENT_BG_DARK = "rgba(249,115,22,0.35)";
const MILESTONE_ACCENT_BG_LIGHT = "rgba(249,115,22,0.6)";

// Sprint filter sentinels — same `all` / `none` / numeric-id shape as the
// milestone filter, one level up the hierarchy (a sprint contains
// milestones). `none` means "not assigned to any sprint", which is a real
// and common state, not an error.
type SprintFilterKey = "all" | "none" | number;
const SPRINT_ALL: SprintFilterKey = "all";
const SPRINT_NONE: SprintFilterKey = "none";
// Sky, echoing the `DirectionsRunRoundedIcon` sprint rows in the milestone
// dropdown's past-sprint folders. Deliberately NOT the milestone orange:
// the two filters sit side by side and mean different things, so the chips
// have to be separable at a glance.
const SPRINT_ACCENT_DARK = "#38bdf8";
const SPRINT_ACCENT_LIGHT = "#0369a1";
const SPRINT_ACCENT_BG_DARK = "rgba(14,165,233,0.35)";
const SPRINT_ACCENT_BG_LIGHT = "rgba(14,165,233,0.6)";

// Member filter sentinels — mirror the milestone `all`/`none` pattern.
// Distinct `__…__` strings so they can never collide with a real userId.
type MemberFilterKey = string; // a userId, or one of the sentinels below
const MEMBER_ALL = "__all__";
const MEMBER_NONE = "__none__";
const MEMBER_ACCENT_DARK = "#818cf8";
const MEMBER_ACCENT_LIGHT = "#4f46e5";

/**
 * The bar's whole selection, in one object.
 *
 * `applyFilters` and `persistFilters` used to take these as positional
 * parameters — six of them, threaded through 17 call sites. Sprint made
 * that untenable rather than merely ugly: `sprintKeys` and `milestoneKeys`
 * have the SAME type (`(string | number)[]`), so a transposed pair would
 * have compiled cleanly and silently filtered by the wrong dimension. Named
 * fields make that unrepresentable, and every call site now reads as
 * "the current selection, except this one dimension":
 *
 *     applyFilters({ ...selection, status: newStatuses });
 */
type FilterSelection = {
    status: FilterProps[];
    tags: FilterProps[];
    priorities: FilterProps[];
    effortLevels: FilterProps[];
    sprintKeys: SprintFilterKey[];
    milestoneKeys: MilestoneFilterKey[];
    memberKeys: MemberFilterKey[];
};

type TaskFilterMenuProps = {
    useTM: TaskManagementState;
    // Optional: when provided, the filter bar exposes a Milestone
    // multi-select drawn from the same visible/sorted set as the
    // sidebar's `MilestonesListItem`. Left optional so the legacy
    // `ProjectTaskTable` call site can keep working without it.
    useSM?: SprintMilestoneManagementState;
    predefinedTagsFilters: FilterProps[];
    setCurrentDisplayingTasks: (tasks: TaskTableProps[]) => void;
    // Optional: receives the set of child task ids that pass the
    // active status / tags / priority / effort / milestone selection,
    // so the consuming table can filter expanded child rows the same
    // way as the top-level list. The "All → root-only" short-circuits
    // used for the top-level set are intentionally skipped here —
    // those exist to keep the top-level row count manageable when no
    // specific filter is selected, which doesn't apply to children
    // shown beneath an already-expanded parent.
    setVisibleChildTaskIds?: (ids: Set<string>) => void;
    // Optional: receives `true` whenever the user has narrowed the
    // milestone multi-select to a specific milestone (anything other
    // than the "All" sentinel) and `false` when it goes back to "All".
    // The board uses this to hide its "Show child tasks" toggle when
    // a milestone is already in scope (children are already showing).
    setIsMilestoneFilterActive?: (active: boolean) => void;
    // Optional: the team's members, source for the Member multi-select.
    // When omitted (or empty) the Member filter is not rendered — the
    // legacy `ProjectTaskTable` call site doesn't pass it.
    teamMembers?: UserProps[];
    // Optional: receives `true` whenever the Member multi-select is narrowed
    // to specific members (anything other than the "All" sentinel). The task
    // table uses this to splice in the (dimmed, non-interactive) ancestor
    // rows of a matching subtask so the dependency tree stays visible; the
    // board ignores it (it renders the matches flat).
    setIsMemberFilterActive?: (active: boolean) => void;
    hideStatusFilter?: boolean;
    // Optional: when provided, renders a "customize columns" gear icon
    // inline with the "Filters" label that opens the column-settings
    // modal. The task table passes this; the sprint board (which shares
    // this menu but has no columns to configure) omits it, so the
    // gear stays hidden there.
    onOpenColumnSettings?: () => void;
    // Optional: when set, the filter selection is persisted under this
    // localStorage key and restored on mount. `TaskHomeLayout` mounts the
    // table and the board conditionally, so without this every trip via
    // the dashboard resets the bar to its defaults. Omitted by the legacy
    // `ProjectTaskTable` call site, which then keeps the old
    // reset-on-mount behaviour.
    filterStorageKey?: string;
    // Optional: backing-task ids of milestones that have at least one
    // matching direct child. The task table force-expands these so the
    // matching task renders instead of hiding behind a chevron. Empty
    // when no filter is narrowing. Omitted by the sprint board, which is
    // flat and has nothing to expand.
    setMilestoneAutoExpandIds?: (ids: Set<string>) => void;
    // Optional: the CURRENT project and team. When both are given, the
    // bar renders the "Saved Filters" control (named, project-shared
    // filter selections).
    //
    // Passed explicitly rather than derived from `useTM.allTasks[0]
    // ?.projectId` — that heuristic is fine for the milestone dropdown
    // (which has nothing to show in an empty project anyway) but is null
    // in a project with zero tasks, and CRUD can't hang off a value that
    // disappears when the filter empties the list. Also not parsed back
    // out of `filterStorageKey`, which is a storage detail.
    savedFiltersProjectId?: number | null;
    savedFiltersTeamId?: string | null;
};

export const TaskFilterMenu = (props: TaskFilterMenuProps) => {
    const {
        useTM,
        useSM,
        predefinedTagsFilters,
        setCurrentDisplayingTasks,
        setVisibleChildTaskIds,
        setIsMilestoneFilterActive,
        teamMembers,
        setIsMemberFilterActive,
        hideStatusFilter,
        onOpenColumnSettings,
        filterStorageKey,
        setMilestoneAutoExpandIds,
        savedFiltersProjectId,
        savedFiltersTeamId,
    } = props;

    // Selection restored from localStorage for the CURRENT key. Read
    // eagerly on the first render so the lazy `useState` initializers
    // below paint the restored selection immediately rather than
    // flashing the defaults for a frame.
    //
    // The key is per-project, so it changes when the user switches
    // projects — the effect further down re-reads and re-applies for the
    // new project. This ref only ever holds the mount-time snapshot.
    const storedFiltersRef = React.useRef<Partial<StoredTaskFilters> | null>(null);
    if (storedFiltersRef.current === null) {
        storedFiltersRef.current = filterStorageKey
            ? (readStoredFilters(filterStorageKey) ?? {})
            : {};
    }
    const stored = storedFiltersRef.current ?? {};

    // Persist the selection the user just chose.
    //
    // Called ONLY from the `handleClose*` handlers and `resetFilters` —
    // i.e. explicit user intent. A blanket effect over the selection
    // state would fire during mount while the async dimensions (tags)
    // are still at their defaults, writing "All" over the stored tag
    // selection before the restore below ever gets to read it.
    const persistFilters = (sel: FilterSelection) => {
        if (!filterStorageKey) return;
        writeStoredFilters(filterStorageKey, {
            effortLevels: sel.effortLevels.map((f) => f.label),
            memberKeys: sel.memberKeys,
            milestoneKeys: sel.milestoneKeys,
            priorities: sel.priorities.map((f) => f.label),
            sprintKeys: sel.sprintKeys,
            status: sel.status.map((f) => f.label),
            tags: sel.tags.map((f) => f.label),
        });
    };
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? TaskFilterMenuStyles.dark : TaskFilterMenuStyles.light;
    const { t } = useTranslation();
    // Resolve a `FilterProps` to its localized display string. Ad-hoc
    // filters (e.g. project tags) carry no `labelKey` and fall back to
    // their user-supplied `label`.
    const filterLabel = (f: FilterProps): string =>
        f.labelKey ? t.tasks.filters[f.labelKey] : f.label;

    // Status filter — when status filter is hidden (e.g. sprint board), default to "All"
    // Restored from storage where available. The board passes no storage
    // key for status (it hides the filter and pins it to "All"), so this
    // falls through to the default there.
    const [selectedStatus, setSelectedStatus] = React.useState<FilterProps[]>(() =>
        hideStatusFilter
            ? [predefinedStatusFilters[0]]
            : rehydrateFilters(stored.status, predefinedStatusFilters, defaultStatusFilters)
    );
    const [anchorElStatusFilter, setAnchorElStatusFilter] = React.useState<null | HTMLElement>(
        null
    );
    const openStatusFilter = Boolean(anchorElStatusFilter);
    const handleClickStatusFilter = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorElStatusFilter(event.currentTarget);
    };
    const handleCloseStatusFilter = (status: FilterProps) => {
        let newStatuses: FilterProps[];
        if (status.label === "All") {
            // If the status is "All", set it to "All". Remove all other statuses.
            newStatuses = [predefinedStatusFilters[0]];
            setSelectedStatus(newStatuses);
            setAnchorElStatusFilter(null);
        } else if (selectedStatus.some((items) => items.label === status.label) === true) {
            // If the status is already selected, remove it
            newStatuses = selectedStatus.filter((item) => item.label != status.label);
            setSelectedStatus(newStatuses);
        } else {
            // If the status is not selected, add it. Remove "All" if it exists.
            newStatuses = [...selectedStatus.filter((item) => item.label != "All"), status];
            setSelectedStatus(newStatuses);
        }

        // If no status is selected, set it to "All"
        if (newStatuses.length === 0) {
            newStatuses = [predefinedStatusFilters[0]];
            setSelectedStatus(newStatuses);
            setAnchorElStatusFilter(null);
        }

        applyFilters({ ...selection, status: newStatuses });
        persistFilters({ ...selection, status: newStatuses });
    };

    // Tags filter
    const [selectedTags, setSelectedTags] = React.useState<FilterProps[]>(
        tagSelectionDefault(predefinedTagsFilters)
    );
    const [anchorElTagsFilter, setAnchorElTagsFilter] = React.useState<null | HTMLElement>(null);
    const openTagsFilter = Boolean(anchorElTagsFilter);
    const handleClickTagsFilter = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorElTagsFilter(event.currentTarget);
    };
    const handleCloseTagsFilter = (tag: FilterProps) => {
        let newTags: FilterProps[];
        if (tag.label === "All") {
            // If the tag is "All", set it to "All". Remove all other tags.
            newTags = tagSelectionDefault(predefinedTagsFilters);
            setSelectedTags(newTags);
            setAnchorElTagsFilter(null);
        } else if (selectedTags.some((items) => items.label === tag.label) === true) {
            // If the tag is already selected, remove it
            newTags = selectedTags.filter((item) => item.label != tag.label);
            setSelectedTags(newTags);
        } else {
            // If the tag is not selected, add it. Remove "All" if it exists.
            newTags = [...selectedTags.filter((item) => item.label != "All"), tag];
            setSelectedTags(newTags);
        }

        if (newTags.length === 0) {
            newTags = tagSelectionDefault(predefinedTagsFilters);
            setSelectedTags(newTags);
            setAnchorElTagsFilter(null);
        }

        applyFilters({ ...selection, tags: newTags });
        persistFilters({ ...selection, tags: newTags });
    };

    // Tags are the one dimension whose options arrive asynchronously AND
    // whose effect force-resets the selection, so it can't be restored by
    // a lazy initializer — it would be overwritten the moment the project
    // tags load. (It also means the selection was being dropped without a
    // remount whenever `currentProject`'s identity churned.)
    //
    // Tracked BY KEY rather than as a one-shot boolean: the key carries
    // the project id, so a project switch makes this effect restore that
    // project's tags instead of resetting to "All". It's also
    // order-independent — whichever of this effect and the project-switch
    // effect below runs first, the mismatch is what triggers the restore,
    // so neither can leave the other holding a stale selection.
    const restoredTagsForKeyRef = React.useRef<string | undefined | null>(null);
    React.useEffect(() => {
        if (predefinedTagsFilters.length === 0) {
            // Either the tags haven't loaded yet, or the project's last tag was
            // just deleted — newly reachable now that deletes propagate. A
            // leftover selection in that second case is unclearable: the
            // dropdown it would be deselected from has no rows left. Drop it,
            // and forget the restore marker so the next list to arrive (another
            // project's, or a tag recreated here) is restored from storage
            // rather than inheriting this cleared state.
            if (selectedTags.length > 0) {
                restoredTagsForKeyRef.current = null;
                const cleared = tagSelectionDefault(predefinedTagsFilters);
                setSelectedTags(cleared);
                applyFilters({ ...selection, tags: cleared });
                persistFilters({ ...selection, tags: cleared });
            }
            return;
        }

        if (restoredTagsForKeyRef.current !== filterStorageKey) {
            restoredTagsForKeyRef.current = filterStorageKey;
            const storedForKey = filterStorageKey ? readStoredFilters(filterStorageKey) : null;
            const restored = rehydrateFilters(
                storedForKey?.tags,
                predefinedTagsFilters,
                tagSelectionDefault(predefinedTagsFilters)
            );
            setSelectedTags(restored);
            // The reactive `applyFilters` effect below doesn't watch
            // `selectedTags`, so a restore that changes the selection has
            // to re-run the pipeline itself or the table would show
            // unfiltered rows under a filtered-looking chip.
            if (restored[0]?.label !== predefinedTagsFilters[0].label) {
                applyFilters({ ...selection, tags: restored });
            }
            return;
        }

        // Same key, new options — the project's tag list was refetched after a
        // tag was created, renamed or deleted (`useTM.tagsRevision`). This used
        // to blanket-reset to "All", which was invisible while the list only
        // ever loaded once per project but would now silently discard the user's
        // active tag filter every time any tag was edited.
        //
        // Remap by label instead — see `remapTagSelection`.
        const remapped = remapTagSelection(selectedTags, predefinedTagsFilters);
        setSelectedTags(remapped);

        // Only when the selection's MEANING changed — a pure colour/identity
        // refresh must not churn the table or rewrite storage. Same reasoning as
        // the restore branch: `selectedTags` isn't in the reactive effect's
        // deps, so a pruned selection has to re-run the pipeline itself.
        if (!sameTagSelection(remapped, selectedTags)) {
            applyFilters({ ...selection, tags: remapped });
            // Persist too, so a deleted tag's label stops living in storage.
            // Left behind, recreating a tag with the same name later would
            // silently re-apply a filter the user never asked for.
            persistFilters({ ...selection, tags: remapped });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [predefinedTagsFilters, filterStorageKey]);

    // Project switch: re-restore the dimensions that a lazy initializer
    // only covered at mount. `TaskFilterMenu` stays mounted across a
    // project change, so without this the previous project's status /
    // priority / effort / sprint / milestone / member selection would linger —
    // and worse, the next `persistFilters` would write it under the NEW
    // project's key.
    //
    // Skips its own first run: the lazy initializers already restored
    // this key, and re-applying would fire a redundant `applyFilters`
    // before the task list has even loaded.
    const restoredKeyRef = React.useRef<string | undefined | null>(filterStorageKey);
    React.useEffect(() => {
        if (restoredKeyRef.current === filterStorageKey) return;
        restoredKeyRef.current = filterStorageKey;

        const next = filterStorageKey ? readStoredFilters(filterStorageKey) : null;
        const nextStatus = hideStatusFilter
            ? [predefinedStatusFilters[0]]
            : rehydrateFilters(next?.status, predefinedStatusFilters, defaultStatusFilters);
        const nextPriorities = rehydrateFilters(next?.priorities, predefinedPriorityFilters, [
            predefinedPriorityFilters[0],
        ]);
        const nextEffort = rehydrateFilters(next?.effortLevels, predefinedEffortLevelFilters, [
            predefinedEffortLevelFilters[0],
        ]);
        const nextSprints = (rehydrateKeys(next?.sprintKeys) as SprintFilterKey[] | null) ?? [
            SPRINT_ALL,
        ];
        const nextMilestones = (rehydrateKeys(next?.milestoneKeys) as
            | MilestoneFilterKey[]
            | null) ?? [MILESTONE_ALL];
        const nextMembers = (rehydrateKeys(next?.memberKeys) as MemberFilterKey[] | null) ?? [
            MEMBER_ALL,
        ];

        setSelectedStatus(nextStatus);
        setSelectedPriorities(nextPriorities);
        setSelectedEffortLevels(nextEffort);
        setSelectedSprintKeys(nextSprints);
        setSelectedMilestoneKeys(nextMilestones);
        setSelectedMemberKeys(nextMembers);
        // Tags are restored by the effect above (their options load
        // asynchronously), which is keyed on the same storage key.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterStorageKey]);

    // Priority filter
    const [selectedPriorities, setSelectedPriorities] = React.useState<FilterProps[]>(() =>
        rehydrateFilters(stored.priorities, predefinedPriorityFilters, [
            predefinedPriorityFilters[0],
        ])
    );
    const [anchorElPriorityFilter, setAnchorElPriorityFilter] = React.useState<null | HTMLElement>(
        null
    );
    const openPriorityFilter = Boolean(anchorElPriorityFilter);
    const handleClickPriorityFilter = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorElPriorityFilter(event.currentTarget);
    };
    const handleClosePriorityFilter = (priority: FilterProps) => {
        let newPriorities: FilterProps[];
        if (priority.label === "All") {
            // If the priority is "All", set it to "All". Remove all other priorities.
            newPriorities = [predefinedPriorityFilters[0]];
            setSelectedPriorities(newPriorities);
            setAnchorElPriorityFilter(null);
        } else if (selectedPriorities.some((items) => items.label === priority.label) === true) {
            // If the priority is already selected, remove it
            newPriorities = selectedPriorities.filter((item) => item.label != priority.label);
            setSelectedPriorities(newPriorities);
        } else {
            // If the priority is not selected, add it. Remove "All" if it exists.
            newPriorities = [
                ...selectedPriorities.filter((item) => item.label != "All"),
                priority,
            ];
            setSelectedPriorities(newPriorities);
        }

        if (newPriorities.length === 0) {
            newPriorities = [predefinedPriorityFilters[0]];
            setSelectedPriorities(newPriorities);
            setAnchorElPriorityFilter(null);
        }

        applyFilters({ ...selection, priorities: newPriorities });
        persistFilters({ ...selection, priorities: newPriorities });
    };

    // Effort level filter
    const [selectedEffortLevels, setSelectedEffortLevels] = React.useState<FilterProps[]>(() =>
        rehydrateFilters(stored.effortLevels, predefinedEffortLevelFilters, [
            predefinedEffortLevelFilters[0],
        ])
    );
    const [anchorElEffortLevelFilter, setAnchorElEffortLevelFilter] =
        React.useState<null | HTMLElement>(null);
    const openEffortLevelFilter = Boolean(anchorElEffortLevelFilter);
    const handleClickEffortLevelFilter = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorElEffortLevelFilter(event.currentTarget);
    };
    const handleCloseEffortLevelFilter = (effortLevel: FilterProps) => {
        let newEffortLevels: FilterProps[];
        if (effortLevel.label === "All") {
            // If the effort level is "All", set it to "All". Remove all other effort levels.
            newEffortLevels = [predefinedEffortLevelFilters[0]];
            setSelectedEffortLevels(newEffortLevels);
            setAnchorElEffortLevelFilter(null);
        } else if (
            selectedEffortLevels.some((items) => items.label === effortLevel.label) === true
        ) {
            // If the effort level is already selected, remove it
            newEffortLevels = selectedEffortLevels.filter(
                (item) => item.label != effortLevel.label
            );
            setSelectedEffortLevels(newEffortLevels);
        } else {
            // If the effort level is not selected, add it. Remove "All" if it exists.
            newEffortLevels = [
                ...selectedEffortLevels.filter((item) => item.label != "All"),
                effortLevel,
            ];
            setSelectedEffortLevels(newEffortLevels);
        }

        if (newEffortLevels.length === 0) {
            newEffortLevels = [predefinedEffortLevelFilters[0]];
            setSelectedEffortLevels(newEffortLevels);
            setAnchorElEffortLevelFilter(null);
        }

        applyFilters({ ...selection, effortLevels: newEffortLevels });
        persistFilters({ ...selection, effortLevels: newEffortLevels });
    };

    // Shared by the Sprint and Milestone filters below.
    const currentProjectId = useTM.allTasks[0]?.projectId ?? null;
    const projectSprints = useMemo(() => {
        if (!useSM || currentProjectId == null) return [];
        return useSM.projectSprints[currentProjectId] ?? [];
    }, [useSM, currentProjectId]);

    // ---- Sprint filter -----------------------------------------------
    //
    // Multi-select over the project's sprints, sitting one level above the
    // milestone filter in the same hierarchy (sprint → milestone → task).
    //
    // It reads `task.sprintId` directly, which is safe because the server
    // keeps that column as a roll-up of the task's milestone: it cascades
    // `milestone.sprint_id` onto the backing row, every task in the
    // milestone, and their sub-tasks at any depth, and clears it when the
    // milestone link goes away. So `task.sprintId != null` iff
    // `task.milestoneId != null`, and the sprint column in the table
    // (`DraggableTaskRow`) already reads it the same way — no
    // `milestoneId → milestone.sprintId` hop is needed here.
    //
    // The corollary is worth knowing before picking "No sprint": because
    // sprint membership comes entirely from the milestone, "no sprint"
    // means "in no milestone" — i.e. the whole unscheduled backlog, not a
    // small leftover set.
    const visibleSprints = useMemo(() => selectVisibleSprints(projectSprints), [projectSprints]);
    // Ended (completed / archived) sprints, newest first. Hidden behind an
    // expander rather than listed inline: sprints auto-roll, so a
    // long-running project accumulates them without limit and the two or
    // three live ones would be buried. Unlike past MILESTONES, past sprints
    // don't hide their tasks — only a Closed milestone in an ended sprint
    // does that (`outdatedMilestoneIds`) — so selecting one needs no
    // un-hiding counterpart in `applyFilters`.
    const pastSprints = useMemo(() => selectEndedSprints(projectSprints), [projectSprints]);
    const [pastSprintsExpanded, setPastSprintsExpanded] = React.useState(false);
    const [selectedSprintKeys, setSelectedSprintKeys] = React.useState<SprintFilterKey[]>(
        () => (rehydrateKeys(stored.sprintKeys) as SprintFilterKey[] | null) ?? [SPRINT_ALL]
    );
    const [anchorElSprintFilter, setAnchorElSprintFilter] = React.useState<null | HTMLElement>(
        null
    );
    const openSprintFilter = Boolean(anchorElSprintFilter);
    const handleClickSprintFilter = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorElSprintFilter(event.currentTarget);
    };
    // Drop a selected sprint id that the live set no longer has (other
    // project, deleted sprint) so we never filter by a stale id and show an
    // empty table forever. Same shape as the milestone and member prunes.
    useEffect(() => {
        if (selectedSprintKeys.length === 1 && selectedSprintKeys[0] === SPRINT_ALL) return;
        // Valid = ongoing OR ended sprints; a selected past sprint has to
        // survive the prune, else it'd be dropped the instant it's picked.
        const validIds = new Set<number>(
            [...visibleSprints, ...pastSprints].map((s) => s.sprintId)
        );
        const pruned = selectedSprintKeys.filter(
            (k) => k === SPRINT_NONE || (typeof k === "number" && validIds.has(k))
        );
        if (pruned.length === selectedSprintKeys.length) return;
        setSelectedSprintKeys(pruned.length > 0 ? pruned : [SPRINT_ALL]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleSprints, pastSprints, currentProjectId]);
    const handleCloseSprintFilter = (key: SprintFilterKey) => {
        let next: SprintFilterKey[];
        if (key === SPRINT_ALL) {
            next = [SPRINT_ALL];
            setSelectedSprintKeys(next);
            setAnchorElSprintFilter(null);
        } else if (selectedSprintKeys.some((k) => k === key)) {
            next = selectedSprintKeys.filter((k) => k !== key);
            setSelectedSprintKeys(next);
        } else {
            next = [...selectedSprintKeys.filter((k) => k !== SPRINT_ALL), key];
            setSelectedSprintKeys(next);
        }

        if (next.length === 0) {
            next = [SPRINT_ALL];
            setSelectedSprintKeys(next);
            setAnchorElSprintFilter(null);
        }

        applyFilters({ ...selection, sprintKeys: next });
        persistFilters({ ...selection, sprintKeys: next });
    };

    const sprintNameOf = (sprintId: number): string =>
        [...visibleSprints, ...pastSprints].find((s) => s.sprintId === sprintId)?.name ??
        `#${sprintId}`;

    // "Nothing narrowed" — drives the button's neutral vs accented look and
    // its label. Named once rather than repeated inline the way the milestone
    // button repeats its own version of this check.
    const sprintFilterIsAll =
        selectedSprintKeys.length === 1 && selectedSprintKeys[0] === SPRINT_ALL;

    const sprintFilterButtonLabel = useMemo(() => {
        if (sprintFilterIsAll) return t.tasks.sprintFilter.all;
        const first = selectedSprintKeys[0];
        if (first === SPRINT_NONE) return t.tasks.sprintFilter.noSprint;
        if (typeof first === "number") {
            const name = sprintNameOf(first);
            return name.length > 16 ? `${name.slice(0, 16)}…` : name;
        }
        return t.tasks.sprintFilter.all;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSprintKeys, visibleSprints, pastSprints, t]);

    // One selectable sprint row in the dropdown. Shared by the ongoing list
    // and the past-sprints expander; the status chip is what tells an
    // "Active" sprint apart from an "Upcoming" one, which matters because
    // both are listed together.
    const renderSprintMenuItem = (s: Sprint) => {
        const isSelected = selectedSprintKeys.some((k) => k === s.sprintId);
        // Reuses the sprint manager's own status wording rather than adding
        // a fourth copy of "Active" / "Completed" to the locale files.
        const statusLabel = t.tasks.sprint.status[s.status] ?? s.status;
        return (
            <MenuItem
                key={`sprint-${s.sprintId}`}
                sx={{
                    borderRadius: "8px",
                    mx: 0.5,
                    my: 0.25,
                    pl: 2,
                    transition: "all 0.2s ease",
                    "&:hover": { background: styles.buttonHoverBg },
                }}
                onClick={() => handleCloseSprintFilter(s.sprintId)}
            >
                <Box sx={{ width: "100%", display: "flex", alignItems: "center", gap: 1 }}>
                    <DirectionsRunRoundedIcon
                        sx={{
                            fontSize: 14,
                            color: isDark ? SPRINT_ACCENT_DARK : SPRINT_ACCENT_LIGHT,
                            flexShrink: 0,
                        }}
                    />
                    <Typography
                        sx={{
                            fontSize: "13px",
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected
                                ? isDark
                                    ? SPRINT_ACCENT_DARK
                                    : SPRINT_ACCENT_LIGHT
                                : styles.textColor,
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {s.name}
                    </Typography>
                    <Chip
                        label={statusLabel}
                        size="small"
                        sx={{
                            height: 16,
                            fontSize: "9px",
                            fontWeight: 700,
                            background: styles.buttonHoverBg,
                            color: styles.mutedText,
                            flexShrink: 0,
                            "& .MuiChip-label": { px: 0.75, lineHeight: 1 },
                        }}
                    />
                    {isSelected && (
                        <Box
                            sx={{
                                width: 16,
                                height: 16,
                                borderRadius: "4px",
                                background: isDark ? SPRINT_ACCENT_DARK : SPRINT_ACCENT_LIGHT,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "10px",
                                color: "#fff",
                                fontWeight: 700,
                                flexShrink: 0,
                            }}
                        >
                            ✓
                        </Box>
                    )}
                </Box>
            </MenuItem>
        );
    };

    // Milestone filter — pulls from the same visible/sorted milestone
    // set the sidebar shows in `MilestonesListItem` so the user can
    // narrow the table to one or more milestones (or explicitly the
    // unattached ones via the "No milestone" sentinel).
    const visibleMilestones = useMemo(() => {
        if (!useSM || currentProjectId == null) return [];
        return selectVisibleMilestones(
            useSM.projectMilestones[currentProjectId] ?? [],
            useSM.projectSprints[currentProjectId] ?? []
        );
    }, [useSM, currentProjectId]);

    // Outdated (Closed + ended-sprint) milestone ids for THIS project. Their
    // milestones and tasks are dropped from the board/table (and the member
    // filter) — reachable only via the sidebar's "Past milestones" folder,
    // which scopes to one through `tableMilestoneFilterId`. Keyed on the
    // actual milestone/sprint state (not the whole churning `useSM`) so the
    // Set identity is stable between real data changes.
    const outdatedMilestoneIds = useMemo(() => {
        if (!useSM || currentProjectId == null) return new Set<number>();
        return getOutdatedMilestoneIds(
            useSM.projectMilestones[currentProjectId] ?? [],
            useSM.projectSprints[currentProjectId] ?? []
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useSM?.projectMilestones, useSM?.projectSprints, currentProjectId]);
    // Stable primitive for the applyFilters effect deps — re-runs the filter
    // only when the outdated SET actually changes, never per render.
    const outdatedMilestoneKey = useMemo(
        () => [...outdatedMilestoneIds].sort((a, b) => a - b).join(","),
        [outdatedMilestoneIds]
    );
    // Past (Closed + ended-sprint) milestones. NOT listed in the dropdown by
    // default — revealed by the "Show past milestones" expander inside it (a
    // "load more"). Selecting one filters to it AND un-hides it in
    // `applyFilters` (its tasks are otherwise dropped by the outdated-hide),
    // showing its full history.
    const pastMilestones = useMemo(() => {
        if (!useSM || currentProjectId == null) return [];
        return selectOutdatedMilestones(
            useSM.projectMilestones[currentProjectId] ?? [],
            useSM.projectSprints[currentProjectId] ?? []
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useSM?.projectMilestones, useSM?.projectSprints, currentProjectId]);
    // Same past milestones as a year → sprint tree, so the expander reveals
    // `<year>/<sprint>/<milestone>` folders instead of a flat list. Display
    // only — all filter/scope logic still reads the flat `pastMilestones`.
    const pastMilestonesByYear = useMemo(() => {
        if (!useSM || currentProjectId == null) return [];
        return groupMilestonesByYearAndSprint(
            pastMilestones,
            useSM.projectSprints[currentProjectId] ?? []
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pastMilestones, useSM?.projectSprints, currentProjectId]);
    const [pastMilestonesExpanded, setPastMilestonesExpanded] = React.useState(false);
    // Which year / sprint folders are expanded inside the past-milestones tree.
    // Sprint keys are namespaced by year (`<year>::<sprintId>`) so two years
    // can't collide on a shared sprint key.
    const [expandedYears, setExpandedYears] = React.useState<Set<string>>(new Set());
    const [expandedSprints, setExpandedSprints] = React.useState<Set<string>>(new Set());
    const toggleInSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
        setter((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    // Stale ids (other project, soft-deleted milestone) are dropped by
    // the prune effect below once the live milestone set loads.
    const [selectedMilestoneKeys, setSelectedMilestoneKeys] = React.useState<MilestoneFilterKey[]>(
        () =>
            (rehydrateKeys(stored.milestoneKeys) as MilestoneFilterKey[] | null) ?? [MILESTONE_ALL]
    );
    const [anchorElMilestoneFilter, setAnchorElMilestoneFilter] =
        React.useState<null | HTMLElement>(null);
    const openMilestoneFilter = Boolean(anchorElMilestoneFilter);
    const handleClickMilestoneFilter = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorElMilestoneFilter(event.currentTarget);
    };
    // When the project changes (or the visible milestone set drops a
    // currently-selected id, e.g. a milestone got soft-deleted), keep
    // the selection consistent so we don't end up filtering by a stale
    // id and showing an empty table forever.
    useEffect(() => {
        if (selectedMilestoneKeys.length === 1 && selectedMilestoneKeys[0] === MILESTONE_ALL) {
            return;
        }
        // Valid = ongoing OR past milestones (a selected past milestone must
        // survive the prune, else it'd be dropped the instant it's picked).
        const validIds = new Set<number>(
            [...visibleMilestones, ...pastMilestones].map((m) => m.milestoneId)
        );
        const pruned = selectedMilestoneKeys.filter(
            (k) => k === MILESTONE_NONE || (typeof k === "number" && validIds.has(k))
        );
        if (pruned.length === selectedMilestoneKeys.length) return;
        setSelectedMilestoneKeys(pruned.length > 0 ? pruned : [MILESTONE_ALL]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleMilestones, pastMilestones, currentProjectId]);
    const handleCloseMilestoneFilter = (key: MilestoneFilterKey) => {
        let next: MilestoneFilterKey[];
        if (key === MILESTONE_ALL) {
            next = [MILESTONE_ALL];
            setSelectedMilestoneKeys(next);
            setAnchorElMilestoneFilter(null);
        } else if (selectedMilestoneKeys.some((k) => k === key)) {
            next = selectedMilestoneKeys.filter((k) => k !== key);
            setSelectedMilestoneKeys(next);
        } else {
            next = [...selectedMilestoneKeys.filter((k) => k !== MILESTONE_ALL), key];
            setSelectedMilestoneKeys(next);
        }

        if (next.length === 0) {
            next = [MILESTONE_ALL];
            setSelectedMilestoneKeys(next);
            setAnchorElMilestoneFilter(null);
        }

        applyFilters({ ...selection, milestoneKeys: next });
        persistFilters({ ...selection, milestoneKeys: next });
    };

    const milestoneFilterButtonLabel = useMemo(() => {
        if (selectedMilestoneKeys.length === 1 && selectedMilestoneKeys[0] === MILESTONE_ALL) {
            return t.tasks.milestoneFilter.all;
        }
        const first = selectedMilestoneKeys[0];
        if (first === MILESTONE_NONE) return t.tasks.milestoneFilter.noMilestone;
        if (typeof first === "number") {
            const m =
                visibleMilestones.find((mm) => mm.milestoneId === first) ??
                pastMilestones.find((mm) => mm.milestoneId === first);
            const title = m?.title ?? `#${first}`;
            return title.length > 16 ? `${title.slice(0, 16)}…` : title;
        }
        return t.tasks.milestoneFilter.all;
    }, [selectedMilestoneKeys, visibleMilestones, pastMilestones, t]);

    // One selectable milestone row in the dropdown. Shared by the ongoing
    // list and the (expandable) past-milestones tree. `indentPl` deepens the
    // left padding when the row sits inside a year/sprint folder (default 2 =
    // the flat, top-level indent that matches the ongoing list).
    const renderMilestoneMenuItem = (m: Milestone, indentPl = 2) => {
        const isSelected = selectedMilestoneKeys.some((k) => k === m.milestoneId);
        const sprintName =
            m.sprintId == null
                ? t.tasks.milestoneFilter.noSprint
                : (projectSprints.find((s) => s.sprintId === m.sprintId)?.name ??
                  t.tasks.milestoneFilter.sprintFallback);
        return (
            <MenuItem
                key={`milestone-${m.milestoneId}`}
                sx={{
                    borderRadius: "8px",
                    mx: 0.5,
                    my: 0.25,
                    pl: indentPl,
                    transition: "all 0.2s ease",
                    "&:hover": {
                        background: styles.buttonHoverBg,
                    },
                }}
                onClick={() => handleCloseMilestoneFilter(m.milestoneId)}
            >
                <Box
                    sx={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        minWidth: 0,
                    }}
                >
                    <FlagRoundedIcon
                        sx={{
                            fontSize: 14,
                            color: isDark ? MILESTONE_ACCENT_DARK : MILESTONE_ACCENT_LIGHT,
                            flexShrink: 0,
                        }}
                    />
                    <Box
                        sx={{
                            flex: 1,
                            minWidth: 0,
                            display: "flex",
                            flexDirection: "column",
                            lineHeight: 1.2,
                        }}
                    >
                        <Typography
                            sx={{
                                fontSize: "13px",
                                fontWeight: isSelected ? 700 : 500,
                                color: isSelected
                                    ? isDark
                                        ? MILESTONE_ACCENT_DARK
                                        : MILESTONE_ACCENT_LIGHT
                                    : styles.textColor,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {m.title}
                        </Typography>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.75,
                                minWidth: 0,
                            }}
                        >
                            <Typography
                                sx={{
                                    fontSize: "10px",
                                    color: styles.mutedText,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    minWidth: 0,
                                }}
                            >
                                {sprintName}
                            </Typography>
                            {m.status
                                ? (() => {
                                      const tone = getMilestoneStatusChipColor(m.status as string);
                                      return (
                                          <Chip
                                              size="small"
                                              label={taskMetaLabel(
                                                  m.status as string,
                                                  t.tasks.filters
                                              )}
                                              sx={{
                                                  height: 16,
                                                  fontSize: "9px",
                                                  fontWeight: 700,
                                                  backgroundColor: tone.color,
                                                  color: tone.textColor,
                                                  flexShrink: 0,
                                                  "& .MuiChip-label": {
                                                      px: 0.75,
                                                      lineHeight: 1,
                                                  },
                                              }}
                                          />
                                      );
                                  })()
                                : null}
                        </Box>
                    </Box>
                    {isSelected && (
                        <Box
                            sx={{
                                width: 16,
                                height: 16,
                                borderRadius: "4px",
                                background: isDark
                                    ? MILESTONE_ACCENT_DARK
                                    : MILESTONE_ACCENT_LIGHT,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "10px",
                                color: "#fff",
                                fontWeight: 700,
                                flexShrink: 0,
                            }}
                        >
                            ✓
                        </Box>
                    )}
                </Box>
            </MenuItem>
        );
    };

    // A collapsible folder row inside the past-milestones tree (year / sprint
    // level). Clicking only toggles the folder, so `stopPropagation` keeps the
    // Menu open — same as the "Show past milestones" expander above.
    const renderTreeFolderRow = (opts: {
        rowKey: string;
        icon: React.ReactNode;
        label: string;
        count: number;
        open: boolean;
        indentPl: number;
        onToggle: () => void;
    }) => (
        <MenuItem
            key={opts.rowKey}
            sx={{
                borderRadius: "8px",
                mx: 0.5,
                my: 0.25,
                pl: opts.indentPl,
                "&:hover": { background: styles.buttonHoverBg },
            }}
            onClick={(e) => {
                e.stopPropagation();
                opts.onToggle();
            }}
        >
            <Box
                sx={{ width: "100%", display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}
            >
                {opts.open ? (
                    <KeyboardArrowDownRoundedIcon
                        sx={{ fontSize: 16, color: styles.mutedText, flexShrink: 0 }}
                    />
                ) : (
                    <KeyboardArrowRightRoundedIcon
                        sx={{ fontSize: 16, color: styles.mutedText, flexShrink: 0 }}
                    />
                )}
                {opts.icon}
                <Typography
                    sx={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: styles.textColor,
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        minWidth: 0,
                    }}
                >
                    {opts.label}
                </Typography>
                <Chip
                    label={opts.count}
                    size="small"
                    sx={{
                        height: 16,
                        fontSize: "9px",
                        fontWeight: 700,
                        background: styles.buttonHoverBg,
                        color: styles.mutedText,
                        flexShrink: 0,
                        "& .MuiChip-label": { px: 0.75, lineHeight: 1 },
                    }}
                />
            </Box>
        </MenuItem>
    );

    // Member filter — multi-select over the team's members. Same
    // all / none / id shape as the milestone filter above.
    // Same deal as milestones: the prune effect below drops a stored id
    // for someone who is no longer on the team.
    const [selectedMemberKeys, setSelectedMemberKeys] = React.useState<MemberFilterKey[]>(
        () => (rehydrateKeys(stored.memberKeys) as MemberFilterKey[] | null) ?? [MEMBER_ALL]
    );
    const [anchorElMemberFilter, setAnchorElMemberFilter] = React.useState<null | HTMLElement>(
        null
    );
    const openMemberFilter = Boolean(anchorElMemberFilter);
    const handleClickMemberFilter = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorElMemberFilter(event.currentTarget);
    };
    // Drop a selected member id that's no longer on the team (member
    // removed) so we don't filter by a stale id and show an empty table.
    useEffect(() => {
        if (selectedMemberKeys.length === 1 && selectedMemberKeys[0] === MEMBER_ALL) return;
        const validIds = new Set((teamMembers ?? []).map((m) => String(m.userId)));
        const pruned = selectedMemberKeys.filter((k) => k === MEMBER_NONE || validIds.has(k));
        if (pruned.length === selectedMemberKeys.length) return;
        setSelectedMemberKeys(pruned.length > 0 ? pruned : [MEMBER_ALL]);
    }, [teamMembers]);
    const handleCloseMemberFilter = (key: MemberFilterKey) => {
        let next: MemberFilterKey[];
        if (key === MEMBER_ALL) {
            next = [MEMBER_ALL];
            setSelectedMemberKeys(next);
            setAnchorElMemberFilter(null);
        } else if (selectedMemberKeys.some((k) => k === key)) {
            next = selectedMemberKeys.filter((k) => k !== key);
            setSelectedMemberKeys(next);
        } else {
            next = [...selectedMemberKeys.filter((k) => k !== MEMBER_ALL), key];
            setSelectedMemberKeys(next);
        }
        if (next.length === 0) {
            next = [MEMBER_ALL];
            setSelectedMemberKeys(next);
            setAnchorElMemberFilter(null);
        }
        applyFilters({ ...selection, memberKeys: next });
        persistFilters({ ...selection, memberKeys: next });
    };
    const memberFilterButtonLabel = useMemo(() => {
        if (selectedMemberKeys.length === 1 && selectedMemberKeys[0] === MEMBER_ALL) {
            return t.tasks.memberFilter.all;
        }
        const first = selectedMemberKeys[0];
        if (first === MEMBER_NONE) return t.tasks.memberFilter.noAssignee;
        const m = (teamMembers ?? []).find((mm) => String(mm.userId) === first);
        const name = m?.userName ?? first;
        return name.length > 16 ? `${name.slice(0, 16)}…` : name;
    }, [selectedMemberKeys, teamMembers, t]);

    // The current selection, as one value. Every handler above spreads it
    // and overrides its own dimension
    // (`applyFilters({ ...selection, tags: next })`), which is what keeps
    // the other six from being re-listed — and mis-ordered — at each of the
    // seventeen call sites.
    //
    // Declared after the state it reads but before the handlers that use
    // it: those are closures invoked from render output or effects, i.e.
    // after this line has run.
    const selection: FilterSelection = {
        status: selectedStatus,
        tags: selectedTags,
        priorities: selectedPriorities,
        effortLevels: selectedEffortLevels,
        sprintKeys: selectedSprintKeys,
        milestoneKeys: selectedMilestoneKeys,
        memberKeys: selectedMemberKeys,
    };

    // Apply filters — single-pass walk over allTasks. Previously this was
    // 5-6 chained `.filter()` calls allocating intermediate arrays plus a
    // separate second walk for childIds, each with its own `new Date()`
    // per row. With 1k+ tasks the old version was the hottest visible
    // path on filter toggles. The optimized version:
    //   - precomputes per-dimension Sets / Booleans up front
    //   - parses `now` once
    //   - walks `allTasks` ONCE, classifying each task as a top-level
    //     row (writes to `filteredTop`) and/or a visible child (writes
    //     to `childIdSet`) in the same pass.
    // Semantics are preserved exactly — see the legacy chained version
    // in git history if you need to cross-check a corner case.
    const applyFilters = (sel: FilterSelection) => {
        // Re-aliased to the names the walk below uses.
        const {
            status: statuses,
            tags,
            priorities: priority,
            effortLevels: effortLevel,
            sprintKeys: sprintSel,
            milestoneKeys: milestoneSel,
            memberKeys: memberSel,
        } = sel;
        const milestoneScopeActive = useTM.tableMilestoneFilterId != null;
        const now = Date.now();

        // --- Status predicate ---
        // Two axes: status-string match + expired-due-date check. Mirrors
        // the original branching (length===1 with "Expired" alone = all
        // statuses but only expired due dates; length>1 with Expired in
        // the mix = status in selection AND expired due date).
        let statusStringFilter: Set<string> | null = null;
        let requireExpired = false;
        if (statuses.length === 1) {
            const label = statuses[0].label;
            if (label === "Expired") {
                requireExpired = true;
            } else if (label !== "All") {
                statusStringFilter = new Set([label]);
            }
        } else if (statuses.length > 1) {
            statusStringFilter = new Set(statuses.map((s) => s.label));
            requireExpired = statuses.some((s) => s.label === "Expired");
        }

        // --- Tag predicate ---
        let tagLabels: string[] | null = null;
        if (tags.length > 0 && !(tags.length === 1 && tags[0].label === "All")) {
            tagLabels = tags.map((t) => t.label);
        }

        // --- Priority predicate ---
        let prioritySet: Set<string> | null = null;
        if (!(priority.length === 1 && priority[0].label === "All")) {
            prioritySet = new Set(priority.map((p) => p.label));
        }

        // --- Effort predicate ---
        let effortSet: Set<string> | null = null;
        if (!(effortLevel.length === 1 && effortLevel[0].label === "All")) {
            effortSet = new Set(effortLevel.map((e) => e.label));
        }

        // --- Sprint (multi-select) predicate ---
        // Reads `task.sprintId`, which the server maintains as a roll-up of
        // the task's milestone (see the filter's own comment above), so
        // "No sprint" is the same set as "no milestone" — the unscheduled
        // backlog, which is usually the biggest bucket in the project.
        const sprintFilterActive = !(sprintSel.length === 1 && sprintSel[0] === SPRINT_ALL);
        const sprintAllowNone = sprintSel.includes(SPRINT_NONE);
        const sprintIdSet = new Set<number>(
            sprintSel.filter((k): k is number => typeof k === "number")
        );

        // --- Milestone (multi-select) predicate ---
        const milestoneFilterActive = !(
            milestoneSel.length === 1 && milestoneSel[0] === MILESTONE_ALL
        );
        const milestoneAllowNone = milestoneSel.includes(MILESTONE_NONE);
        const milestoneIdSet = new Set<number>(
            milestoneSel.filter((k): k is number => typeof k === "number")
        );

        // --- Member (multi-select) predicate ---
        // A task matches a member if its assignee is in the selection (or it's
        // unassigned and the "No assignee" sentinel is chosen). Matching drives
        // the flat board list AND the table's root set; the table separately
        // splices in the (dimmed) ancestor chain of any matching subtask.
        const memberFilterActive = !(memberSel.length === 1 && memberSel[0] === MEMBER_ALL);
        const memberAllowNone = memberSel.includes(MEMBER_NONE);
        const memberIdSet = new Set<string>(
            memberSel.filter((k) => k !== MEMBER_ALL && k !== MEMBER_NONE)
        );

        // --- Milestone scope (sidebar-driven) predicate ---
        let scopeBackingTaskId: string | null = null;
        const scopeTarget = useTM.tableMilestoneFilterId;
        if (milestoneScopeActive && scopeTarget != null) {
            const milestoneTask = useTM.allTasks.find(
                (t) => t.isMilestone === true && t.milestoneId === scopeTarget
            );
            scopeBackingTaskId = milestoneTask?.id != null ? String(milestoneTask.id) : null;
        }
        // Scoped to a PAST milestone (from the sidebar's "Past milestones"
        // folder)? Then show its FULL history — bypass the status filter so
        // Closed subtasks appear, and don't apply the outdated-hide to it.
        const scopeIsOutdated =
            milestoneScopeActive && scopeTarget != null && outdatedMilestoneIds.has(scopeTarget);

        // The "All in any dimension → restrict to roots" rule the
        // legacy code applied inside each per-dimension `if (... "All")`
        // branch. In practice it fires iff ANY dimension is in "All"
        // mode AND no milestone scope is active — the per-dimension
        // applications were idempotent. Collapsed here into one flag.
        //
        // Milestone-dropdown selection (`milestoneFilterActive`) counts
        // the same as the sidebar's `tableMilestoneFilterId` scope:
        // when the user has narrowed to a specific milestone, we want
        // its tasks and subtasks to land in `filteredTop` so a flat
        // kanban view (SprintBoard) can surface them. The table's
        // depth-0 render still strips non-roots via
        // `parentRows = currentDisplayingTasks.filter(t => t.parentTaskId == null)`
        // ([DraggableTaskTable.tsx:562]), so this relaxation does not
        // double-render rows there — non-roots only surface via the
        // expand chevron through `childrenByParent`.
        const restrictTopToRoots =
            !milestoneScopeActive &&
            !milestoneFilterActive &&
            // A member filter, like a milestone filter, wants its matching
            // subtasks in `filteredTop` (flat board list + table roots).
            !memberFilterActive &&
            ((statuses.length === 1 && statuses[0].label === "All") ||
                (tags.length === 1 && tags[0].label === "All") ||
                (priority.length === 1 && priority[0].label === "All") ||
                (effortLevel.length === 1 && effortLevel[0].label === "All"));

        const filteredTop: TaskTableProps[] = [];
        const childIdSet = new Set<string>();

        for (const task of useTM.allTasks) {
            // Outdated milestones (Closed + ended sprint) and everything under
            // them are hidden EVERYWHERE, UNLESS the user opts in: by scoping to
            // that one milestone via the sidebar's "Past milestones" folder
            // (`tableMilestoneFilterId`), or by SELECTING it in the milestone
            // dropdown (revealed there via "Show past milestones").
            const isOutdatedTask =
                task.milestoneId != null && outdatedMilestoneIds.has(task.milestoneId);
            if (
                isOutdatedTask &&
                task.milestoneId !== scopeTarget &&
                !(task.milestoneId != null && milestoneIdSet.has(task.milestoneId))
            ) {
                continue;
            }

            // When narrowing by MEMBER, also drop the member's own closed /
            // deleted standalone tasks (kept only when a milestone scope is
            // active, so a scoped past milestone still lists its full history).
            if (
                memberFilterActive &&
                !milestoneScopeActive &&
                task.isMilestone !== true &&
                (task.status === "Closed" || task.status === "Deleted")
            ) {
                continue;
            }

            // Status (string + expired axes). Bypassed for an outdated task the
            // user is deliberately surfacing — a scoped past milestone
            // (`scopeIsOutdated`) or one they selected in the dropdown — since
            // both want its FULL history (incl. Closed), not the ongoing view.
            const bypassStatus =
                scopeIsOutdated ||
                (isOutdatedTask &&
                    task.milestoneId != null &&
                    milestoneIdSet.has(task.milestoneId));
            if (!bypassStatus) {
                if (statusStringFilter !== null && !statusStringFilter.has(task.status ?? "")) {
                    continue;
                }
                if (requireExpired) {
                    if (!task.dueDate) continue;
                    const ts = new Date(task.dueDate).getTime();
                    if (!Number.isFinite(ts) || ts >= now) continue;
                }
            }

            // Tags (substring search on concatTags)
            if (tagLabels !== null) {
                const concat = task.concatTags;
                if (!concat) continue;
                let match = false;
                for (const label of tagLabels) {
                    if (concat.includes(label)) {
                        match = true;
                        break;
                    }
                }
                if (!match) continue;
            }

            // Priority
            if (prioritySet !== null && !prioritySet.has(task.priority ?? "")) {
                continue;
            }

            // Effort
            if (effortSet !== null && !effortSet.has(task.effortLevel ?? "")) {
                continue;
            }

            // Sprint multi-select
            if (sprintFilterActive) {
                if (task.sprintId == null) {
                    if (!sprintAllowNone) continue;
                } else if (!sprintIdSet.has(task.sprintId)) {
                    continue;
                }
            }

            // Milestone multi-select
            if (milestoneFilterActive) {
                if (task.milestoneId == null) {
                    if (!milestoneAllowNone) continue;
                } else if (!milestoneIdSet.has(task.milestoneId)) {
                    continue;
                }
            }

            // Member multi-select (by assignee)
            if (memberFilterActive) {
                // A regular task has ONE assignee. A milestone can have many
                // (MilestoneAssignees) — its backing row only carries the
                // primary in `assigneeId`, so matching on that alone would
                // miss members who are secondary assignees. Pull the full set
                // from `useSM.projectMilestones` and union in the backing
                // assignee as a fallback (covers the row landing before the
                // milestone list is hydrated).
                let assigneeIds: string[];
                if (task.isMilestone === true) {
                    const milestone =
                        task.milestoneId != null && task.projectId != null && useSM
                            ? (useSM.projectMilestones[task.projectId] ?? []).find(
                                  (m) => m.milestoneId === task.milestoneId
                              )
                            : undefined;
                    const ids = new Set<string>();
                    for (const a of milestone?.assignees ?? []) {
                        if (a.userId != null) ids.add(String(a.userId));
                    }
                    if (task.assigneeId != null) ids.add(String(task.assigneeId));
                    assigneeIds = [...ids];
                } else {
                    assigneeIds = task.assigneeId != null ? [String(task.assigneeId)] : [];
                }
                if (assigneeIds.length === 0) {
                    if (!memberAllowNone) continue;
                } else if (!assigneeIds.some((id) => memberIdSet.has(id))) {
                    continue;
                }
            }

            // Milestone scope (sidebar) — narrows to the backing task,
            // any task in the scoped milestone, or any direct child of
            // the backing task.
            if (milestoneScopeActive) {
                const inScope =
                    (task.isMilestone === true && task.milestoneId === scopeTarget) ||
                    task.milestoneId === scopeTarget ||
                    (scopeBackingTaskId != null &&
                        task.parentTaskId != null &&
                        String(task.parentTaskId) === scopeBackingTaskId);
                if (!inScope) continue;
            }

            // Task passes every dimension. Decide top-level vs child.
            const isRoot = task.parentTaskId == null;
            if (!restrictTopToRoots || isRoot) {
                filteredTop.push(task);
            }
            if (!isRoot && task.id != null) {
                childIdSet.add(String(task.id));
            }
        }

        // --- Milestone rescue: a milestone survives when ITS TASKS do ---
        //
        // Every row above was judged on its own metadata, so a milestone
        // carrying no tags (or a different status / priority / effort /
        // assignee) was dropped even when the tasks under it matched —
        // and those tasks vanished with it, because a task only renders
        // beneath its milestone row.
        //
        // `childIdSet` is already exactly "non-root rows that passed
        // every dimension", so the rescue reads parent links only and
        // can't drift from the predicates above.
        const milestonesWithMatchingChildren = selectMilestonesWithMatchingChildren(
            useTM.allTasks,
            childIdSet
        );
        if (milestonesWithMatchingChildren.size > 0) {
            const alreadyVisible = new Set(
                filteredTop.map((t) => (t.id != null ? String(t.id) : ""))
            );
            for (const task of useTM.allTasks) {
                if (task.isMilestone !== true || task.id == null) continue;
                const id = String(task.id);
                if (alreadyVisible.has(id)) continue;
                if (!milestonesWithMatchingChildren.has(id)) continue;
                // Never resurrect an outdated milestone through the back
                // door — it stays hidden unless the user opted into it,
                // exactly as the main loop's guard above decides.
                if (
                    task.milestoneId != null &&
                    outdatedMilestoneIds.has(task.milestoneId) &&
                    task.milestoneId !== scopeTarget &&
                    !milestoneIdSet.has(task.milestoneId)
                ) {
                    continue;
                }
                filteredTop.push(task);
            }
        }

        setCurrentDisplayingTasks(filteredTop);

        if (setVisibleChildTaskIds) {
            setVisibleChildTaskIds(childIdSet);
        }

        // Auto-expand ONLY the milestones picked in the milestone filter.
        //
        // Narrowing to a milestone is a statement about wanting to see
        // that milestone's work, so opening it saves a click with no
        // other purpose. Every other filter deliberately leaves rows
        // closed: expanding on a tag / status / priority / effort /
        // member filter fires across the whole list at once and reorders
        // what the user is reading, which is disruptive rather than
        // helpful. A milestone rescued by one of its tasks therefore
        // appears closed too — the chevron is the user's to press.
        if (setMilestoneAutoExpandIds) {
            // BOTH ways of narrowing to a milestone count: this dropdown,
            // and the sidebar's Milestones folder
            // (`useTM.tableMilestoneFilterId`). They're the same gesture
            // from the user's side — "show me this milestone's work" — so
            // they get the same result. An empty set (nothing picked
            // either way) leaves every row as the user left it.
            const expandTargets = new Set<number>(milestoneIdSet);
            if (milestoneScopeActive && scopeTarget != null) {
                expandTargets.add(scopeTarget);
            }
            setMilestoneAutoExpandIds(
                selectMilestoneRowsForSelection(useTM.allTasks, expandTargets)
            );
        }

        if (setIsMilestoneFilterActive) {
            setIsMilestoneFilterActive(milestoneFilterActive);
        }

        if (setIsMemberFilterActive) {
            setIsMemberFilterActive(memberFilterActive);
        }
    };

    // ---- Saved Filters (named, project-shared selections) ------------
    //
    // Reads the CURRENT selection in the same identity-only shape the
    // localStorage path uses (`StoredTaskFilters`) — labels and keys, never
    // the `FilterProps` objects, which carry predicates and palette colors
    // that ship with the app. Crossing users makes that rule stricter, not
    // looser: a stored predicate would pin one member's stale copy of the
    // logic for everyone.
    // The status rule lives in `buildSavedFilterPayload` (a board-saved
    // filter omits status entirely) — see that module's docstring.
    const currentSavedFilterPayload = buildSavedFilterPayload({
        hideStatusFilter,
        ...selection,
    });
    const getCurrentSavedFilterPayload = (): SavedFilterPayload => currentSavedFilterPayload;

    // "Is this saved filter the selection currently in effect?" — asked per
    // row, on every render, so the menu's applied state is DERIVED from the
    // live selection instead of remembered from the last click.
    //
    // That's what makes both of these correct without any extra bookkeeping:
    // editing a dimension after applying a filter drops the badge (the
    // selection genuinely isn't that filter any more), and hand-building a
    // selection that happens to equal a saved one shows it as applied.
    // Reset lands in the first case.
    //
    // Rebuilt each render rather than memoised: it closes over every
    // selection, so a `useCallback` would need all of them in its deps and
    // would be recreated just as often. The comparison is a handful of
    // short arrays per saved filter.
    const isCurrentSavedFilterSelection = (payload: SavedFilterPayload): boolean =>
        savedFilterMatchesSelection(payload, currentSavedFilterPayload, {
            hideStatusFilter,
            predefinedStatusFilters,
            defaultStatusFilters,
            predefinedTagsFilters,
            predefinedPriorityFilters,
            predefinedEffortLevelFilters,
        });

    // Applies a saved selection. The one thing that is load-bearing HERE
    // (the rest is in `resolveSavedFilter`): `applyFilters` must be called
    // with the NEW values. The reactive effect at the bottom of this file
    // watches only allTasks / tableMilestoneFilterId / milestone / member /
    // outdated — status, tags, priority and effort are NOT in its deps,
    // which is why every handler in this file re-runs the pipeline inline.
    // Setting state alone would leave the table showing unfiltered rows
    // under a filtered-looking bar.
    const applySavedFilter = (payload: SavedFilterPayload) => {
        const resolved = resolveSavedFilter(payload, {
            hideStatusFilter,
            predefinedStatusFilters,
            defaultStatusFilters,
            predefinedTagsFilters,
            predefinedPriorityFilters,
            predefinedEffortLevelFilters,
        });
        const next: FilterSelection = {
            status: resolved.status,
            tags: resolved.tags,
            priorities: resolved.priorities,
            effortLevels: resolved.effortLevels,
            sprintKeys: resolved.sprintKeys as SprintFilterKey[],
            milestoneKeys: resolved.milestoneKeys as MilestoneFilterKey[],
            memberKeys: resolved.memberKeys as MemberFilterKey[],
        };

        setSelectedStatus(next.status);
        setSelectedTags(next.tags);
        setSelectedPriorities(next.priorities);
        setSelectedEffortLevels(next.effortLevels);
        setSelectedSprintKeys(next.sprintKeys);
        setSelectedMilestoneKeys(next.milestoneKeys);
        setSelectedMemberKeys(next.memberKeys);

        applyFilters(next);
        // Persist like any other selection change, so the applied filter
        // survives the table/board/dashboard remount the same way a
        // hand-picked one does.
        persistFilters(next);
    };

    const resetFilters = () => {
        // Status reset differs by surface. Where the status filter is
        // shown (the task table), reset to the "ongoing" default
        // (Open/WIP/Blocked/Pending). Where it's HIDDEN (the sprint
        // board), the board pins status to "All" (its columns are the
        // status view, so a status filter makes no sense) — reset must
        // return to that "All", or Closed/Deleted cards silently vanish
        // after a Reset. Mirrors the mount-time initializer above.
        const reset: FilterSelection = {
            status: hideStatusFilter ? [predefinedStatusFilters[0]] : defaultStatusFilters,
            tags: tagSelectionDefault(predefinedTagsFilters),
            priorities: [predefinedPriorityFilters[0]],
            effortLevels: [predefinedEffortLevelFilters[0]],
            sprintKeys: [SPRINT_ALL],
            milestoneKeys: [MILESTONE_ALL],
            memberKeys: [MEMBER_ALL],
        };
        setSelectedStatus(reset.status);
        setSelectedTags(reset.tags);
        setSelectedPriorities(reset.priorities);
        setSelectedEffortLevels(reset.effortLevels);
        setSelectedSprintKeys(reset.sprintKeys);
        setSelectedMilestoneKeys(reset.milestoneKeys);
        setSelectedMemberKeys(reset.memberKeys);
        setPastSprintsExpanded(false);
        setPastMilestonesExpanded(false);
        applyFilters(reset);
        if (filterStorageKey) clearStoredFilters(filterStorageKey);
    };

    useEffect(() => {
        applyFilters(selection);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        useTM.allTasks,
        useTM.tableMilestoneFilterId,
        selectedSprintKeys,
        selectedMilestoneKeys,
        selectedMemberKeys,
        outdatedMilestoneKey,
    ]);

    // NOTE: there used to be a second `applyFilters` pass here, keyed on
    // `[isTaskUpdated]`. It was redundant and expensive.
    //
    // Redundant because `applyFilters` derives entirely from
    // `useTM.allTasks`, `useTM.tableMilestoneFilterId` and the selection
    // state — every one of which already re-runs it, either through the
    // effect above or through the handler that changes a selection. Any
    // real task edit reaches the table by writing `allTasks`, so the
    // effect above catches it.
    //
    // Expensive because `isTaskUpdated` flips on every task OPEN, not just
    // on an edit — so simply clicking through tasks ran a second full O(N)
    // walk plus an O(N log N) sort, on top of the one the `allTasks` pass
    // was already doing. Both surfaces that host this menu (task table and
    // sprint board) then rebuilt their derived structures a second time.

    // Modern filter button style generator
    const getFilterButtonStyle = (filter: FilterProps, isAllSelected: boolean) => ({
        color: isAllSelected ? styles.textColor : "#fff",
        background: isDark
            ? `linear-gradient(135deg, ${alpha(filter.darkModeColor, 0.4)} 0%, ${alpha(filter.darkModeColor, 0.6)} 100%)`
            : `linear-gradient(135deg, ${alpha(filter.lightModeColor, 0.7)} 0%, ${alpha(filter.lightModeColor, 0.9)} 100%)`,
        border: `1px solid ${isDark ? alpha(filter.darkModeColor, 0.5) : alpha(filter.lightModeColor, 0.6)}`,
        borderRadius: "10px",
        fontSize: "12px",
        fontWeight: 600,
        height: "32px",
        whiteSpace: "nowrap",
        px: 1.5,
        my: 0.5,
        textTransform: "none" as const,
        boxShadow: isDark
            ? `0 2px 8px ${alpha(filter.darkModeColor, 0.3)}`
            : `0 2px 8px ${alpha(filter.lightModeColor, 0.25)}`,
        transition: "all 0.2s ease",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxHeight: "2.7em", // show up to ~2 lines, then cut
        lineHeight: 1.35,
        display: "-webkit-box",
        WebkitLineClamp: 2, // limit lines for better UX
        WebkitBoxOrient: "vertical",
        "& span, & .MuiChip-label, & .MuiButton-label, & .MuiTypography-root": {
            overflow: "hidden",
            whiteSpace: "normal",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
        },
        "&::after": {
            content: '""',
        },
        "&:hover": {
            background: isDark
                ? `linear-gradient(135deg, ${alpha(filter.darkModeColor, 0.5)} 0%, ${alpha(filter.darkModeColor, 0.7)} 100%)`
                : `linear-gradient(135deg, ${alpha(filter.lightModeColor, 0.8)} 0%, ${alpha(filter.lightModeColor, 1)} 100%)`,
            transform: "translateY(-1px)",
            boxShadow: isDark
                ? `0 4px 12px ${alpha(filter.darkModeColor, 0.4)}`
                : `0 4px 12px ${alpha(filter.lightModeColor, 0.35)}`,
        },
    });

    return (
        <Box
            sx={{
                background: styles.containerBg,
                border: `1px solid ${styles.containerBorder}`,
                borderRadius: "14px",
                px: 2,
                py: 1,
                mb: 1,
                boxShadow: isDark
                    ? "0 4px 20px rgba(0,0,0,0.3)"
                    : "0 4px 20px rgba(var(--gp-brand-700-rgb), 0.08)",
            }}
        >
            <Stack
                alignItems="center"
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                direction="row"
                gap={1.5}
                sx={{ overflowX: "auto" }}
            >
                {/* Filter Icon Label */}
                <Stack alignItems="center" direction="row" gap={0.5} sx={{ flexShrink: 0 }}>
                    <FilterListIcon
                        sx={{
                            fontSize: "18px",
                            color: isDark ? "var(--gp-brandalt-400)" : "var(--gp-brand-800)",
                        }}
                    />
                    <Typography
                        variant="caption"
                        sx={{
                            color: styles.mutedText,
                            fontWeight: 600,
                            fontSize: "11px",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                        }}
                    >
                        Filters
                    </Typography>

                    {/* How-it-works explainer. The rules aren't guessable
                        from the chips alone — particularly that a
                        milestone rides in on its tasks, and that
                        sub-tasks don't get the same treatment. */}
                    <AppTooltip
                        title={
                            <Box sx={{ maxWidth: 300, py: 0.5 }}>
                                <Typography
                                    sx={{
                                        display: "block",
                                        fontWeight: 700,
                                        fontSize: "12px",
                                        mb: 0.75,
                                    }}
                                >
                                    {t.tasks.filterHelp.title}
                                </Typography>
                                <Typography
                                    sx={{ display: "block", fontSize: "11.5px", mb: 0.75 }}
                                >
                                    {t.tasks.filterHelp.combine}
                                </Typography>
                                <Typography
                                    sx={{ display: "block", fontSize: "11.5px", mb: 0.75 }}
                                >
                                    {t.tasks.filterHelp.rootRows}
                                </Typography>
                                <Typography
                                    sx={{ display: "block", fontSize: "11.5px", mb: 0.75 }}
                                >
                                    {t.tasks.filterHelp.milestoneRescue}
                                </Typography>
                                <Typography
                                    sx={{ display: "block", fontSize: "11.5px", mb: 0.75 }}
                                >
                                    {t.tasks.filterHelp.subtasks}
                                </Typography>
                                <Typography sx={{ display: "block", fontSize: "11.5px" }}>
                                    {t.tasks.filterHelp.milestoneExpand}
                                </Typography>
                            </Box>
                        }
                    >
                        <IconButton
                            aria-label={t.tasks.filterHelp.title}
                            size="small"
                            sx={{
                                ml: 0.25,
                                color: styles.mutedText,
                                "&:hover": {
                                    color: isDark
                                        ? "var(--gp-brandalt-400)"
                                        : "var(--gp-brand-800)",
                                    background: styles.buttonHoverBg,
                                },
                            }}
                        >
                            <HelpOutlineRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </AppTooltip>

                    {/* Column-customizer trigger — only rendered when the
                        host (DraggableTaskTable) wires it up. The sprint
                        board uses this same menu but doesn't have
                        column-layout state, so it omits the prop and
                        the icon stays hidden there. */}
                    {onOpenColumnSettings && (
                        <AppTooltip title={t.tasks.table.columnSettings.openTooltip}>
                            <IconButton
                                aria-label={t.tasks.table.columnSettings.openTooltip}
                                size="small"
                                sx={{
                                    ml: 0.25,
                                    color: styles.mutedText,
                                    "&:hover": {
                                        color: isDark
                                            ? "var(--gp-brandalt-400)"
                                            : "var(--gp-brand-800)",
                                        background: styles.buttonHoverBg,
                                    },
                                }}
                                onClick={onOpenColumnSettings}
                            >
                                <TuneRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </AppTooltip>
                    )}
                </Stack>

                {/* Divider */}
                <Box
                    sx={{
                        width: "1px",
                        height: "24px",
                        background: styles.containerBorder,
                        flexShrink: 0,
                    }}
                />

                {/* Sprint Filter — sits immediately left of the milestone
                    filter, matching the sprint → milestone → task
                    hierarchy the sidebar and the picker both present.
                    Hidden under the sidebar's milestone scope for the same
                    reason the milestone filter is: that scope already pins
                    the view to one milestone, hence to one sprint, so a
                    sprint filter on top could only agree with it or empty
                    the table. */}
                {useSM && useTM.tableMilestoneFilterId == null && (
                    <>
                        <AppTooltip
                            title={(() => {
                                if (
                                    selectedSprintKeys.length === 1 &&
                                    selectedSprintKeys[0] === SPRINT_ALL
                                ) {
                                    return t.tasks.sprintFilter.allSprints;
                                }
                                return selectedSprintKeys
                                    .map((k) =>
                                        k === SPRINT_NONE
                                            ? t.tasks.sprintFilter.noSprint
                                            : sprintNameOf(k as number)
                                    )
                                    .join(", ");
                            })()}
                        >
                            <Button
                                aria-controls={openSprintFilter ? "fade-menu" : undefined}
                                aria-expanded={openSprintFilter ? "true" : undefined}
                                aria-haspopup="true"
                                variant="contained"
                                startIcon={
                                    <DirectionsRunRoundedIcon
                                        sx={{
                                            fontSize: "16px",
                                            color: sprintFilterIsAll
                                                ? isDark
                                                    ? SPRINT_ACCENT_DARK
                                                    : SPRINT_ACCENT_LIGHT
                                                : "#fff",
                                        }}
                                    />
                                }
                                sx={{
                                    color: sprintFilterIsAll ? styles.textColor : "#fff",
                                    background: sprintFilterIsAll
                                        ? isDark
                                            ? "rgba(14,165,233,0.15)"
                                            : "rgba(14,165,233,0.1)"
                                        : isDark
                                          ? `linear-gradient(135deg, ${alpha("#0ea5e9", 0.5)} 0%, ${alpha("#0ea5e9", 0.7)} 100%)`
                                          : `linear-gradient(135deg, ${alpha("#0ea5e9", 0.75)} 0%, ${alpha("#0ea5e9", 0.95)} 100%)`,
                                    border: `1px solid ${
                                        isDark ? SPRINT_ACCENT_BG_DARK : SPRINT_ACCENT_BG_LIGHT
                                    }`,
                                    borderRadius: "10px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    height: "32px",
                                    whiteSpace: "nowrap",
                                    px: 1.5,
                                    my: 0.5,
                                    textTransform: "none",
                                    boxShadow: isDark
                                        ? "0 2px 8px rgba(14,165,233,0.25)"
                                        : "0 2px 8px rgba(14,165,233,0.2)",
                                    transition: "all 0.2s ease",
                                    flexShrink: 0,
                                    "&:hover": {
                                        background: sprintFilterIsAll
                                            ? isDark
                                                ? "rgba(14,165,233,0.25)"
                                                : "rgba(14,165,233,0.2)"
                                            : isDark
                                              ? `linear-gradient(135deg, ${alpha("#0ea5e9", 0.6)} 0%, ${alpha("#0ea5e9", 0.8)} 100%)`
                                              : `linear-gradient(135deg, ${alpha("#0ea5e9", 0.85)} 0%, ${alpha("#0ea5e9", 1)} 100%)`,
                                        transform: "translateY(-1px)",
                                        boxShadow: isDark
                                            ? "0 4px 12px rgba(14,165,233,0.35)"
                                            : "0 4px 12px rgba(14,165,233,0.3)",
                                    },
                                }}
                                onClick={handleClickSprintFilter}
                            >
                                Sprint: {sprintFilterButtonLabel}
                                {selectedSprintKeys.length > 1 && (
                                    <Chip
                                        label={`+${selectedSprintKeys.length - 1}`}
                                        size="small"
                                        sx={{
                                            ml: 0.5,
                                            height: "18px",
                                            fontSize: "10px",
                                            fontWeight: 700,
                                            background: "rgba(255,255,255,0.2)",
                                            color: "inherit",
                                        }}
                                    />
                                )}
                            </Button>
                        </AppTooltip>
                        <Menu
                            anchorEl={anchorElSprintFilter}
                            open={openSprintFilter}
                            slots={{ transition: Fade }}
                            slotProps={{
                                paper: {
                                    className: `custom-scrollbar-${isDark ? "dark" : "light"}`,
                                    sx: {
                                        background: styles.menuBg,
                                        border: `1px solid ${styles.menuBorder}`,
                                        borderRadius: "12px",
                                        boxShadow: isDark
                                            ? "0 8px 32px rgba(0,0,0,0.5)"
                                            : "0 8px 32px rgba(0,0,0,0.15)",
                                        mt: 1,
                                        minWidth: "220px",
                                        maxHeight: "320px",
                                    },
                                },
                            }}
                            onClose={() => setAnchorElSprintFilter(null)}
                        >
                            {([SPRINT_ALL, SPRINT_NONE] as SprintFilterKey[]).map((key) => {
                                const isSelected = selectedSprintKeys.some((k) => k === key);
                                const label =
                                    key === SPRINT_ALL
                                        ? t.tasks.sprintFilter.all
                                        : t.tasks.sprintFilter.noSprint;
                                return (
                                    <MenuItem
                                        key={`sprint-key-${String(key)}`}
                                        sx={{
                                            borderRadius: "8px",
                                            mx: 0.5,
                                            my: 0.25,
                                            transition: "all 0.2s ease",
                                            "&:hover": { background: styles.buttonHoverBg },
                                        }}
                                        onClick={() => handleCloseSprintFilter(key)}
                                    >
                                        <Box
                                            sx={{
                                                width: "100%",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                            }}
                                        >
                                            <DirectionsRunRoundedIcon
                                                sx={{
                                                    fontSize: 14,
                                                    color: isDark
                                                        ? SPRINT_ACCENT_DARK
                                                        : SPRINT_ACCENT_LIGHT,
                                                    opacity: key === SPRINT_ALL ? 0.5 : 1,
                                                }}
                                            />
                                            <Typography
                                                sx={{
                                                    fontSize: "13px",
                                                    fontWeight: isSelected ? 700 : 500,
                                                    color: isSelected
                                                        ? isDark
                                                            ? SPRINT_ACCENT_DARK
                                                            : SPRINT_ACCENT_LIGHT
                                                        : styles.textColor,
                                                    flex: 1,
                                                }}
                                            >
                                                {label}
                                            </Typography>
                                            {isSelected && (
                                                <Box
                                                    sx={{
                                                        width: 16,
                                                        height: 16,
                                                        borderRadius: "4px",
                                                        background: isDark
                                                            ? SPRINT_ACCENT_DARK
                                                            : SPRINT_ACCENT_LIGHT,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        fontSize: "10px",
                                                        color: "#fff",
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    ✓
                                                </Box>
                                            )}
                                        </Box>
                                    </MenuItem>
                                );
                            })}
                            {visibleSprints.length > 0 && (
                                <Box
                                    sx={{
                                        height: "1px",
                                        background: styles.containerBorder,
                                        mx: 1,
                                        my: 0.5,
                                    }}
                                />
                            )}
                            {visibleSprints.map((s) => renderSprintMenuItem(s))}

                            {/* "Show past sprints" expander — same affordance as the
                                milestone filter's, and needed for the same reason:
                                sprints auto-roll, so the ended ones grow without
                                bound. Clicking the row only expands, so keep the
                                menu open. */}
                            {pastSprints.length > 0 && (
                                <MenuItem
                                    sx={{
                                        borderRadius: "8px",
                                        mx: 0.5,
                                        my: 0.25,
                                        "&:hover": { background: styles.buttonHoverBg },
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPastSprintsExpanded((prev) => !prev);
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: "100%",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                        }}
                                    >
                                        <HistoryRoundedIcon
                                            sx={{
                                                fontSize: 15,
                                                color: styles.mutedText,
                                                flexShrink: 0,
                                            }}
                                        />
                                        <Typography
                                            sx={{
                                                fontSize: "13px",
                                                fontWeight: 600,
                                                color: styles.textColor,
                                                flex: 1,
                                            }}
                                        >
                                            {pastSprintsExpanded
                                                ? t.tasks.sprintFilter.hidePastSprints
                                                : t.tasks.sprintFilter.showPastSprints}
                                        </Typography>
                                        <Chip
                                            label={pastSprints.length}
                                            size="small"
                                            sx={{
                                                height: 16,
                                                fontSize: "9px",
                                                fontWeight: 700,
                                                background: styles.buttonHoverBg,
                                                color: styles.mutedText,
                                                "& .MuiChip-label": { px: 0.75, lineHeight: 1 },
                                            }}
                                        />
                                    </Box>
                                </MenuItem>
                            )}
                            {pastSprintsExpanded &&
                                pastSprints.map((s) => renderSprintMenuItem(s))}
                        </Menu>
                    </>
                )}

                {/* Milestone Filter — multi-select drawn from the same
                    visible/sorted set the sidebar shows in
                    `MilestonesListItem`. Hidden while the sidebar's
                    scope chip is active so users aren't confused by
                    two competing milestone narrowing controls. */}
                {useSM && useTM.tableMilestoneFilterId == null && (
                    <>
                        <AppTooltip
                            title={(() => {
                                if (
                                    selectedMilestoneKeys.length === 1 &&
                                    selectedMilestoneKeys[0] === MILESTONE_ALL
                                ) {
                                    return t.tasks.milestoneFilter.allMilestones;
                                }
                                return selectedMilestoneKeys
                                    .map((k) => {
                                        if (k === MILESTONE_NONE)
                                            return t.tasks.milestoneFilter.noMilestone;
                                        const m = visibleMilestones.find(
                                            (mm) => mm.milestoneId === k
                                        );
                                        return m?.title ?? `#${k}`;
                                    })
                                    .join(", ");
                            })()}
                        >
                            <Button
                                aria-controls={openMilestoneFilter ? "fade-menu" : undefined}
                                aria-expanded={openMilestoneFilter ? "true" : undefined}
                                aria-haspopup="true"
                                variant="contained"
                                startIcon={
                                    <FlagRoundedIcon
                                        sx={{
                                            fontSize: "16px",
                                            color:
                                                selectedMilestoneKeys.length === 1 &&
                                                selectedMilestoneKeys[0] === MILESTONE_ALL
                                                    ? isDark
                                                        ? MILESTONE_ACCENT_DARK
                                                        : MILESTONE_ACCENT_LIGHT
                                                    : "#fff",
                                        }}
                                    />
                                }
                                sx={{
                                    color:
                                        selectedMilestoneKeys.length === 1 &&
                                        selectedMilestoneKeys[0] === MILESTONE_ALL
                                            ? styles.textColor
                                            : "#fff",
                                    background:
                                        selectedMilestoneKeys.length === 1 &&
                                        selectedMilestoneKeys[0] === MILESTONE_ALL
                                            ? isDark
                                                ? "rgba(249,115,22,0.15)"
                                                : "rgba(249,115,22,0.1)"
                                            : isDark
                                              ? `linear-gradient(135deg, ${alpha("#f97316", 0.5)} 0%, ${alpha("#f97316", 0.7)} 100%)`
                                              : `linear-gradient(135deg, ${alpha("#f97316", 0.75)} 0%, ${alpha("#f97316", 0.95)} 100%)`,
                                    border: `1px solid ${
                                        isDark
                                            ? MILESTONE_ACCENT_BG_DARK
                                            : MILESTONE_ACCENT_BG_LIGHT
                                    }`,
                                    borderRadius: "10px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    height: "32px",
                                    whiteSpace: "nowrap",
                                    px: 1.5,
                                    my: 0.5,
                                    textTransform: "none",
                                    boxShadow: isDark
                                        ? "0 2px 8px rgba(249,115,22,0.25)"
                                        : "0 2px 8px rgba(249,115,22,0.2)",
                                    transition: "all 0.2s ease",
                                    flexShrink: 0,
                                    "&:hover": {
                                        background:
                                            selectedMilestoneKeys.length === 1 &&
                                            selectedMilestoneKeys[0] === MILESTONE_ALL
                                                ? isDark
                                                    ? "rgba(249,115,22,0.25)"
                                                    : "rgba(249,115,22,0.2)"
                                                : isDark
                                                  ? `linear-gradient(135deg, ${alpha("#f97316", 0.6)} 0%, ${alpha("#f97316", 0.8)} 100%)`
                                                  : `linear-gradient(135deg, ${alpha("#f97316", 0.85)} 0%, ${alpha("#f97316", 1)} 100%)`,
                                        transform: "translateY(-1px)",
                                        boxShadow: isDark
                                            ? "0 4px 12px rgba(249,115,22,0.35)"
                                            : "0 4px 12px rgba(249,115,22,0.3)",
                                    },
                                }}
                                onClick={handleClickMilestoneFilter}
                            >
                                Milestone: {milestoneFilterButtonLabel}
                                {selectedMilestoneKeys.length > 1 && (
                                    <Chip
                                        label={`+${selectedMilestoneKeys.length - 1}`}
                                        size="small"
                                        sx={{
                                            ml: 0.5,
                                            height: "18px",
                                            fontSize: "10px",
                                            fontWeight: 700,
                                            background: "rgba(255,255,255,0.2)",
                                            color: "inherit",
                                        }}
                                    />
                                )}
                            </Button>
                        </AppTooltip>
                        <Menu
                            anchorEl={anchorElMilestoneFilter}
                            open={openMilestoneFilter}
                            slots={{ transition: Fade }}
                            slotProps={{
                                paper: {
                                    className: `custom-scrollbar-${isDark ? "dark" : "light"}`,
                                    sx: {
                                        background: styles.menuBg,
                                        border: `1px solid ${styles.menuBorder}`,
                                        borderRadius: "12px",
                                        boxShadow: isDark
                                            ? "0 8px 32px rgba(0,0,0,0.5)"
                                            : "0 8px 32px rgba(0,0,0,0.15)",
                                        mt: 1,
                                        minWidth: "220px",
                                        maxHeight: "320px",
                                    },
                                },
                            }}
                            onClose={() => setAnchorElMilestoneFilter(null)}
                        >
                            {([MILESTONE_ALL, MILESTONE_NONE] as MilestoneFilterKey[]).map(
                                (key) => {
                                    const isSelected = selectedMilestoneKeys.some(
                                        (k) => k === key
                                    );
                                    const label =
                                        key === MILESTONE_ALL
                                            ? t.tasks.milestoneFilter.all
                                            : t.tasks.milestoneFilter.noMilestone;
                                    return (
                                        <MenuItem
                                            key={`milestone-key-${String(key)}`}
                                            sx={{
                                                borderRadius: "8px",
                                                mx: 0.5,
                                                my: 0.25,
                                                transition: "all 0.2s ease",
                                                "&:hover": {
                                                    background: styles.buttonHoverBg,
                                                },
                                            }}
                                            onClick={() => handleCloseMilestoneFilter(key)}
                                        >
                                            <Box
                                                sx={{
                                                    width: "100%",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 1,
                                                }}
                                            >
                                                <FlagRoundedIcon
                                                    sx={{
                                                        fontSize: 14,
                                                        color: isDark
                                                            ? MILESTONE_ACCENT_DARK
                                                            : MILESTONE_ACCENT_LIGHT,
                                                        opacity: key === MILESTONE_ALL ? 0.5 : 1,
                                                    }}
                                                />
                                                <Typography
                                                    sx={{
                                                        fontSize: "13px",
                                                        fontWeight: isSelected ? 700 : 500,
                                                        color: isSelected
                                                            ? isDark
                                                                ? MILESTONE_ACCENT_DARK
                                                                : MILESTONE_ACCENT_LIGHT
                                                            : styles.textColor,
                                                        flex: 1,
                                                    }}
                                                >
                                                    {label}
                                                </Typography>
                                                {isSelected && (
                                                    <Box
                                                        sx={{
                                                            width: 16,
                                                            height: 16,
                                                            borderRadius: "4px",
                                                            background: isDark
                                                                ? MILESTONE_ACCENT_DARK
                                                                : MILESTONE_ACCENT_LIGHT,
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            fontSize: "10px",
                                                            color: "#fff",
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        ✓
                                                    </Box>
                                                )}
                                            </Box>
                                        </MenuItem>
                                    );
                                }
                            )}
                            {visibleMilestones.length > 0 && (
                                <Box
                                    sx={{
                                        height: "1px",
                                        background: styles.containerBorder,
                                        mx: 1,
                                        my: 0.5,
                                    }}
                                />
                            )}
                            {visibleMilestones.map((m) => renderMilestoneMenuItem(m))}

                            {/* "Show past milestones" expander — a "load more" that reveals the
                                outdated (Closed + ended-sprint) milestones as extra selectable
                                options. Hidden by default; selecting one filters to it (and
                                un-hides it — see applyFilters). Clicking the row only expands
                                the list, so keep the menu open. */}
                            {pastMilestones.length > 0 && (
                                <MenuItem
                                    sx={{
                                        borderRadius: "8px",
                                        mx: 0.5,
                                        my: 0.25,
                                        "&:hover": { background: styles.buttonHoverBg },
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPastMilestonesExpanded((prev) => !prev);
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: "100%",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                        }}
                                    >
                                        <HistoryRoundedIcon
                                            sx={{
                                                fontSize: 15,
                                                color: styles.mutedText,
                                                flexShrink: 0,
                                            }}
                                        />
                                        <Typography
                                            sx={{
                                                fontSize: "13px",
                                                fontWeight: 600,
                                                color: styles.textColor,
                                                flex: 1,
                                            }}
                                        >
                                            {pastMilestonesExpanded
                                                ? t.tasks.milestoneFilter.hidePastMilestones
                                                : t.tasks.milestoneFilter.showPastMilestones}
                                        </Typography>
                                        <Chip
                                            label={pastMilestones.length}
                                            size="small"
                                            sx={{
                                                height: 16,
                                                fontSize: "9px",
                                                fontWeight: 700,
                                                background: styles.buttonHoverBg,
                                                color: styles.mutedText,
                                                "& .MuiChip-label": { px: 0.75, lineHeight: 1 },
                                            }}
                                        />
                                    </Box>
                                </MenuItem>
                            )}
                            {/* MUI Menu manages focus over its direct children and
                                rejects Fragments, so the year → sprint → milestone
                                tree is flattened into a single keyed array via
                                flatMap rather than nested fragments. */}
                            {pastMilestonesExpanded &&
                                pastMilestonesByYear.flatMap((yearGroup) => {
                                    const yearOpen = expandedYears.has(yearGroup.year);
                                    const yearCount = yearGroup.sprints.reduce(
                                        (n, s) => n + s.milestones.length,
                                        0
                                    );
                                    const rows: React.ReactNode[] = [
                                        renderTreeFolderRow({
                                            rowKey: `past-year-row-${yearGroup.year}`,
                                            icon: (
                                                <CalendarMonthRoundedIcon
                                                    sx={{
                                                        fontSize: 14,
                                                        color: styles.mutedText,
                                                        flexShrink: 0,
                                                    }}
                                                />
                                            ),
                                            label: yearGroup.year,
                                            count: yearCount,
                                            open: yearOpen,
                                            indentPl: 3,
                                            onToggle: () =>
                                                toggleInSet(setExpandedYears, yearGroup.year),
                                        }),
                                    ];
                                    if (!yearOpen) return rows;
                                    for (const sprintGroup of yearGroup.sprints) {
                                        const sprintKey = `${yearGroup.year}::${
                                            sprintGroup.sprintId ?? "none"
                                        }`;
                                        const sprintOpen = expandedSprints.has(sprintKey);
                                        rows.push(
                                            renderTreeFolderRow({
                                                rowKey: `past-sprint-row-${sprintKey}`,
                                                icon: (
                                                    <DirectionsRunRoundedIcon
                                                        sx={{
                                                            fontSize: 14,
                                                            color: styles.mutedText,
                                                            flexShrink: 0,
                                                        }}
                                                    />
                                                ),
                                                label: sprintGroup.sprintName,
                                                count: sprintGroup.milestones.length,
                                                open: sprintOpen,
                                                indentPl: 5,
                                                onToggle: () =>
                                                    toggleInSet(setExpandedSprints, sprintKey),
                                            })
                                        );
                                        if (sprintOpen) {
                                            for (const m of sprintGroup.milestones) {
                                                rows.push(renderMilestoneMenuItem(m, 7));
                                            }
                                        }
                                    }
                                    return rows;
                                })}
                        </Menu>
                    </>
                )}

                {/* Milestone scope chip — appears when the user clicked
                    a milestone item in the sidebar. Clicking the X
                    clears the milestone-scoped view. */}
                {useTM.tableMilestoneFilterId != null && (
                    <Chip
                        label={(() => {
                            const target = useTM.tableMilestoneFilterId;
                            const m = useTM.allTasks.find(
                                (t) => t.isMilestone === true && t.milestoneId === target
                            );
                            return `Milestone: ${m?.title?.slice(0, 10) ?? `#${target}`}${m?.title?.length && m?.title?.length > 10 ? "..." : ""}`;
                        })()}
                        sx={{
                            fontSize: 12,
                            fontWeight: 600,
                            background: isDark ? "rgba(249,115,22,0.15)" : "rgba(249,115,22,0.1)",
                            color: isDark ? "#fb923c" : "#c2410c",
                            border: `1px solid ${
                                isDark ? "rgba(249,115,22,0.35)" : "rgba(249,115,22,0.25)"
                            }`,
                            borderRadius: "10px",
                            height: 32,
                            "& .MuiChip-deleteIcon": {
                                color: isDark ? "#fb923c" : "#c2410c",
                            },
                        }}
                        onDelete={() => useTM.setTableMilestoneFilter(null)}
                    />
                )}

                {/* Status Filter */}
                {!hideStatusFilter && (
                    <>
                        <AppTooltip
                            title={selectedStatus.map((status) => filterLabel(status)).join(", ")}
                        >
                            <Button
                                aria-controls={openStatusFilter ? "fade-menu" : undefined}
                                aria-expanded={openStatusFilter ? "true" : undefined}
                                aria-haspopup="true"
                                id="fade-button"
                                variant="contained"
                                sx={getFilterButtonStyle(
                                    selectedStatus[0],
                                    selectedStatus[0].label === "All"
                                )}
                                onClick={handleClickStatusFilter}
                            >
                                {fmt(t.tasks.filterButtons.status, {
                                    value: filterLabel(selectedStatus[0]),
                                })}
                                {selectedStatus.length > 1 && (
                                    <Chip
                                        label={`+${selectedStatus.length - 1}`}
                                        size="small"
                                        sx={{
                                            ml: 0.5,
                                            height: "18px",
                                            fontSize: "10px",
                                            fontWeight: 700,
                                            background: "rgba(255,255,255,0.2)",
                                            color: "inherit",
                                        }}
                                    />
                                )}
                            </Button>
                        </AppTooltip>
                        <Menu
                            anchorEl={anchorElStatusFilter}
                            id="fade-menu"
                            open={openStatusFilter}
                            slots={{ transition: Fade }}
                            slotProps={{
                                list: {
                                    "aria-labelledby": "fade-button",
                                },
                                paper: {
                                    sx: {
                                        background: styles.menuBg,
                                        border: `1px solid ${styles.menuBorder}`,
                                        borderRadius: "12px",
                                        boxShadow: isDark
                                            ? "0 8px 32px rgba(0,0,0,0.5)"
                                            : "0 8px 32px rgba(0,0,0,0.15)",
                                        mt: 1,
                                        minWidth: "160px",
                                    },
                                },
                            }}
                            onClose={() => setAnchorElStatusFilter(null)}
                        >
                            {predefinedStatusFilters.map((status) => {
                                const isSelected = selectedStatus.some(
                                    (items) => items.label === status.label
                                );
                                return (
                                    <MenuItem
                                        key={status.label}
                                        sx={{
                                            borderRadius: "8px",
                                            mx: 0.5,
                                            my: 0.25,
                                            transition: "all 0.2s ease",
                                            "&:hover": {
                                                background: styles.buttonHoverBg,
                                            },
                                        }}
                                        onClick={() => handleCloseStatusFilter(status)}
                                    >
                                        <Box
                                            sx={{
                                                width: "100%",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: "50%",
                                                    background: isDark
                                                        ? status.darkModeColor
                                                        : status.lightModeColor,
                                                    boxShadow: `0 0 6px ${isDark ? status.darkModeColor : status.lightModeColor}`,
                                                }}
                                            />
                                            <Typography
                                                sx={{
                                                    fontSize: "13px",
                                                    fontWeight: isSelected ? 700 : 500,
                                                    color: isSelected
                                                        ? isDark
                                                            ? status.darkModeColor
                                                            : status.lightModeColor
                                                        : styles.textColor,
                                                    flex: 1,
                                                }}
                                            >
                                                {filterLabel(status)}
                                            </Typography>
                                            {isSelected && (
                                                <Box
                                                    sx={{
                                                        width: 16,
                                                        height: 16,
                                                        borderRadius: "4px",
                                                        background: isDark
                                                            ? status.darkModeColor
                                                            : status.lightModeColor,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        fontSize: "10px",
                                                        color: "#fff",
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    ✓
                                                </Box>
                                            )}
                                        </Box>
                                    </MenuItem>
                                );
                            })}
                        </Menu>
                    </>
                )}

                {/* Tags Filter */}
                {selectedTags.length > 0 && (
                    <>
                        <AppTooltip title={selectedTags.map((tag) => filterLabel(tag)).join(", ")}>
                            <Button
                                aria-controls={openTagsFilter ? "fade-menu" : undefined}
                                aria-expanded={openTagsFilter ? "true" : undefined}
                                aria-haspopup="true"
                                variant="contained"
                                sx={getFilterButtonStyle(
                                    selectedTags[0],
                                    selectedTags.some((tag) => tag.label === "All")
                                )}
                                onClick={handleClickTagsFilter}
                            >
                                {fmt(t.tasks.filterButtons.tags, {
                                    value: filterLabel(selectedTags[0]),
                                })}
                                {selectedTags.length > 1 && (
                                    <Chip
                                        label={`+${selectedTags.length - 1}`}
                                        size="small"
                                        sx={{
                                            ml: 0.5,
                                            height: "18px",
                                            fontSize: "10px",
                                            fontWeight: 700,
                                            background: "rgba(255,255,255,0.2)",
                                            color: "inherit",
                                        }}
                                    />
                                )}
                            </Button>
                        </AppTooltip>
                        <Menu
                            anchorEl={anchorElTagsFilter}
                            open={openTagsFilter}
                            slots={{ transition: Fade }}
                            slotProps={{
                                paper: {
                                    className: `custom-scrollbar-${isDark ? "dark" : "light"}`,
                                    sx: {
                                        background: styles.menuBg,
                                        border: `1px solid ${styles.menuBorder}`,
                                        borderRadius: "12px",
                                        boxShadow: isDark
                                            ? "0 8px 32px rgba(0,0,0,0.5)"
                                            : "0 8px 32px rgba(0,0,0,0.15)",
                                        mt: 1,
                                        minWidth: "160px",
                                        maxHeight: "300px",
                                    },
                                },
                            }}
                            onClose={() => setAnchorElTagsFilter(null)}
                        >
                            {predefinedTagsFilters.map((tag) => {
                                const isSelected = selectedTags.some(
                                    (items) => items.label === tag.label
                                );
                                return (
                                    <MenuItem
                                        key={tag.label}
                                        sx={{
                                            borderRadius: "8px",
                                            mx: 0.5,
                                            my: 0.25,
                                            transition: "all 0.2s ease",
                                            "&:hover": {
                                                background: styles.buttonHoverBg,
                                            },
                                        }}
                                        onClick={() => handleCloseTagsFilter(tag)}
                                    >
                                        <Box
                                            sx={{
                                                width: "100%",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: "50%",
                                                    background: isDark
                                                        ? tag.darkModeColor
                                                        : tag.lightModeColor,
                                                    boxShadow: `0 0 6px ${isDark ? tag.darkModeColor : tag.lightModeColor}`,
                                                }}
                                            />
                                            <Typography
                                                sx={{
                                                    fontSize: "13px",
                                                    fontWeight: isSelected ? 700 : 500,
                                                    color: isSelected
                                                        ? isDark
                                                            ? tag.darkModeColor
                                                            : tag.lightModeColor
                                                        : styles.textColor,
                                                    flex: 1,
                                                }}
                                            >
                                                {filterLabel(tag)}
                                            </Typography>
                                            {isSelected && (
                                                <Box
                                                    sx={{
                                                        width: 16,
                                                        height: 16,
                                                        borderRadius: "4px",
                                                        background: isDark
                                                            ? tag.darkModeColor
                                                            : tag.lightModeColor,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        fontSize: "10px",
                                                        color: "#fff",
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    ✓
                                                </Box>
                                            )}
                                        </Box>
                                    </MenuItem>
                                );
                            })}
                        </Menu>
                    </>
                )}

                {/* Priority Filter */}
                <AppTooltip
                    title={selectedPriorities.map((priority) => filterLabel(priority)).join(", ")}
                >
                    <Button
                        aria-controls={openPriorityFilter ? "fade-menu" : undefined}
                        aria-expanded={openPriorityFilter ? "true" : undefined}
                        aria-haspopup="true"
                        variant="contained"
                        sx={getFilterButtonStyle(
                            selectedPriorities[0],
                            selectedPriorities.some((priority) => priority.label === "All")
                        )}
                        onClick={handleClickPriorityFilter}
                    >
                        {fmt(t.tasks.filterButtons.priority, {
                            value: filterLabel(selectedPriorities[0]),
                        })}
                        {selectedPriorities.length > 1 && (
                            <Chip
                                label={`+${selectedPriorities.length - 1}`}
                                size="small"
                                sx={{
                                    ml: 0.5,
                                    height: "18px",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    background: "rgba(255,255,255,0.2)",
                                    color: "inherit",
                                }}
                            />
                        )}
                    </Button>
                </AppTooltip>
                <Menu
                    anchorEl={anchorElPriorityFilter}
                    open={openPriorityFilter}
                    slots={{ transition: Fade }}
                    slotProps={{
                        paper: {
                            sx: {
                                background: styles.menuBg,
                                border: `1px solid ${styles.menuBorder}`,
                                borderRadius: "12px",
                                boxShadow: isDark
                                    ? "0 8px 32px rgba(0,0,0,0.5)"
                                    : "0 8px 32px rgba(0,0,0,0.15)",
                                mt: 1,
                                minWidth: "160px",
                            },
                        },
                    }}
                    onClose={() => setAnchorElPriorityFilter(null)}
                >
                    {predefinedPriorityFilters.map((priority) => {
                        const isSelected = selectedPriorities.some(
                            (items) => items.label === priority.label
                        );
                        return (
                            <MenuItem
                                key={priority.label}
                                sx={{
                                    borderRadius: "8px",
                                    mx: 0.5,
                                    my: 0.25,
                                    transition: "all 0.2s ease",
                                    "&:hover": {
                                        background: styles.buttonHoverBg,
                                    },
                                }}
                                onClick={() => handleClosePriorityFilter(priority)}
                            >
                                <Box
                                    sx={{
                                        width: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: "50%",
                                            background: isDark
                                                ? priority.darkModeColor
                                                : priority.lightModeColor,
                                            boxShadow: `0 0 6px ${isDark ? priority.darkModeColor : priority.lightModeColor}`,
                                        }}
                                    />
                                    <Typography
                                        sx={{
                                            fontSize: "13px",
                                            fontWeight: isSelected ? 700 : 500,
                                            color: isSelected
                                                ? isDark
                                                    ? priority.darkModeColor
                                                    : priority.lightModeColor
                                                : styles.textColor,
                                            flex: 1,
                                        }}
                                    >
                                        {filterLabel(priority)}
                                    </Typography>
                                    {isSelected && (
                                        <Box
                                            sx={{
                                                width: 16,
                                                height: 16,
                                                borderRadius: "4px",
                                                background: isDark
                                                    ? priority.darkModeColor
                                                    : priority.lightModeColor,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "10px",
                                                color: "#fff",
                                                fontWeight: 700,
                                            }}
                                        >
                                            ✓
                                        </Box>
                                    )}
                                </Box>
                            </MenuItem>
                        );
                    })}
                </Menu>

                {/* Effort Level Filter */}
                <AppTooltip
                    title={selectedEffortLevels
                        .map((effortLevel) => filterLabel(effortLevel))
                        .join(", ")}
                >
                    <Button
                        aria-controls={openEffortLevelFilter ? "fade-menu" : undefined}
                        aria-expanded={openEffortLevelFilter ? "true" : undefined}
                        aria-haspopup="true"
                        variant="contained"
                        sx={getFilterButtonStyle(
                            selectedEffortLevels[0],
                            selectedEffortLevels.some((effortLevel) => effortLevel.label === "All")
                        )}
                        onClick={handleClickEffortLevelFilter}
                    >
                        {fmt(t.tasks.filterButtons.effort, {
                            value: filterLabel(selectedEffortLevels[0]),
                        })}
                        {selectedEffortLevels.length > 1 && (
                            <Chip
                                label={`+${selectedEffortLevels.length - 1}`}
                                size="small"
                                sx={{
                                    ml: 0.5,
                                    height: "18px",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    background: "rgba(255,255,255,0.2)",
                                    color: "inherit",
                                }}
                            />
                        )}
                    </Button>
                </AppTooltip>
                <Menu
                    anchorEl={anchorElEffortLevelFilter}
                    open={openEffortLevelFilter}
                    slots={{ transition: Fade }}
                    slotProps={{
                        paper: {
                            sx: {
                                background: styles.menuBg,
                                border: `1px solid ${styles.menuBorder}`,
                                borderRadius: "12px",
                                boxShadow: isDark
                                    ? "0 8px 32px rgba(0,0,0,0.5)"
                                    : "0 8px 32px rgba(0,0,0,0.15)",
                                mt: 1,
                                minWidth: "160px",
                            },
                        },
                    }}
                    onClose={() => setAnchorElEffortLevelFilter(null)}
                >
                    {predefinedEffortLevelFilters.map((effortLevel) => {
                        const isSelected = selectedEffortLevels.some(
                            (items) => items.label === effortLevel.label
                        );
                        return (
                            <MenuItem
                                key={effortLevel.label}
                                sx={{
                                    borderRadius: "8px",
                                    mx: 0.5,
                                    my: 0.25,
                                    transition: "all 0.2s ease",
                                    "&:hover": {
                                        background: styles.buttonHoverBg,
                                    },
                                }}
                                onClick={() => handleCloseEffortLevelFilter(effortLevel)}
                            >
                                <Box
                                    sx={{
                                        width: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: "50%",
                                            background: isDark
                                                ? effortLevel.darkModeColor
                                                : effortLevel.lightModeColor,
                                            boxShadow: `0 0 6px ${isDark ? effortLevel.darkModeColor : effortLevel.lightModeColor}`,
                                        }}
                                    />
                                    <Typography
                                        sx={{
                                            fontSize: "13px",
                                            fontWeight: isSelected ? 700 : 500,
                                            color: isSelected
                                                ? isDark
                                                    ? effortLevel.darkModeColor
                                                    : effortLevel.lightModeColor
                                                : styles.textColor,
                                            flex: 1,
                                        }}
                                    >
                                        {filterLabel(effortLevel)}
                                    </Typography>
                                    {isSelected && (
                                        <Box
                                            sx={{
                                                width: 16,
                                                height: 16,
                                                borderRadius: "4px",
                                                background: isDark
                                                    ? effortLevel.darkModeColor
                                                    : effortLevel.lightModeColor,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "10px",
                                                color: "#fff",
                                                fontWeight: 700,
                                            }}
                                        >
                                            ✓
                                        </Box>
                                    )}
                                </Box>
                            </MenuItem>
                        );
                    })}
                </Menu>

                {/* Member Filter — multi-select over the team's members.
                    Filtering by a member surfaces every task/milestone
                    assigned to them; in the table the (unassigned) ancestors
                    of a matching subtask are still shown — dimmed and
                    non-interactive — so the dependency tree stays legible. */}
                {teamMembers && teamMembers.length > 0 && (
                    <>
                        <AppTooltip
                            title={(() => {
                                if (
                                    selectedMemberKeys.length === 1 &&
                                    selectedMemberKeys[0] === MEMBER_ALL
                                ) {
                                    return t.tasks.memberFilter.allMembers;
                                }
                                return selectedMemberKeys
                                    .map((k) => {
                                        if (k === MEMBER_NONE)
                                            return t.tasks.memberFilter.noAssignee;
                                        const m = teamMembers.find(
                                            (mm) => String(mm.userId) === k
                                        );
                                        return m?.userName ?? k;
                                    })
                                    .join(", ");
                            })()}
                        >
                            <Button
                                aria-controls={openMemberFilter ? "fade-menu" : undefined}
                                aria-expanded={openMemberFilter ? "true" : undefined}
                                aria-haspopup="true"
                                variant="contained"
                                startIcon={
                                    <PersonRoundedIcon
                                        sx={{
                                            fontSize: "16px",
                                            color:
                                                selectedMemberKeys.length === 1 &&
                                                selectedMemberKeys[0] === MEMBER_ALL
                                                    ? isDark
                                                        ? MEMBER_ACCENT_DARK
                                                        : MEMBER_ACCENT_LIGHT
                                                    : "#fff",
                                        }}
                                    />
                                }
                                sx={{
                                    color:
                                        selectedMemberKeys.length === 1 &&
                                        selectedMemberKeys[0] === MEMBER_ALL
                                            ? styles.textColor
                                            : "#fff",
                                    background:
                                        selectedMemberKeys.length === 1 &&
                                        selectedMemberKeys[0] === MEMBER_ALL
                                            ? isDark
                                                ? "rgba(99,102,241,0.15)"
                                                : "rgba(99,102,241,0.1)"
                                            : isDark
                                              ? `linear-gradient(135deg, ${alpha("#6366f1", 0.5)} 0%, ${alpha("#6366f1", 0.7)} 100%)`
                                              : `linear-gradient(135deg, ${alpha("#6366f1", 0.75)} 0%, ${alpha("#6366f1", 0.95)} 100%)`,
                                    border: `1px solid ${
                                        isDark ? "rgba(99,102,241,0.35)" : "rgba(99,102,241,0.6)"
                                    }`,
                                    borderRadius: "10px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    height: "32px",
                                    whiteSpace: "nowrap",
                                    px: 1.5,
                                    my: 0.5,
                                    textTransform: "none",
                                    boxShadow: isDark
                                        ? "0 2px 8px rgba(99,102,241,0.25)"
                                        : "0 2px 8px rgba(99,102,241,0.2)",
                                    transition: "all 0.2s ease",
                                    flexShrink: 0,
                                    "&:hover": {
                                        background:
                                            selectedMemberKeys.length === 1 &&
                                            selectedMemberKeys[0] === MEMBER_ALL
                                                ? isDark
                                                    ? "rgba(99,102,241,0.25)"
                                                    : "rgba(99,102,241,0.2)"
                                                : isDark
                                                  ? `linear-gradient(135deg, ${alpha("#6366f1", 0.6)} 0%, ${alpha("#6366f1", 0.8)} 100%)`
                                                  : `linear-gradient(135deg, ${alpha("#6366f1", 0.85)} 0%, ${alpha("#6366f1", 1)} 100%)`,
                                        transform: "translateY(-1px)",
                                    },
                                }}
                                onClick={handleClickMemberFilter}
                            >
                                Member: {memberFilterButtonLabel}
                                {selectedMemberKeys.length > 1 && (
                                    <Chip
                                        label={`+${selectedMemberKeys.length - 1}`}
                                        size="small"
                                        sx={{
                                            ml: 0.5,
                                            height: "18px",
                                            fontSize: "10px",
                                            fontWeight: 700,
                                            background: "rgba(255,255,255,0.2)",
                                            color: "inherit",
                                        }}
                                    />
                                )}
                            </Button>
                        </AppTooltip>
                        <Menu
                            anchorEl={anchorElMemberFilter}
                            open={openMemberFilter}
                            slots={{ transition: Fade }}
                            slotProps={{
                                paper: {
                                    className: `custom-scrollbar-${isDark ? "dark" : "light"}`,
                                    sx: {
                                        background: styles.menuBg,
                                        border: `1px solid ${styles.menuBorder}`,
                                        borderRadius: "12px",
                                        boxShadow: isDark
                                            ? "0 8px 32px rgba(0,0,0,0.5)"
                                            : "0 8px 32px rgba(0,0,0,0.15)",
                                        mt: 1,
                                        minWidth: "220px",
                                        maxHeight: "320px",
                                    },
                                },
                            }}
                            onClose={() => setAnchorElMemberFilter(null)}
                        >
                            {([MEMBER_ALL, MEMBER_NONE] as MemberFilterKey[]).map((key) => {
                                const isSelected = selectedMemberKeys.some((k) => k === key);
                                const label =
                                    key === MEMBER_ALL
                                        ? t.tasks.memberFilter.all
                                        : t.tasks.memberFilter.noAssignee;
                                const accent = isDark ? MEMBER_ACCENT_DARK : MEMBER_ACCENT_LIGHT;
                                return (
                                    <MenuItem
                                        key={`member-key-${key}`}
                                        sx={{
                                            borderRadius: "8px",
                                            mx: 0.5,
                                            my: 0.25,
                                            "&:hover": { background: styles.buttonHoverBg },
                                        }}
                                        onClick={() => handleCloseMemberFilter(key)}
                                    >
                                        <Box
                                            sx={{
                                                width: "100%",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                            }}
                                        >
                                            <PersonRoundedIcon
                                                sx={{
                                                    fontSize: 16,
                                                    color: accent,
                                                    opacity: key === MEMBER_ALL ? 0.5 : 1,
                                                }}
                                            />
                                            <Typography
                                                sx={{
                                                    fontSize: "13px",
                                                    fontWeight: isSelected ? 700 : 500,
                                                    color: isSelected ? accent : styles.textColor,
                                                    flex: 1,
                                                }}
                                            >
                                                {label}
                                            </Typography>
                                            {isSelected && (
                                                <Box
                                                    sx={{
                                                        width: 16,
                                                        height: 16,
                                                        borderRadius: "4px",
                                                        background: accent,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        fontSize: "10px",
                                                        color: "#fff",
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    ✓
                                                </Box>
                                            )}
                                        </Box>
                                    </MenuItem>
                                );
                            })}
                            <Box
                                sx={{
                                    height: "1px",
                                    background: styles.containerBorder,
                                    mx: 1,
                                    my: 0.5,
                                }}
                            />
                            {teamMembers.map((m) => {
                                const memberId = String(m.userId);
                                const isSelected = selectedMemberKeys.some((k) => k === memberId);
                                const accent = isDark ? MEMBER_ACCENT_DARK : MEMBER_ACCENT_LIGHT;
                                return (
                                    <MenuItem
                                        key={`member-${memberId}`}
                                        sx={{
                                            borderRadius: "8px",
                                            mx: 0.5,
                                            my: 0.25,
                                            "&:hover": { background: styles.buttonHoverBg },
                                        }}
                                        onClick={() => handleCloseMemberFilter(memberId)}
                                    >
                                        <Box
                                            sx={{
                                                width: "100%",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                                minWidth: 0,
                                            }}
                                        >
                                            <Avatar
                                                src={buildAvatarSrc(m.avatarImgPath)}
                                                sx={{ width: 22, height: 22, fontSize: 11 }}
                                            >
                                                {(m.userName?.[0] || "?").toUpperCase()}
                                            </Avatar>
                                            <Typography
                                                sx={{
                                                    fontSize: "13px",
                                                    fontWeight: isSelected ? 700 : 500,
                                                    color: isSelected ? accent : styles.textColor,
                                                    flex: 1,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                    minWidth: 0,
                                                }}
                                            >
                                                {m.userName}
                                            </Typography>
                                            {isSelected && (
                                                <Box
                                                    sx={{
                                                        width: 16,
                                                        height: 16,
                                                        borderRadius: "4px",
                                                        background: accent,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        fontSize: "10px",
                                                        color: "#fff",
                                                        fontWeight: 700,
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    ✓
                                                </Box>
                                            )}
                                        </Box>
                                    </MenuItem>
                                );
                            })}
                        </Menu>
                    </>
                )}

                <Box sx={{ flex: 1 }} />

                {/* Saved Filters — named, project-shared selections.
                    Sits after the dimension filters and before Reset:
                    it acts on the whole bar rather than narrowing one
                    dimension, so it belongs with Reset in the trailing
                    action group, not in the row of dimension chips.
                    Renders only when a project + team are resolved. */}
                <SavedFiltersMenu
                    getCurrentFilters={getCurrentSavedFilterPayload}
                    isCurrentSelection={isCurrentSavedFilterSelection}
                    projectId={savedFiltersProjectId}
                    teamId={savedFiltersTeamId}
                    onApply={applySavedFilter}
                />

                {/* Reset Filters Button */}
                <AppTooltip title={t.tasks.tooltips.resetFilters}>
                    <Button
                        startIcon={<RestartAltIcon sx={{ fontSize: "16px" }} />}
                        variant="outlined"
                        sx={{
                            color: isDark ? "#f87171" : "#dc2626",
                            background: styles.resetBg,
                            border: `1px solid ${styles.resetBorder}`,
                            borderRadius: "10px",
                            fontSize: "12px",
                            fontWeight: 600,
                            height: "32px",
                            px: 1.5,
                            textTransform: "none",
                            flexShrink: 0,
                            transition: "all 0.2s ease",
                            "&:hover": {
                                background: styles.resetHover,
                                border: `1px solid ${isDark ? "rgba(239,68,68,0.5)" : "rgba(239,68,68,0.4)"}`,
                                transform: "translateY(-1px)",
                                boxShadow: isDark
                                    ? "0 4px 12px rgba(239,68,68,0.2)"
                                    : "0 4px 12px rgba(239,68,68,0.15)",
                            },
                        }}
                        onClick={resetFilters}
                    >
                        Reset
                    </Button>
                </AppTooltip>
            </Stack>
        </Box>
    );
};
