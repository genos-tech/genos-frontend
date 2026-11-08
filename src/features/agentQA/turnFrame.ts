import type { SxProps } from "@mui/joy/styles/types";

import type { BubbleLayout } from "../../components/ui/bubble";

/**
 * The `sx` an answer turn passes to its `Bubble` frame, shared by the live turn
 * (`AgentTurn`) and the read-only archive turn in Spotlight's history, so the two
 * cannot drift apart.
 *
 * The hosts already pad their column; on a phone the compact row's own 16px each
 * side would take a fifth of the reading width. The balloon clips its content by
 * default (for the pointed corner); a turn holds an approval card and wide
 * previews that must not be cut, and its corner is not pointed.
 */
export const turnFrameSx = (layout: BubbleLayout): SxProps =>
    layout === "compact" ? { px: { xs: 1, md: 2 } } : { overflow: "visible" };
