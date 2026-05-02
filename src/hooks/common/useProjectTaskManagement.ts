import { useEffect } from "react";

import { useSprintMilestoneManagement } from "../tasks/useSprintMilestoneManagement";
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
    const useSM = useSprintMilestoneManagement(accessToken);

    // Auto-fetch project tasks when:
    //   (a) loadProjectsAndTasks has just finished writing the tasks for the
    //       current project into IndexedDB (signaled by tsTasksLoadedToIDB), or
    //   (b) currentProject changed but no signal has fired (e.g. setCurrentProject
    //       was called directly from a chat bubble or thread navigation, without
    //       going through loadProjectsAndTasks). In that case fall back to a
    //       short delay so any in-flight IDB write has a chance to complete.
    //
    // Previously this effect always waited a fixed 1000ms before reading from
    // IndexedDB, which raced loadProjectTasks on slower networks. When a team
    // switch fired loadProjectTasks > 1s of API + IDB time, the fetch ran
    // against an empty store, allTasks was set to [], and nothing re-read the
    // store afterward — leaving the table empty until the user refreshed.
    useEffect(() => {
        if (!usePM.currentProject || !usePM.currentProject.projectId) return;
        const projectId = usePM.currentProject.projectId;

        const runFetch = () => {
            useTM.fetchProjectTasks(projectId);
            localStorage.setItem("lastProjectId", projectId.toString());
        };

        // Signal matches the active project: IDB is freshly populated, fetch now.
        if (usePM.tsTasksLoadedToIDB?.projectId === projectId) {
            runFetch();
            return;
        }

        // Fallback path: schedule a deferred fetch and clear it if the signal
        // arrives first (which will re-trigger this effect via the dep below).
        const timer = setTimeout(runFetch, 1000);
        return () => clearTimeout(timer);
    }, [usePM.currentProject, usePM.tsTasksLoadedToIDB]);

    // Load sprint config + sprints + milestones whenever the active
    // project changes. Each loader is idempotent and replaces only its
    // own slice in the per-project keyed maps.
    useEffect(() => {
        if (!usePM.currentProject || !usePM.currentProject.projectId) return;
        const projectId = usePM.currentProject.projectId;
        (async () => {
            await useSM.loadConfigForProject(projectId);
            await useSM.loadSprintsForProject(projectId);
            await useSM.loadMilestonesForProject(projectId, {
                statuses: ["Open", "WIP", "Pending", "Closed"],
            });
        })();
    }, [usePM.currentProject?.projectId]);

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
                creationKind: "task",
                milestoneId: null,
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
            creationKind: "task",
            milestoneId: null,
        });
        useSM.initializeSprintMilestoneStates();
        // We expect to load tasks for the new team's first project shortly.
        // Flip the loading flag now so the table shows the "waiting" spinner
        // during the gap before fetchProjectTasks fires. The safety timeout in
        // useTaskManagement will reset it if no project ever loads.
        useTM.setIsLoadingTasks(true);
    }, [currentTeamId]);

    return {
        usePM,
        useTM,
        useSM,
    };
};
