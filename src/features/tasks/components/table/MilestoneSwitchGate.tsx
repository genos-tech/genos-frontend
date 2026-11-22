import type { ReactNode } from "react";

import { usePendingMilestoneSwitch } from "../../state/milestoneSwitchStore";

/**
 * MIP-1972: while a milestone that was just picked in the sidebar is not yet what the table
 * shows, the rows are hidden and the loading skeleton stands in their place, so the previous
 * milestone's tasks are never on screen under the new selection.
 *
 * The rows stay MOUNTED (hidden, not unmounted): this component's own state is the only thing
 * that changes at the click, `children` keeps its identity, so React does not render the rows
 * again and the first paint is just this swap.
 */
export const MilestoneSwitchGate = ({
    skeleton,
    children,
    forcePending = false,
}: {
    skeleton: ReactNode;
    children: ReactNode;
    /** MIP-2000: a status the filter now shows is being fetched, so the rows that are held
     *  would be an incomplete list. Same treatment as a milestone switch: hidden, not unmounted. */
    forcePending?: boolean;
}) => {
    const pending = usePendingMilestoneSwitch() !== null || forcePending;
    return (
        <>
            <div
                aria-hidden={pending || undefined}
                data-milestone-switch={pending ? "pending" : "ready"}
                style={pending ? { display: "none" } : undefined}
            >
                {children}
            </div>
            {pending ? skeleton : null}
        </>
    );
};
