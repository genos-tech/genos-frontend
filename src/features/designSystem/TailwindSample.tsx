/**
 * Tailwind next to Joy (MIP-1120). Each pair paints one token role twice:
 * once with ONLY Tailwind classes (the `@theme inline` block in index.css),
 * once with the same role through `sx` and `g`. They must compute to the same
 * value in every theme and mode; jsdom ignores Tailwind, so the check is made
 * in a real browser by reading `getComputedStyle` of the two cells of a row
 * (`data-sample-role`, `data-via`, `data-prop`).
 *
 * Tailwind scans source for whole class names, so every class below is a
 * literal; do not build them by concatenation.
 */

import Box from "@mui/joy/Box";

import { g } from "../../theme/tokens";
import { Text } from "./samples";

type Prop =
    | "backgroundColor"
    | "color"
    | "borderTopColor"
    | "borderTopLeftRadius"
    | "boxShadow"
    | "fontFamily";

interface Row {
    role: string;
    prop: Prop;
    /** Tailwind classes, nothing else. */
    tw: string;
    /** The same role through Joy's `sx`. */
    sx: object;
}

// The base utilities (size, border width) are the same on both sides; only the
// role under test differs.
const swatch = { height: 28, borderRadius: 0 } as const;
const bordered = { height: 28, border: "2px solid" } as const;

const ROWS: Row[] = [
    {
        role: "bg-bg",
        prop: "backgroundColor",
        tw: "h-7 bg-bg",
        sx: { ...swatch, bgcolor: g.bg.default },
    },
    {
        role: "bg-bg-subtle",
        prop: "backgroundColor",
        tw: "h-7 bg-bg-subtle",
        sx: { ...swatch, bgcolor: g.bg.subtle },
    },
    {
        role: "bg-surface",
        prop: "backgroundColor",
        tw: "h-7 bg-surface",
        sx: { ...swatch, bgcolor: g.surface.default },
    },
    {
        role: "bg-surface-raised",
        prop: "backgroundColor",
        tw: "h-7 bg-surface-raised",
        sx: { ...swatch, bgcolor: g.surface.raised },
    },
    {
        role: "bg-accent",
        prop: "backgroundColor",
        tw: "h-7 bg-accent",
        sx: { ...swatch, bgcolor: g.accent.solid },
    },
    {
        role: "bg-accent-subtle",
        prop: "backgroundColor",
        tw: "h-7 bg-accent-subtle",
        sx: { ...swatch, bgcolor: g.accent.subtle },
    },
    {
        role: "bg-danger",
        prop: "backgroundColor",
        tw: "h-7 bg-danger",
        sx: { ...swatch, bgcolor: g.danger.solid },
    },
    {
        role: "bg-danger-subtle",
        prop: "backgroundColor",
        tw: "h-7 bg-danger-subtle",
        sx: { ...swatch, bgcolor: g.danger.subtle },
    },
    {
        role: "bg-success",
        prop: "backgroundColor",
        tw: "h-7 bg-success",
        sx: { ...swatch, bgcolor: g.success.solid },
    },
    {
        role: "bg-warning",
        prop: "backgroundColor",
        tw: "h-7 bg-warning",
        sx: { ...swatch, bgcolor: g.warning.solid },
    },
    {
        role: "bg-info",
        prop: "backgroundColor",
        tw: "h-7 bg-info",
        sx: { ...swatch, bgcolor: g.info.solid },
    },
    { role: "text-primary", prop: "color", tw: "text-primary", sx: { color: g.text.primary } },
    {
        role: "text-secondary",
        prop: "color",
        tw: "text-secondary",
        sx: { color: g.text.secondary },
    },
    { role: "text-tertiary", prop: "color", tw: "text-tertiary", sx: { color: g.text.tertiary } },
    { role: "text-disabled", prop: "color", tw: "text-disabled", sx: { color: g.text.disabled } },
    {
        role: "text-accent-text",
        prop: "color",
        tw: "text-accent-text",
        sx: { color: g.accent.text },
    },
    {
        role: "text-danger-text",
        prop: "color",
        tw: "text-danger-text",
        sx: { color: g.danger.text },
    },
    {
        role: "text-success-text",
        prop: "color",
        tw: "text-success-text",
        sx: { color: g.success.text },
    },
    {
        role: "text-warning-text",
        prop: "color",
        tw: "text-warning-text",
        sx: { color: g.warning.text },
    },
    { role: "text-info-text", prop: "color", tw: "text-info-text", sx: { color: g.info.text } },
    {
        role: "border-subtle",
        prop: "borderTopColor",
        tw: "h-7 border-2 border-subtle",
        sx: { ...bordered, borderColor: g.border.subtle },
    },
    {
        role: "border-default",
        prop: "borderTopColor",
        tw: "h-7 border-2 border-default",
        sx: { ...bordered, borderColor: g.border.default },
    },
    {
        role: "border-strong",
        prop: "borderTopColor",
        tw: "h-7 border-2 border-strong",
        sx: { ...bordered, borderColor: g.border.strong },
    },
    {
        role: "border-accent-border",
        prop: "borderTopColor",
        tw: "h-7 border-2 border-accent-border",
        sx: { ...bordered, borderColor: g.accent.border },
    },
    {
        role: "border-danger-border",
        prop: "borderTopColor",
        tw: "h-7 border-2 border-danger-border",
        sx: { ...bordered, borderColor: g.danger.border },
    },
    {
        role: "rounded-xs",
        prop: "borderTopLeftRadius",
        tw: "h-7 bg-surface-raised rounded-xs",
        sx: { height: 28, bgcolor: g.surface.raised, borderRadius: g.radius.xs },
    },
    {
        role: "rounded-sm",
        prop: "borderTopLeftRadius",
        tw: "h-7 bg-surface-raised rounded-sm",
        sx: { height: 28, bgcolor: g.surface.raised, borderRadius: g.radius.sm },
    },
    {
        role: "rounded-md",
        prop: "borderTopLeftRadius",
        tw: "h-7 bg-surface-raised rounded-md",
        sx: { height: 28, bgcolor: g.surface.raised, borderRadius: g.radius.md },
    },
    {
        role: "rounded-lg",
        prop: "borderTopLeftRadius",
        tw: "h-7 bg-surface-raised rounded-lg",
        sx: { height: 28, bgcolor: g.surface.raised, borderRadius: g.radius.lg },
    },
    {
        role: "shadow-sm",
        prop: "boxShadow",
        tw: "h-7 bg-surface rounded-md shadow-sm",
        sx: {
            height: 28,
            bgcolor: g.surface.default,
            borderRadius: g.radius.md,
            boxShadow: g.shadow.sm,
        },
    },
    {
        role: "shadow-md",
        prop: "boxShadow",
        tw: "h-7 bg-surface rounded-md shadow-md",
        sx: {
            height: 28,
            bgcolor: g.surface.default,
            borderRadius: g.radius.md,
            boxShadow: g.shadow.md,
        },
    },
    {
        role: "font-sans",
        prop: "fontFamily",
        tw: "font-sans text-sm",
        sx: { fontFamily: g.font.body, fontSize: "0.875rem" },
    },
    {
        role: "font-mono",
        prop: "fontFamily",
        tw: "font-mono text-sm",
        sx: { fontFamily: g.font.mono, fontSize: "0.875rem" },
    },
];

