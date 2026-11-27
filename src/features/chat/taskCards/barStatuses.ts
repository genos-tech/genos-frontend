import {
    STATUS_BLOCKED,
    STATUS_CLOSED,
    STATUS_OPEN,
    STATUS_PENDING,
    STATUS_WIP,
} from "../../tasks/meta/taskStatuses";

/** Lifecycle order, from the inline start: what is finished first, what is not begun last. */
export const BAR_STATUSES = [
    STATUS_CLOSED,
    STATUS_WIP,
    STATUS_BLOCKED,
    STATUS_PENDING,
    STATUS_OPEN,
] as const;
