// Tasks-channel handlers. Consolidates the 4 single-purpose task workers
// (addTask, loadProjectTasks, loadTeamTasks, popSpecificProjectTasks).

import { loadProjectTasksFromApi } from "../../../features/tasks/services/loadProjectTasksFromApi";
import { loadTeamTasks } from "../../../features/tasks/services/loadTeamTasks";
import type { TaskTableProps } from "../../../types/tasks";
import { TaskRepository } from "../../repositories";
import { TaskService } from "../../services";
import type { TasksRequests } from "../contracts";
import type { HandlerMap } from "../poolWorker";

const BATCH_SIZE = 1000;

const taskRepo = new TaskRepository();
const taskService = new TaskService();

export const tasksHandlers: HandlerMap<TasksRequests> = {
    addTask: async ({ task }) => {
        await taskRepo.put(task);
        return "done";
    },

    loadProjectTasks: async ({ myself, projectId, accessToken }) => {
        const taskList = await loadProjectTasksFromApi(myself, projectId, accessToken);
        if (taskList?.length) await taskRepo.batchInsert(taskList);
        return "done";
    },

    loadTeamTasks: async ({ myself, accessToken }) => {
        await taskRepo.clear();
        const taskList: TaskTableProps[] = await loadTeamTasks(myself, accessToken);
        for (let i = 0; i < taskList.length; i += BATCH_SIZE) {
            await taskRepo.batchInsert(taskList.slice(i, i + BATCH_SIZE));
        }
        return "done";
    },

    popSpecificProjectTasks: async ({ projectId, targetStatuses }) => {
        const tasks = await taskService.getTasksByMultipleStatus(projectId, targetStatuses);
        return tasks ?? [];
    },
};
