import { FAB_CLEARANCE_VAR } from "./spotlightFabPosition";

/**
 * Last "row" of a Virtuoso list that scrolls under the floating "Open Genos"
 * button: an empty spacer as tall as the button's clearance, so the final row
 * can be scrolled clear of it (MIP-1404). Zero tall wherever the button is not
 * shown. Module-level on purpose: Virtuoso remounts a `Footer` whose identity
 * changes between renders.
 */
export const FabClearanceFooter = () => (
    <div aria-hidden style={{ height: `var(${FAB_CLEARANCE_VAR}, 0px)` }} />
);

/** `components` prop for a Virtuoso list: one shared object, so it is stable. */
export const FAB_CLEARANCE_COMPONENTS = { Footer: FabClearanceFooter };
