// Tasks-channel handlers. Consolidates the 4 single-purpose task workers
// (addTask, loadProjectTasks, loadTeamTasks, popSpecificProjectTasks).

import { loadProjectTasksFromApi } from "../../../features/tasks/services/loadProjectTasksFromApi";
import { loadTeamTasks } from "../../../features/tasks/services/loadTeamTasks";
import type { TaskTableProps } from "../../../types/tasks";
import { TaskRepository } from "../../repositories";
import { TaskService } from "../../services";
import type { TasksRequests } from "../contracts";
import type { HandlerMap } from "../poolWorker";
import { syncWithCheckpoint } from "../utils/syncWithCheckpoint";

const BATCH_SIZE = 1000;

const taskRepo = new TaskRepository();
const taskService = new TaskService();

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
        await syncWithCheckpoint({
            key: `tasks:${projectId}`,
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
                return { serverTime: response.serverTime, data: response.tasks };
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
    },

    loadTeamTasks: async ({ myself, accessToken }) => {
        await taskRepo.clear();
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
