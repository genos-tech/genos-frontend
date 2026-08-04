// Tasks-channel handlers. Consolidates the 4 single-purpose task workers
// (addTask, loadProjectTasks, loadTeamTasks, popSpecificProjectTasks).

import { loadProjectTasksFromApi } from "../../../features/tasks/services/loadProjectTasksFromApi";
import { loadTeamTasks } from "../../../features/tasks/services/loadTeamTasks";
import type { TaskTableProps } from "../../../types/tasks";
import { TaskRepository } from "../../repositories";
import { CheckpointRepository } from "../../repositories/checkpoints";
import { TaskService } from "../../services";
import type { TasksRequests } from "../contracts";
import type { HandlerMap } from "../poolWorker";
import { syncWithCheckpoint } from "../utils/syncWithCheckpoint";

const BATCH_SIZE = 1000;

const taskRepo = new TaskRepository();
const taskService = new TaskService();
const checkpointRepo = new CheckpointRepository();

export const tasksHandlers: HandlerMap<TasksRequests> = {
    addTask: async ({ task }) => {
        await taskRepo.put(task);
    },

    loadProjectTasks: async ({ myself, projectId, accessToken }) => {
        // Per-project checkpoint key so switching between projects
        // doesn't collide. The TASK_META store is shared across projects
        // (indexed by projectId), so we don't `clear()` on full load —
        // doing so would wipe sibling projects' tasks. This matches the
        // pre-incremental behavior (append-only); incremental loads now
        // additionally evict server-side soft-deletes.
        const key = `tasks:${projectId}`;
        const sync = () =>
            syncWithCheckpoint({
                key,
                fetcher: async (since) => {
                    const response = await loadProjectTasksFromApi(
                        myself,
                        projectId,
                        accessToken,
                        since
                    );
                    if (!response) {
                        throw new Error("Failed to load project tasks");
                    }
                    return {
                        serverTime: response.serverTime,
                        data: response.tasks,
                        forceFull: response.forceFull,
                    };
                },
                applier: async (tasks, _hadCheckpoint) => {
                    const toUpsert: TaskTableProps[] = [];
                    for (const t of tasks) {
                        if (t.isDeleted) {
                            // Backend always emits a string id; guard for the
                            // declared-nullable TS type only.
                            if (t.id) await taskRepo.delete(t.id);
                        } else {
                            const { isDeleted: _ignored, ...rest } = t;
                            toUpsert.push(rest);
                        }
                    }
                    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
                        await taskRepo.batchInsert(toUpsert.slice(i, i + BATCH_SIZE));
                    }
                },
            });

        const hadCheckpoint = (await checkpointRepo.getCheckpoint(key)) !== null;
        await sync();

        // A watermark with nothing behind it is a dead end: every later
        // sync asks only for changes, and a project whose rows never
        // arrived stays empty for good — an empty task table, board and
        // dashboard, with a working single-task preview beside them
        // because that path doesn't read this store.
        //
        // Two ways to get there, both of which happened: a full load that
        // returned nothing because the server was refusing the caller
        // (guests in a shared project, before the API was taught to answer
        // for them), and `loadTeamTasks` below emptying the shared store
        // out from under this checkpoint.
        //
        // A project with genuinely no tasks pays one extra full request
        // per load, which for an empty project is the cheapest request in
        // the app.
        if (hadCheckpoint && (await taskRepo.getTasksByProject(projectId)).length === 0) {
            await checkpointRepo.forgetCheckpoint(key);
            await sync();
        }
    },

    loadTeamTasks: async ({ myself, accessToken }) => {
        await taskRepo.clear();
        // The store this just emptied is the one every per-project
        // checkpoint counts on. Drop them together or each project's next
        // sync asks for changes-since and restores nothing.
        await checkpointRepo.forgetCheckpointsWithPrefix("tasks:");
        const taskList: TaskTableProps[] = await loadTeamTasks(myself, accessToken);
        for (let i = 0; i < taskList.length; i += BATCH_SIZE) {
            await taskRepo.batchInsert(taskList.slice(i, i + BATCH_SIZE));
        }
    },

    popSpecificProjectTasks: async ({ projectId, targetStatuses }) => {
        const tasks = await taskService.getTasksByMultipleStatus(projectId, targetStatuses);
        return tasks ?? [];
    },
};
