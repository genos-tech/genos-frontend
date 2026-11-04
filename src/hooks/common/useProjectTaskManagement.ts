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
    // The active project is threaded in so a milestone scope set in one
    // project stops applying the moment the user is somewhere else — see
    // `tableMilestoneFilterId`. usePM is constructed first precisely so
    // this is available here.
    // `currentTeamId` goes in too: a read that comes back after a team switch is
    // dropped (see `fetchProjectTasks`). So does whether the open project is the
    // user's own team's: that is read from the team's LIST, not from the open
    // project object, because the paths that open a project (chat, boot, the
    // URL) do not all carry `isExternal`.
    const openProjectId = usePM.currentProject?.projectId;
    const listedOpenProject =
        openProjectId == null
            ? undefined
            : usePM.teamProjects.find((p) => p.projectId === openProjectId);
    const isOwnTeamProject = listedOpenProject
        ? listedOpenProject.isExternal !== true && usePM.currentProject?.isExternal !== true
        : undefined;
    const useTM = useTaskManagement(myself, accessToken, openProjectId, {
        currentTeamId,
        isOwnTeamProject,
    });
    const useSM = useSprintMilestoneManagement(accessToken);

    // Read the open project's rows from IndexedDB into the table.
    //
    //   (a) The open project CHANGED (by id): read at once, so what is already
    //       in IndexedDB paints without waiting for the network. This used to
    //       wait for `tsTasksLoadedToIDB` or a 1 s timer, and ran for every new
    //       project OBJECT: a switch sets that object several times (the click,
    //       the tag reload, a record completed from the list), up to four
    //       950-row reads per switch.
    //   (b) The network refresh of the open project finished writing its rows
    //       (`tsTasksLoadedToIDB`): read them again. A refresh of any OTHER
    //       project (the agent's bulk write, a cross-project move) changed rows
    //       this table does not show: no read.
    const openId = usePM.currentProject?.projectId;
    useEffect(() => {
        if (!openId) return;
        void useTM.fetchProjectTasks(openId);
        localStorage.setItem("lastProjectId", openId.toString());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openId]);

    useEffect(() => {
        const signal = usePM.tsTasksLoadedToIDB;
        if (!signal) return;
        if (signal.projectId !== openId) {
            // Rows of a project the user is not in changed under the copy that
            // is remembered for it: forget the copy (a switch back is a miss and
            // reads IndexedDB, which is current).
            useTM.dropCachedProjectRows(signal.projectId);
            return;
        }
        void useTM.fetchProjectTasks(openId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usePM.tsTasksLoadedToIDB]);

    // A project that is gone from the team's list (deleted here or by the
    // agent, left, or the whole list reset by a team switch) keeps no rows in
    // memory.
    useEffect(() => {
        useTM.pruneCachedProjectRows(usePM.teamProjects.map((p) => p.projectId));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usePM.teamProjects]);

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

    // A task was just created: load it and upsert its row into the table.
    // Only for that. Opening or switching a task is the job of the "auto-load"
    // effect further down; running this one on every preview change as well
    // made every click fetch the same task twice more (MIP-968).
    useEffect(() => {
        if (usePM.currentProject && useTM.isNewTaskCreated === true) {
            useTM.loadUpdatedTask(usePM.currentProject.projectId);
        }
    }, [useTM.currentPreviewTaskId, useTM.isNewTaskCreated]);

    // Freshness strategy. Two pieces working together:
    //
    //   (A) A change-driven refresh of the project task list (and its sprints)
    //       on window focus, on a 60 s tick and when the `#` menu asks. It
    //       lives in `useChangeRefresher`, mounted once in `App`, and is NOT
    //       registered here any more: this hook used to add its own unthrottled
    //       `focus` listener next to it, which reloaded the task list and the
    //       sprints on every focus whether or not anything had changed. The
    //       list call gives every row a fresh `updatedAt`, so it is the
    //       *trigger* that makes `allTasks` authoritative.
    //   (B) `allTasks`-watch effect below → when the open preview's row
    //       in `allTasks` has a newer `updatedAt` than what
    //       `currentPreviewTask` currently shows (and that IS the open task),
    //       re-run
    //       `loadUpdatedTask`. `loadSpecificTask` then compares against
    //       the IDB cache: cache up-to-date → instant hit, no API call;
    //       cache stale → API refetch. Either way the preview lands on
    //       fresh data.
    //
    // This catches everything the PM socket misses (PR-merge auto-close,
    // teammate edits via the task UI, background jobs) without paying
    // for a full task refetch every focus event.
    //
    // A sprint's `status` (upcoming/active/completed) is derived server-side
    // from today's date, so the active sprint silently rotates at a sprint
    // boundary and no write announces it. Returning to the tab after it
    // happened lands on the full refresh (more than ten minutes since the
    // last), which re-fetches the sprints; the day-change poll below covers a
    // tab that never leaves. Both the milestone sprint picker and the dashboard
    // read this shared state.

    // Sprint rotation for a tab that stays OPEN AND FOCUSED across a day
    // boundary — a focus refresh never fires then. Poll cheaply for a
    // change in the local calendar date and re-fetch sprints when it ticks
    // over, so the dashboard's active sprint and the milestone picker rotate
    // on their own. The date compare is a near-free string check; the network
    // call only happens once per day change. `loadSprintsForProject` reconciles
    // `currentSprint` (see its self-heal), and the server is the authority on
    // each sprint's status, so an approximate client-side day boundary is only
    // a trigger, never the source of truth.
    useEffect(() => {
        if (!usePM.currentProject?.projectId) return;
        const projectId = usePM.currentProject.projectId;
        const localDate = () => {
            const d = new Date();
            return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        };
        let lastDate = localDate();
        const id = setInterval(() => {
            const today = localDate();
            if (today !== lastDate) {
                lastDate = today;
                void useSM.loadSprintsForProject(projectId);
            }
        }, 60_000);
        return () => clearInterval(id);
    }, [usePM.currentProject?.projectId, useSM.loadSprintsForProject]);

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
    //
    // Only when `currentPreviewTask` already IS the requested task. During a
    // switch it still holds the OUTGOING task until the new one lands, so
    // comparing the new row against it "found" a newer row on nearly every
    // first open or switch and loaded the task a second time, alongside the
    // main load below (MIP-968).
    useEffect(() => {
        if (!usePM.currentProject || useTM.currentPreviewTaskId === -1) return;
        if (String(useTM.currentPreviewTask?.id) !== String(useTM.currentPreviewTaskId)) return;
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
