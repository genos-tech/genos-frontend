import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import Stack from "@mui/joy/Stack";
import { useColorScheme } from "@mui/joy/styles";
import Switch from "@mui/joy/Switch";
import Typography from "@mui/joy/Typography";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { Socket } from "socket.io-client";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useAuth } from "../../../../context/AuthContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { useTaskSortPreferences } from "../../../../hooks/common/useTaskSortPreferences";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { TagListProps, TaskTableProps } from "../../../../types/tasks";
import { LazyTaskDiagram } from "../../diagram/components/LazyTaskDiagram";
import { updateTaskFromTable } from "../../services/updateTaskFromTable";
import { FilterProps } from "../../types/TaskTableTypes";
import { buildComparator } from "../../utils/sortTask";
import { buildBoardDisplaySet } from "../../utils/sprintBoardDisplay";
import { formatTaskDisplayId } from "../../utils/taskDisplayId";
import { taskFilterStorageKey } from "../../utils/taskFilterStorage";
import { statuses } from "../../utils/taskMeta";
import { TaskFilterMenu } from "../table/TaskFilterMenu";
import { ColumnConfig, SprintBoardColumn } from "./SprintBoardColumn";

const materialTheme = createTheme({ cssVariables: true });

// Sort tiers (priority/due-date/etc. ranking, comparator builder) now
// live in features/tasks/utils/sortTask.ts so the sprint board and the
// task table share one set of rank maps. Selection is owned by the
// Settings modal via `useTaskSortPreferences`.

// Column definitions. `title` is filled in at render time from the
// `titleKey` so the board columns stay localizable while `status` stays
// the backend enum value the filterModel keys off.
const COLUMNS: ColumnConfig[] = [
    {
        id: "open",
        title: "Open",
        titleKey: "columnOpen",
        status: "Open",
        color: "#0044c2",
        bgColor: "rgba(0, 68, 194, 0.1)",
    },
    {
        id: "wip",
        title: "Work In Progress",
        titleKey: "columnWip",
        status: "WIP",
        color: "#ff8c00",
        bgColor: "rgba(255, 140, 0, 0.1)",
    },
    {
        id: "blocked",
        title: "Blocked",
        titleKey: "columnBlocked",
        status: "Blocked",
        color: "#e11d48",
        bgColor: "rgba(225, 29, 72, 0.1)",
    },
    {
        id: "closed",
        title: "Closed",
        titleKey: "columnClosed",
        status: "Closed",
        color: "#1dc200",
        bgColor: "rgba(29, 194, 0, 0.1)",
    },
    {
        id: "pending",
        title: "Pending",
        titleKey: "columnPending",
        status: "Pending",
        color: "#b900ff",
        bgColor: "rgba(185, 0, 255, 0.1)",
    },
];

// Style helpers
const getBoardContainerStyles = (mode: "light" | "dark" | undefined): React.CSSProperties => ({
    display: "grid",
    // One equal-width column per status — derived from COLUMNS so adding
    // a status (e.g. Blocked) can't silently overflow the fixed grid.
    gridTemplateColumns: `repeat(${COLUMNS.length}, 1fr)`,
    gap: 12,
    padding: 12,
    flex: 1,
    minHeight: 0,
    width: "100%",
    overflow: "hidden",
    backgroundColor: mode === "dark" ? "#0a0a10" : "#f4f5f7",
    borderRadius: 12,
});

type SprintBoardProps = {
    teamMembers: UserProps[];
    setTeamMembers: (value: UserProps[]) => void;
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    usePM: ProjectManagementState;
    useSM: SprintMilestoneManagementState;
    useTM: TaskManagementState;
    socket?: Socket | null;
};

