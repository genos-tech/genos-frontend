import { TaskRepository } from "../repositories";
import { TaskTableProps } from "../../types/tasks";

self.onmessage = async (event) => {
    const taskData: TaskTableProps = event.data.task;

    const taskRepo = new TaskRepository();
    await taskRepo.put(taskData);

    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
