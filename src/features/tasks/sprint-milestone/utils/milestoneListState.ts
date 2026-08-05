import { Milestone } from "../types";

/**
 * File `m` into the per-project milestone map (`projectId -> Milestone[]`)
 * that `useSprintMilestoneManagement` keeps, replacing an existing entry
 * with the same `milestoneId` or prepending a new one.
 *
 * A milestone can CHANGE project, so this also evicts it from whichever
 * project's list it used to sit in. Without that eviction a moved
 * milestone renders under both projects, and the copy left behind keeps
 * the sprint chip and rollup counts of the project it left — which the
 * move reset server-side.
 */
export const upsertMilestoneInList = (
    prev: Record<number, Milestone[]>,
    m: Milestone
): Record<number, Milestone[]> => {
    const cleaned: Record<number, Milestone[]> = {};
    for (const [projectId, list] of Object.entries(prev)) {
        if (Number(projectId) === m.projectId) {
            cleaned[Number(projectId)] = list;
            continue;
        }
        const without = list.filter((x) => x.milestoneId !== m.milestoneId);
        // Keep the original array when nothing was dropped, so the
        // untouched projects' lists stay referentially equal and their
        // memoized consumers don't re-render on every upsert.
        cleaned[Number(projectId)] = without.length === list.length ? list : without;
    }
    const list = cleaned[m.projectId] ?? [];
    const exists = list.some((x) => x.milestoneId === m.milestoneId);
    const next = exists
        ? list.map((x) => (x.milestoneId === m.milestoneId ? m : x))
        : [m, ...list];
    return { ...cleaned, [m.projectId]: next };
};
