// The passage of text a member selected and pointed "Ask Genos" at (MIP-1058), shown as a quote:
// above the input while it waits for a question (with a way to drop it), and under the question of a
// turn that was asked with it (read only).
//
// Props only, like `AgentTurn`: Spotlight renders above the providers, so every word arrives as a
// prop. The text is the member's selection and can be in any script, so it carries `dir="auto"`
// (an Arabic passage quoted in an English UI reads right to left) and breaks anywhere; it is clamped
// to a few lines, because the full text goes to Genos, not onto the screen.

import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FormatQuoteRoundedIcon from "@mui/icons-material/FormatQuoteRounded";
import { Box, IconButton, Typography } from "@mui/joy";

import { AppTooltip } from "../../components/ui/AppTooltip";
import { touchTargetSx } from "../../components/ui/touchTargets";
import { g } from "../../theme/tokens";

export interface SelectedTextQuoteProps {
    text: string;
    /** "Selected text": the card's name for a screen reader, and its small heading. */
    label: string;
    /** A line under the text (a long selection was cut: "Only the first 4,000 characters..."). */
    note?: string;
    /** With a remove handler the card is the composer's, and says how to drop the text. */
    onRemove?: () => void;
    removeLabel?: string;
    /** How many lines of the text show. */
    maxLines?: number;
}

export const SelectedTextQuote = ({
    text,
    label,
    note,
    onRemove,
    removeLabel,
    maxLines = 3,
}: SelectedTextQuoteProps) => (
    <Box
        aria-label={label}
        role="group"
        sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 0.75,
            minWidth: 0,
            px: 1,
            py: 0.75,
            borderRadius: g.radius.sm,
            // A logical edge, so the bar sits on the reading side in a right-to-left UI too.
            borderInlineStart: "3px solid",
            borderInlineStartColor: g.accent.border,
            background: g.bg.subtle,
        }}
    >
        <FormatQuoteRoundedIcon
            sx={{ fontSize: 16, mt: "1px", flexShrink: 0, color: g.text.tertiary }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography level="body-xs" sx={{ color: g.text.tertiary, fontWeight: 500 }}>
                {label}
            </Typography>
            <Typography
                dir="auto"
                level="body-sm"
                sx={{
                    color: g.text.secondary,
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: maxLines,
                    overflow: "hidden",
                    overflowWrap: "anywhere",
                    whiteSpace: "pre-wrap",
                }}
            >
                {text}
            </Typography>
            {note && (
                <Typography level="body-xs" sx={{ color: g.text.tertiary, mt: 0.25 }}>
                    {note}
                </Typography>
            )}
        </Box>
        {onRemove && (
            <AppTooltip title={removeLabel ?? ""}>
                <IconButton
                    aria-label={removeLabel}
                    color="neutral"
                    size="sm"
                    sx={{ minWidth: 0, p: "3px", flexShrink: 0, ...touchTargetSx("&") }}
                    variant="plain"
                    onClick={onRemove}
                >
                    <CloseRoundedIcon sx={{ fontSize: 14 }} />
                </IconButton>
            </AppTooltip>
        )}
    </Box>
);
