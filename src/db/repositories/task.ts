import { TaskTableProps } from "../../types/tasks";
import { INDEX_NAMES, STORES } from "../config";
import { TaskQuery } from "../types";
import { BaseRepository } from "./base";

// Task repository for managing task data
export class TaskRepository extends BaseRepository<TaskTableProps> {
    constructor() {
        super(STORES.TASK_META);
    }

    // Get task by ID
    async getTask(taskId: number): Promise<TaskTableProps | null> {
        const result = await this.get(taskId);
        return result.success && result.data ? result.data : null;
    }

    // Get all tasks
    async getAllTasks(): Promise<TaskTableProps[]> {
        const result = await this.getAll();
        return result.success && result.data ? result.data : [];
    }

    // Get tasks by project ID
    async getTasksByProject(projectId: number): Promise<TaskTableProps[]> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const index = store.index(INDEX_NAMES.TASK_META);
            const tasks = await index.getAll(projectId);
            return tasks;
        } catch {
            return [];
        }
    }

    // Get tasks assigned to a user, across all projects.
    async getTasksByAssignee(assigneeId: string): Promise<TaskTableProps[]> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const index = store.index(INDEX_NAMES.TASK_META_ASSIGNEE);
            return await index.getAll(assigneeId);
        } catch {
            return [];
        }
    }

    // Get tasks assigned to a user inside a single project.
    async getTasksByAssigneeAndProject(
        assigneeId: string,
        projectId: number
    ): Promise<TaskTableProps[]> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const index = store.index(INDEX_NAMES.TASK_META_ASSIGNEE_PROJECT);
            return await index.getAll([assigneeId, projectId]);
        } catch {
            return [];
        }
    }

    // Get tasks by status
    async getTasksByStatus(projectId: number, status: string): Promise<TaskTableProps[]> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const index = store.index(INDEX_NAMES.TASK_META_COMPOUND);
            const tasks = await index.getAll([projectId, status]);
            return tasks;
        } catch {
            return [];
        }
    }

    // Get tasks by multiple statuses
    async getTasksByMultipleStatus(
        projectId: number,
        statuses: string[]
    ): Promise<TaskTableProps[]> {
        const results = await Promise.all(
            statuses.map((status) => this.getTasksByStatus(projectId, status))
        );
        return results.flat();
    }

    // Get tasks with query parameters
    async getTasks(query: TaskQuery): Promise<TaskTableProps[]> {
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
    async saveTask(task: TaskTableProps): Promise<boolean> {
        const result = await this.put(task);
        return result.success;
    }

    // Batch insert tasks
    async batchInsertTasks(tasks: TaskTableProps[]): Promise<boolean> {
        const result = await this.batchInsert(tasks);
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
