export const services = {
    agent: {
        notSignedIn: "Not signed in.",
        streamNoBody: "Streaming response has no body.",
        streamEndedUnexpectedly: "The answer stream ended unexpectedly. Please try again.",
        unknownError: "Unknown error",
        networkError: "Network error: {message}",
        serverReturned: "Server returned {status}",
        streamInterrupted: "Stream interrupted: {message}",
        malformedNdjsonLine: "Malformed NDJSON line: {line}",
    },
    notifications: {
        permissionTitle: "Notifications are off",
        permissionBody: "Enable browser notifications to get pinged when something needs you.",
        permissionEnable: "Enable notifications",
        muteToggleTooltip: "Mute/Unmute notifications",
        categories: {
            chats: "Chats",
            threadReplies: "Thread replies",
            mentions: "Mentions",
            taskComments: "Task comments",
            inbox: "Inbox",
        },
        // Top banner (PermissionBanner.tsx) prompting the user to grant
        // browser-notification permission.
        banner: {
            title: "Enable desktop notifications",
            body: "Get notified about new messages, mentions, and inbox updates while the tab is in the background.",
            enable: "Enable",
        },
        // Mute toggle button shown in chat headers.
        muteButton: {
            mute: "Mute notifications",
            unmute: "Unmute notifications",
        },
        // The full settings panel embedded in the Settings modal.
        settings: {
            heading: "Web notifications",
            description:
                "Show desktop notifications when the tab is in the background, or an in-app toast when it's foreground but you're on a different screen.",
            browserPermissionLabel: "Browser permission:",
            allow: "Allow",
            mutedChatsHeading: "Muted chats ({count})",
            noMutedChats: "No muted chats. Use the bell icon in any chat header to mute it.",
            unmuteAriaLabel: "Unmute {name}",
            categoryDescriptions: {
                chats: "Direct messages, group chats, and project chat messages.",
                threadReplies: "Replies posted under any message you can see.",
                mentions: "When someone @-mentions you anywhere.",
                taskComments: "New comments on tasks you participate in.",
                inbox: "Join requests, approvals, and other inbox items.",
            },
        },
        // Display labels for chat-type integers. Two separate maps:
        //   * `routerChatType` is the short label embedded in a notification
        //     title (e.g. "Direct message", "Group", "Project chat") — used
        //     when no chatName is known.
        //   * `settingsChatType` is the long label shown in the muted-chats
        //     panel chip (e.g. "Direct Messages", "Group Messages").
        routerChatType: {
            direct: "Direct message",
            group: "Group",
            groupNamed: "#{name}",
            projectNamed: "Project • {name}",
            project: "Project chat",
            groupDm: "Group DM",
            unknown: "Chat",
        },
        settingsChatType: {
            direct: "Direct Messages",
            group: "Group Messages",
            project: "Project Updates",
            fallback: "Chat {chatType}",
        },
        // Strings used to construct notification title/body lines in
        // `notificationRouter.ts`.
        router: {
            someone: "Someone",
            chatTitleWithLabel: "{senderName} • {chatLabel}",
            threadReplyTitle: "{senderName} replied in {parentLabel}",
            mentionTitle: "{senderName} mentioned you in {subjectLabel}",
            taskCommentTitle: "{senderName} commented on a task",
            activityProjectLabel: "Project • {projectName}",
            inboxFallback: "New inbox item",
            inboxTitleNewActivity: "New activity",
            inboxTitleJoinTeam: "Join team request",
            inboxTitleJoinProject: "Join project request",
            inboxTitleJoinGroup: "Join group request",
        },
    },
} as const;