export const SprintBoard = (props: SprintBoardProps) => {
    const { teamMembers, teamMemberProfiles, myself, usePM, useSM, useTM, socket } = props;
    const { mode: colorMode } = useColorScheme();
    const { accessToken } = useAuth();
    const { t } = useTranslation();

    // Normalize mode
    const mode: "light" | "dark" | undefined =
        colorMode === "light" || colorMode === "dark" ? colorMode : undefined;

    // Filtered tasks from TaskFilterMenu
    const [filteredTasks, setFilteredTasks] = useState<TaskTableProps[]>([]);

    // Subscription to TaskFilterMenu's per-task "subtask passes the
    // filter" set. The table consumes this too (via its expand chevron);
    // the board uses it to honor the user's "Show child tasks" toggle —
    // when on, every non-root that matched the active filter is added
    // to the columns alongside the root rows already in `filteredTasks`.
    const [visibleChildTaskIds, setVisibleChildTaskIds] = useState<Set<string> | null>(null);
    // Depth toggle. The board shows ONE layer by default (see the organize
    // effect): milestone cards (+ orphan root tasks) when no milestone scope
    // is active, or the scoped milestone's DIRECT tasks when it is. Turning
    // this on reveals exactly ONE more layer — the milestones' tasks, or those
    // tasks' subtasks — and stops there (2-depth max). Deeper descendants stay
    // hidden. The label adapts: "Show tasks" (no scope) / "Show subtasks"
    // (scoped). Replaces the old flatten-everything "Show child tasks" toggle.
    const [expandExtraDepth, setExpandExtraDepth] = useState<boolean>(false);
    const [isMilestoneFilterActive, setIsMilestoneFilterActive] = useState<boolean>(false);
    const [isMemberFilterActive, setIsMemberFilterActive] = useState<boolean>(false);
    // A milestone is "scoped" via the dropdown milestone filter
    // (`isMilestoneFilterActive`, published by TaskFilterMenu) OR the sidebar's
    // Milestones folder (`useTM.tableMilestoneFilterId`).
    const scoped = isMilestoneFilterActive || useTM.tableMilestoneFilterId != null;
    // Hide the depth toggle only under a Member filter, where the board shows
    // flat assignee matches (fe #225) and a per-layer depth would be
    // meaningless. It shows in BOTH the scoped and unscoped cases otherwise.
    const depthToggleVisible = !isMemberFilterActive;
    // Tooltip that spells out what's on the board NOW and what flipping the
    // toggle will add/hide — adapts on both scope (tasks vs subtasks) and the
    // current on/off state.
    const depthTooltip = scoped
        ? expandExtraDepth
            ? t.tasks.board.depthTooltipSubtasksOn
            : t.tasks.board.depthTooltipSubtasksOff
        : expandExtraDepth
          ? t.tasks.board.depthTooltipTasksOn
          : t.tasks.board.depthTooltipTasksOff;

    // Per-column sort tiers. Sourced from the shared
    // `useTaskSortPreferences` hook so the Settings modal is the only
    // surface that mutates them. Empty array = no sort (preserve
    // filter-pipeline ordering). Up to 2 tiers; the shared comparator
    // builder applies them in order and tie-breaks on id at the end.
    const { sprintBoardSortTiers } = useTaskSortPreferences();
    const sortColumn = useMemo(() => {
        if (sprintBoardSortTiers.length === 0) {
            return (tasks: TaskTableProps[]): TaskTableProps[] => tasks;
        }
        const comparator = buildComparator(sprintBoardSortTiers);
        return (tasks: TaskTableProps[]): TaskTableProps[] => {
            if (tasks.length < 2) return tasks;
            return [...tasks].sort(comparator);
        };
    }, [sprintBoardSortTiers]);

    // Project-tag filters. Tags are loaded into
    // `usePM.currentProject.projectTags` by TaskSidebarMain on project change —
    // read from there instead of refetching /api/v2/project/tag/ on every
    // allTasks change (which fired on every task update too, not just project
    // switches).
    const [predefinedTagsFilters, setPredefinedTagsFilters] = useState<FilterProps[]>([]);
    useEffect(() => {
        const projectTags: TagListProps[] = usePM.currentProject?.projectTags || [];
        if (projectTags.length === 0) {
            setPredefinedTagsFilters([]);
            return;
        }
        const allTagFilter: FilterProps = {
            label: "All",
            filterModel: { items: [] },
            lightModeColor: "#6b7280",
            darkModeColor: "#9ca3af",
        };
        const tagBasedFilters: FilterProps[] = projectTags.map((tag) => ({
            label: tag.tagName,
            filterModel: {
                items: [
                    {
                        field: "concatTags",
                        operator: "contains",
                        value: `/${tag.tagName}/`,
                    },
                ],
            },
            lightModeColor: tag.tagColor,
            darkModeColor: tag.tagColor,
        }));
        setPredefinedTagsFilters([allTagFilter, ...tagBasedFilters]);
    }, [usePM.currentProject?.projectTags]);

    // Local state for board tasks organized by column. One bucket per
    // entry in COLUMNS (incl. `blocked`) — a status without a bucket
    // here is silently dropped by `dispatchToColumn`, which is exactly
    // why Blocked cards never appeared on the board before.
    const [boardTasks, setBoardTasks] = useState<Record<string, TaskTableProps[]>>({
        open: [],
        wip: [],
        blocked: [],
        pending: [],
        closed: [],
    });

    // Organize the board's cards into status columns. The card SET is chosen
    // by the depth model in `buildBoardDisplaySet` (pure + unit-tested — see
    // its docstring and the toggle comment above); here we just bucket the
    // result by status and sort each column.
    useEffect(() => {
        const organized: Record<string, TaskTableProps[]> = {
            open: [],
            wip: [],
            blocked: [],
            pending: [],
            closed: [],
        };
        const dispatchToColumn = (task: TaskTableProps) => {
            const status = task.status?.toLowerCase() || "open";
            if (status === "open") organized.open.push(task);
            else if (status === "wip") organized.wip.push(task);
            else if (status === "blocked") organized.blocked.push(task);
            else if (status === "pending") organized.pending.push(task);
            else if (status === "closed") organized.closed.push(task);
        };

        const display = buildBoardDisplaySet({
            filteredTasks: filteredTasks || [],
            visibleChildTaskIds,
            allTasks: useTM.allTasks,
            scoped,
            memberFilterActive: isMemberFilterActive,
            expandExtraDepth,
        });
        for (const task of display) dispatchToColumn(task);

        // Sort each column independently. `sortColumn` is a no-op when
        // `sortBy === "default"`, so paying for an extra useMemo +
        // function call here is cheap.
        organized.open = sortColumn(organized.open);
        organized.wip = sortColumn(organized.wip);
        organized.blocked = sortColumn(organized.blocked);
        organized.pending = sortColumn(organized.pending);
        organized.closed = sortColumn(organized.closed);

        setBoardTasks(organized);
    }, [
        filteredTasks,
        visibleChildTaskIds,
        useTM.allTasks,
        sortColumn,
        scoped,
        isMemberFilterActive,
        expandExtraDepth,
    ]);

    // Sync the dragged task's new status onto the open preview pane so
    // the user immediately sees the change there. Mirrors the manual
    // update DraggableTaskTable.handleRowUpdate does — looks up the
    // status object by label since `currentPreviewTask.status` is a
    // structured object (not a string).
    const syncPreviewStatus = useCallback(
        (taskId: string, newStatus: string) => {
            const preview = useTM.currentPreviewTask;
            if (!preview || String(preview.id) !== taskId) return;
            const statusObj = statuses.find((s) => s.status === newStatus) ?? preview.status;
            useTM.setCurrentPreviewTask({
                ...preview,
                status: statusObj,
            });
        },
        [useTM]
    );

    // Handle drag end. Two modes: task vs milestone — milestones are
    // persisted via the milestone API (`useSM.updateExistingMilestone`),
    // not the task API, since the authoritative status lives on
    // MilestoneMaster. Without that branch the backing task gets
    // updated but the milestone record drifts and the next reload
    // resets the card back to its old status.
    const handleDragEnd = async (result: DropResult) => {
        const { source, destination, draggableId } = result;

        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) {
            return;
        }

        const sourceColumn = source.droppableId;
        const destColumn = destination.droppableId;

        if (sourceColumn === destColumn) {
            const columnTasks = [...boardTasks[sourceColumn]];
            const [movedTask] = columnTasks.splice(source.index, 1);
            columnTasks.splice(destination.index, 0, movedTask);
            setBoardTasks({ ...boardTasks, [sourceColumn]: columnTasks });
            return;
        }

        // Cross-column move: snapshot the original layout so we can roll
        // back on error.
        const previousBoardTasks = boardTasks;
        const sourceTasks = [...boardTasks[sourceColumn]];
        const destTasks = [...boardTasks[destColumn]];
        const [movedTask] = sourceTasks.splice(source.index, 1);
        const newStatus = COLUMNS.find((col) => col.id === destColumn)?.status || movedTask.status;
        const updatedMovedTask = { ...movedTask, status: newStatus };
        destTasks.splice(destination.index, 0, updatedMovedTask);

        setBoardTasks({
            ...boardTasks,
            [sourceColumn]: sourceTasks,
            [destColumn]: destTasks,
        });

        if (!newStatus || !accessToken) {
            return;
        }

        // Functional setter + String() id coercion. The legacy
        // `task.id === draggableId` comparison silently failed when
        // `task.id` was a number (which it sometimes is post-fetch) —
        // allTasks stayed at the old status, the filter pipeline
        // re-classified the card back into the source column on the
        // next render, and the user saw "the card returns to Open".
        const idStr = String(draggableId);

        try {
            if (movedTask.isMilestone === true && movedTask.milestoneId != null) {
                const projectId = Number(movedTask.projectId);
                if (!Number.isFinite(projectId) || projectId <= 0) return;
                const updated = await useSM.updateExistingMilestone(
                    { milestoneId: movedTask.milestoneId, status: newStatus },
                    projectId
                );
                if (!updated) return;

                // Mirror the milestone shape onto the row format (same
                // mapping as DraggableTaskTable.handleRowUpdate). This
                // keeps useTM.allTasks in sync so the filter pipeline
                // doesn't bounce the card back to its old column.
                const firstAssignee = updated.assignees?.[0];
                const hasAssignee = firstAssignee?.userId != null;
                const tags = (updated.tags as TagListProps[] | null) ?? [];
                const concatTags =
                    tags.length > 0 ? "/" + tags.map((tg) => tg.tagName).join("/") + "/" : null;
                const mirrored: TaskTableProps = {
                    ...updatedMovedTask,
                    title: updated.title ?? updatedMovedTask.title,
                    status: (updated.status as string) ?? newStatus,
                    priority: updated.priority ?? updatedMovedTask.priority,
                    effortLevel: updated.effortLevel ?? updatedMovedTask.effortLevel,
                    tags,
                    concatTags,
                    updatedAt: updated.tsUpdatedAt ?? updatedMovedTask.updatedAt,
                    assigneeId: hasAssignee ? String(firstAssignee.userId) : null,
                    assigneeName: hasAssignee
                        ? firstAssignee.username || firstAssignee.email || ""
                        : null,
                    assigneeEmail: hasAssignee ? firstAssignee.email || "" : null,
                    assigneeImgPath: hasAssignee ? firstAssignee.profileImageUrl || "" : null,
                    milestoneId: updated.milestoneId,
                    sprintId: updated.sprintId ?? updatedMovedTask.sprintId,
                    isMilestone: true,
                    customFieldValues:
                        updated.customFieldValues ?? updatedMovedTask.customFieldValues,
                };
                useTM.setAllTasks((prev) =>
                    prev.map((task: TaskTableProps) =>
                        String(task.id) === idStr ? mirrored : task
                    )
                );
                // Milestone preview reads from useSM.projectMilestones,
                // which updateExistingMilestone already refreshes — no
                // extra wiring needed for the preview status here.
                return;
            }

            await updateTaskFromTable(
                updatedMovedTask,
                myself,
                socket || null,
                accessToken,
                teamMembers
            );

            useTM.setAllTasks((prev) =>
                prev.map((task: TaskTableProps) =>
                    String(task.id) === idStr ? { ...task, status: newStatus } : task
                )
            );

            // Task preview shows TaskProps — update its status if it's
            // the dragged task. Milestone preview path is covered by the
            // updateExistingMilestone return-and-refresh flow above.
            syncPreviewStatus(idStr, newStatus);
        } catch (error) {
            console.error("[SprintBoard] Failed to update status:", error);
            setBoardTasks(previousBoardTasks);
        }
    };

    // Handle task click. Milestone backing rows must route through
    // `setCurrentPreviewMilestoneId` so the preview pane opens directly
    // in MilestonePreviewInner instead of briefly mounting TaskPreview
    // with `currentPreviewKind === "task"` before the reroute kicks in
    // (which also re-runs the `setIsTaskUpdated` cascade and mutates
    // `useTM.allTasks`). Regular tasks keep the old path.
    // Stabilize the click handler so `SprintBoardCard` (now React.memo) can
    // skip re-renders when nothing about a card has changed. Destructuring
    // pins the underlying useState setters — those are guaranteed stable by
    // React regardless of how often `useTM` is re-constructed by its hook.
    const {
        setIsTaskPreviewVisible,
        setCurrentPreviewKind,
        setCurrentPreviewMilestoneId,
        setCurrentPreviewTaskId,
    } = useTM;

    // Rapid card-click coalescing. Each click fans out ~13 TaskPreview
    // network requests (4× activity, 2× childTasks, 2× meta, 2× tag…).
    // Clicking 10 cards in a second pegged the backend at >100 requests
    // and broke card selection mid-flight. The fix decouples *visual*
    // selection (immediate) from the *preview load* (debounced 150 ms),
    // so a rapid sequence collapses into a single fetch for the last
    // card the user landed on while the highlight still tracks every
    // click in real time.
    const [pendingTaskId, setPendingTaskId] = useState<number | null>(null);
    const [pendingMilestoneId, setPendingMilestoneId] = useState<number | null>(null);
    const previewSwitchTimerRef = useRef<number | null>(null);

    // Drop the pending highlight once the real preview state has caught
    // up (timer fired, fetch kicked off). The row equality check stays
    // honest: `selectedTaskId` below reads from useTM after this clears.
    useEffect(() => {
        if (pendingTaskId != null && pendingTaskId === useTM.currentPreviewTaskId) {
            setPendingTaskId(null);
        }
    }, [pendingTaskId, useTM.currentPreviewTaskId]);
    useEffect(() => {
        if (pendingMilestoneId != null && pendingMilestoneId === useTM.currentPreviewMilestoneId) {
            setPendingMilestoneId(null);
        }
    }, [pendingMilestoneId, useTM.currentPreviewMilestoneId]);

    // Clean up any in-flight timer on unmount so we don't write into a
    // dead component.
    useEffect(() => {
        return () => {
            if (previewSwitchTimerRef.current != null) {
                window.clearTimeout(previewSwitchTimerRef.current);
                previewSwitchTimerRef.current = null;
            }
        };
    }, []);

    const PREVIEW_SWITCH_DEBOUNCE_MS = 150;

    // Card whose task graph is open (null = diagram closed). One shared
    // ModalTaskDiagram at the board level; cards request it through the
    // identity-stable callback below (SprintBoardCard is React.memo with
    // shallow equality, so the identity matters — same contract as
    // handleTaskClick).
    const [diagramTask, setDiagramTask] = useState<TaskTableProps | null>(null);
    const handleOpenDiagram = useCallback((task: TaskTableProps) => {
        if (task.id == null) return;
        setDiagramTask(task);
    }, []);

    const handleTaskClick = useCallback(
        (task: TaskTableProps) => {
            const isMile = task.isMilestone === true && task.milestoneId != null;
            // Step 1: instant visual feedback. Card highlights re-render
            // off these local pending IDs (see selectedTaskId /
            // selectedMilestoneId on SprintBoardColumn below). Pane
            // visibility is cheap and stays instant — only the heavy
            // fetch-triggering setters are deferred so opening the
            // preview pane from a closed state never feels delayed.
            if (isMile) {
                setPendingMilestoneId(task.milestoneId as number);
                setPendingTaskId(null);
            } else if (task.id) {
                setPendingTaskId(parseInt(task.id));
                setPendingMilestoneId(null);
            }
            setIsTaskPreviewVisible(true);

            // Step 2: debounce the heavy state switch that triggers the
            // TaskPreview fetch cascade.
            if (previewSwitchTimerRef.current != null) {
                window.clearTimeout(previewSwitchTimerRef.current);
            }
            previewSwitchTimerRef.current = window.setTimeout(() => {
                previewSwitchTimerRef.current = null;
                if (isMile) {
                    setCurrentPreviewKind("milestone");
                    setCurrentPreviewMilestoneId(task.milestoneId as number);
                } else if (task.id) {
                    setCurrentPreviewKind("task");
                    setCurrentPreviewTaskId(parseInt(task.id));
                }
            }, PREVIEW_SWITCH_DEBOUNCE_MS);
        },
        [
            setIsTaskPreviewVisible,
            setCurrentPreviewKind,
            setCurrentPreviewMilestoneId,
            setCurrentPreviewTaskId,
        ]
    );

    return (
        <ThemeProvider theme={{ [THEME_ID]: materialTheme }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                <TaskFilterMenu
                    predefinedTagsFilters={predefinedTagsFilters}
                    savedFiltersProjectId={usePM.currentProject?.projectId}
                    savedFiltersTeamId={myself.teamId}
                    setCurrentDisplayingTasks={setFilteredTasks}
                    setIsMemberFilterActive={setIsMemberFilterActive}
                    setIsMilestoneFilterActive={setIsMilestoneFilterActive}
                    setVisibleChildTaskIds={setVisibleChildTaskIds}
                    teamMembers={teamMembers}
                    useSM={useSM}
                    useTM={useTM}
                    filterStorageKey={taskFilterStorageKey(
                        "board",
                        usePM.currentProject?.projectId
                    )}
                    hideStatusFilter
                />
                {/* Depth toggle — reveals one more layer (2-depth max). Label
                    adapts on scope: "Show tasks" (no milestone scope, adds
                    milestones' tasks) / "Show subtasks" (milestone scoped, adds
                    the tasks' subtasks). Hidden under a Member filter. */}
                {depthToggleVisible && (
                    <AppTooltip placement="bottom-start" title={depthTooltip}>
                        <Stack
                            alignItems="center"
                            direction="row"
                            spacing={1}
                            sx={{
                                px: 1.5,
                                py: 0.5,
                                flexShrink: 0,
                                width: "fit-content",
                            }}
                        >
                            <Switch
                                checked={expandExtraDepth}
                                size="sm"
                                onChange={(event) => setExpandExtraDepth(event.target.checked)}
                            />
                            <Typography
                                level="body-sm"
                                sx={{
                                    cursor: "pointer",
                                    color:
                                        mode === "dark"
                                            ? "rgba(255,255,255,0.7)"
                                            : "rgba(0,0,0,0.65)",
                                }}
                                onClick={() => setExpandExtraDepth((prev) => !prev)}
                            >
                                {scoped ? t.tasks.board.showSubtasks : t.tasks.board.showTasks}
                            </Typography>
                        </Stack>
                    </AppTooltip>
                )}
                <DragDropContext onDragEnd={handleDragEnd}>
                    <div style={getBoardContainerStyles(mode)}>
                        {COLUMNS.map((column) => {
                            // Pending state lights up the just-clicked
                            // card; the debounced setters catch the
                            // real `useTM.currentPreview*` state up
                            // ~150 ms later. When the click is a *mode
                            // switch* (e.g. milestone preview is open
                            // and the user clicks a regular task — or
                            // vice versa) the stale useTM values for
                            // the old mode would otherwise keep the
                            // previously-selected card highlighted
                            // until the timer fires, producing the
                            // "both cards selected for a second"
                            // glitch. The pending fields express
                            // intent: when one mode is pending, the
                            // other mode's highlight must be
                            // suppressed immediately.
                            const taskPending = pendingTaskId != null;
                            const milestonePending = pendingMilestoneId != null;
                            const selectedTaskId = milestonePending
                                ? undefined
                                : (pendingTaskId ?? useTM.currentPreviewTaskId);
                            const selectedMilestoneId = taskPending
                                ? undefined
                                : (pendingMilestoneId ?? useTM.currentPreviewMilestoneId);
                            const isMilestonePreviewActive = taskPending
                                ? false
                                : milestonePending
                                  ? true
                                  : useTM.currentPreviewKind === "milestone";
                            return (
                                <SprintBoardColumn
                                    key={column.id}
                                    column={column}
                                    isMilestonePreviewActive={isMilestonePreviewActive}
                                    myself={myself}
                                    selectedMilestoneId={selectedMilestoneId}
                                    selectedTaskId={selectedTaskId}
                                    tasks={boardTasks[column.id] || []}
                                    teamMemberProfiles={teamMemberProfiles}
                                    onOpenDiagram={handleOpenDiagram}
                                    onTaskClick={handleTaskClick}
                                />
                            );
                        })}
                    </div>
                </DragDropContext>
            </div>

            {/* Shared task-graph modal for the per-card footer trigger.
                Anchored on the card's OWN id — as every diagram caller is:
                the loader walks up the parent chain itself. Here the
                trigger only renders on root cards (parentTaskId null —
                root tasks / milestone backing rows), so the walk is a
                no-op. Page-hosted surface, so the diagram's default 9999
                layer applies (no zIndex). */}
            {diagramTask != null &&
                diagramTask.id != null &&
                (diagramTask.projectId ?? usePM.currentProject?.projectId) != null && (
                    <LazyTaskDiagram
                        myself={myself}
                        open={true}
                        rootLabel={`${formatTaskDisplayId(diagramTask)} · ${diagramTask.title || "Untitled"}`}
                        rootTaskId={Number(diagramTask.id)}
                        usePM={usePM}
                        useSM={useSM}
                        useTM={useTM}
                        projectId={Number(
                            diagramTask.projectId ?? usePM.currentProject?.projectId
                        )}
                        onClose={() => setDiagramTask(null)}
                    />
                )}
        </ThemeProvider>
    );
};
