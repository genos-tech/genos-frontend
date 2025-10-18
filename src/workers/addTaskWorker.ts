import { STORES } from "../db/conf";
import { TaskRepository } from "../db/repositories";
import { Task } from "../db/types";
import { TaskTableProps } from "../types/tasks";

self.onmessage = async (event) => {
    const taskData: TaskTableProps = event.data.task;

    // Convert TaskTableProps to Task format
    const task: Task = {
        id: taskData.id ? parseInt(taskData.id) : 0,
        projectId: taskData.projectId || 0,
        title: taskData.title || "",
        description: undefined, // TaskTableProps doesn't have description
        status: taskData.status || "",
        assigneeId: taskData.assigneeId || undefined,
        createdAt: taskData.createdDate ? new Date(taskData.createdDate).getTime() : Date.now(),
        updatedAt: taskData.updatedAt ? new Date(taskData.updatedAt).getTime() : Date.now(),
    };

    const taskRepo = new TaskRepository();
    await taskRepo.put(task);

    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
