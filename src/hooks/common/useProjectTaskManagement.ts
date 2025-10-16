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
    const PM = useProjectManagement(myself, accessToken, currentTeamId);
    const TM = useTaskManagement(myself, accessToken);

    // Auto-fetch project tasks when project changes
    useEffect(() => {
        const intervalMs: number = 1000;
        const now = Date.now();
        if (
            TM.tsLastLoadProjectTasks === undefined ||
            (TM.tsLastLoadProjectTasks && now - TM.tsLastLoadProjectTasks >= intervalMs)
        ) {
            setTimeout(() => {
                (async () => {
                    if (PM.currentProject && PM.currentProject.projectId) {
                        await TM.fetchProjectTasks(PM.currentProject.projectId);
                        localStorage.setItem(
                            "lastProjectId",
                            PM.currentProject.projectId.toString()
                        );
                    }
                })();
            }, 1000);
        }
    }, [PM.currentProject]);

    // Handle new project creation
    useEffect(() => {
        (async () => {
            if (PM.currentProject && PM.isNewProjectCreated === true) {
                TM.fetchProjectTasks(PM.currentProject.projectId);
                localStorage.setItem("lastProjectId", PM.currentProject.projectId.toString());
            }
        })();
    }, [PM.isNewProjectCreated]);

    // Load updated task when preview changes
    useEffect(() => {
        if (PM.currentProject) {
            TM.loadUpdatedTask(PM.currentProject.projectId);
        }
    }, [TM.currentPreviewTaskId, TM.isNewTaskCreated, TM.isTaskUpdatedBySomeone]);

    // Handle new task creation
    useEffect(() => {
        if (TM.isNewTaskCreated === true) {
            setTimeout(() => {
                (async () => {
                    await PM.loadProjectsAndTasks(
                        localStorage.getItem("lastProjectId")
                            ? Number(localStorage.getItem("lastProjectId"))
                            : -1
                    );
                })();
            }, 500);
        }
    }, [TM.isNewTaskCreated]);

    // Auto-load task when preview ID changes
    useEffect(() => {
        if (PM.currentProject && TM.currentPreviewTaskId !== -1) {
            TM.loadTask(PM.currentProject.projectId, TM.currentPreviewTaskId);
        }
    }, [TM.currentPreviewTaskId, PM.currentProject]);

    // Reset task state when team/project changes
    useEffect(() => {
        if (!PM.currentProject) {
            TM.setIsTaskPreviewVisible(false);
            TM.setCurrentPreviewTaskId(-1);
            TM.setCurrentPreviewTask(undefined);
            TM.setIsCreatingTask({
                flag: false,
                parentTaskId: null,
                rootTaskId: null,
            });
        }
    }, [PM.currentProject]);

    return {
        PM,
        TM,
    };
};
