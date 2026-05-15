import { ToDoFactProps } from "../../types/chat";
import { STORES } from "../config";
import { BaseRepository } from "./base";

type TodoIDBRecord = ToDoFactProps & { userId: string };

export class TodoRepository extends BaseRepository<TodoIDBRecord> {
    constructor() {
        super(STORES.TODOS);
    }

    async getTodosByUser(userId: string): Promise<ToDoFactProps[]> {
        const result = await this.getAll();
        if (!result.success || !result.data) return [];
        return result.data
            .filter((r) => r.userId === userId)
            .map(({ userId: _uid, ...todo }) => todo as ToDoFactProps);
    }

    async saveTodo(todo: ToDoFactProps, userId: string): Promise<boolean> {
        const result = await this.put({ ...todo, userId });
        return result.success;
    }

    async batchSaveTodos(todos: ToDoFactProps[], userId: string): Promise<boolean> {
        const records: TodoIDBRecord[] = todos.map((t) => ({ ...t, userId }));
        const result = await this.batchInsert(records);
        return result.success;
    }

    async deleteTodo(todoId: number): Promise<boolean> {
        const result = await this.delete(todoId);
        return result.success;
    }
}
