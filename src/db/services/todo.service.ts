import { ToDoFactProps } from "../../types/chat";
import { TodoRepository } from "../repositories/todo";

export class TodoService {
    private repo: TodoRepository;

    constructor() {
        this.repo = new TodoRepository();
    }

    async getTodosByUser(userId: string): Promise<ToDoFactProps[]> {
        return this.repo.getTodosByUser(userId);
    }

    async cacheTodos(todos: ToDoFactProps[], userId: string): Promise<void> {
        await this.repo.batchSaveTodos(todos, userId);
    }

    async saveTodo(todo: ToDoFactProps, userId: string): Promise<void> {
        await this.repo.saveTodo(todo, userId);
    }
}
