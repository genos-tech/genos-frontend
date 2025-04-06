import { getProjectTasks } from "../components/indexedDBUtils/crud";

self.onmessage = async (event) => {
    const projectId: number = event.data.projectId;
    const tasks = await getProjectTasks(projectId)
    if (tasks) {
        self.postMessage(tasks);
    } else {
        self.postMessage([]);
    }
};

export { };
