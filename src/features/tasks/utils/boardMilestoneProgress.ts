import { TaskTableProps } from "../../../types/tasks";
import { Milestone } from "../sprint-milestone/types";

type CountedTask = Pick<TaskTableProps, "milestoneId" | "isMilestone" | "status">;

/**
 * The sprint board's milestone cards, keyed by their BACKING TASK's id (the
 * id of the board row they replace), with a LIVE "closed / total" (MIP-1048).
 *
 * `Milestone.tasksTotal` / `tasksClosed` are counted by the server when the
 * milestone list loads and nothing refreshes them when a task changes status,
 * so a card built straight from them kept its old progress after a task was
 * dragged to Closed, until a reload. The loaded task rows are always current,
 * so count those instead, the same way the milestone preview does for its
 * status chips: by `milestoneId`, never the milestone's own backing row, and
 * not Deleted tasks.
 *
 * A milestone none of whose tasks is loaded keeps the server's numbers (the
 * rows may simply not be here yet; an empty count must not read as "0/0
 * done"). A milestone whose live numbers equal the server's keeps its own
 * object, so memoised cards skip the re-render.
 */
export const milestonesByTaskIdWithLiveProgress = (
    milestones: ReadonlyArray<Milestone>,
    tasks: ReadonlyArray<CountedTask>
): Map<number, Milestone> => {
    const counts = new Map<number, { total: number; closed: number }>();
    for (const task of tasks) {
        if (task.isMilestone || task.milestoneId == null || task.status === "Deleted") continue;
        const id = Number(task.milestoneId);
        const c = counts.get(id) ?? { total: 0, closed: 0 };
        c.total += 1;
        if (task.status === "Closed") c.closed += 1;
        counts.set(id, c);
    }

    const byTaskId = new Map<number, Milestone>();
    for (const m of milestones) {
        if (m.taskId == null) continue;
        const live = counts.get(m.milestoneId);
        const unchanged =
            live == null || (live.total === m.tasksTotal && live.closed === m.tasksClosed);
        byTaskId.set(
            Number(m.taskId),
            unchanged ? m : { ...m, tasksTotal: live.total, tasksClosed: live.closed }
        );
    }
    return byTaskId;
};
