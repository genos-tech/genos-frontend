import { useEffect, useRef, useState } from "react";

import { loadProjectTasks } from "../../features/tasks/services/loadProjectTasks";
import { loadTeamProjects } from "../../features/tasks/services/loadTeamProjects";
import { UserProps } from "../../types/admin";
import { ProjectProps } from "../../types/tasks";

export interface ProjectManagementState {
    teamProjects: ProjectProps[];
    setTeamProjects: (projects: ProjectProps[]) => void;
    openCreateProject: boolean;
    setOpenCreateProject: (open: boolean) => void;
    isNewProjectCreated: boolean;
    setIsNewProjectCreated: (created: boolean) => void;
    currentProject: ProjectProps | null;
    setCurrentProject: (project: ProjectProps | null) => void;
    loadProjectsAndTasks: (targetProjectId: number) => Promise<void>;
    refreshProjectTasks: (projectId: number) => Promise<void>;
    // Signal that tasks for `projectId` have just finished being written to
    // IndexedDB by `loadProjectTasks`. Consumers can react to this to fetch
    // the freshly-cached rows into React state, instead of guessing with a
    // fixed setTimeout.
    tsTasksLoadedToIDB: { ts: number; projectId: number } | undefined;
}

export const useProjectManagement = (
    myself: UserProps,
    accessToken: string | null,
    currentTeamId: string
): ProjectManagementState => {
    const [teamProjects, setTeamProjects] = useState<ProjectProps[]>([]);
    const [openCreateProject, setOpenCreateProject] = useState(false);
    const [isNewProjectCreated, setIsNewProjectCreated] = useState(false);
    const [currentProject, setCurrentProject] = useState<ProjectProps | null>(null);
    const [tsTasksLoadedToIDB, setTsTasksLoadedToIDB] = useState<
        { ts: number; projectId: number } | undefined
    >(undefined);

    // Held in a ref because the `[myself]` effect below uses this to
    // throttle re-fires. The previous `let` reset to undefined on every
    // render, so the throttle check was always taking the "first run"
    // branch — every myself update triggered another `loadProjectsAndTasks`
    // (and therefore another `getProjectTasks` fetch).
    const tsLastLoadProjectAndTasks = useRef<number | undefined>(undefined);

    const loadProjectsAndTasks = async (targetProjectId: number = -1) => {
        // Load the latest project as initial process
        const loadedTeamProjects: ProjectProps[] | undefined = await loadTeamProjects(
            myself,
            accessToken
        );
        // Only stamp the throttle timestamp on a real response. If
        // `loadTeamProjects` early-returned (missing teamId, auth
        // error, network failure), updating the timestamp would block
        // the next `[myself]` re-fire — which is the one most likely
        // to succeed. The effect's own guard skips empty-myself calls,
        // but this protects every other failure mode too.
        if (!loadedTeamProjects) return;
        tsLastLoadProjectAndTasks.current = Date.now();

        // When the user has just switched teams, any caller-supplied
        // `targetProjectId` (and any cached lastProjectId on localStorage,
        // which the public setTimeout caller resolves before us) refers to
        // the PREVIOUS team's project and is no longer applicable. Force it
        // to -1 so the joined-project default below picks a project the
        // user is actually a member of in the new team (`ProjectMembers`).
        const teamHasChanged = !!currentTeamId && myself.teamId !== currentTeamId;
        if (teamHasChanged) {
            targetProjectId = -1;
        }

        // Set the current project to one of the joining project.
        if (loadedTeamProjects && loadedTeamProjects.length > 0) {
            setTeamProjects([...loadedTeamProjects]);

            for (let i = 0; i < loadedTeamProjects.length; i++) {
                // If the current project is not set, or the current project is not the same
                // as the loaded team projects, set the current project to the loaded team projects.
                if (
                    currentProject === null ||
                    currentProject.projectId !== loadedTeamProjects[i].projectId
                ) {
                    if (targetProjectId !== -1 && currentProject && currentTeamId) {
                        // Defense in depth: when the team has just changed,
                        // also require `isJoined === true` here so we never
                        // auto-select a project the user isn't a member of.
                        // (`teamHasChanged` already nulls out `targetProjectId`
                        // above, so this branch shouldn't fire on team switch
                        // — but the explicit guard protects against any
                        // future caller path that supplies a stale id.)
                        if (
                            loadedTeamProjects[i].projectId === targetProjectId ||
                            (myself.teamId !== currentTeamId &&
                                loadedTeamProjects[i].isJoined === true)
                        ) {
                            const pickedProjectId = loadedTeamProjects[i].projectId;
                            setCurrentProject({
                                projectId: pickedProjectId,
                                projectName: loadedTeamProjects[i].projectName,
                                projectTags: loadedTeamProjects[i].projectTags,
                                isPrivate: loadedTeamProjects[i].isPrivate,
                                systemUserId: loadedTeamProjects[i].systemUserId,
                            });
                            // Load the latest tasks and insert into the indexedDB
                            await loadProjectTasks(myself, pickedProjectId, accessToken);
                            setTsTasksLoadedToIDB({
                                ts: Date.now(),
                                projectId: pickedProjectId,
                            });
                            break;
                        }
                    } else {
                        // If targetProjectId is not -1, set the target project as the current project
                        if (targetProjectId !== -1) {
                            if (loadedTeamProjects[i].projectId === targetProjectId) {
                                const pickedProjectId = loadedTeamProjects[i].projectId;
                                setCurrentProject({
                                    projectId: pickedProjectId,
                                    projectName: loadedTeamProjects[i].projectName,
                                    projectTags: loadedTeamProjects[i].projectTags,
                                    isPrivate: loadedTeamProjects[i].isPrivate,
                                    systemUserId: loadedTeamProjects[i].systemUserId,
                                });
                                // Load the latest tasks and insert into the indexedDB
                                await loadProjectTasks(myself, pickedProjectId, accessToken);
                                setTsTasksLoadedToIDB({
                                    ts: Date.now(),
                                    projectId: pickedProjectId,
                                });
                                break;
                            }
                        } else if (
                            loadedTeamProjects[i].isJoined === true &&
                            loadedTeamProjects[i].projectId
                        ) {
                            const pickedProjectId = loadedTeamProjects[i].projectId;
                            setCurrentProject({
                                projectId: pickedProjectId,
                                projectName: loadedTeamProjects[i].projectName,
                                projectTags: loadedTeamProjects[i].projectTags,
                                isPrivate: loadedTeamProjects[i].isPrivate,
                                systemUserId: loadedTeamProjects[i].systemUserId,
                            });
                            // Load the latest tasks and insert into the indexedDB
                            await loadProjectTasks(myself, pickedProjectId, accessToken);
                            setTsTasksLoadedToIDB({
                                ts: Date.now(),
                                projectId: pickedProjectId,
                            });
                            break;
                        }
                    }
                }
            }
        }
    };

    const refreshProjectTasks = async (projectId: number) => {
        await loadProjectTasks(myself, projectId, accessToken);
        setTsTasksLoadedToIDB({
            ts: Date.now(),
            projectId: projectId,
        });
    };

    // Update project isPrivate if undefined
    useEffect(() => {
        if (currentProject && currentProject.isPrivate === undefined) {
            const targetProject: ProjectProps | undefined = teamProjects.find(
                (project) => project.projectId === currentProject.projectId
            );
            if (targetProject) {
                setCurrentProject(targetProject);
            }
        }
    }, [currentProject, teamProjects]);

    // Load projects and tasks when myself changes.
    //
    // GUARD: skip until `myself` actually has teamId + userId. On a
    // cold app load (fresh tab, post-deploy reload) `myself` arrives
    // as an empty placeholder first, then is replaced ~1s later when
    // the auth + getMyTeams round-trips complete. Without this guard:
    //   1. The first effect fires with empty `myself`.
    //   2. The 500ms timer calls `loadProjectsAndTasks` → which calls
    //      `loadTeamProjects`, which early-returns undefined because
    //      `teamId` is empty.
    //   3. Line 49 still stamps `tsLastLoadProjectAndTasks` on this
    //      failed call.
    //   4. The next render (myself now populated) re-fires the effect
    //      but the 1s throttle blocks it.
    //   5. Result: `teamProjects` stays at [] — the sidebar shows no
    //      projects, the task table / sprint board can't open. Until
    //      the user clicks a recent task (which finally gets the
    //      throttle to expire and a later re-render succeeds).
    // Skipping the effect entirely until myself is ready means the
    // first valid run is the only run, no wasted call.
    useEffect(() => {
        if (!myself.teamId || !myself.userId) return;
        const intervalMs: number = 1000;
        const now = Date.now();
        const last = tsLastLoadProjectAndTasks.current;
        if (last === undefined || now - last >= intervalMs) {
            setTimeout(() => {
                (async () => {
                    await loadProjectsAndTasks(
                        localStorage.getItem("lastProjectId")
                            ? Number(localStorage.getItem("lastProjectId"))
                            : -1
                    );
                })();
            }, 500); // wait 500ms
        }
    }, [myself]);

    return {
        teamProjects,
        setTeamProjects,
        openCreateProject,
        setOpenCreateProject,
        isNewProjectCreated,
        setIsNewProjectCreated,
        currentProject,
        setCurrentProject,
        loadProjectsAndTasks,
        refreshProjectTasks,
        tsTasksLoadedToIDB,
    };
};
