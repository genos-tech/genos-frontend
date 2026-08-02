export const sidebar = {
    nav: {
        inbox: "Inbox",
        chats: "Chats",
        tasks: "Tasks",
        notes: "Notes",
        // Mobile-only: the BottomTabBar's Account tab (opens the account
        // sheet). The desktop sidebar has no equivalent nav entry.
        account: "Account",
        integrations: "Integrations",
        // Label for the Genos page entry in the sidebar. The AI-agent
        // surface does far more than search, so it carries the product
        // name rather than "Search". (Key kept as `search` to avoid a
        // cross-locale rename; the button navigates to /workspace/genos,
        // while Cmd/Ctrl-K still opens the quick-ask overlay.)
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
        // On the Genos button: it navigates to the page; the shortcut
        // hint stays because ⌘/Ctrl+K opens the quick-ask overlay from
        // anywhere else.
        spotlightShortcut: { mac: "Quick ask · ⌘+K", windows: "Quick ask · Ctrl+K" },
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
