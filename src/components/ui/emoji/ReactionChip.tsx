import { forwardRef } from "react";
import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { EmojiGlyph } from "./EmojiGlyph";

/**
 * A posted reaction: the emoji plus how many people sent it.
 *
 * Shared by chat/thread bubbles (`ShowEmojiReaction`) and task comments
 * (`ReactionTaskCommentEmojiDisplay`), which previously each rendered their
 * own Joy `Chip` and had drifted apart — chat painted "I reacted" with
 * `color="success"` (a green that ignored the brand entirely) while task
 * comments used `color="neutral"` (grey). One component now owns the look,
 * so the same reaction reads the same wherever it appears.
 *
 * Colors come from the brand ramp rather than Joy's semantic palettes, so
 * the chip follows the user's selected color theme. Green also carried the
 * wrong meaning here: a reaction isn't a success state.
 *
 * Rendered as a real `<button aria-pressed>` — it's a toggle (clicking
 * adds or removes YOUR reaction), and the pressed state is exactly what
 * the highlighted styling communicates visually.
 */

type ReactionChipProps = {
    emoji: string;
    count: number;
    /** Whether the signed-in user is one of the senders — drives the
     *  highlighted (pressed) styling. */
    mine: boolean;
    onClick: () => void;
    /** Accessible name, e.g. "👍 reaction, 3 people". Falls back to a
     *  count-only label; the visible tooltip already names the senders. */
    label?: string;
};

// Shared geometry so the two states can't drift in size and the row
// doesn't reflow when a reaction becomes (or stops being) yours.
const BASE = {
    display: "inline-flex",
    alignItems: "center",
    gap: 0.5,
    height: 22,
    px: 0.75,
    borderRadius: "999px",
    border: "1px solid",
    cursor: "pointer",
    fontFamily: "inherit",
    lineHeight: 1,
    flexShrink: 0,
    // Matches the reply counter's motion curve in `BubbleUnderBar`, which
    // sits directly beside these chips.
    transition: "all 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
    "&:active": { transform: "translateY(0) scale(0.96)" },
} as const;

/**
 * `forwardRef` + prop spread are load-bearing, not boilerplate: every call
 * site wraps this in `AppTooltip` (the "X and Y reacted" hover), and Joy's
 * Tooltip works by cloning its child to inject a ref plus hover/focus
 * listeners and `aria-describedby`. A component that swallows those
 * renders no tooltip at all — silently, since nothing errors.
 */