const isText = (prop: Prop) => prop === "color" || prop === "fontFamily";

const Cell = ({ row, via }: { row: Row; via: "tw" | "sx" }) => {
    const common = {
        "data-sample-role": row.role,
        "data-via": via,
        "data-prop": row.prop,
    };
    const label = isText(row.prop) ? "Aa 123" : null;
    return via === "tw" ? (
        <div {...common} className={row.tw}>
            {label}
        </div>
    ) : (
        <Box {...common} sx={row.sx}>
            {label}
        </Box>
    );
};

export const TailwindSample = () => (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {/* The whole point in one picture: a card written only in Tailwind,
            beside the same card written in sx. */}
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
            <div
                className="bg-surface text-primary border-default rounded-md border p-3 font-sans text-sm shadow-md"
                data-sample-card="tw"
            >
                <div className="text-secondary text-xs">Tailwind only</div>
                <div className="mt-1 font-semibold">
                    bg-surface text-primary border-default rounded-md shadow-md
                </div>
                <div className="mt-2 flex gap-2">
                    <span className="bg-accent text-accent-fg rounded-sm px-2 py-1 text-xs">
                        Accent
                    </span>
                    <span className="bg-danger-subtle text-danger-text border-danger-border rounded-sm border px-2 py-1 text-xs">
                        Danger
                    </span>
                    <span className="text-tertiary px-2 py-1 text-xs">Tertiary</span>
                </div>
            </div>
            <Box
                data-sample-card="sx"
                sx={{
                    bgcolor: g.surface.default,
                    color: g.text.primary,
                    border: `1px solid ${g.border.default}`,
                    borderRadius: g.radius.md,
                    p: 1.5,
                    fontFamily: g.font.body,
                    fontSize: "0.875rem",
                    boxShadow: g.shadow.md,
                }}
            >
                <Box sx={{ color: g.text.secondary, fontSize: "0.75rem" }}>Joy sx</Box>
                <Box sx={{ mt: 0.5, fontWeight: 600 }}>
                    g.surface.default g.text.primary g.border.default g.radius.md g.shadow.md
                </Box>
                <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
                    <Box
                        sx={{
                            bgcolor: g.accent.solid,
                            color: g.accent.fg,
                            borderRadius: g.radius.sm,
                            px: 1,
                            py: 0.5,
                            fontSize: "0.75rem",
                        }}
                    >
                        Accent
                    </Box>
                    <Box
                        sx={{
                            bgcolor: g.danger.subtle,
                            color: g.danger.text,
                            border: `1px solid ${g.danger.border}`,
                            borderRadius: g.radius.sm,
                            px: 1,
                            py: 0.5,
                            fontSize: "0.75rem",
                        }}
                    >
                        Danger
                    </Box>
                    <Box sx={{ color: g.text.tertiary, px: 1, py: 0.5, fontSize: "0.75rem" }}>
                        Tertiary
                    </Box>
                </Box>
            </Box>
        </Box>

        <Box
            sx={{
                display: "grid",
                gap: 1,
                gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                columnGap: 3,
            }}
        >
            {ROWS.map((row) => (
                <Box
                    key={row.role}
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "150px 1fr 1fr",
                        alignItems: "center",
                        gap: 1,
                    }}
                >
                    <Text level="body-xs" sx={{ fontFamily: g.font.mono }} tone="tertiary">
                        {row.role}
                    </Text>
                    <Cell row={row} via="tw" />
                    <Cell row={row} via="sx" />
                </Box>
            ))}
        </Box>
    </Box>
);
