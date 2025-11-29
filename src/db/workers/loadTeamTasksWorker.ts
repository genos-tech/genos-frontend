import { loadTeamTasks } from "../../features/tasks/services/loadTeamTasks";
import { UserProps } from "../../types/admin";
import { TaskTableProps } from "../../types/tasks";
import { TaskRepository } from "../repositories";

const BATCH_SIZE = 1000;

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    const taskRepository = new TaskRepository();
    await taskRepository.clear();

    // Load data from backend
    const taskList: TaskTableProps[] = await loadTeamTasks(myself, accessToken);

    for (let i = 0; i < taskList.length; i += BATCH_SIZE) {
        const miniBatchTasks: TaskTableProps[] = taskList.slice(i, i + BATCH_SIZE);
        await taskRepository.batchInsert(miniBatchTasks);
    }

    // Send finish a message
    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
