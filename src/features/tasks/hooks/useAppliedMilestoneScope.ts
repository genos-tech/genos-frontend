import { startTransition, useCallback, useRef, useState } from "react";

import { getPendingMilestoneSwitch } from "../state/milestoneSwitchStore";

/**
 * MIP-1972: the task table filters its rows in an effect that runs AFTER the milestone
 * scope changes, so for a moment the rows still belong to the previous scope. This tracks
 * which scope the rows were last filtered for. While it differs from the scope now
 * selected, `settled` is false and the table shows its loading skeleton: never the old
 * milestone's rows under the new title.
 *
 * `apply` runs the filter's write in a transition, so the click paints first (new
 * selection + skeleton) and the heavy rebuild of the rows does not block that frame. A
 * scope whose rows are already in memory settles in the same task: no extra frame.
 */
export const useAppliedMilestoneScope = (scopeId: number | null) => {
    const [appliedScopeId, setAppliedScopeId] = useState<number | null>(scopeId);
    // The scope of the render that is committing: the filter effect reads it.
    const scopeRef = useRef<number | null>(scopeId);
    scopeRef.current = scopeId;

    const apply = useCallback((write: () => void) => {
        const scope = scopeRef.current;
        const commit = () => {
            write();
            setAppliedScopeId(scope);
        };
        // While the click's skeleton is up nothing needs to stay responsive behind it:
        // write at once (a second time-sliced pass only made the switch slower).
        if (getPendingMilestoneSwitch() !== null) commit();
        else startTransition(commit);
    }, []);

    return { settled: appliedScopeId === scopeId, apply };
};
