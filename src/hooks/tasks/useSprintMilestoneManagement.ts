import { useCallback, useState } from "react";
import { Socket } from "socket.io-client";

import { invalidateCachedFullTask } from "../../db/services/task-full.service";
import { addTask } from "../../features/tasks/services/addTask";
import {
    addMilestoneAssignee,
    createMilestone,
    CreateMilestoneInput,
    createSprint,
    CreateSprintInput,
    deleteMilestone,
    deleteSprint,
    loadMilestone,
    loadProjectMilestones,
    LoadProjectMilestonesOptions,
    loadProjectSprints,
    LoadProjectSprintsOptions,
    loadSprintConfig,
    moveMilestoneToSprint,
    removeMilestoneAssignee,
    SprintConfigInput,
    updateMilestone,
    UpdateMilestoneInput,
    updateSprint,
    UpdateSprintInput,
    upsertSprintConfig,
} from "../../features/tasks/sprint-milestone/services";
import type { MilestoneMentionContext } from "../../features/tasks/sprint-milestone/services/updateMilestone";
import { Milestone, Sprint, SprintConfig } from "../../features/tasks/sprint-milestone/types";
import { upsertMilestoneInList } from "../../features/tasks/sprint-milestone/utils/milestoneListState";

// Every milestone mutation goes through `_sync_backing_task` on the
// backend, which mirrors the milestone's status / dates / sprint /
// assignee / etc. onto the milestone's backing TaskMaster row. The
// two frontend IDB caches that store that row do NOT get touched by
// the milestone API roundtrip, though — so without this helper, any
// surface that reads the backing task (parent-task chip in
// TaskMainBlock, table row, diagram node) keeps replaying pre-update
// values from cache until the user hard-refreshes.
//
//   1. `invalidateCachedFullTask` clears the TaskProps blob that
//      `loadSpecificTask` returns to the parent-task / preview path.
//   2. `addTask` upserts a fresh TaskTableProps row into the project
//      table cache so table views also reflect the change.
//
// We synthesise the table-row from the fresh Milestone payload (which
// the backend `_sync_backing_task` just copied INTO the backing task,
// so it's the canonical source of truth right now). Single-assignee
// = oldest assignee, falling back to the reporter — same convention
// as the backend.
const syncMilestoneBackingTaskCaches = (milestone: Milestone): void => {
    if (milestone.taskId == null) return;
    void invalidateCachedFullTask(milestone.taskId);
    const firstAssignee = milestone.assignees?.[0];
    const reporter = milestone.reporter ?? null;
    void addTask({
        id: String(milestone.taskId),
        // Preserve the milestone's human-readable id on the IDB row.
        // Without this, every refreshMilestone() overwrites the cached
        // backing-task row with one missing `displayId`, so the next
        // table render of `DraggableTaskRow` falls back to "#<id>".
        displayId: milestone.displayId ?? null,
        title: milestone.title ?? null,
        priority: milestone.priority ?? null,
        effortLevel: milestone.effortLevel ?? null,
        createdDate: milestone.tsCreatedAt ?? null,
        updatedAt: milestone.tsUpdatedAt ?? null,
        dueDate: milestone.dueDate ?? null,
        startDate: milestone.startDate ?? null,
        daysLeft: null,
        status: milestone.status ?? null,
        assigneeId: firstAssignee?.userId
            ? String(firstAssignee.userId)
            : reporter?.userId
              ? String(reporter.userId)
              : null,
        assigneeEmail: firstAssignee?.email ?? reporter?.email ?? null,
        assigneeName: firstAssignee?.username ?? reporter?.username ?? null,
        assigneeImgPath: firstAssignee?.profileImageUrl ?? reporter?.profileImageUrl ?? null,
        parentTaskId: null,
        threadId: null,
        tags: (milestone.tags as never) ?? [],
        concatTags: null,
        teamId: milestone.teamId != null ? String(milestone.teamId) : null,
        projectId: milestone.projectId,
        isMilestone: true,
        milestoneId: milestone.milestoneId,
        sprintId: milestone.sprintId ?? null,
        // Backing-task custom-field values ride the milestone payload
        // (single source of truth is the backing row) — mirror them so
        // the table's custom columns survive a cache read.
        customFieldValues: milestone.customFieldValues ?? undefined,
    });
};

