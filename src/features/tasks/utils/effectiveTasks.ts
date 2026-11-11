import { TaskTableProps } from "../../../types/tasks";
import { selectAncestorVerdicts } from "./closedByAncestor";

// A task augmented with status/close-date rolled up from its ancestors.
// `effectiveStatus`:
//   - "Closed"   → task itself OR any ancestor (a parent at any depth, or its
//                  milestone) is Closed: sub-tasks of a closed parent are reported
//                  as completed even if their own status was never updated.
//   - otherwise  → the task's own status.
//   (A task that is Deleted, or under a Deleted ancestor, is not in the result.)
// `effectiveCloseDate`: when the task became "effectively" closed:
//   - the task's own `updatedAt` if its own status is Closed,
//   - else the closest closed ancestor's `updatedAt`,
//   - else null (task is not effectively closed).
export type EffectiveTask = TaskTableProps & {
    effectiveStatus: string;
    effectiveCloseDate: string | null;
};

/**
 * Roll a flat task list up into `EffectiveTask`s: drop Deleted tasks and whole branches
 * under a Deleted ancestor, and treat a sub-task of a Closed ancestor as Closed itself
 * (MIP-1382, MIP-1389: the shared rule in `closedByAncestor.ts`). Shared by the
 * current-project dashboard metrics and the team-wide (all-projects) Team Capacity
 * pass, so both apply the exact same closed/deleted semantics. Iterates
 * `taskById.values()` so any duplicate rows collapse to one entry per id (latest wins).
 */
export const deriveEffectiveTasks = (
    taskById: ReadonlyMap<string, TaskTableProps>
): EffectiveTask[] => {
    const rows = [...taskById.values()];
    const verdicts = selectAncestorVerdicts(rows);
    const result: EffectiveTask[] = [];
    for (const t of rows) {
        if (!t.id) continue;
        if (t.status === "Deleted") continue;
        const verdict = verdicts.get(String(t.id));
        if (verdict?.status === "Deleted") continue;

        const closedByAncestor = verdict?.status === "Closed";
        const effectiveStatus =
            t.status === "Closed" || closedByAncestor ? "Closed" : t.status || "Open";
        const effectiveCloseDate =
            t.status === "Closed"
                ? t.updatedAt
                : closedByAncestor
                  ? (verdict.ancestor.updatedAt ?? null)
                  : null;

        result.push({ ...t, effectiveStatus, effectiveCloseDate });
    }
    return result;
};
