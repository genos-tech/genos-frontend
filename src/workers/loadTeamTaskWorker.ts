import loadProjectTasks from '../features/tasks/services/loadTeamTasks';
import { UserProps, TaskTableProps } from "../types";
import { STORES } from "../components/indexedDBUtils/conf";
import {
    clearStore,
    addData,
} from "../components/indexedDBUtils/crud";

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    await clearStore(STORES.TASKS)

    // Load data from backend
    const taskList: TaskTableProps[] = await loadProjectTasks({
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
