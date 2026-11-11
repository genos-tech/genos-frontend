import { g } from "../../../theme/tokens";
import { headerTouchTargetsSx } from "../touchTargets";

/**
 * The frame of every top bar (MIP-1134). Kept apart from `PageHeader.tsx`
 * because a header that owns its content (the chat pane's channel header) wears
 * the same frame without being wrapped in a second bar.
 */

/** Height of every top bar in px: 56 on a phone, 64 from `md` up. The chat
 *  pane header was 64 / 56 first, so it set the number. */
export const PAGE_HEADER_HEIGHT = { xs: 56, md: 64 } as const;

/** The frame, for a header that owns its content (the chat pane) and still has
 *  to sit on the same line as the rest. */
export const pageHeaderFrameSx = {
    boxSizing: "border-box",
    minHeight: { xs: PAGE_HEADER_HEIGHT.xs, md: PAGE_HEADER_HEIGHT.md },
    flexShrink: 0,
    minWidth: 0,
    px: { xs: 2, md: 3 },
    background: g.bg.default,
    borderBottom: `1px solid ${g.border.subtle}`,
    ...headerTouchTargetsSx,
} as const;
