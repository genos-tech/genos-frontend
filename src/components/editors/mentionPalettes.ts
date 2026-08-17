// Per-entity color palettes for every mention/hash surface — the ONE
// source of truth for "what color is a task vs a note vs a user".
//
// Extracted here (away from Mention.tsx / HashMention.tsx) because those
// files value-import `@blocknote/react` (the heavy editor runtime), and
// the agent-input mention dropdown — which is in Spotlight's initial
// entry chunk — needs these colors WITHOUT dragging BlockNote into that
// chunk. This module imports nothing, so any surface can read the
// palettes for free. Mention.tsx / HashMention.tsx re-export them so
// their existing consumers (e.g. LightMessageBody) are unchanged.
//
// A `MentionPalette` is a translucent background (`bg`), a stronger
// hover/underline background (`bgHover`), and a solid `text`/icon color.
// Colors are the app-wide entity identity colors, so a `#task` reads blue
// in a message body, in the BlockNote `#` menu, and in the agent
// dropdown alike — change a color here and every surface moves together.
export type MentionPalette = { bg: string; bgHover: string; text: string };

// ── User / group (`@` mentions) ──────────────────────────────────────────
// The "self" variant is a UX signal — when *you* are mentioned, the chip
// pops with a different color so the eye lands on it while scanning a long
// message list.
export const USER_SELF_PALETTE: MentionPalette = {
    bg: "rgba(245, 158, 11, 0.18)",
    bgHover: "rgba(245, 158, 11, 0.32)",
    text: "#d97706",
};
export const USER_OTHER_PALETTE: MentionPalette = {
    bg: "rgba(236, 72, 153, 0.15)",
    bgHover: "rgba(236, 72, 153, 0.28)",
    text: "#db2777",
};
export const GROUP_PALETTE: MentionPalette = {
    bg: "rgba(34, 197, 94, 0.15)",
    bgHover: "rgba(34, 197, 94, 0.28)",
    text: "#16a34a",
};

// ── Entities (`#` mentions) ──────────────────────────────────────────────
export const TASK_PALETTE: MentionPalette = {
    bg: "rgba(59, 130, 246, 0.15)",
    bgHover: "rgba(59, 130, 246, 0.28)",
    text: "#2563eb",
};
// Milestone rows read as their own kind, not a task — the orange
// milestone identity color used across the app (task table flag icon,
// diagram node, Spotlight milestone chip).
export const MILESTONE_PALETTE: MentionPalette = {
    bg: "rgba(249, 115, 22, 0.15)",
    bgHover: "rgba(249, 115, 22, 0.28)",
    text: "#ea580c",
};
export const NOTE_PALETTE: MentionPalette = {
    bg: "rgba(var(--gp-brandalt-500-rgb), 0.15)",
    bgHover: "rgba(var(--gp-brandalt-500-rgb), 0.28)",
    text: "var(--gp-brand-700)",
};
export const CHAT_PALETTE: MentionPalette = {
    bg: "rgba(20, 184, 166, 0.15)",
    bgHover: "rgba(20, 184, 166, 0.28)",
    text: "#0d9488",
};
export const PROJECT_PALETTE: MentionPalette = {
    bg: "rgba(245, 158, 11, 0.15)",
    bgHover: "rgba(245, 158, 11, 0.28)",
    text: "#d97706",
};
// Todo has no BlockNote `#` equivalent — it's an agent-dropdown-only kind.
// Brand-violet matches Spotlight's todo identity; the `TaskAltRounded`
// icon (vs the note's sticky-note) keeps it distinct from the sibling
// violet NOTE palette. `text` resolves to the brand var so dark surfaces
// can swap it up the ramp for legibility, same as NOTE.
export const TODO_PALETTE: MentionPalette = {
    bg: "rgba(var(--gp-brand-700-rgb), 0.15)",
    bgHover: "rgba(var(--gp-brand-700-rgb), 0.28)",
    text: "var(--gp-brand-700)",
};

/**
 * A palette's foreground, corrected for a dark ground.
 *
 * The violet palettes (note, todo) resolve `text` to the brand var, which
 * blends into a dark surface — the Spotlight sheet, a dark-mode to-do row —
 * so it swaps up the ramp to the lighter alt stop, the app-wide dark
 * convention (`isDark ? brandalt-400 : brand-700`). Every other palette
 * uses a hardcoded hex that is legible on both grounds and passes through.
 *
 * Lives here rather than in each surface because three of them had grown
 * their own copy of the same substring test.
 */
export const mentionIconColor = (palette: MentionPalette, isDark?: boolean): string =>
    isDark && palette.text.includes("--gp-brand-700") ? "var(--gp-brandalt-400)" : palette.text;
