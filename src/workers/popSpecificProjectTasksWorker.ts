import { getTasksByMultipleStatus } from "../db/crud";

self.onmessage = async (event) => {
    const projectId: number = event.data.projectId;
    const targetStatuses: string[] = event.data.targetStatuses;
    const tasks = await getTasksByMultipleStatus(projectId, targetStatuses);
    if (tasks) {
        self.postMessage(tasks);
    } else {
        self.postMessage([]);
    }

    self.close(); // Terminates itself
};

export {};
