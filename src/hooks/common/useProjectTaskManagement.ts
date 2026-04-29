import { useEffect } from "react";

import { useTaskManagement } from "../tasks/useTaskManagement";
import { useProjectManagement } from "./useProjectManagement";

interface UseProjectTaskManagementProps {
    myself: any;
    accessToken: string;
    currentTeamId: string;
    openingService: number;
}

export const useProjectTaskManagement = ({
    myself,
    accessToken,
    currentTeamId,
    openingService,
}: UseProjectTaskManagementProps) => {
    const usePM = useProjectManagement(myself, accessToken, currentTeamId);
    const useTM = useTaskManagement(myself, accessToken);

    // Auto-fetch project tasks when project changes
    useEffect(() => {
        const intervalMs: number = 1000;
        const now = Date.now();
        if (
            useTM.tsLastLoadProjectTasks === undefined ||
            (useTM.tsLastLoadProjectTasks && now - useTM.tsLastLoadProjectTasks >= intervalMs)
        ) {
            setTimeout(() => {
                (async () => {
                    if (usePM.currentProject && usePM.currentProject.projectId) {
                        await useTM.fetchProjectTasks(usePM.currentProject.projectId);
                        localStorage.setItem(
                            "lastProjectId",
                            usePM.currentProject.projectId.toString()
                        );
                    }
                })();
            }, 1000);
        }
    }, [usePM.currentProject]);

    // Handle new project creation
    useEffect(() => {
        (async () => {
            if (usePM.currentProject && usePM.isNewProjectCreated === true) {
                useTM.fetchProjectTasks(usePM.currentProject.projectId);
                localStorage.setItem("lastProjectId", usePM.currentProject.projectId.toString());
            }
        })();
    }, [usePM.isNewProjectCreated]);

    // Load updated task when preview changes
    useEffect(() => {
        if (usePM.currentProject) {
            useTM.loadUpdatedTask(usePM.currentProject.projectId);
        }
    }, [useTM.currentPreviewTaskId, useTM.isNewTaskCreated, useTM.isTaskUpdatedBySomeone]);

    // Handle new task creation
    useEffect(() => {
        if (useTM.isNewTaskCreated === true) {
            setTimeout(() => {
                (async () => {
                    await usePM.loadProjectsAndTasks(
                        localStorage.getItem("lastProjectId")
                            ? Number(localStorage.getItem("lastProjectId"))
                            : -1
                    );
                })();
            }, 500);
        }
    }, [useTM.isNewTaskCreated]);

    // Auto-load task when preview ID changes
    useEffect(() => {
        if (usePM.currentProject && useTM.currentPreviewTaskId !== -1) {
            useTM.loadTask(usePM.currentProject.projectId, useTM.currentPreviewTaskId);
            if (openingService !== 1) {
                useTM.setIsTaskPreviewVisible(true);
            }
        }
    }, [useTM.currentPreviewTaskId, usePM.currentProject]);

    // Reset task state when team/project changes
    useEffect(() => {
        if (!usePM.currentProject) {
            useTM.setIsTaskPreviewVisible(false);
            useTM.setCurrentPreviewTaskId(-1);
            useTM.setCurrentPreviewTask(undefined);
            useTM.setIsCreatingTask({
                flag: false,
                parentTaskId: null,
                rootTaskId: null,
            });
        }
    }, [usePM.currentProject]);

    // Wipe all project & task React state when the user switches teams.
    // Without this, the previous team's projects keep showing in TaskSidebarMain
    // (loadProjectsAndTasks only replaces teamProjects when the new team has at
    // least one project) and stale tasks/preview can briefly render in the new team.
    useEffect(() => {
        if (!currentTeamId) return;
        usePM.setTeamProjects([]);
        usePM.setCurrentProject(null);
        useTM.setAllTasks([]);
        useTM.setCurrentPreviewTask(undefined);
        useTM.setCurrentPreviewTaskId(-1);
        useTM.setIsTaskPreviewVisible(false);
        useTM.setIsTaskHomeVisible(true);
        useTM.setCurrentTaskChain([]);
        useTM.setTaskMetaTree([]);
        useTM.setIsCreatingTask({
            flag: false,
            parentTaskId: null,
            rootTaskId: null,
        });
        // We expect to load tasks for the new team's first project shortly.
        // Flip the loading flag now so the table shows the "waiting" spinner
        // during the gap before fetchProjectTasks fires. The safety timeout in
        // useTaskManagement will reset it if no project ever loads.
        useTM.setIsLoadingTasks(true);
    }, [currentTeamId]);

    return {
        usePM,
        useTM,
    };
};
