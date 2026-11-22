/**
 * Canonical group ids, in the same order as `GROUP_ICONS`. Exported so the cross-locale test
 * asserts against the real table rather than a copy that could drift and let the test pass while
 * the page stays broken.
 */
export const GROUP_ORDER = [
    "search",
    "ask",
    "reason",
    "followup",
    "todos",
    "thread",
    "agent",
] as const;
