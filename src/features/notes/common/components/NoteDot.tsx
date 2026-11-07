import { Box } from "@mui/joy";

import { g } from "../../../../theme/tokens";

/**
 * The leading marker of a note row: a quiet dot, a larger accent dot when the
 * note has an unread @mention (cleared on open). Selection is the row's tint,
 * so the dot does not repeat it.
 */
export const NoteDot = ({ unread = false }: { unread?: boolean }) => (
    <Box
        sx={{
            width: unread ? 8 : 6,
            height: unread ? 8 : 6,
            borderRadius: g.radius.full,
            flexShrink: 0,
            background: unread ? g.accent.solid : g.border.strong,
            transition: `all ${g.motion.base} ${g.ease}`,
        }}
        aria-hidden
    />
);
