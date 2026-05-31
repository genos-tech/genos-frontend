export const calendar = {
    title: "Calendar",
    today: "Today",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    close: "Close",
    more: "more",
    connectPrompt: "Connect Google Calendar to see your events here.",
    connectButton: "Connect Google",
    scopePrompt: "Calendar access hasn't been granted yet. Grant it to read and manage events.",
    grantButton: "Grant Calendar access",
    reauthPrompt:
        "Your Google Calendar connection expired. Reconnect to see and manage your events.",
    reconnectButton: "Reconnect Google Calendar",
    openTooltip: "Open calendar",
    // Keyboard chord for the global shortcut handled by
    // `useGlobalServiceShortcut` (letter "C" + the platform modifier
    // set returned by `getServiceShortcutModifierKeys`). Split per
    // platform so the tooltip composer can pick the right one at
    // render time. Symbols (Ctrl, ⌘, Alt, +) are universal across
    // locales — no translation needed.
    openShortcut: {
        mac: "Ctrl+⌘+C",
        windows: "Ctrl+Alt+C",
    },
    prev: "Previous",
    next: "Next",
    views: {
        month: "Month",
        week: "Week",
        threeDay: "3 days",
        day: "Day",
    },
    allDay: "All day",
    nowLabel: "Now",
    attendees: {
        label: "Invite teammates",
        placeholder: "Search by name or email…",
        noResults: "No teammates match.",
        emptyState: "No one invited yet.",
        helperText:
            "Invitees see this event on their Google Calendar. We don't send Google email invites — the chat handles notifications.",
    },
} as const;
