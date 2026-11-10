import { useCallback, useEffect, useRef, useState } from "react";

import {
    PROJECT_DELETED_EVENT,
    type ProjectDeletedDetail,
} from "../../features/agentQA/approvedProjectWrites";
import { loadProjectTasks } from "../../features/tasks/services/loadProjectTasks";
import { loadTeamProjects } from "../../features/tasks/services/loadTeamProjects";
import { syncStatus, tasksScope } from "../../services/syncStatus";
import { UserProps } from "../../types/admin";
import { ProjectProps } from "../../types/tasks";
import { keepIfEqual } from "../../utils/keepIfEqual";

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
    // Open a project the user picked (sidebar, milestone of another project,
    // dashboard picker). The project is the open one in the same render as
    // the click, and its rows are refreshed from the server in the background.
    openProject: (project: ProjectProps) => void;
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
    const [teamProjects, setTeamProjectsRaw] = useState<ProjectProps[]>([]);
    // The one write path for the project list. A caller that re-fetches the
    // list on a timer (the `#`-mention refresh in App.tsx) hands in a new
    // array every time, even when the server's answer is unchanged, and a new
    // identity re-renders the project sidebar, dashboard and routing effects.
    // Handing back `prev` for an equal list makes that write a no-op; any
    // real change (add / join / rename / delete / reorder) still lands as a
    // new array. Stable identity, because it is threaded into services and
    // memoized props.
    const setTeamProjects = useCallback(
        (projects: ProjectProps[]) => setTeamProjectsRaw((prev) => keepIfEqual(prev, projects)),
        []
    );
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

    // Load the latest tasks of the project just picked and announce them (the table
    // reads them from IndexedDB). A failed load must not escape: `loadProjectsAndTasks`
    // is awaited by an un-awaited IIFE in the `[myself]` effect, so a rejection was an
    // unhandled promise rejection (MIP-1324). `loadProjectTasks` has already told the
    // sync status (`report("tasks", false)`, so the banner and Retry exist); this only
    // logs, and still announces, so the table shows the rows IndexedDB already has.
    const loadPickedProjectTasks = async (pickedProjectId: number) => {
        try {
            await loadProjectTasks(myself, pickedProjectId, accessToken);
        } catch (error) {
            console.error(`Failed to load the tasks of project ${pickedProjectId}`, error);
        }
        setTsTasksLoadedToIDB({ ts: Date.now(), projectId: pickedProjectId });
    };

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
        if (!loadedTeamProjects) {
            // No answer. With a team and a token that is a failed load, not "no
            // projects": say so, or the sidebar and the dashboard claim "No
            // project selected" for a workspace that was never read (MIP-1298).
            if (accessToken && myself.teamId && myself.userId) {
                syncStatus.report("projects", false);
            }
            return;
        }
        syncStatus.report("projects", true);
        // A project the list no longer holds (deleted, left, access lost) has no
        // task load worth retrying: its failure must not hold the banner up for a
        // stale `lastProjectId` (MIP-1323).
        syncStatus.retainProjects(loadedTeamProjects.map((p) => p.projectId));
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
                                projectLabels: loadedTeamProjects[i].projectLabels,
                                isPrivate: loadedTeamProjects[i].isPrivate,
                                systemUserId: loadedTeamProjects[i].systemUserId,
                            });
                            await loadPickedProjectTasks(pickedProjectId);
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
                                    projectLabels: loadedTeamProjects[i].projectLabels,
                                    isPrivate: loadedTeamProjects[i].isPrivate,
                                    systemUserId: loadedTeamProjects[i].systemUserId,
                                });
                                await loadPickedProjectTasks(pickedProjectId);
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
                                projectLabels: loadedTeamProjects[i].projectLabels,
                                isPrivate: loadedTeamProjects[i].isPrivate,
                                systemUserId: loadedTeamProjects[i].systemUserId,
                            });
                            await loadPickedProjectTasks(pickedProjectId);
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

    // The click on a project. `loadProjectsAndTasks` was used for this, and
    // it first waited for the whole `GET /project/projects/` answer to pick the
    // project out of it, then set it as the open one, then loaded its tasks: two
    // round trips in series, with the open project (and so the URL, the
    // filters and the sort) unchanged until the first returned. The click
    // already holds the project, so: set it now, refresh its rows (`refreshProjectTasks`
    // announces them through `tsTasksLoadedToIDB`, which makes the table read
    // them), and leave the list to its own 60 s refresh.
    //
    // The list's record is the complete one (labels, `isExternal`,
    // `hostTeamName`, ...); the dashboard picker and the milestone click build
    // partial objects, so prefer the record and fall back to what was passed.
    const openProject = (project: ProjectProps) => {
        const projectId = project.projectId;
        setCurrentProject(teamProjects.find((p) => p.projectId === projectId) ?? project);
        refreshProjectTasks(projectId).catch((error: unknown) => {
            console.error(`Failed to refresh the tasks of project ${projectId}`, error);
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

    // The agent deleted a project (an approved `delete_project`). The server
    // has already done it, so this only drops the browser's copies, the same
    // two steps `ModalDeleteProject` takes on a 204 and with no call to the
    // delete endpoint: leave the project's page if it is the open one, and
    // take it out of the team project list (the sidebar). Functional updates,
    // because this listener is installed once and would otherwise close over
    // the first render's lists.
    useEffect(() => {
        const onProjectDeleted = (event: Event) => {
            const projectId = (event as CustomEvent<ProjectDeletedDetail>).detail?.projectId;
            if (typeof projectId !== "number") return;
            syncStatus.forget(tasksScope(projectId));
            setCurrentProject((current) => (current?.projectId === projectId ? null : current));
            setTeamProjectsRaw((projects) => projects.filter((p) => p.projectId !== projectId));
        };
        window.addEventListener(PROJECT_DELETED_EVENT, onProjectDeleted);
        return () => window.removeEventListener(PROJECT_DELETED_EVENT, onProjectDeleted);
    }, []);

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
        openProject,
        tsTasksLoadedToIDB,
    };
};
