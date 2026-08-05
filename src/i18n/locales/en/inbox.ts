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
    tabs: {
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
    },
    // A reminder that has come due (item_type 9). The card is written from
    // the reader's side — they asked for this, so it says so.
    messageReminder: {
        headline: "You asked to be reminded about this message.",
        headlineFrom: "You asked to be reminded about {name}'s message.",
        openMessage: "Open message",
        openInNamed: "Open in {chat}",
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
    footer: {
        tagline: "Keep your inbox tidy",
    },
    notification: {
        approvalBody: "Request has been approved to join the {target}: ",
    },
    requestTargets: {
        team: "team",
        project: "project",
    },
} as const;
