import { TaskStatusProps, TaskTableProps } from "../../types/tasks";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { TaskRepository } from "../repositories";
import { TaskQuery } from "../types";

// Task service for business logic related to tasks
export class TaskService {
    private taskRepo: TaskRepository;

    constructor() {
        this.taskRepo = new TaskRepository();
    }

    // Get task by ID
    async getTask(taskId: number): Promise<TaskTableProps | null> {
        return this.taskRepo.getTask(taskId);
    }

    // Get all tasks
    async getAllTasks(): Promise<TaskTableProps[]> {
        return this.taskRepo.getAllTasks();
    }

    // Get tasks by project ID
    async getTasksByProject(projectId: number): Promise<TaskTableProps[]> {
        return this.taskRepo.getTasksByProject(projectId);
    }

    // Get tasks by status
    async getTasksByStatus(projectId: number, status: string): Promise<TaskTableProps[]> {
        return this.taskRepo.getTasksByStatus(projectId, status);
    }

    // Get tasks by multiple statuses
    async getTasksByMultipleStatus(
        projectId: number,
        statuses: string[]
    ): Promise<TaskTableProps[]> {
        return this.taskRepo.getTasksByMultipleStatus(projectId, statuses);
    }

    // Get tasks with query parameters
    async getTasks(query: TaskQuery): Promise<TaskTableProps[]> {
        return this.taskRepo.getTasks(query);
    }

    // Add or update task
    async saveTask(task: TaskTableProps): Promise<boolean> {
        return this.taskRepo.saveTask(task);
    }

    // Delete task
    async deleteTask(taskId: number): Promise<boolean> {
        return this.taskRepo.deleteTask(taskId);
    }

    // Check if task exists
    async taskExists(taskId: number): Promise<boolean> {
        return this.taskRepo.taskExists(taskId);
    }

    // Get tasks assigned to a user (indexed)
    async getTasksByAssignee(assigneeId: string): Promise<TaskTableProps[]> {
        return this.taskRepo.getTasksByAssignee(assigneeId);
    }

    // Get tasks by assignee and project (compound-indexed)
    async getTasksByAssigneeAndProject(
        assigneeId: string,
        projectId: number
    ): Promise<TaskTableProps[]> {
        return this.taskRepo.getTasksByAssigneeAndProject(assigneeId, projectId);
    }

    // Batch insert tasks
    async batchInsertTasks(tasks: TaskTableProps[]): Promise<boolean> {
        return this.taskRepo.batchInsertTasks(tasks);
    }

    // Update task status
    async updateTaskStatus(taskId: number, status: TaskStatusProps): Promise<boolean> {
        const task = await this.getTask(taskId);
        if (!task) return false;

        task.status = status.status;
        task.updatedAt = getLocalCurrentTimestamp();
        return this.saveTask(task);
    }

    // Update task assignee
    async updateTaskAssignee(taskId: number, assigneeId: string): Promise<boolean> {
        const task = await this.getTask(taskId);
        if (!task) return false;

        task.assigneeId = assigneeId;
        task.updatedAt = getLocalCurrentTimestamp();
        return this.saveTask(task);
    }

    // Get task statistics for a project
    async getTaskStatistics(projectId: number): Promise<{
        total: number;
        byStatus: Record<string, number>;
        byAssignee: Record<string, number>;
    }> {
        const tasks = await this.getTasksByProject(projectId);

        const byStatus: Record<string, number> = {};
        const byAssignee: Record<string, number> = {};

        tasks.forEach((task) => {
            byStatus[task.status || ""] = (byStatus[task.status || ""] || 0) + 1;
            if (task.assigneeId) {
                byAssignee[task.assigneeId] = (byAssignee[task.assigneeId] || 0) + 1;
            }
        });

        return {
            total: tasks.length,
            byStatus,
            byAssignee,
        };
    }
}