const removeMilestoneBackingTaskCaches = (taskId: number | null | undefined): void => {
    if (taskId == null) return;
    void invalidateCachedFullTask(taskId);
};

export interface SprintMilestoneManagementState {
    // Per-project sprint config (the cadence settings).
    sprintConfig: SprintConfig | null;
    setSprintConfig: (config: SprintConfig | null) => void;
    // All known sprints for the current project, keyed by projectId so
    // a project switch keeps neighbour data in cache for free.
    projectSprints: Record<number, Sprint[]>;
    setProjectSprints: (next: Record<number, Sprint[]>) => void;
    // Sprint the user is currently inspecting in the dashboard. Defaults
    // to the active sprint when sprints load.
    currentSprint: Sprint | null;
    setCurrentSprint: (s: Sprint | null) => void;

    // Milestones, keyed by projectId.
    projectMilestones: Record<number, Milestone[]>;
    setProjectMilestones: (next: Record<number, Milestone[]>) => void;
    currentMilestone: Milestone | null;
    setCurrentMilestone: (m: Milestone | null) => void;

    // Mutation flags so other parts of the app can react.
    tsLastMilestonesLoaded: number | undefined;
    tsLastSprintsLoaded: number | undefined;

    // Loaders
    loadConfigForProject: (projectId: number) => Promise<SprintConfig | null>;
    saveConfig: (input: SprintConfigInput) => Promise<SprintConfig | null>;
    loadSprintsForProject: (
        projectId: number,
        opts?: LoadProjectSprintsOptions
    ) => Promise<Sprint[]>;
    loadMilestonesForProject: (
        projectId: number,
        opts?: LoadProjectMilestonesOptions
    ) => Promise<Milestone[]>;
    refreshMilestone: (milestoneId: number) => Promise<Milestone | null>;

    // CRUD
    createNewSprint: (input: CreateSprintInput) => Promise<Sprint | null>;
    updateExistingSprint: (input: UpdateSprintInput) => Promise<Sprint | null>;
    removeSprint: (sprintId: number, projectId: number) => Promise<boolean>;

    createNewMilestone: (input: CreateMilestoneInput) => Promise<Milestone | null>;
    updateExistingMilestone: (
        input: UpdateMilestoneInput,
        projectId: number,
        socket?: Socket | null,
        mentionMeta?: Omit<MilestoneMentionContext, "socket" | "tsUpdatedAt">,
        opts?: { deferStateSync?: boolean }
    ) => Promise<Milestone | null>;
    /** The App-root state writes `updateExistingMilestone` performs by
     *  default (milestone-list upsert + currentMilestone mirror). A
     *  `deferStateSync` caller invokes this itself once its editing
     *  session goes idle. */
    applyMilestoneToState: (m: Milestone) => void;
    moveMilestone: (
        milestoneId: number,
        sprintId: number | null,
        projectId: number
    ) => Promise<Milestone | null>;
    removeMilestone: (milestoneId: number, projectId: number) => Promise<boolean>;

    assignMilestoneMember: (
        milestoneId: number,
        userId: number | string,
        projectId: number
    ) => Promise<Milestone | null>;
    unassignMilestoneMember: (
        milestoneId: number,
        userId: number | string,
        projectId: number
    ) => Promise<Milestone | null>;

    // Reset (used on team switch).
    initializeSprintMilestoneStates: () => void;
}

