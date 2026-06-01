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
            // Fine-grained mention sub-categories (registry-driven).
            mentionChat: "In a chat message",
            mentionThread: "In a thread reply",
            mentionTaskBody: "In a task description",
            mentionTaskComment: "In a task comment",
            mentionNoteMy: "In My Notes",
            mentionNoteTask: "In a task note",
            mentionNoteChat: "In a chat note",
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
            mutedTargetsHeading: "Muted items ({count})",
            noMutedTargets:
                "No muted items. Mute a specific thread, task, or note from its header or ⋮ menu.",
            unmuteAriaLabel: "Unmute {name}",
            // Labels for the per-object mute list, by target type.
            targetTypeLabels: {
                chat: "Chat",
                thread: "Thread",
                task: "Task",
                note: "Note",
            },
            categoryDescriptions: {
                chats: "Direct messages, group chats, and project chat messages.",
                threadReplies: "Replies posted under any message you can see.",
                mentions: "When someone @-mentions you anywhere.",
                taskComments: "New comments on tasks you participate in.",
                inbox: "Join requests, approvals, and other inbox items.",
                // Fine-grained mention sub-category descriptions.
                mentionChat: "When someone @-mentions you in a chat message.",
                mentionThread: "When someone @-mentions you in a thread reply.",
                mentionTaskBody: "When someone @-mentions you in a task description.",
                mentionTaskComment: "When someone @-mentions you in a task comment.",
                mentionNoteMy: "When someone @-mentions you in My Notes.",
                mentionNoteTask: "When someone @-mentions you in a task note.",
                mentionNoteChat: "When someone @-mentions you in a chat note.",
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
            // Used when the activity comes from the project's system
            // user (the PM bot) — saying "{projectName} mentioned you
            // in Project • {projectName}" reads as a duplicate.
            mentionTitleByBot: "Mentioned you in {subjectLabel}",
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
