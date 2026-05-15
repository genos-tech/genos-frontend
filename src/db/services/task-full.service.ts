import { TaskProps } from "../../types/tasks";
import { TaskFullRepository } from "../repositories/task-full";

// Service wrapper around TaskFullRepository. The free-function exports
// below are the public API used by `loadSpecificTask`,
// `sendUpdatedSpecificTask`, and the PM websocket handler.
export class TaskFullService {
    private repo: TaskFullRepository;

    constructor() {
        this.repo = new TaskFullRepository();
    }

    getCachedFullTask(taskId: number): Promise<TaskProps | null> {
        return this.repo.getById(taskId);
    }

    cacheFullTask(task: TaskProps): Promise<void> {
        return this.repo.upsert(task);
    }

    invalidateCachedFullTask(taskId: number): Promise<void> {
        return this.repo.invalidate(taskId);
    }
}

const service = new TaskFullService();

export const getCachedFullTask = (taskId: number): Promise<TaskProps | null> =>
    service.getCachedFullTask(taskId);

export const cacheFullTask = (task: TaskProps): Promise<void> => service.cacheFullTask(task);

export const invalidateCachedFullTask = (taskId: number): Promise<void> =>
    service.invalidateCachedFullTask(taskId);
