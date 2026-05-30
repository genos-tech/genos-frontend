import { tasksChannel } from "../../../db/workers/channels";
import { TaskTableProps } from "../../../types/tasks";

export const popSpecificProjectTasks = (
    projectId: number,
    targetStatuses: string[]
): Promise<TaskTableProps[]> => {
    return tasksChannel.request("popSpecificProjectTasks", { projectId, targetStatuses });
};
