import type { ElementType } from "react";
import { Box } from "@mui/joy";

import { plainButtonSx } from "../../../components/ui/plainButtonStyles";
import { invisibleHitAreaSx } from "../../../components/ui/touchTargets";
import { focusRing, g, type } from "../../../theme/tokens";

type Props = {
    Icon?: ElementType;
    label: string;
    onClick: () => void;
};

/**
 * What a card points at (a project, a chat, a note, the message a reminder is about), as a quiet
 * inline link: the type's small icon, then the name in the link colour, cut with an ellipsis
 * rather than wrapping. It replaces three hand-styled bordered chips. The card is a button as a
 * whole (`Clickable` in the list), so a click here must not also open the card.
 */
export const InboxLinkChip = ({ Icon, label, onClick }: Props) => (
    <Box
        component="button"
        type="button"
        sx={{
            ...plainButtonSx,
            ...type("body-xs"),
            display: "inline-flex",
            alignItems: "flex-start",
            gap: 0.5,
            minWidth: 0,
            maxWidth: "100%",
            color: g.link.default,
            fontWeight: 500,
            "&:hover": { color: g.link.hover, textDecoration: "underline" },
            "&:focus-visible": { ...focusRing, outlineOffset: "1px" },
            ...invisibleHitAreaSx(),
        }}
        data-inbox-target
        onClick={(event) => {
            event.stopPropagation();
            onClick();
        }}
    >
        {Icon && <Icon sx={{ fontSize: 14, flexShrink: 0 }} />}
        <Box
            component="span"
            sx={{
                minWidth: 0,
                overflow: "hidden",
                overflowWrap: "anywhere",
                textAlign: "start",
                // A long team or project name is the point of the line: two lines, then the cut.
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
            }}
        >
            {label}
        </Box>
    </Box>
);

/** The same place in the same line, as plain text: for a target the card names but the reader
 *  cannot open (a chat that is not in their list yet, a task note). A name you cannot click is
 *  still the thing you are being asked about. */
export const InboxTargetText = ({ label }: { label: string }) => (
    <Box
        component="span"
        sx={{
            ...type("body-xs"),
            minWidth: 0,
            overflow: "hidden",
            overflowWrap: "anywhere",
            fontWeight: 500,
            color: g.text.primary,
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
        }}
        data-inbox-target
    >
        {label}
    </Box>
);
