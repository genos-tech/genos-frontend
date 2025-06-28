import { TaskTableProps } from "../../../types/tasks";
import PopSpecificProjectTasksWorker from "../../../workers/popSpecificProjectTasksWorker.ts?worker";

export const popSpecificProjectTasks = (projectId: number): Promise<TaskTableProps[]> => {
    return new Promise((resolve, reject) => {
        const popSpecificProjectTasksWorker = new PopSpecificProjectTasksWorker();

        popSpecificProjectTasksWorker.postMessage({
            projectId: projectId,
        });

        popSpecificProjectTasksWorker.onmessage = (event) => {
            popSpecificProjectTasksWorker.terminate();
            resolve(event.data as TaskTableProps[]);
        };

        popSpecificProjectTasksWorker.onerror = (error) => {
            popSpecificProjectTasksWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
