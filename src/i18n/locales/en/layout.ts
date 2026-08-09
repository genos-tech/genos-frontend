export const layout = {
    // Mobile account sheet (MobileAccountSheet.tsx) — the phone's only
    // route to what the desktop sidebar holds. The sign-out confirm text
    // is shared with the sidebar under `sidebar.signOutConfirm`.
    mobileAccount: {
        switchTeam: "Switch team",
        settings: "Settings",
        darkMode: "Dark mode",
        lightMode: "Light mode",
        signOut: "Sign out",
    },
    mobile: {
        close: "Close",
        openGenos: "Open Genos",
    },
    pageNotFound: {
        title: "Page Not Found",
        body: "The page you're looking for doesn't exist or has been moved to a new location.",
        backHome: "Back to Home",
    },
    serviceSwitcher: {
        inbox: "Inbox",
        chats: "Chats",
        tasks: "Tasks",
        notes: "Notes",
        // Key name mirrors sidebar.nav.search (the "Genos" label).
        search: "Genos",
        hintMac: "Hold ⌘  ·  Tap Ctrl to cycle  ·  Release ⌘ to switch",
        hintOther: "Hold Alt  ·  Tap Ctrl to cycle  ·  Release Alt to switch",
    },
} as const;
