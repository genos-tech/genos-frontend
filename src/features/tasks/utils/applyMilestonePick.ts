/**
 * The task preview's working copy after the milestone picker is used.
 *
 * Picking a milestone changes three things at once, in ONE update (two
 * separate ones clobber each other inside a React batch; see
 * `SprintMilestonePicker`):
 *
 *   - `milestoneId`: the pick;
 *   - `parentTaskId`: the milestone's backing task, so the table nests the task
 *     under the milestone row ("changing the milestone is changing the parent");
 *   - `sprintId`: a task has no sprint picker of its own, its sprint IS its
 *     milestone's, or none. The server derives it the same way. `null` is an
 *     answer here ("no sprint"), so it is written like any other value.
 *     Applying it only when a sprint was handed over left the old sprint on a
 *     task moved into a milestone without one, in the table and in the cache
 *     (MIP-1035).
 */
export const applyMilestonePick = <
    T extends {
        milestoneId?: number | null;
        parentTaskId?: number | null;
        sprintId?: number | null;
    },
>(
    task: T,
    milestoneId: number | null,
    parentTaskId: number | null,
    sprintId: number | null
): T => ({ ...task, milestoneId, parentTaskId, sprintId });
