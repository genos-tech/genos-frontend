import type { MentionPalette } from "./mentionPalettes";

// Exported so the light path shares this exact style (see the palette
// comment above).
export const hashMentionTextSx = (palette: MentionPalette) =>
    ({
        display: "inline",
        color: palette.text,
        fontWeight: 600,
        cursor: "pointer",
        // A subtle, faded underline marks it as a distinct interactive token
        // (vs plain text) without the weight of a chip/pill; it strengthens
        // on hover.
        textDecoration: "underline",
        textDecorationColor: palette.bgHover,
        textUnderlineOffset: "2px",
        transition: "text-decoration-color 0.15s ease",
        "&:hover": { textDecorationColor: palette.text },
    }) as const;

// What the user typed after `#` when they picked a row, per editor: a task
// found by its id is inserted as a compact `#PRJ-12` chip (MIP-739).
export const lastHashQuery = new WeakMap<object, string>();
export const rememberHashQuery = (editor: object, query: string) =>
    lastHashQuery.set(editor, query);
