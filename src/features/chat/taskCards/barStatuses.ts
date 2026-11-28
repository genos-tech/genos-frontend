import {
    STATUS_BLOCKED,
    STATUS_CLOSED,
    STATUS_DELETED,
    STATUS_OPEN,
    STATUS_PENDING,
    STATUS_WIP,
} from "../../tasks/meta/taskStatuses";

/** Finished or gone: such work is never overdue. Rejected is MIP-2494's status. */
export const isDone = (status: string): boolean =>
    status === STATUS_CLOSED || status === STATUS_DELETED || status === "Rejected";

/** Lifecycle order, from the inline start: what is finished first, what is not begun last. */
export const BAR_STATUSES = [
    STATUS_CLOSED,
    STATUS_WIP,
    STATUS_BLOCKED,
    STATUS_PENDING,
    STATUS_OPEN,
] as const;
