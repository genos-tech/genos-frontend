import * as React from "react";
import { useEffect, useMemo } from "react";
import FilterListIcon from "@mui/icons-material/FilterList";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useColorScheme } from "@mui/joy/styles";
import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import Button from "@mui/material/Button";
import Fade from "@mui/material/Fade";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { tooltipClasses } from "@mui/material/Tooltip";
import { alpha } from "@mui/system";

import { TaskFilterMenuStyles } from "../../../../components/ui/styles/commonStyle";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { TaskTableProps } from "../../../../types/tasks";
import {
    getMilestoneStatusChipColor,
    selectVisibleMilestones,
} from "../../sprint-milestone/utils/sortMilestones";
import {
    FilterProps,
    predefinedEffortLevelFilters,
    predefinedPriorityFilters,
    predefinedStatusFilters,
} from "../../types/TaskTableTypes";

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

type TaskFilterMenuProps = {
    isTaskUpdated?: boolean;
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
    hideStatusFilter?: boolean;
};

export const TaskFilterMenu = (props: TaskFilterMenuProps) => {
    const {
        isTaskUpdated,
        useTM,
        useSM,
        predefinedTagsFilters,
        setCurrentDisplayingTasks,
        setVisibleChildTaskIds,
        hideStatusFilter,
    } = props;
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
    const [selectedStatus, setSelectedStatus] = React.useState<FilterProps[]>(
        hideStatusFilter ? [predefinedStatusFilters[0]] : predefinedStatusFilters.slice(1, 4)
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

        applyFilters(
            newStatuses,
            selectedTags,
            selectedPriorities,
            selectedEffortLevels,
            selectedMilestoneKeys
        );
    };

    // Tags filter
    const [selectedTags, setSelectedTags] = React.useState<FilterProps[]>(
        predefinedTagsFilters.length > 0 ? [predefinedTagsFilters[0]] : []
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
            newTags = [predefinedTagsFilters[0]];
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
            newTags = [predefinedTagsFilters[0]];
            setSelectedTags(newTags);
            setAnchorElTagsFilter(null);
        }

        applyFilters(
            selectedStatus,
            newTags,
            selectedPriorities,
            selectedEffortLevels,
            selectedMilestoneKeys
        );
    };

    React.useEffect(() => {
        if (predefinedTagsFilters.length > 0) {
            setSelectedTags([predefinedTagsFilters[0]]);
        }
    }, [predefinedTagsFilters]);

    // Priority filter
    const [selectedPriorities, setSelectedPriorities] = React.useState<FilterProps[]>([
        predefinedPriorityFilters[0],
    ]);
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

        applyFilters(
            selectedStatus,
            selectedTags,
            newPriorities,
            selectedEffortLevels,
            selectedMilestoneKeys
        );
    };

    // Effort level filter
    const [selectedEffortLevels, setSelectedEffortLevels] = React.useState<FilterProps[]>([
        predefinedEffortLevelFilters[0],
    ]);
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

        applyFilters(
            selectedStatus,
            selectedTags,
            selectedPriorities,
            newEffortLevels,
            selectedMilestoneKeys
        );
    };

    // Milestone filter — pulls from the same visible/sorted milestone
    // set the sidebar shows in `MilestonesListItem` so the user can
    // narrow the table to one or more milestones (or explicitly the
    // unattached ones via the "No milestone" sentinel).
    const currentProjectId = useTM.allTasks[0]?.projectId ?? null;
    const visibleMilestones = useMemo(() => {
        if (!useSM || currentProjectId == null) return [];
        return selectVisibleMilestones(
            useSM.projectMilestones[currentProjectId] ?? [],
            useSM.projectSprints[currentProjectId] ?? []
        );
    }, [useSM, currentProjectId]);
    const projectSprints = useMemo(() => {
        if (!useSM || currentProjectId == null) return [];
        return useSM.projectSprints[currentProjectId] ?? [];
    }, [useSM, currentProjectId]);
    const [selectedMilestoneKeys, setSelectedMilestoneKeys] = React.useState<MilestoneFilterKey[]>(
        [MILESTONE_ALL]
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
        const validIds = new Set<number>(visibleMilestones.map((m) => m.milestoneId));
        const pruned = selectedMilestoneKeys.filter(
            (k) => k === MILESTONE_NONE || (typeof k === "number" && validIds.has(k))
        );
        if (pruned.length === selectedMilestoneKeys.length) return;
        setSelectedMilestoneKeys(pruned.length > 0 ? pruned : [MILESTONE_ALL]);
    }, [visibleMilestones, currentProjectId]);
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

        applyFilters(selectedStatus, selectedTags, selectedPriorities, selectedEffortLevels, next);
    };

    const milestoneFilterButtonLabel = useMemo(() => {
        if (selectedMilestoneKeys.length === 1 && selectedMilestoneKeys[0] === MILESTONE_ALL) {
            return t.tasks.milestoneFilter.all;
        }
        const first = selectedMilestoneKeys[0];
        if (first === MILESTONE_NONE) return t.tasks.milestoneFilter.noMilestone;
        if (typeof first === "number") {
            const m = visibleMilestones.find((mm) => mm.milestoneId === first);
            const title = m?.title ?? `#${first}`;
            return title.length > 16 ? `${title.slice(0, 16)}…` : title;
        }
        return t.tasks.milestoneFilter.all;
    }, [selectedMilestoneKeys, visibleMilestones, t]);

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
    const applyFilters = (
        statuses: FilterProps[],
        tags: FilterProps[],
        priority: FilterProps[],
        effortLevel: FilterProps[],
        milestoneSel: MilestoneFilterKey[]
    ) => {
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

        // --- Milestone (multi-select) predicate ---
        const milestoneFilterActive = !(
            milestoneSel.length === 1 && milestoneSel[0] === MILESTONE_ALL
        );
        const milestoneAllowNone = milestoneSel.includes(MILESTONE_NONE);
        const milestoneIdSet = new Set<number>(
            milestoneSel.filter((k): k is number => typeof k === "number")
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
            ((statuses.length === 1 && statuses[0].label === "All") ||
                (tags.length === 1 && tags[0].label === "All") ||
                (priority.length === 1 && priority[0].label === "All") ||
                (effortLevel.length === 1 && effortLevel[0].label === "All"));

        const filteredTop: TaskTableProps[] = [];
        const childIdSet = new Set<string>();

        for (const task of useTM.allTasks) {
            // Status (string + expired axes)
            if (statusStringFilter !== null && !statusStringFilter.has(task.status ?? "")) {
                continue;
            }
            if (requireExpired) {
                if (!task.dueDate) continue;
                const ts = new Date(task.dueDate).getTime();
                if (!Number.isFinite(ts) || ts >= now) continue;
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

            // Milestone multi-select
            if (milestoneFilterActive) {
                if (task.milestoneId == null) {
                    if (!milestoneAllowNone) continue;
                } else if (!milestoneIdSet.has(task.milestoneId)) {
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

        setCurrentDisplayingTasks(filteredTop);

        if (setVisibleChildTaskIds) {
            setVisibleChildTaskIds(childIdSet);
        }
    };

    const resetFilters = () => {
        setSelectedStatus(predefinedStatusFilters.slice(1, 4));
        setSelectedTags([predefinedTagsFilters[0]]);
        setSelectedPriorities([predefinedPriorityFilters[0]]);
        setSelectedEffortLevels([predefinedEffortLevelFilters[0]]);
        setSelectedMilestoneKeys([MILESTONE_ALL]);
        applyFilters(
            predefinedStatusFilters.slice(1, 4),
            [predefinedTagsFilters[0]],
            [predefinedPriorityFilters[0]],
            [predefinedEffortLevelFilters[0]],
            [MILESTONE_ALL]
        );
    };

    useEffect(() => {
        applyFilters(
            selectedStatus,
            selectedTags,
            selectedPriorities,
            selectedEffortLevels,
            selectedMilestoneKeys
        );
    }, [useTM.allTasks, useTM.tableMilestoneFilterId, selectedMilestoneKeys]);

    useEffect(() => {
        if (isTaskUpdated) {
            applyFilters(
                selectedStatus,
                selectedTags,
                selectedPriorities,
                selectedEffortLevels,
                selectedMilestoneKeys
            );
        }
    }, [isTaskUpdated]);

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
                    : "0 4px 20px rgba(124,58,237,0.08)",
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
                            color: isDark ? "#a78bfa" : "#6d28d9",
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

                {/* Milestone Filter — multi-select drawn from the same
                    visible/sorted set the sidebar shows in
                    `MilestonesListItem`. Hidden while the sidebar's
                    scope chip is active so users aren't confused by
                    two competing milestone narrowing controls. */}
                {useSM && useTM.tableMilestoneFilterId == null && (
                    <>
                        <Tooltip
                            placement="top"
                            slotProps={{
                                popper: {
                                    sx: {
                                        [`& .${tooltipClasses.tooltip}`]: {
                                            background: styles.menuBg,
                                            color: styles.textColor,
                                            border: `1px solid ${styles.menuBorder}`,
                                            boxShadow: isDark
                                                ? "0 4px 12px rgba(0,0,0,0.4)"
                                                : "0 4px 12px rgba(0,0,0,0.1)",
                                            fontSize: 11,
                                            borderRadius: "8px",
                                            px: 1.5,
                                            py: 0.5,
                                        },
                                    },
                                },
                            }}
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
                        </Tooltip>
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
                            {visibleMilestones.map((m) => {
                                const isSelected = selectedMilestoneKeys.some(
                                    (k) => k === m.milestoneId
                                );
                                const sprintName =
                                    m.sprintId == null
                                        ? t.tasks.milestoneFilter.noSprint
                                        : (projectSprints.find((s) => s.sprintId === m.sprintId)
                                              ?.name ?? t.tasks.milestoneFilter.sprintFallback);
                                return (
                                    <MenuItem
                                        key={`milestone-${m.milestoneId}`}
                                        sx={{
                                            borderRadius: "8px",
                                            mx: 0.5,
                                            my: 0.25,
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
                                                    color: isDark
                                                        ? MILESTONE_ACCENT_DARK
                                                        : MILESTONE_ACCENT_LIGHT,
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
                                                              const tone =
                                                                  getMilestoneStatusChipColor(
                                                                      m.status as string
                                                                  );
                                                              return (
                                                                  <Chip
                                                                      label={m.status}
                                                                      size="small"
                                                                      sx={{
                                                                          height: 16,
                                                                          fontSize: "9px",
                                                                          fontWeight: 700,
                                                                          backgroundColor:
                                                                              tone.color,
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
                        onDelete={() => useTM.setTableMilestoneFilterId(null)}
                    />
                )}

                {/* Status Filter */}
                {!hideStatusFilter && (
                    <>
                        <Tooltip
                            placement="top"
                            title={selectedStatus.map((status) => filterLabel(status)).join(", ")}
                            slotProps={{
                                popper: {
                                    sx: {
                                        [`& .${tooltipClasses.tooltip}`]: {
                                            background: styles.menuBg,
                                            color: styles.textColor,
                                            border: `1px solid ${styles.menuBorder}`,
                                            boxShadow: isDark
                                                ? "0 4px 12px rgba(0,0,0,0.4)"
                                                : "0 4px 12px rgba(0,0,0,0.1)",
                                            fontSize: 11,
                                            borderRadius: "8px",
                                            px: 1.5,
                                            py: 0.5,
                                        },
                                    },
                                },
                            }}
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
                                Status: {selectedStatus[0].label}
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
                        </Tooltip>
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
                        <Tooltip
                            placement="top"
                            title={selectedTags.map((tag) => filterLabel(tag)).join(", ")}
                            slotProps={{
                                popper: {
                                    sx: {
                                        [`& .${tooltipClasses.tooltip}`]: {
                                            background: styles.menuBg,
                                            color: styles.textColor,
                                            border: `1px solid ${styles.menuBorder}`,
                                            boxShadow: isDark
                                                ? "0 4px 12px rgba(0,0,0,0.4)"
                                                : "0 4px 12px rgba(0,0,0,0.1)",
                                            fontSize: 11,
                                            borderRadius: "8px",
                                            px: 1.5,
                                            py: 0.5,
                                        },
                                    },
                                },
                            }}
                        >
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
                                Tags: {selectedTags[0].label}
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
                        </Tooltip>
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
                <Tooltip
                    placement="top"
                    title={selectedPriorities.map((priority) => filterLabel(priority)).join(", ")}
                    slotProps={{
                        popper: {
                            sx: {
                                [`& .${tooltipClasses.tooltip}`]: {
                                    background: styles.menuBg,
                                    color: styles.textColor,
                                    border: `1px solid ${styles.menuBorder}`,
                                    boxShadow: isDark
                                        ? "0 4px 12px rgba(0,0,0,0.4)"
                                        : "0 4px 12px rgba(0,0,0,0.1)",
                                    fontSize: 11,
                                    borderRadius: "8px",
                                    px: 1.5,
                                    py: 0.5,
                                },
                            },
                        },
                    }}
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
                        Priority: {selectedPriorities[0].label}
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
                </Tooltip>
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
                <Tooltip
                    placement="top"
                    title={selectedEffortLevels
                        .map((effortLevel) => filterLabel(effortLevel))
                        .join(", ")}
                    slotProps={{
                        popper: {
                            sx: {
                                [`& .${tooltipClasses.tooltip}`]: {
                                    background: styles.menuBg,
                                    color: styles.textColor,
                                    border: `1px solid ${styles.menuBorder}`,
                                    boxShadow: isDark
                                        ? "0 4px 12px rgba(0,0,0,0.4)"
                                        : "0 4px 12px rgba(0,0,0,0.1)",
                                    fontSize: 11,
                                    borderRadius: "8px",
                                    px: 1.5,
                                    py: 0.5,
                                },
                            },
                        },
                    }}
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
                        Effort: {selectedEffortLevels[0].label}
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
                </Tooltip>
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

                <Box sx={{ flex: 1 }} />

                {/* Reset Filters Button */}
                <Tooltip
                    placement="top"
                    title={t.tasks.tooltips.resetFilters}
                    slotProps={{
                        popper: {
                            sx: {
                                [`& .${tooltipClasses.tooltip}`]: {
                                    background: styles.menuBg,
                                    color: styles.textColor,
                                    border: `1px solid ${styles.menuBorder}`,
                                    fontSize: 11,
                                    borderRadius: "8px",
                                    px: 1.5,
                                    py: 0.5,
                                },
                            },
                        },
                    }}
                >
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
                </Tooltip>
            </Stack>
        </Box>
    );
};
