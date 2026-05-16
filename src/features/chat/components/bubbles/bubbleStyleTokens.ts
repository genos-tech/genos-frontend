// Layout constants shared across MessageBubble, ThreadMessageBubble, and
// TaskCommentBubble for the Slack-style "compact" variant. Centralising
// the avatar gutter so a future avatar-size change has one source of
// truth (today the UserAvatar default is 32px and the row uses
// spacing=1.5 → 12px gap).

export const COMPACT_BODY_INDENT = 44;

export const COMPACT_TOOLBAR_OFFSET = {
    top: 4,
    right: 8,
};

// Unified palette across all three bubble surfaces (MessageBubble,
// ThreadMessageBubble, TaskCommentBubble). The `focused` GREEN is a
// deliberate functional carve-out for deep-link targets — keep it
// distinct from brand purple. `threadActive` is brighter purple and is
// only used by MessageBubble (root message of an open thread).
export const BUBBLE_COLORS = {
    sent: {
        dark: { bg: "#3b0764", border: "#7c3aed", text: "#f3e8ff" },
        light: { bg: "#f5f3ff", border: "#c4b5fd", text: "#3b0764" },
    },
    received: {
        dark: { bg: "#1f2937", border: "#374151", text: "#f3f4f6" },
        light: { bg: "#ffffff", border: "#e5e7eb", text: "#111827" },
    },
    focused: {
        dark: { bg: "#14532d", border: "#22c55e", text: "#dcfce7" },
        light: { bg: "#dcfce7", border: "#22c55e", text: "#14532d" },
    },
    threadActive: {
        dark: { bg: "#4c1d95", border: "#a78bfa", text: "#f3e8ff" },
        light: { bg: "#ede9fe", border: "#a78bfa", text: "#3b0764" },
    },
} as const;
