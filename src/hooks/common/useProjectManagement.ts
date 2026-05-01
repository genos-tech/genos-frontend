import { useEffect, useState } from "react";

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

    let tsLastLoadProjectAndTasks: number | undefined = undefined;

    const loadProjectsAndTasks = async (targetProjectId: number = -1) => {
        // Load the latest project as initial process
        const loadedTeamProjects: ProjectProps[] = await loadTeamProjects(myself, accessToken);
        tsLastLoadProjectAndTasks = Date.now();

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

    // Load projects and tasks when myself changes
    useEffect(() => {
        const intervalMs: number = 1000;
        const now = Date.now();
        if (
            tsLastLoadProjectAndTasks === undefined ||
            (tsLastLoadProjectAndTasks && now - tsLastLoadProjectAndTasks >= intervalMs)
        ) {
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
        tsTasksLoadedToIDB,
    };
};
