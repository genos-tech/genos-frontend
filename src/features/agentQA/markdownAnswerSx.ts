// Joy UI `sx` block shared by every surface that renders an LLM
// answer as markdown: the global Spotlight overlay, its read-only
// history archive, and the per-entity Ask modals (thread, notes).
// Centralising it means tweaks to answer typography land in one place.
//
// The consuming `<Box sx={...}>` still owns layout-only props (`mb`,
// `bgcolor` for the summary card, etc.) and merges this style in.

// Dark-mode body-text colour. Re-exported so consumers that share the
// same look (badges, secondary labels) can keep importing from one
// module — no risk of the two drifting apart.
export const DARK_TEXT_STRONG = "#f1e8ff";

export function markdownAnswerSx(isDark: boolean): Record<string, unknown> {
    return {
        lineHeight: 1.65,
        fontSize: "1rem",
        color: isDark ? DARK_TEXT_STRONG : undefined,
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
        "& li::marker": { color: isDark ? "var(--gp-brandalt-400)" : "var(--gp-brand-700)" },
        // nested lists — tighter than top-level
        "& li > ul, & li > ol": { my: 0.25, pl: 2 },
        // code blocks
        "& pre": {
            overflowX: "auto",
            borderRadius: "6px",
            p: 1,
            my: 0.75,
            fontSize: "0.875rem",
            background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
        },
        // inline code
        "& code": {
            fontFamily: "monospace",
            fontSize: "0.85em",
            px: "0.3em",
            py: "0.1em",
            borderRadius: "3px",
            background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
        },
        // reset code-inside-pre so the pre bg shows
        "& pre code": { background: "none", px: 0, py: 0 },
        // headings
        "& h1, & h2, & h3": { mt: 1, mb: 0.5, fontWeight: 700 },
        "& h1": { fontSize: "1.1em" },
        "& h2": { fontSize: "1.0em" },
        "& h3": { fontSize: "0.95em" },
        // bold / italic
        "& strong": { fontWeight: 700 },
        // links
        "& a": {
            color: "primary.500",
            textDecoration: "underline",
            textUnderlineOffset: "2px",
        },
        // blockquotes
        "& blockquote": {
            borderLeft: `3px solid ${isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.18)"}`,
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
            border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`,
            px: 1,
            py: 0.5,
            textAlign: "left",
        },
        "& th": {
            fontWeight: 700,
            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
        },
        // horizontal rule
        "& hr": {
            border: "none",
            borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
            my: 1,
        },
    };
}
