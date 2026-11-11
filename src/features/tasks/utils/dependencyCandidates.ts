import { TaskTableProps } from "../../../types/tasks";
import { effectiveStatusOf, selectAncestorVerdicts } from "./closedByAncestor";

/**
 * The tasks the dependency picker offers as a blocker: live work only. A row is out when
 * it is excluded by id, has no numeric id, or is Closed or Deleted, by its own status or
 * because a Closed or Deleted ancestor (a parent at any depth, or its milestone) takes it
 * with it (MIP-1389). `all` is the whole project list, the ancestors are looked up in it.
 */
export const selectDependencyCandidates = (
    all: readonly TaskTableProps[],
    excludeTaskIds: ReadonlySet<number>
): TaskTableProps[] => {
    const verdicts = selectAncestorVerdicts(all);
    return all.filter((t) => {
        const id = t.id != null ? Number(t.id) : NaN;
        if (Number.isNaN(id)) return false;
        if (excludeTaskIds.has(id)) return false;
        const status = (effectiveStatusOf(t, verdicts) ?? "").toLowerCase();
        return status !== "deleted" && status !== "closed";
    });
};
