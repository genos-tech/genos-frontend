import { TaskRepository } from "../repositories";
import { Task, TaskQuery } from "../types";

// Task service for business logic related to tasks
export class TaskService {
    private taskRepo: TaskRepository;

    constructor() {
        this.taskRepo = new TaskRepository();
    }

    // Get task by ID
    async getTask(taskId: number): Promise<Task | null> {
        return this.taskRepo.getTask(taskId);
    }

    // Get all tasks
    async getAllTasks(): Promise<Task[]> {
        return this.taskRepo.getAllTasks();
    }

    // Get tasks by project ID
    async getTasksByProject(projectId: number): Promise<Task[]> {
        return this.taskRepo.getTasksByProject(projectId);
    }

    // Get tasks by status
    async getTasksByStatus(projectId: number, status: string): Promise<Task[]> {
        return this.taskRepo.getTasksByStatus(projectId, status);
    }

    // Get tasks by multiple statuses
    async getTasksByMultipleStatus(projectId: number, statuses: string[]): Promise<Task[]> {
        return this.taskRepo.getTasksByMultipleStatus(projectId, statuses);
    }

    // Get tasks with query parameters
    async getTasks(query: TaskQuery): Promise<Task[]> {
        return this.taskRepo.getTasks(query);
    }

    // Add or update task
    async saveTask(task: Task): Promise<boolean> {
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

    // Get tasks assigned to a user
    async getTasksByAssignee(assigneeId: string): Promise<Task[]> {
        const allTasks = await this.getAllTasks();
        return allTasks.filter((task) => task.assigneeId === assigneeId);
    }

    // Get tasks by assignee and project
    async getTasksByAssigneeAndProject(assigneeId: string, projectId: number): Promise<Task[]> {
        const projectTasks = await this.getTasksByProject(projectId);
        return projectTasks.filter((task) => task.assigneeId === assigneeId);
    }

    // Update task status
    async updateTaskStatus(taskId: number, status: string): Promise<boolean> {
        const task = await this.getTask(taskId);
        if (!task) return false;

        task.status = status;
        task.updatedAt = Date.now();
        return this.saveTask(task);
    }

    // Update task assignee
    async updateTaskAssignee(taskId: number, assigneeId: string): Promise<boolean> {
        const task = await this.getTask(taskId);
        if (!task) return false;

        task.assigneeId = assigneeId;
        task.updatedAt = Date.now();
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
            byStatus[task.status] = (byStatus[task.status] || 0) + 1;
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