export const useSprintMilestoneManagement = (
    accessToken: string | null
): SprintMilestoneManagementState => {
    const [sprintConfig, setSprintConfig] = useState<SprintConfig | null>(null);
    const [projectSprints, setProjectSprintsState] = useState<Record<number, Sprint[]>>({});
    const [currentSprint, setCurrentSprint] = useState<Sprint | null>(null);

    const [projectMilestones, setProjectMilestonesState] = useState<Record<number, Milestone[]>>(
        {}
    );
    const [currentMilestone, setCurrentMilestone] = useState<Milestone | null>(null);

    const [tsLastSprintsLoaded, setTsLastSprintsLoaded] = useState<number | undefined>(undefined);
    const [tsLastMilestonesLoaded, setTsLastMilestonesLoaded] = useState<number | undefined>(
        undefined
    );

    const setProjectSprints = useCallback((next: Record<number, Sprint[]>) => {
        setProjectSprintsState(next);
    }, []);

    const setProjectMilestones = useCallback((next: Record<number, Milestone[]>) => {
        setProjectMilestonesState(next);
    }, []);

    const initializeSprintMilestoneStates = useCallback(() => {
        setSprintConfig(null);
        setProjectSprintsState({});
        setCurrentSprint(null);
        setProjectMilestonesState({});
        setCurrentMilestone(null);
        setTsLastSprintsLoaded(undefined);
        setTsLastMilestonesLoaded(undefined);
    }, []);

    const loadConfigForProject = useCallback(
        async (projectId: number): Promise<SprintConfig | null> => {
            const res = await loadSprintConfig(projectId, accessToken);
            const next = res?.config ?? null;
            setSprintConfig(next);
            return next;
        },
        [accessToken]
    );

    const saveConfig = useCallback(
        async (input: SprintConfigInput): Promise<SprintConfig | null> => {
            const res = await upsertSprintConfig(input, accessToken);
            const next = res?.config ?? null;
            setSprintConfig(next);
            return next;
        },
        [accessToken]
    );

    const loadSprintsForProject = useCallback(
        async (projectId: number, opts?: LoadProjectSprintsOptions): Promise<Sprint[]> => {
            const res = await loadProjectSprints(projectId, accessToken, opts);
            const sprints = res?.sprints ?? [];
            setProjectSprintsState((prev) => ({ ...prev, [projectId]: sprints }));
            setTsLastSprintsLoaded(Date.now());
            // If we don't have a `currentSprint` yet, default to the
            // active sprint when one exists, otherwise the first
            // upcoming one. This keeps the dashboard non-empty.
            if (!currentSprint || currentSprint.projectId !== projectId) {
                const active = sprints.find((s) => s.status === "active");
                const upcoming = sprints.find((s) => s.status === "upcoming");
                setCurrentSprint(active ?? upcoming ?? null);
            }
            return sprints;
        },
        [accessToken, currentSprint]
    );

    const loadMilestonesForProject = useCallback(
        async (projectId: number, opts?: LoadProjectMilestonesOptions): Promise<Milestone[]> => {
            const res = await loadProjectMilestones(projectId, accessToken, opts);
            const milestones = res?.milestones ?? [];
            setProjectMilestonesState((prev) => ({ ...prev, [projectId]: milestones }));
            setTsLastMilestonesLoaded(Date.now());
            return milestones;
        },
        [accessToken]
    );

    const refreshMilestone = useCallback(
        async (milestoneId: number): Promise<Milestone | null> => {
            const res = await loadMilestone(milestoneId, accessToken);
            const m = res?.milestone ?? null;
            if (m) {
                setProjectMilestonesState((prev) => {
                    const list = prev[m.projectId] ?? [];
                    const next = list.some((x) => x.milestoneId === m.milestoneId)
                        ? list.map((x) => (x.milestoneId === m.milestoneId ? m : x))
                        : [m, ...list];
                    return { ...prev, [m.projectId]: next };
                });
                if (currentMilestone?.milestoneId === m.milestoneId) {
                    setCurrentMilestone(m);
                }
            }
            return m;
        },
        [accessToken, currentMilestone]
    );

    const createNewSprint = useCallback(
        async (input: CreateSprintInput): Promise<Sprint | null> => {
            const res = await createSprint(input, accessToken);
            if (res?.sprint) {
                setProjectSprintsState((prev) => {
                    const list = prev[input.projectId] ?? [];
                    return {
                        ...prev,
                        [input.projectId]: [...list, res.sprint].sort((a, b) =>
                            a.startDate.localeCompare(b.startDate)
                        ),
                    };
                });
            }
            return res?.sprint ?? null;
        },
        [accessToken]
    );

    const updateExistingSprint = useCallback(
        async (input: UpdateSprintInput): Promise<Sprint | null> => {
            const res = await updateSprint(input, accessToken);
            if (res?.sprint) {
                const updated = res.sprint;
                setProjectSprintsState((prev) => {
                    const list = prev[updated.projectId] ?? [];
                    return {
                        ...prev,
                        [updated.projectId]: list.map((s) =>
                            s.sprintId === updated.sprintId ? updated : s
                        ),
                    };
                });
                if (currentSprint?.sprintId === updated.sprintId) {
                    setCurrentSprint(updated);
                }
            }
            return res?.sprint ?? null;
        },
        [accessToken, currentSprint]
    );

    const removeSprint = useCallback(
        async (sprintId: number, projectId: number): Promise<boolean> => {
            const ok = await deleteSprint(sprintId, accessToken);
            if (ok) {
                setProjectSprintsState((prev) => {
                    const list = prev[projectId] ?? [];
                    return {
                        ...prev,
                        [projectId]: list.filter((s) => s.sprintId !== sprintId),
                    };
                });
                // Detach the deleted sprint from in-memory milestones
                // so the UI doesn't keep referencing it.
                setProjectMilestonesState((prev) => {
                    const list = prev[projectId] ?? [];
                    return {
                        ...prev,
                        [projectId]: list.map((m) =>
                            m.sprintId === sprintId ? { ...m, sprintId: null } : m
                        ),
                    };
                });
                if (currentSprint?.sprintId === sprintId) {
                    setCurrentSprint(null);
                }
            }
            return ok;
        },
        [accessToken, currentSprint]
    );

    const createNewMilestone = useCallback(
        async (input: CreateMilestoneInput): Promise<Milestone | null> => {
            const res = await createMilestone(input, accessToken);
            if (res?.milestone) {
                setProjectMilestonesState((prev) => upsertMilestoneInList(prev, res.milestone));
            }
            return res?.milestone ?? null;
        },
        [accessToken]
    );

    // App-root state writes for a freshly-updated milestone, split out of
    // `updateExistingMilestone` so the milestone-body autosave loop can
    // DEFER them to the end of a typing session: `projectMilestones` feeds
    // the open preview's own `milestone` memo, so an upsert here re-renders
    // the whole App AND rebuilds the preview subtree — every 3s while the
    // user is still typing.
    const applyMilestoneToState = useCallback((m: Milestone) => {
        setProjectMilestonesState((prev) => upsertMilestoneInList(prev, m));
        setCurrentMilestone((prev) => (prev && prev.milestoneId === m.milestoneId ? m : prev));
    }, []);

    const updateExistingMilestone = useCallback(
        async (
            input: UpdateMilestoneInput,
            _projectId: number,
            socket?: Socket | null,
            mentionMeta?: Omit<MilestoneMentionContext, "socket" | "tsUpdatedAt">,
            opts?: { deferStateSync?: boolean }
        ): Promise<Milestone | null> => {
            let mentionCtx: MilestoneMentionContext | undefined;
            if (socket && mentionMeta) {
                // `tsUpdatedAt` comes from the server response; use a
                // placeholder so the socket event can stamp itself.
                mentionCtx = { socket, tsUpdatedAt: new Date().toISOString(), ...mentionMeta };
            }
            const res = await updateMilestone(input, accessToken, mentionCtx);
            if (res?.milestone) {
                // IDB cache writes are render-free — immediate on both paths.
                syncMilestoneBackingTaskCaches(res.milestone);
                // `deferStateSync` callers own calling `applyMilestoneToState`
                // (+ their table sync) when their editing session goes idle.
                if (!opts?.deferStateSync) {
                    applyMilestoneToState(res.milestone);
                }
            }
            return res?.milestone ?? null;
        },
        [accessToken, applyMilestoneToState]
    );

    const moveMilestone = useCallback(
        async (
            milestoneId: number,
            sprintId: number | null,
            _projectId: number
        ): Promise<Milestone | null> => {
            const res = await moveMilestoneToSprint(milestoneId, sprintId, accessToken);
            if (res?.milestone) {
                setProjectMilestonesState((prev) => upsertMilestoneInList(prev, res.milestone));
                if (currentMilestone?.milestoneId === res.milestone.milestoneId) {
                    setCurrentMilestone(res.milestone);
                }
                syncMilestoneBackingTaskCaches(res.milestone);
            }
            return res?.milestone ?? null;
        },
        [accessToken, currentMilestone]
    );

    const removeMilestone = useCallback(
        async (milestoneId: number, projectId: number): Promise<boolean> => {
            // Capture the backing-task id BEFORE the milestone gets
            // removed from local state, so we can invalidate its full-
            // task cache post-delete.
            const milestoneTaskId =
                (projectMilestones[projectId] ?? []).find((m) => m.milestoneId === milestoneId)
                    ?.taskId ?? null;
            const ok = await deleteMilestone(milestoneId, accessToken);
            if (ok) {
                setProjectMilestonesState((prev) => {
                    const list = prev[projectId] ?? [];
                    return {
                        ...prev,
                        [projectId]: list.filter((m) => m.milestoneId !== milestoneId),
                    };
                });
                if (currentMilestone?.milestoneId === milestoneId) {
                    setCurrentMilestone(null);
                }
                removeMilestoneBackingTaskCaches(milestoneTaskId);
            }
            return ok;
        },

        [accessToken, currentMilestone, projectMilestones]
    );

    const assignMilestoneMember = useCallback(
        async (
            milestoneId: number,
            userId: number | string,
            _projectId: number
        ): Promise<Milestone | null> => {
            const res = await addMilestoneAssignee(milestoneId, userId, accessToken);
            if (res?.milestone) {
                setProjectMilestonesState((prev) => upsertMilestoneInList(prev, res.milestone));
                if (currentMilestone?.milestoneId === res.milestone.milestoneId) {
                    setCurrentMilestone(res.milestone);
                }
                syncMilestoneBackingTaskCaches(res.milestone);
            }
            return res?.milestone ?? null;
        },
        [accessToken, currentMilestone]
    );

    const unassignMilestoneMember = useCallback(
        async (
            milestoneId: number,
            userId: number | string,
            _projectId: number
        ): Promise<Milestone | null> => {
            const res = await removeMilestoneAssignee(milestoneId, userId, accessToken);
            if (res?.milestone) {
                setProjectMilestonesState((prev) => upsertMilestoneInList(prev, res.milestone));
                if (currentMilestone?.milestoneId === res.milestone.milestoneId) {
                    setCurrentMilestone(res.milestone);
                }
                syncMilestoneBackingTaskCaches(res.milestone);
            }
            return res?.milestone ?? null;
        },
        [accessToken, currentMilestone]
    );

    return {
        sprintConfig,
        setSprintConfig,
        projectSprints,
        setProjectSprints,
        currentSprint,
        setCurrentSprint,
        projectMilestones,
        setProjectMilestones,
        currentMilestone,
        setCurrentMilestone,
        tsLastMilestonesLoaded,
        tsLastSprintsLoaded,
        loadConfigForProject,
        saveConfig,
        loadSprintsForProject,
        loadMilestonesForProject,
        refreshMilestone,
        createNewSprint,
        updateExistingSprint,
        removeSprint,
        createNewMilestone,
        updateExistingMilestone,
        applyMilestoneToState,
        moveMilestone,
        removeMilestone,
        assignMilestoneMember,
        unassignMilestoneMember,
        initializeSprintMilestoneStates,
    };
};
