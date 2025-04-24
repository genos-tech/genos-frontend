import { loadTeamTasks } from '../features/tasks/services/loadTeamTasks';
import { UserProps } from "../types/admin";
import { TaskTableProps } from "../types/tasks";
import { STORES } from "../db/conf";
import {
    clearStore,
    addData,
} from "../db/crud";

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    await clearStore(STORES.TASKS)

    // Load data from backend
    const taskList: TaskTableProps[] = await loadTeamTasks({
        myself: myself,
        accessToken: accessToken
    });

    for (let i = 0; i < taskList.length; i += 1) {
        const task: TaskTableProps = taskList[i]

        await addData({
            storeName: STORES.TASKS,
            data: task
        })

    }

    // Send finish a message
    self.postMessage("done");
};

export { };
