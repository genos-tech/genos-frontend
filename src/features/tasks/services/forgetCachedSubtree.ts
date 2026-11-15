import { invalidateCachedFullTask } from "../../../db/services/task-full.service";
import { TaskService } from "../../../db/services/task.service";
import { forgetInFlightTask } from "./taskLoadInFlight";

/**
 * After a project move, forget the full-task cache rows of every task that
 * travelled under `rootTaskId` (MIP-1587).
 *
 * The server re-judges each moved task's collaborators against the
 * destination, and the cached copy of a sub-task still lists the ones it
 * dropped (and the project it left). Deleting the row is the whole job: the
 * next time the sub-task is opened it is read from the server, which holds
 * the pruned list. Which tasks travelled is read from the SOURCE project's
 * rows in IndexedDB, so this runs BEFORE the bulk re-pull replaces them.
 * Best effort: IndexedDB being unavailable leaves the caches as they were.
 */
export const forgetCachedSubtree = async (
    rootTaskId: number,
    sourceProjectId: number
): Promise<void> => {
    try {
        const rows = await new TaskService().getTasksByProject(sourceProjectId);
        const childrenOf = new Map<string, string[]>();
        for (const row of rows) {
            if (row.parentTaskId == null) continue;
            const key = String(row.parentTaskId);
            childrenOf.set(key, [...(childrenOf.get(key) ?? []), String(row.id)]);
        }
        const seen = new Set<string>([String(rootTaskId)]);
        const queue = [String(rootTaskId)];
        while (queue.length > 0) {
            for (const child of childrenOf.get(queue.shift()!) ?? []) {
                if (seen.has(child)) continue;
                seen.add(child);
                queue.push(child);
                const taskId = Number(child);
                forgetInFlightTask(taskId);
                await invalidateCachedFullTask(taskId);
            }
        }
    } catch (error) {
        console.error("forgetCachedSubtree failed:", error);
    }
};
