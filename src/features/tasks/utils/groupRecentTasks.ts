import { SearchTeamTasksResponse } from "../../../types/tasks";

// The server returns every status (`GET /task/recent/`): the point of Recents
// includes checking a task right after closing or deleting it. Finished tasks
// count towards the per-project limit.
export const RECENTS_PER_PROJECT = 20;

// A project folder under Recents shows this many tasks when opened, and the
// "More" row reveals this many further ones per click. All
// `RECENTS_PER_PROJECT` rows are already in memory, so revealing is local: no
// extra request, and 20 is the most a project can ever show.
export const RECENTS_INITIAL_VISIBLE = 5;
export const RECENTS_MORE_STEP = 5;

/** Rows to show after one "More" click. Never past what is loaded. */
export const nextRecentsVisible = (visible: number, total: number): number =>
    Math.min(total, visible + RECENTS_MORE_STEP);

/**
 * Rows a folder must show so the task at `index` is among them. Rounded up to
 * a whole page so the folder grows by the same steps "More" uses, rather than
 * ending on an odd number. Never shrinks a folder the user already widened.
 */
export const recentsVisibleToReveal = (visible: number, index: number): number => {
    if (index < 0 || index < visible) return visible;
    return Math.ceil((index + 1) / RECENTS_MORE_STEP) * RECENTS_MORE_STEP;
};

// When the user opened the task, as a sort key. A row without it sorts last, not
// "newest" (NaN would make the order depend on the engine).
const openedAt = (task: SearchTeamTasksResponse | undefined): number => {
    const time = task?.tsOpened ? new Date(task.tsOpened).getTime() : NaN;
    return Number.isFinite(time) ? time : 0;
};

export type RecentTaskGroup = {
    projectId: number;
    projectName: string;
    systemUserId: string;
    tasks: SearchTeamTasksResponse[];
};

/**
 * Group the sidebar's Recents by project, most recently OPENED first.
 *
 * Keyed by `projectId`, not `projectName`: two projects may share a name and
 * must stay separate groups (the old name key merged them).
 */
export const groupRecentTasks = (recentTasks: SearchTeamTasksResponse[]): RecentTaskGroup[] => {
    const groups = new Map<number, RecentTaskGroup>();

    recentTasks.forEach((task) => {
        let group = groups.get(task.projectId);
        if (!group) {
            group = {
                projectId: task.projectId,
                projectName: task.projectName,
                systemUserId: task.systemUserId,
                tasks: [],
            };
            groups.set(task.projectId, group);
        }
        group.tasks.push(task);
    });

    const result = Array.from(groups.values());

    // Tasks within each group by tsOpened descending.
    result.forEach((group) => {
        group.tasks.sort((a, b) => openedAt(b) - openedAt(a));
    });

    // Groups by their most recently opened task, newest first.
    return result.sort((a, b) => openedAt(b.tasks[0]) - openedAt(a.tasks[0]));
};
