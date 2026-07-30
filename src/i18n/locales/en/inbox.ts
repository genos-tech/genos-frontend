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
