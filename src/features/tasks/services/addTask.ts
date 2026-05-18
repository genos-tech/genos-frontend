import { tasksChannel } from "../../../db/workers/channels";
import { TaskTableProps } from "../../../types/tasks";

export const addTask = (task: TaskTableProps): Promise<null> => {
    return tasksChannel.request("addTask", { task }).then(() => null);
};
