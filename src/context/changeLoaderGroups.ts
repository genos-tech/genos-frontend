import type { LoaderGroups } from "./changeRefresher";

/** The app's loaders, as the change-driven refresh sees them. */
export interface ChangeLoaderSources {
    getChatNoteMeta: () => Promise<boolean>;
    getMyNoteMeta: () => Promise<boolean>;
    getSharedNoteMeta: () => Promise<boolean>;
    getTaskNoteMeta: () => Promise<boolean>;
    getTeamNoteFolders: () => Promise<boolean>;
    getTeamNoteMeta: () => Promise<boolean>;
    /** The project LIST: resolves `false` when the request failed. */
    loadProjects: () => Promise<boolean>;
    /** The team-wide task list behind the `#` menu: `false` when it failed. */
    loadTeamTasks: () => Promise<boolean>;
    /** The `since=` delta of one project's tasks. REJECTS when the request failed. */
    refreshProjectTasks: (projectId: number) => Promise<void>;
    /** One project's sprints: `false` when the request failed. */
    refreshSprints: (projectId: number) => Promise<boolean>;
}

/**
 * Which loaders each `/changes/` token drives (MIP-970's table). A token moving
 * is the only thing that runs its loaders; a loader missing here is a list that
 * would go stale until the 10-minute backstop, and one listed under the wrong
 * token is a refetch that never comes.
 *
 *   tasks_project   open project's task delta + its sprints
 *   tasks_team      team-wide task list (the `#` menu)
 *   projects        project list
 *   notes_personal  my notes, shared-with-me notes, team folders, team notes
 *   notes_task      task notes
 *   notes_chat      chat notes
 *
 * With no project open there is nothing to load for `tasks_project`.
 */
export const buildChangeLoaderGroups = (
    src: ChangeLoaderSources,
    projectId: number | null
): LoaderGroups => ({
    notes_chat: [src.getChatNoteMeta],
    notes_personal: [
        src.getMyNoteMeta,
        src.getSharedNoteMeta,
        src.getTeamNoteFolders,
        src.getTeamNoteMeta,
    ],
    notes_task: [src.getTaskNoteMeta],
    projects: [src.loadProjects],
    tasks_project: projectId
        ? [
              async () => {
                  await src.refreshProjectTasks(projectId);
                  return true;
              },
              () => src.refreshSprints(projectId),
          ]
        : [],
    tasks_team: [src.loadTeamTasks],
});
