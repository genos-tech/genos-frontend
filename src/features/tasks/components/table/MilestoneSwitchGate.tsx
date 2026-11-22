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
}: {
    skeleton: ReactNode;
    children: ReactNode;
}) => {
    const pending = usePendingMilestoneSwitch() !== null;
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
