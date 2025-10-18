import { TaskService } from "../db/services/task.service";

self.onmessage = async (event) => {
    const projectId: number = event.data.projectId;
    const targetStatuses: string[] = event.data.targetStatuses;
    const taskService = new TaskService();
    const tasks = await taskService.getTasksByMultipleStatus(projectId, targetStatuses);
    if (tasks) {
        self.postMessage(tasks);
    } else {
        self.postMessage([]);
    }

    self.close(); // Terminates itself
};

export {};
