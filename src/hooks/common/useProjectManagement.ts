import { useState, useEffect } from "react";
import { UserProps } from "../../types/admin";
import { ProjectProps } from "../../types/tasks";
import { loadTeamProjects } from "../../features/tasks/services/loadTeamProjects";
import { loadProjectTasks } from "../../features/tasks/services/loadProjectTasks";

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

    let tsLastLoadProjectAndTasks: number | undefined = undefined;

    const loadProjectsAndTasks = async (targetProjectId: number = -1) => {
        // Load the latest project as initial process
        const loadedTeamProjects: ProjectProps[] = await loadTeamProjects(myself, accessToken);
        tsLastLoadProjectAndTasks = Date.now();

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
                    if (targetProjectId !== -1 && currentProject) {
                        if (
                            loadedTeamProjects[i].projectId === targetProjectId ||
                            myself.teamId !== currentTeamId
                        ) {
                            setCurrentProject({
                                projectId: loadedTeamProjects[i].projectId,
                                projectName: loadedTeamProjects[i].projectName,
                                projectTags: loadedTeamProjects[i].projectTags,
                                isPrivate: loadedTeamProjects[i].isPrivate,
                                systemUserId: loadedTeamProjects[i].systemUserId,
                            });
                            // Load the latest tasks and insert into the indexedDB
                            await loadProjectTasks(
                                myself,
                                loadedTeamProjects[i].projectId,
                                accessToken
                            );
                            break;
                        }
                    } else {
                        // If targetProjectId is not -1, set the target project as the current project
                        if (targetProjectId !== -1) {
                            if (loadedTeamProjects[i].projectId === targetProjectId) {
                                setCurrentProject({
                                    projectId: loadedTeamProjects[i].projectId,
                                    projectName: loadedTeamProjects[i].projectName,
                                    projectTags: loadedTeamProjects[i].projectTags,
                                    isPrivate: loadedTeamProjects[i].isPrivate,
                                    systemUserId: loadedTeamProjects[i].systemUserId,
                                });
                                // Load the latest tasks and insert into the indexedDB
                                await loadProjectTasks(
                                    myself,
                                    loadedTeamProjects[i].projectId,
                                    accessToken
                                );
                                break;
                            }
                        } else if (
                            loadedTeamProjects[i].isJoined === true &&
                            loadedTeamProjects[i].projectId
                        ) {
                            setCurrentProject({
                                projectId: loadedTeamProjects[i].projectId,
                                projectName: loadedTeamProjects[i].projectName,
                                projectTags: loadedTeamProjects[i].projectTags,
                                isPrivate: loadedTeamProjects[i].isPrivate,
                                systemUserId: loadedTeamProjects[i].systemUserId,
                            });
                            // Load the latest tasks and insert into the indexedDB
                            await loadProjectTasks(
                                myself,
                                loadedTeamProjects[i].projectId,
                                accessToken
                            );
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
    };
};
