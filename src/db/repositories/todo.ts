import { TodoGroupProps } from "../../types/chat";
import { STORES } from "../config";
import { BaseRepository } from "./base";

type TodoGroupIDBRecord = TodoGroupProps & { userId: string };

export class TodoRepository extends BaseRepository<TodoGroupIDBRecord> {
    constructor() {
        super(STORES.TODOS);
    }

    async getGroupsByUser(userId: string): Promise<TodoGroupProps[]> {
        const result = await this.getAll();
        if (!result.success || !result.data) return [];
        return (
            result.data
                .filter((r) => r.userId === userId)
                .map(({ userId: _uid, ...group }) => group as TodoGroupProps)
                // Guard against stale records that pre-date the
                // ToDoFact → ToDoGroup schema swap (no groupId or no
                // items array). Returning them would crash the consumer
                // hook the moment it reads `.items`.
                .filter((g) => typeof g.groupId === "number" && Array.isArray(g.items))
        );
    }

    async batchSaveGroups(groups: TodoGroupProps[], userId: string): Promise<boolean> {
        const records: TodoGroupIDBRecord[] = groups.map((g) => ({ ...g, userId }));
        const result = await this.batchInsert(records);
        return result.success;
    }

    async deleteGroup(groupId: number): Promise<boolean> {
        const result = await this.delete(groupId);
        return result.success;
    }
}
