import { TodoGroupProps } from "../../types/chat";
import { TodoRepository } from "../repositories/todo";

export class TodoService {
    private repo: TodoRepository;

    constructor() {
        this.repo = new TodoRepository();
    }

    async getGroupsByUser(userId: string): Promise<TodoGroupProps[]> {
        return this.repo.getGroupsByUser(userId);
    }

    async cacheGroups(groups: TodoGroupProps[], userId: string): Promise<void> {
        await this.repo.batchSaveGroups(groups, userId);
    }

    async deleteGroup(groupId: number): Promise<void> {
        await this.repo.deleteGroup(groupId);
    }
}
