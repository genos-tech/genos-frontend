// Joy UI `sx` block shared by every surface that renders an LLM
// answer as markdown: the global Spotlight overlay, its read-only
// history archive, and the per-entity Ask modals (thread, notes).
// Centralising it means tweaks to answer typography land in one place.
//
// The consuming `<Box sx={...}>` still owns layout-only props (`mb`,
// `bgcolor` for the summary card, etc.) and merges this style in.

import { g } from "../../theme/tokens";

// Roles, not values (MIP-1130): the answer reads the same tokens as every
// message and comment, so it follows the theme and mode in CSS and takes no
// `isDark`.
export function markdownAnswerSx(): Record<string, unknown> {
    return {
        lineHeight: 1.65,
        fontSize: "1rem",
        color: g.text.primary,
        // paragraphs — reset default browser margins
        "& p": { m: 0, mb: 0.75 },
        "& p:last-child": { mb: 0 },
        // lists — something in Joy UI's cascade clears `list-style`, so
        // lists rendered indented but markerless. Set list-style and
        // `display: list-item` explicitly so the markers always show.
        "& ul, & ol": { pl: 2.75, my: 0.75, listStylePosition: "outside" },
        "& ul": { listStyleType: "disc" },
        "& ol": { listStyleType: "decimal" },
        "& li": { mb: 0.5, display: "list-item" },
        "& li:last-child": { mb: 0 },
        "& li::marker": { color: g.accent.text },
        // nested lists — tighter than top-level
        "& li > ul, & li > ol": { my: 0.25, pl: 2 },
        // code blocks
        "& pre": {
            overflowX: "auto",
            borderRadius: g.radius.sm,
            p: 1,
            my: 0.75,
            fontSize: "0.875rem",
            background: g.hover,
        },
        // inline code
        "& code": {
            fontFamily: "monospace",
            fontSize: "0.85em",
            px: "0.3em",
            py: "0.1em",
            borderRadius: g.radius.xs,
            background: g.hover,
        },
        // reset code-inside-pre so the pre bg shows
        "& pre code": { background: "none", px: 0, py: 0 },
        // headings
        "& h1, & h2, & h3": { mt: 1, mb: 0.5, fontWeight: 600 },
        "& h1": { fontSize: "1.1em" },
        "& h2": { fontSize: "1.0em" },
        "& h3": { fontSize: "0.95em" },
        // bold / italic
        "& strong": { fontWeight: 600 },
        // links
        "& a": {
            color: g.accent.text,
            textDecoration: "underline",
            textUnderlineOffset: "2px",
        },
        // blockquotes
        "& blockquote": {
            borderLeft: `3px solid ${g.border.strong}`,
            pl: 1.5,
            my: 0.5,
            opacity: 0.85,
        },
        // tables (rendered by remark-gfm)
        "& table": {
            borderCollapse: "collapse",
            width: "100%",
            fontSize: "0.9375rem",
            my: 0.75,
        },
        "& th, & td": {
            border: `1px solid ${g.border.default}`,
            px: 1,
            py: 0.5,
            textAlign: "left",
        },
        "& th": {
            fontWeight: 600,
            background: g.hover,
        },
        // horizontal rule
        "& hr": {
            border: "none",
            borderTop: `1px solid ${g.border.subtle}`,
            my: 1,
        },
    };
}
