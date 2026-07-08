export const sidebar = {
    nav: {
        inbox: "Inbox",
        chats: "Chats",
        tasks: "Tasks",
        notes: "Notes",
        integrations: "Integrations",
        // Label for the Spotlight launcher in the sidebar. Spotlight is the
        // AI-agent entry point that does far more than search, so it carries
        // the product name rather than "Search". (Key kept as `search` to
        // avoid a cross-locale rename.)
        search: "Genos",
    },
    tooltips: {
        settings: "Settings",
        signOut: "Sign out",
        openProfile: "Open My Profile",
        switchServiceMac: "Hold ⌘ + tap Ctrl",
        switchServiceOther: "Hold Ctrl + tap Alt",
        // Per-service letter shortcuts surfaced in sidebar tooltips.
        // Split per platform so the consumer can pick via `isMac()`.
        // Mirrors bindings in `useGlobalServiceShortcut`. Inbox/Chats
        // intentionally have no letter shortcut — they're cycle-only.
        spotlightShortcut: { mac: "⌘+K", windows: "Ctrl+K" },
        tasksShortcut: { mac: "Ctrl+⌘+T", windows: "Ctrl+Alt+T" },
        notesShortcut: { mac: "Ctrl+⌘+N", windows: "Ctrl+Alt+N" },
        historyShortcut: { mac: "History · Ctrl+⌘+H", windows: "History · Ctrl+Alt+H" },
    },
    signOutConfirm: {
        title: "Sign out of this workspace?",
        body: "You'll need to sign in again to come back. Any unsent drafts on this device will be cleared.",
        cancel: "Cancel",
        confirm: "Sign out",
    },
} as const;
