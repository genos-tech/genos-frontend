import React from "react";
import { Box } from "@mui/joy";

/**
 * Slot-root wrappers that strip MUI Joy's `ownerState` prop before
 * forwarding to the underlying component.
 *
 * Why: when a Joy component (e.g. `MenuButton`) accepts a
 * `slots={{ root: SomeComponent }}` override, it forwards its internal
 * `ownerState` prop into the slot. Joy components like `IconButton`
 * know how to consume it, but plain `Box` / DOM elements forward it
 * unchanged to their host node and React emits:
 *
 *   "Warning: React does not recognize the `ownerState` prop on a DOM
 *    element. If you intentionally want it to appear in the DOM as a
 *    custom attribute, spell it as lowercase `ownerstate` instead."
 *
 * Use these wrappers as the slot value to silence the warning while
 * preserving the original rendering. Defined as `forwardRef` so the
 * slot still participates in ref forwarding (the parent passes a ref
 * down through `slotProps.root.ref`).
 */
type WithOwnerState<T> = T & { ownerState?: unknown };

export const BoxSlotRoot = React.forwardRef<
    HTMLDivElement,
    WithOwnerState<React.ComponentProps<typeof Box>>
>(({ ownerState: _ownerState, ...rest }, ref) => <Box ref={ref} {...rest} />);
BoxSlotRoot.displayName = "BoxSlotRoot";
