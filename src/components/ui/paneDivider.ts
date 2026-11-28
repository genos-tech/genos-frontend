import { g } from "../../theme/tokens";

// The line between two panes that cannot be resized (MIP-2606). Same width and
// color as the resize handle (`.gp-pane-handle` in index.css). Put it on ONE side
// of ONE pane, e.g. `sx={{ borderInlineEnd: paneDivider }}`.
export const paneDivider = `2px solid ${g.border.default}`;
