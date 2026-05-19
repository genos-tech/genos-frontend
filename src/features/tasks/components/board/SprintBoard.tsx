import React, { useCallback, useEffect, useRef, useState } from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { useColorScheme } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { TagListProps, TaskTableProps } from "../../../../types/tasks";
import { loadProjectTags } from "../../services/loadProjectTags";
import { updateTaskFromTable } from "../../services/updateTaskFromTable";
import { FilterProps } from "../../types/TaskTableTypes";
import { statuses } from "../../utils/taskMeta";
import { TaskFilterMenu } from "../table/TaskFilterMenu";
import { ColumnConfig, SprintBoardColumn } from "./SprintBoardColumn";

const materialTheme = createTheme({ cssVariables: true });

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
    gridTemplateColumns: "repeat(4, 1fr)", // Fixed 4 equal columns
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

    // Normalize mode
    const mode: "light" | "dark" | undefined =
        colorMode === "light" || colorMode === "dark" ? colorMode : undefined;

    // Filtered tasks from TaskFilterMenu
    const [filteredTasks, setFilteredTasks] = useState<TaskTableProps[]>([]);

    // Tag filter setup
    const [predefinedTagsFilters, setPredefinedTagsFilters] = useState<FilterProps[]>([]);
    useEffect(() => {
        (async () => {
            if (useTM.allTasks.length > 0) {
                const loadedProjectTags: TagListProps[] = await loadProjectTags(
                    myself,
                    useTM.allTasks[0].projectId || -1,
                    accessToken
                );
                if (loadedProjectTags.length > 0) {
                    const allTagFilter: FilterProps = {
                        label: "All",
                        filterModel: { items: [] },
                        lightModeColor: "#6b7280",
                        darkModeColor: "#9ca3af",
                    };
                    const tagBasedFilters: FilterProps[] = loadedProjectTags.map((tag) => ({
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
                }
            }
        })();
    }, [usePM.currentProject, useTM.allTasks]);

    // Local state for board tasks organized by column
    const [boardTasks, setBoardTasks] = useState<Record<string, TaskTableProps[]>>({
        open: [],
        wip: [],
        pending: [],
        closed: [],
    });

    // Organize filtered tasks into board columns. We deliberately do
    // NOT restrict by sprint binding here:
    //   1. Without a milestone scope, the board should show every
    //      milestone (backing tasks) AND every regular root task so
    //      users can see the full project at a glance — not just the
    //      handful of things tied to the current sprint. The user's
    //      sprint scoping happens in the dashboard / sidebar.
    //   2. With a milestone scope active (clicked from the sidebar),
    //      `TaskFilterMenu` already narrows `filteredTasks` to the
    //      milestone's children, so we just trust its output.
    // Dropping the milestone/sprint deps also means a milestone preview
    // refreshing its data no longer rebuilds the board's columns, so a
    // just-clicked card stays put instead of being filtered away by the
    // momentary state churn.
    useEffect(() => {
        const milestoneScopeActive = useTM.tableMilestoneFilterId != null;
        const tasks = (filteredTasks || []).filter((task) => {
            if (milestoneScopeActive) return true;
            return task.parentTaskId === null;
        });

        const organized: Record<string, TaskTableProps[]> = {
            open: [],
            wip: [],
            pending: [],
            closed: [],
        };

        tasks.forEach((task: TaskTableProps) => {
            const status = task.status?.toLowerCase() || "open";
            if (status === "open") organized.open.push(task);
            else if (status === "wip") organized.wip.push(task);
            else if (status === "pending") organized.pending.push(task);
            else if (status === "closed") organized.closed.push(task);
        });

        setBoardTasks(organized);
    }, [filteredTasks, useTM.tableMilestoneFilterId]);

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
            console.warn(
                `[SprintBoard] Cannot persist status: newStatus=${newStatus}, accessToken=${!!accessToken}`
            );
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
                    isTaskUpdated={useTM.isTaskUpdated}
                    predefinedTagsFilters={predefinedTagsFilters}
                    setCurrentDisplayingTasks={setFilteredTasks}
                    useSM={useSM}
                    useTM={useTM}
                    hideStatusFilter
                />
                <DragDropContext onDragEnd={handleDragEnd}>
                    <div style={getBoardContainerStyles(mode)}>
                        {COLUMNS.map((column) => (
                            <SprintBoardColumn
                                key={column.id}
                                column={column}
                                // Pending state lights up the card on
                                // click; the debounced setters then
                                // catch the real state up ~150 ms later.
                                isMilestonePreviewActive={
                                    pendingMilestoneId != null
                                        ? true
                                        : useTM.currentPreviewKind === "milestone"
                                }
                                myself={myself}
                                selectedMilestoneId={
                                    pendingMilestoneId ?? useTM.currentPreviewMilestoneId
                                }
                                selectedTaskId={pendingTaskId ?? useTM.currentPreviewTaskId}
                                tasks={boardTasks[column.id] || []}
                                teamMemberProfiles={teamMemberProfiles}
                                onTaskClick={handleTaskClick}
                            />
                        ))}
                    </div>
                </DragDropContext>
            </div>
        </ThemeProvider>
    );
};
