export const inbox = {
    title: "Inbox",
    empty: "Your inbox is empty",
    types: {
        joinTeamRequest: "Join team request",
        newActivity: "New activity",
        newInboxItem: "New inbox item",
    },
    actions: {
        markRead: "Mark as read",
        markUnread: "Mark as unread",
        archive: "Archive",
    },
    header: {
        title: "Inbox",
        subtitle: "Stay on top of notifications",
    },
    // The Sync button in the header: fetch what arrived without a socket event to announce it
    // (a report a schedule filed, a reminder).
    sync: {
        label: "Sync inbox",
        upToDate: "Inbox is up to date",
        added: "{count, plural, one {# new item} other {# new items}}",
        failed: "Couldn't sync the inbox. Try again.",
    },
    tabs: {
        ariaLabel: "Inbox sections",
        requests: "Requests",
        activities: "Activities",
    },
    requestTypes: {
        teamRequest: "Team Request",
        projectRequest: "Project Request",
        gmRequest: "GM Request",
        noteAccessRequest: "Note Access",
        ownershipClaim: "Ownership Request",
        digest: "Genos digest",
        teamConnection: "Team Connection",
        externalShare: "Shared With Your Team",
        messageReminder: "Reminder",
        todoReminder: "To-do reminder",
        genosReport: "Genos report",
    },
    // The rich card of a typed report (item_body.version 2, MIP-1208). Section headings and
    // the lines in them come from the server; this is only the card's own chrome.
    report: {
        showMore: "Show {count} more",
        showLess: "Show less",
        emptyTitle: "All clear",
        emptyBody: "Nothing needs your attention right now.",
        daysLate: "{days}d late",
        statComments: "Comments",
        statItems: "Items",
    },
    // What an AI-made item cost and its off switch (MIP-1227). The unit is the one Plan & usage
    // uses: "AI credits". The digest and a report each say what was turned off, in the member's
    // words; the server's own sentence is English-only and is not shown.
    aiUsage: {
        used: "AI credits used: {credits}",
        usedAtLeast: "AI credits used: at least {credits}",
        usedTiny: "AI credits used: less than 0.01",
        unmeasured: "Genos used AI for this. The amount wasn't measured.",
        deductedNone: "None deducted from your balance",
        deducted: "{credits} deducted from your balance",
        scheduleFallback: "This schedule",
        turnOff: "Turn this off",
        turnOffNamed: "Turn this off: {name}",
        turnBackOn: "Turn back on",
        turnBackOnNamed: "Turn back on: {name}",
        undo: "Undo",
        undoNamed: "Undo: turn {name} back on",
        offDigest:
            "{name} is off. No more will be written, and no more AI credits spent on it, until you turn it back on.",
        offSchedule: "{name} is off. It won't run or use AI credits until you turn it back on.",
        alreadyOff: "{name} is already off.",
        restingOff: "{name} is turned off.",
        onAgain: "{name} is on again.",
        gone: "The schedule that made this report no longer exists, so there is nothing to turn off.",
        failed: "That didn't work. Try again in a moment.",
        planNeeded: "Turning this on needs the Core plan or higher.",
    },
    // A reminder that has come due (item_type 9). The card is written from
    // the reader's side — they asked for this, so it says so.
    messageReminder: {
        headline: "You asked to be reminded about this message.",
        headlineFrom: "You asked to be reminded about {name}'s message.",
        openMessage: "Open message",
        openInNamed: "Open in {chat}",
    },
    // The other kind of item_type 9, told apart by `item_optionals.kind`.
    // Same card, different subject: a to-do of the reader's own, quoted
    // under the same preview block.
    todoReminder: {
        headline: "You asked to be reminded about this to-do.",
        openTodo: "Open to-do",
    },
    crossTeam: {
        // Both of these are answered from the card, so the card is where
        // the consequence has to be stated. Approving a connection grants
        // nothing; accepting a share puts the item in your workspace and
        // lets you bring colleagues in afterwards.
        connectionHint: "Connecting shares nothing on its own.",
        shareHint: "Accept to open it, then add your own people to it.",
        failed: "Couldn’t respond. Please try again.",
        // WHERE the thing you just accepted now is. Approving used to leave
        // no trace anywhere a person would look, which made a working
        // feature indistinguishable from a broken one.
        acceptedIn: {
            channel: "It’s in your chat list now.",
            project: "It’s in your project list now.",
            note_folder: "It’s in your Team Notes now.",
        },
        // Fallback chip label when the offered object has no name to show.
        objectKinds: {
            channel: "Chat",
            project: "Project",
            note_folder: "Note folder",
        },
    },
    ownershipClaim: {
        // The card's body already says how many days. This is the date,
        // because the consequence of ignoring THIS request is losing the
        // team — the one inbox item where doing nothing is the decision.
        respondBy: "Respond by {date}, or they can take ownership",
    },
    noteAccess: {
        openNote: "Open note",
        openNoteNamed: "Open “{title}”",
    },
    bubble: {
        approve: "Approve",
        reject: "Reject",
        approved: "Approved",
        rejected: "Rejected",
    },
    section: {
        defaultEmptyTitle: "All caught up!",
        defaultEmptySubtitle: "No new items to review",
    },
    emptyStates: {
        activitiesTitle: "No activities yet",
        activitiesSubtitle: "New updates and notifications will appear here",
        requestsTitle: "No pending requests",
        requestsSubtitle: "Team and project requests will show up here",
    },
    notification: {
        approvalBody: "Your request to join the {target} was approved: ",
    },
    requestTargets: {
        team: "team",
        project: "project",
    },
} as const;
