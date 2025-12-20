import { loadSpecificTaskTmp } from "../../features/tasks/services/loadSpecificTaskTmp";
import { UserProps } from "../../types/admin";
import { TaskTableProps } from "../../types/tasks";
import { TaskRepository } from "../repositories";

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const projectId: number = event.data.projectId;
    const accessToken: string = event.data.accessToken;

    const taskRepository = new TaskRepository();

    // If no task exists with the same projectId, clear the database.
    // (The database contains tasks for one project only. But maybe should be changed in the future.)
    // const existingTasks = await taskRepository.getTasksByProject(projectId);
    // if (existingTasks.length === 0) {
    //     await taskRepository.clear();
    // }

    // Load data from backend
    const taskList: TaskTableProps[] = await loadSpecificTaskTmp(myself, projectId, accessToken);
    await taskRepository.batchInsert(taskList);

    // Send finish a message
    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
