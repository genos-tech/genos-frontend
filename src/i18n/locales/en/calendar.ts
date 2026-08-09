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
    // Shown instead of "(no title)" for an event on a calendar shared at
    // Google's "See only free/busy (hide details)" level. Google strips
    // the title upstream, so nothing is missing — labelling it
    // "(no title)" reads as a bug on our side rather than the sharing
    // setting working as intended.
    busy: "Busy",
    // Recurring events. Google expands a series server-side, so what the
    // user sees on the grid are individual occurrences of one rule.
    repeat: {
        label: "Repeat",
        every: "Every",
        onDays: "On days",
        ends: "Ends",
        endNever: "Never",
        endOnDate: "On date",
        endAfter: "After",
        occurrences: "occurrences",
        endOnDateHelper: "The last day the event can repeat on (inclusive).",
        // Google falls back to the event's own weekday when no day is
        // ticked, so this is guidance rather than an error.
        noDaysHelper: "Repeats on the same weekday as the event.",
        frequency: {
            none: "Does not repeat",
            daily: "Daily",
            weekly: "Weekly",
            monthly: "Monthly",
            yearly: "Yearly",
        },
        unit: {
            none: "",
            daily: "days",
            weekly: "weeks",
            monthly: "months",
            yearly: "years",
        },
    },
    // Editing or deleting one occurrence of a series vs. the whole
    // thing. Always an explicit choice — guessing either way silently
    // does something the user did not ask for.
    scope: {
        label: "This is a repeating event",
        thisEvent: "This event",
        allEvents: "All events",
        editHelper: "Choose whether your change applies to this occurrence or the whole series.",
        seriesTimingNote:
            "Editing all events won't move the series — change the date on a single occurrence instead.",
    },
    // Multi-account overlay: the side rail that picks which accounts
    // and calendars are drawn on the grid at once.
    sources: {
        title: "Calendars",
        addAccount: "Add Google account",
        showAllFrom: "Show all calendars from this account",
        hideAllFrom: "Hide all calendars from this account",
        // Shown when Google returned no email for a connected account —
        // rare, but the group still needs a heading.
        unknownAccount: "Google account",
        // Marks a calendar someone else shared with the user. They can
        // see it but not create events on it.
        sharedBadge: "Shared",
        emptySelection: "No calendars selected. Tick one to see events.",
        // One source failed while others loaded — shown as a dismissible
        // inline note rather than replacing the whole grid.
        partialFailure: "Some calendars couldn't be loaded.",
        accountReauthNeeded: "{email} needs reconnecting.",
        accountScopeNeeded: "{email} hasn't granted Calendar access.",
    },
    target: {
        label: "Calendar",
        helperText: "Which calendar this event is created on.",
        readOnly: "You can't create events on this calendar.",
    },
    attendees: {
        label: "Invite teammates",
        placeholder: "Search by name or email…",
        noResults: "No teammates match.",
        emptyState: "No one invited yet.",
        helperText:
            "Invitees see this event on their Google Calendar. We don't send Google email invites — the chat handles notifications.",
    },
    event: {
        editTitle: "Edit event",
        newTitle: "New event",
        titleLabel: "Title",
        allDay: "All day",
        startLabel: "Start",
        endLabel: "End",
        inclusiveEndHelper: "Ends on this day (inclusive).",
        descriptionLabel: "Description (optional)",
        addMeet: "Add Google Meet link",
        deleting: "Deleting…",
        confirmDelete: "Confirm delete?",
        deleteAll: "Delete all events?",
        saving: "Saving…",
        requiredError: "Title, start, and end are required.",
        invalidEndError: "End date can't be before the start date.",
    },
} as const;
