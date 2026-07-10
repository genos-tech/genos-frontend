import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { onTasksBulkChanged } from "../../features/tasks/services/taskEvents";
import { useSprintMilestoneManagement } from "../tasks/useSprintMilestoneManagement";
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
    const location = useLocation();
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
        // These three loaders are independent — each hits a different endpoint
        // and replaces only its own per-project state slice — so fire them in
        // parallel instead of a serial await chain, which was 3x the latency
        // in series on a slow backend. `allSettled` so one failure doesn't stop
        // the others (the old serial chain aborted the rest on the first throw).
        void Promise.allSettled([
            useSM.loadConfigForProject(projectId),
            useSM.loadSprintsForProject(projectId),
            useSM.loadMilestonesForProject(projectId, {
                statuses: ["Open", "WIP", "Pending", "Closed"],
            }),
        ]);
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

    // Freshness strategy. Two pieces working together:
    //
    //   (A) Window focus → refresh the project task list. The list call
    //       is cheap and gives every row a fresh `updatedAt`. This is
    //       the *trigger*: it makes `allTasks` authoritative.
    //   (B) `allTasks`-watch effect below → when the open preview's row
    //       in `allTasks` has a newer `updatedAt` than what
    //       `currentPreviewTask` currently shows, re-run
    //       `loadUpdatedTask`. `loadSpecificTask` then compares against
    //       the IDB cache: cache up-to-date → instant hit, no API call;
    //       cache stale → API refetch. Either way the preview lands on
    //       fresh data.
    //
    // This catches everything the PM socket misses (PR-merge auto-close,
    // teammate edits via the task UI, background jobs) without paying
    // for a full task refetch every focus event.
    useEffect(() => {
        const onFocus = () => {
            if (usePM.currentProject) {
                void usePM.refreshProjectTasks(usePM.currentProject.projectId);
            }
        };
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [usePM.currentProject]);

    // Agent bulk-write invalidator. The agent's approved task writes
    // (create_task_plan, update_tasks_bulk, ...) mutate tasks AND
    // milestones outside every UI flow above, so without this the table
    // / diagram / milestone list show stale data until a reload or
    // focus cycle. Re-run the same network refresh the focus handler
    // uses, plus the milestone slice (a plan can create a milestone;
    // a bulk update changes the rollup counts) and the open milestone
    // preview if any.
    useEffect(() => {
        return onTasksBulkChanged((detail) => {
            const projectId = detail.projectId ?? usePM.currentProject?.projectId;
            if (!projectId) return;
            void usePM.refreshProjectTasks(projectId);
            void useSM.loadMilestonesForProject(projectId, {
                statuses: ["Open", "WIP", "Pending", "Closed"],
            });
            if (useTM.currentPreviewMilestoneId !== -1) {
                void useSM.refreshMilestone(useTM.currentPreviewMilestoneId);
            }
        });
    }, [usePM.currentProject, useTM.currentPreviewMilestoneId]);

    // (B) — re-run loadUpdatedTask whenever the row in `allTasks` for
    // the currently-previewed task has a newer `updatedAt` than what
    // the preview is showing. Triggered by focus refresh, by PM-channel
    // updates that update `allTasks`, by initial app mount — anything
    // that puts fresh `updatedAt`s in the table.
    useEffect(() => {
        if (!usePM.currentProject || useTM.currentPreviewTaskId === -1) return;
        const row = useTM.allTasks.find(
            (t) => t.id != null && String(t.id) === String(useTM.currentPreviewTaskId)
        );
        const rowUpdatedAt = row?.updatedAt ?? null;
        const previewUpdatedAt = useTM.currentPreviewTask?.updatedAt ?? null;
        if (!rowUpdatedAt) return;
        if (previewUpdatedAt && String(rowUpdatedAt) <= String(previewUpdatedAt)) return;
        void useTM.loadUpdatedTask(usePM.currentProject.projectId);
    }, [
        usePM.currentProject,
        useTM.currentPreviewTaskId,
        useTM.allTasks,
        useTM.currentPreviewTask?.updatedAt,
    ]);

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
            // Suppress the task preview pane when the user is currently
            // inside the Chat service — there the task preview is rendered
            // as a side panel and the visibility flag is owned elsewhere.
            // Mirrors the active-route detection used by the sidebar so we
            // don't depend on `openingService` for a check the URL already
            // encodes.
            if (!location.pathname.includes("/workspace/chat")) {
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
        useTM.setIsTaskTableVisible(true);
        useTM.setCurrentTaskChain([]);
        // taskMetaTree is derived from taskMeta — clearing taskMeta drops the tree.
        useTM.setTaskMeta([]);
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
