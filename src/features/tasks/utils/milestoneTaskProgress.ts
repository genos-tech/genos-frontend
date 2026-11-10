import { TaskTableProps } from "../../../types/tasks";
import { effectiveStatusOf, selectAncestorVerdicts } from "./closedByAncestor";

/**
 * Per-status task counts behind the "Task progress" chips of the milestone
 * preview (MIP-1017).
 *
 * The chips used to be a fixed list of four statuses, so a task in any other
 * status (Blocked above all: the API sets it by itself when a dependency
 * blocks a task) was in the total but on no chip, and the chips did not add
 * up. This helper turns a list of task statuses into the chips to show, and
 * the entries always add up to `total`.
 */

/** Statuses that get a chip of their own, in the order used across the app
 *  (the task table, the filters, the milestone status order). */
export const MILESTONE_PROGRESS_ORDER = ["Open", "WIP", "Blocked", "Pending", "Closed"] as const;

export type MilestoneProgressStatus = (typeof MILESTONE_PROGRESS_ORDER)[number];

/** `Other` collects every status that has no chip of its own. */
export type MilestoneProgressKey = MilestoneProgressStatus | "Other";

export type MilestoneProgressEntry = { status: MilestoneProgressKey; count: number };

const isChipStatus = (s: string): s is MilestoneProgressStatus =>
    (MILESTONE_PROGRESS_ORDER as readonly string[]).includes(s);

/**
 * `statuses` holds one status per task of the milestone. A Deleted task is not
 * counted at all (the sidebar's `tasksTotal` leaves it out too, so the two
 * numbers agree). An empty, missing or unknown status counts as `Other`.
 * Entries come in app order, `Other` last, and only for a count above zero.
 */
export const countMilestoneTaskStatuses = (
    statuses: ReadonlyArray<string | null | undefined>
): { entries: MilestoneProgressEntry[]; total: number } => {
    const counts: Record<MilestoneProgressKey, number> = {
        Open: 0,
        WIP: 0,
        Blocked: 0,
        Pending: 0,
        Closed: 0,
        Other: 0,
    };
    let total = 0;
    for (const status of statuses) {
        if (status === "Deleted") continue;
        total += 1;
        counts[status && isChipStatus(status) ? status : "Other"] += 1;
    }
    const entries = ([...MILESTONE_PROGRESS_ORDER, "Other"] as const)
        .filter((status) => counts[status] > 0)
        .map((status) => ({ status, count: counts[status] }));
    return { entries, total };
};

/**
 * The status of each task of one milestone, as the chips should count it: the milestone's
 * own backing row is not one of its tasks, and a task under a Closed ancestor (a parent at
 * any depth, or the milestone itself) reads Closed, one under a Deleted ancestor reads
 * Deleted (which `countMilestoneTaskStatuses` leaves out), whatever its own row says
 * (MIP-1389). `tasks` is the whole loaded list: the ancestors are looked up in it.
 */
export const milestoneTaskStatuses = (
    tasks: ReadonlyArray<
        Pick<TaskTableProps, "id" | "status" | "parentTaskId" | "milestoneId" | "isMilestone">
    >,
    milestoneId: number
): Array<string | null | undefined> => {
    const verdicts = selectAncestorVerdicts(tasks);
    const statuses: Array<string | null | undefined> = [];
    for (const task of tasks) {
        if (task.milestoneId !== milestoneId || task.isMilestone) continue;
        statuses.push(effectiveStatusOf(task, verdicts));
    }
    return statuses;
};
