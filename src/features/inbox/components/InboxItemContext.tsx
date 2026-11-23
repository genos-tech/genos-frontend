import type { ElementType, ReactNode } from "react";
import { Box } from "@mui/joy";

import { g, type } from "../../../theme/tokens";

type Props = {
    /** What kind of card this is: the type's icon and its short name. Absent for a plain activity. */
    Icon?: ElementType;
    label?: string;
    /** What it points at: the quiet links. */
    children?: ReactNode;
    /** The time, the unread dot and the read toggle, when the card has no title line to carry them. */
    meta?: ReactNode;
};

/**
 * The card's second line: its type, then what it is about, in secondary text on one line.
 * The type's name used to be a bordered chip of its own; it is folded in here so the card has one
 * title and one line of context instead of a chip, a body, a second chip and a button row.
 *
 * Draws nothing when it has nothing to say (`:empty`), so a plain activity with no target costs
 * no height.
 */
export const InboxItemContext = ({ Icon, label, children, meta }: Props) => (
    <Box
        sx={{
            ...type("body-xs"),
            display: "flex",
            alignItems: "flex-start",
            gap: 1,
            minWidth: 0,
            mt: 0.25,
            color: g.text.secondary,
            "&:empty": { display: "none" },
        }}
    >
        {label && (
            <Box
                component="span"
                sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    flexShrink: 0,
                    // The dot only when a target follows the name.
                    "&:has(+ [data-inbox-target])::after": {
                        content: '"·"',
                        marginInlineStart: 1,
                        color: g.text.tertiary,
                    },
                }}
            >
                {Icon && <Icon sx={{ fontSize: 14 }} />}
                {label}
            </Box>
        )}
        {children}
        {meta && <Box sx={{ marginInlineStart: "auto", flexShrink: 0 }}>{meta}</Box>}
    </Box>
);
