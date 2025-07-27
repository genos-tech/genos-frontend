import AddTaskWorker from "../../../workers/addTaskWorker.ts?worker";
import { TaskTableProps } from "../../../types/tasks";

export const addTask = (task: TaskTableProps): Promise<null> => {
    return new Promise((resolve, reject) => {
        const addTskWorker = new AddTaskWorker();

        addTskWorker.postMessage({ task: task });

        addTskWorker.onmessage = (event) => {
            addTskWorker.terminate();
            resolve(null);
        };

        addTskWorker.onerror = (error) => {
            addTskWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
