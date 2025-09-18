import { loadSpecificTaskTmp } from "../features/tasks/services/loadSpecificTaskTmp";
import { UserProps } from "../types/admin";
import { TaskTableProps } from "../types/tasks";
import { STORES } from "../db/conf";
import { clearStore, miniBatchInsertMessages } from "../db/crud";

const BATCH_SIZE = 1000;

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const projectId: number = event.data.projectId;
    const accessToken: string = event.data.accessToken;

    await clearStore(STORES.TASKS);

    // Load data from backend
    const taskList: TaskTableProps[] = await loadSpecificTaskTmp(myself, projectId, accessToken);

    for (let i = 0; i < taskList.length; i += BATCH_SIZE) {
        const miniBatchTasks: TaskTableProps[] = taskList.slice(i, i + BATCH_SIZE);
        await miniBatchInsertMessages({
            storeName: STORES.TASKS,
            miniBatchMessages: miniBatchTasks,
        });
    }

    // Send finish a message
    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
