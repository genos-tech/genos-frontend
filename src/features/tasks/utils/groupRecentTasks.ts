import { SearchTeamTasksResponse } from "../../../types/tasks";

// Every status: the point of Recents includes checking a task right after
// closing or deleting it. Finished tasks count towards the per-project limit.
export const RECENTS_STATUSES = "open,wip,blocked,pending,closed,deleted";
export const RECENTS_PER_PROJECT = 20;

export type RecentTaskGroup = {
    projectId: number;
    projectName: string;
    systemUserId: string;
    tasks: SearchTeamTasksResponse[];
};

/**
 * Group the sidebar's Recents by project, newest first.
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

    // Tasks within each group by tsUpdated descending.
    result.forEach((group) => {
        group.tasks.sort(
            (a, b) => new Date(b.tsUpdated).getTime() - new Date(a.tsUpdated).getTime()
        );
    });

    // Groups by their most recent task's tsUpdated descending.
    return result.sort((a, b) => {
        const aLatest = a.tasks[0]?.tsUpdated ?? "";
        const bLatest = b.tasks[0]?.tsUpdated ?? "";
        return new Date(bLatest).getTime() - new Date(aLatest).getTime();
    });
};
