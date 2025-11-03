import { useEffect } from "react";

import { useTaskManagement } from "../tasks/useTaskManagement";
import { useProjectManagement } from "./useProjectManagement";

interface UseProjectTaskManagementProps {
    myself: any;
    accessToken: string;
    currentTeamId: string;
}

export const useProjectTaskManagement = ({
    myself,
    accessToken,
    currentTeamId,
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

    return {
        usePM,
        useTM,
    };
};
