import { STORES } from "../db/conf";
import { addData } from "../db/crud";
import { TaskTableProps } from "../types/tasks";

self.onmessage = async (event) => {
    const task: TaskTableProps = event.data.task;

    await addData({
        storeName: STORES.TASKS,
        data: task,
    });

    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
