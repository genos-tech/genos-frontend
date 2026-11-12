import { Box } from "@mui/joy";

import { g } from "../../../../theme/tokens";

/**
 * The trailing mark of a note row that has an unread @mention (cleared on open).
 *
 * It sits at the end of the row, where the chat list puts its unread dot, so the title
 * never moves when a note goes unread. The row's accent bar and bold title (`NavItem`'s
 * `unread`) say the same thing from the other side. It used to be the row's LEADING
 * marker: a 6px grey dot that grew into an 8px accent one and pushed the title along.
 */
export const NoteUnreadDot = () => (
    <Box
        className="NoteUnreadDot"
        sx={{
            width: 8,
            height: 8,
            borderRadius: g.radius.full,
            flexShrink: 0,
            background: g.accent.solid,
        }}
        aria-hidden
    />
);