export const ReactionChip = forwardRef<HTMLButtonElement, ReactionChipProps>(function ReactionChip(
    { emoji, count, mine, onClick, label, ...tooltipProps },
    ref
) {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const brand = (alpha: number) => `rgba(var(--gp-brand-700-rgb), ${alpha})`;
    // The same accent the reply counter uses, so the whole under-bar reads
    // as one row rather than two unrelated controls.
    const brandText = isDark ? "var(--gp-brandalt-400)" : "var(--gp-brand-800)";

    // Every chip paints its tint OVER an opaque surface rather than letting
    // the bubble show through. Bubbles come in four backgrounds — sent
    // (brand-tinted), received (neutral), focused (green) and thread-active
    // — and a translucent chip dissolved into the tinted ones: a teal
    // "mine" chip on a green focused bubble was nearly invisible. The base
    // layer means a reaction reads identically wherever it lands.
    const base = `var(--joy-palette-background-surface)`;
    const layer = (top: string, bottom: string) =>
        `linear-gradient(135deg, ${top} 0%, ${bottom} 100%), ${base}`;

    const mineSx = {
        background: isDark ? layer(brand(0.34), brand(0.2)) : layer(brand(0.2), brand(0.1)),
        borderColor: brand(isDark ? 0.5 : 0.4),
        "&:hover": {
            background: isDark ? layer(brand(0.46), brand(0.3)) : layer(brand(0.3), brand(0.16)),
            borderColor: brand(isDark ? 0.68 : 0.55),
            transform: "translateY(-1px)",
            boxShadow: `0 3px 10px ${brand(isDark ? 0.28 : 0.2)}`,
        },
    };

    const theirsSx = {
        background: isDark
            ? layer("rgba(255,255,255,0.09)", "rgba(255,255,255,0.05)")
            : layer("rgba(0,0,0,0.05)", "rgba(0,0,0,0.025)"),
        borderColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)",
        "&:hover": {
            background: isDark
                ? layer("rgba(255,255,255,0.14)", "rgba(255,255,255,0.08)")
                : layer("rgba(0,0,0,0.08)", "rgba(0,0,0,0.04)"),
            // Hint the brand on hover so it's clear the chip is actionable
            // and that acting on it opts you in.
            borderColor: brand(isDark ? 0.45 : 0.35),
            transform: "translateY(-1px)",
            boxShadow: isDark ? "0 3px 10px rgba(0,0,0,0.3)" : "0 3px 10px rgba(0,0,0,0.08)",
        },
    };

    // Ordering here is deliberate, and getting it wrong is silent.
    //
    // Joy's Tooltip clones its child and injects `component: undefined`
    // among its props — so spreading AFTER `component="button"` overwrote
    // it and Box fell back to rendering a <div>: no button semantics, no
    // keyboard activation, and `type="button"` on a div. `component` /
    // `type` / `aria-pressed` therefore come after the spread.
    //
    // `aria-label` goes BEFORE it, so the tooltip's richer label ("Alice
    // and Bob reacted") wins over the "👍 3" fallback.
    //
    // `sx` is injected too, so it's merged rather than replaced.
    const { sx: injectedSx, ...injectedRest } = tooltipProps as { sx?: unknown };
    return (
        <Box
            aria-label={label ?? `${emoji} ${count}`}
            {...injectedRest}
            ref={ref}
            aria-pressed={mine}
            component="button"
            type="button"
            sx={[
                {
                    ...BASE,
                    ...(mine ? mineSx : theirsSx),
                    "&:focus-visible": {
                        outline: "2px solid",
                        outlineColor: brand(0.6),
                        outlineOffset: 1,
                    },
                },
                ...(Array.isArray(injectedSx) ? injectedSx : [injectedSx]),
            ]}
            onClick={onClick}
        >
            <EmojiGlyph emoji={emoji} size={14} />
            <Box
                component="span"
                sx={{
                    fontSize: "0.7rem",
                    fontWeight: mine ? 700 : 600,
                    // Digits share a width, so 9 → 10 doesn't nudge every
                    // chip to its right.
                    fontVariantNumeric: "tabular-nums",
                    color: mine
                        ? brandText
                        : isDark
                          ? "rgba(255,255,255,0.62)"
                          : "rgba(0,0,0,0.58)",
                    letterSpacing: "0.01em",
                }}
            >
                {count}
            </Box>
        </Box>
    );
});

/**
 * Overflow indicator once a message carries more distinct reactions than
 * the row shows. Non-interactive beyond its tooltip, so it's deliberately
 * quieter than a real chip — same pill geometry, no fill.
 */
export const MoreReactionsChip = forwardRef<HTMLSpanElement, { text: string }>(
    function MoreReactionsChip({ text, ...tooltipProps }, ref) {
        const { mode } = useColorScheme();
        const isDark = mode === "dark";
        // Same ordering rule as `ReactionChip` above — see the note there.
        const { sx: injectedSx, ...injectedRest } = tooltipProps as { sx?: unknown };
        return (
            <Box
                {...injectedRest}
                ref={ref}
                component="span"
                sx={[
                    {
                        ...BASE,
                        cursor: "default",
                        // Same opaque base as a real chip so the row reads as
                        // one set of pills against any bubble background.
                        background: "var(--joy-palette-background-surface)",
                        borderColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)",
                        fontSize: "0.68rem",
                        fontWeight: 600,
                        color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)",
                        "&:active": undefined,
                    },
                    ...(Array.isArray(injectedSx) ? injectedSx : [injectedSx]),
                ]}
            >
                {text}
            </Box>
        );
    }
);
