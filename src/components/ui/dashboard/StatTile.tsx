import { ReactNode } from "react";
import { Box, Typography } from "@mui/joy";

import { Tone, toneCss } from "../../../features/tasks/meta/taskTone";
import { focusRing, g, type } from "../../../theme/tokens";

/**
 * One number and its label (MIP-1963). The tone colours the VALUE text only, never the
 * background, and a zero is always secondary so a non-zero red number is the only thing
 * that stands out. `value` is already formatted (`useNumberFormat`).
 */
export type StatTileProps = {
    label: string;
    value: string;
    /** The numeric value, only to grey a zero. */
    raw?: number;
    tone?: Extract<Tone, "danger" | "warning" | "success" | "neutral">;
    sub?: string;
    onClick?: () => void;
    /** A clickable tile is a filter: whether it is the active one. */
    pressed?: boolean;
};

export const StatTile = ({
    label,
    value,
    raw,
    tone = "neutral",
    sub,
    onClick,
    pressed,
}: StatTileProps) => {
    const zero = raw === 0;
    const color = zero || tone === "neutral" ? g.text.primary : toneCss(tone).text;
    const content: ReactNode = (
        <>
            <Typography
                component="span"
                sx={{
                    ...type("h3"),
                    color: zero ? g.text.secondary : color,
                    display: "block",
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {value}
                {sub && (
                    <Typography
                        component="span"
                        sx={{ ...type("body-xs"), color: g.text.secondary, ml: 0.5 }}
                    >
                        {sub}
                    </Typography>
                )}
            </Typography>
            <Typography
                component="span"
                sx={{
                    ...type("body-xs"),
                    color: g.text.secondary,
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2,
                    overflow: "hidden",
                }}
            >
                {label}
            </Typography>
        </>
    );
    const sx = {
        background: g.surface.default,
        border: `1px solid ${pressed ? g.accent.border : g.border.subtle}`,
        borderRadius: g.radius.md,
        minHeight: 72,
        minWidth: 0,
        p: 1.5,
        textAlign: "start",
        display: "block",
        width: "100%",
    } as const;
    if (onClick) {
        return (
            <Box
                aria-pressed={pressed}
                component="button"
                type="button"
                sx={{
                    ...sx,
                    cursor: "pointer",
                    font: "inherit",
                    "&:hover": { background: g.hover },
                    "&:focus-visible": focusRing,
                }}
                onClick={onClick}
            >
                {content}
            </Box>
        );
    }
    return <Box sx={sx}>{content}</Box>;
};

/** At most 5 tiles; a strip never holds two tiles that say the same thing. 2 columns on phone. */
export const StatStrip = ({ children }: { children: ReactNode }) => (
    <Box
        sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: {
                xs: "repeat(2, minmax(0, 1fr))",
                sm: "repeat(auto-fit, minmax(132px, 1fr))",
            },
        }}
    >
        {children}
    </Box>
);
