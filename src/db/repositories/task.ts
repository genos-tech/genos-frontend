import { INDEX_NAMES, STORES } from "../config";
import { Task, TaskQuery } from "../types";
import { BaseRepository } from "./base";

// Task repository for managing task data
export class TaskRepository extends BaseRepository<Task> {
    constructor() {
        super(STORES.TASKS);
    }

    // Get task by ID
    async getTask(taskId: number): Promise<Task | null> {
        const result = await this.get(taskId);
        return result.success && result.data ? result.data : null;
    }

    // Get all tasks
    async getAllTasks(): Promise<Task[]> {
        const result = await this.getAll();
        return result.success && result.data ? result.data : [];
    }

    // Get tasks by project ID
    async getTasksByProject(projectId: number): Promise<Task[]> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const index = store.index(INDEX_NAMES.TASKS);
            const tasks = await index.getAll(projectId);
            return tasks;
        } catch {
            return [];
        }
    }

    // Get tasks by status
    async getTasksByStatus(projectId: number, status: string): Promise<Task[]> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const index = store.index(INDEX_NAMES.TASKS_COMPOUND);
            const tasks = await index.getAll([projectId, status]);
            return tasks;
        } catch {
            return [];
        }
    }

    // Get tasks by multiple statuses
    async getTasksByMultipleStatus(projectId: number, statuses: string[]): Promise<Task[]> {
        const results = await Promise.all(
            statuses.map((status) => this.getTasksByStatus(projectId, status))
        );
        return results.flat();
    }

    // Get tasks with query parameters
    async getTasks(query: TaskQuery): Promise<Task[]> {
        if (query.status) {
            if (Array.isArray(query.status)) {
                return this.getTasksByMultipleStatus(query.projectId, query.status);
            } else {
                return this.getTasksByStatus(query.projectId, query.status);
            }
        }
        return this.getTasksByProject(query.projectId);
    }

    // Add or update task
    async saveTask(task: Task): Promise<boolean> {
        const result = await this.put(task);
        return result.success;
    }

    // Delete task
    async deleteTask(taskId: number): Promise<boolean> {
        const result = await this.delete(taskId);
        return result.success;
    }

    // Check if task exists
    async taskExists(taskId: number): Promise<boolean> {
        return this.exists(taskId);
    }
}
