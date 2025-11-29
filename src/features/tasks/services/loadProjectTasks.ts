import { UserProps } from "../../../types/admin";
import { ThreadMessageProps } from "../../../types/chat";
import LoadProjectTasksWorker from "../../../db/workers/loadProjectTasksWorker.ts?worker";

export const loadProjectTasks = (
    myself: UserProps,
    projectId: number,
    accessToken: string | null
) => {
    return new Promise((resolve, reject) => {
        const loadProjectTasksWorker = new LoadProjectTasksWorker();

        loadProjectTasksWorker.postMessage({
            myself,
            projectId,
            accessToken,
        });

        loadProjectTasksWorker.onmessage = (event) => {
            loadProjectTasksWorker.terminate();
            resolve(event.data as ThreadMessageProps[]);
        };

        loadProjectTasksWorker.onerror = (error) => {
            loadProjectTasksWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
