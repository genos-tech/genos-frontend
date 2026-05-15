import { TaskProps } from "../../types/tasks";
import { INDEX_NAMES, MAX_CACHED_FULL_TASKS, STORES } from "../config";
import { BaseRepository } from "./base";

// Row shape persisted in the TASK_FULL store: a full TaskProps payload
// augmented with an `accessedAt` epoch-ms field that drives LRU eviction.
type CachedTaskRow = TaskProps & { id: number; accessedAt: number };

const stripAccessedAt = (row: CachedTaskRow): TaskProps => {
    const task: Partial<CachedTaskRow> = { ...row };
    delete task.accessedAt;
    return task as TaskProps;
};

// Repository for the per-task full-data cache. The store mirrors the
// shape used by TASK_META but holds the full `TaskProps` so that
// `loadSpecificTask` can return without a network round-trip on warm
// reads. Eviction is LRU-bounded by `MAX_CACHED_FULL_TASKS`.
export class TaskFullRepository extends BaseRepository<CachedTaskRow> {
    constructor() {
        super(STORES.TASK_FULL);
    }

    // Read a cached task and touch its `accessedAt` so LRU eviction
    // keeps recently-read entries. The `accessedAt` field is stripped
    // from the returned value to keep the cache layer invisible to
    // callers.
    async getById(taskId: number): Promise<TaskProps | null> {
        const result = await this.get(taskId);
        if (!result.success || !result.data) return null;

        const touched: CachedTaskRow = { ...result.data, accessedAt: Date.now() };
        await this.put(touched);

        return stripAccessedAt(touched);
    }

    // Write a task to the cache (insert or update) and run LRU
    // eviction so the store never exceeds the configured cap.
    async upsert(task: TaskProps): Promise<void> {
        if (task.id == null) return;
        const row: CachedTaskRow = { ...task, accessedAt: Date.now(), id: task.id };
        const putResult = await this.put(row);
        if (!putResult.success) return;
        await this.evictLRU();
    }

    async invalidate(taskId: number): Promise<void> {
        await this.delete(taskId);
    }

    // Walk the `accessedAt` index in ascending order and delete the
    // oldest rows until the store is back at the cap.
    private async evictLRU(): Promise<void> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readwrite");
            const store = tx.objectStore(this.storeName);
            const total = await store.count();
            const overflow = total - MAX_CACHED_FULL_TASKS;
            if (overflow <= 0) {
                await tx.done;
                return;
            }

            let removed = 0;
            let cursor = await store.index(INDEX_NAMES.TASK_FULL_LRU).openCursor();
            while (cursor && removed < overflow) {
                await cursor.delete();
                removed++;
                cursor = await cursor.continue();
            }
            await tx.done;
        } catch (error) {
            console.error("TaskFullRepository.evictLRU failed:", error);
        }
    }
}
