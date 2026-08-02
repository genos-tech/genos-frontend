// Strings for the full-page Genos surface (/workspace/genos).
// The conversation surface itself reuses `spotlight.*` (same
// SpotlightContent component); these cover only the page chrome —
// the session sidebar and its states. Session-row metadata (relative
// times, turn counts) also reuses `spotlight.history.*` so the two
// history surfaces can't drift.
export const genos = {
    // Empty-state hero above the centered input (ChatGPT-style greeting).
    hero: {
        title: "Ask Genos anything",
        subtitle: "Search chats, tasks, and notes — or have Genos do the work.",
    },
    sidebar: {
        // "Ask history" — the list of the user's past agent sessions.
        header: "Ask history",
        newChat: "New chat",
        empty: "No conversations yet. Ask Genos anything to start one.",
        loading: "Loading history…",
        // Toggle for the collapsible sidebar (mobile / narrow widths).
        openLabel: "Show history",
        closeLabel: "Hide history",
        // Shown under the header when a clicked session failed to
        // restore (outside retention, network error).
        resumeFailed: "Couldn't reopen that conversation.",
    },
} as const;
