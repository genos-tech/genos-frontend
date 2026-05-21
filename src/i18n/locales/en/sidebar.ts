export const sidebar = {
    nav: {
        inbox: "Inbox",
        chats: "Chats",
        tasks: "Tasks",
        notes: "Notes",
        integrations: "Integrations",
        search: "Search",
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
    },
} as const;
