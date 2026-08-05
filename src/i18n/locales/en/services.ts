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
    // Install-to-home-screen banner (InstallBanner.tsx). `iosBody` is the
    // no-prompt path: iOS has no install API, so the affordance is
    // instructions — and installing is also what enables push there.
    pwaInstall: {
        title: "Install Genos",
        body: "Add Genos to your home screen for quick access and reliable notifications.",
        install: "Install",
        iosBody:
            "Tap the Share button and choose “Add to Home Screen”. On iOS, notifications only work in the installed app.",
        // iOS-only: no install API exists there, so the banner's action
        // opens a step-by-step dialog instead of prompting.
        how: "How?",
        howTitle: "Install Genos on your iPhone",
        howStep1: "Tap the Share button in Safari's toolbar.",
        howStep2: "Scroll down and choose “Add to Home Screen”.",
        howNote:
            "Then open Genos from your home screen, sign in, and allow notifications there — iOS only delivers them to the installed app.",
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
            agentRunDone: "AI answer ready",
            messageReminder: "Message reminders",
        },
        // Email-channel category labels (emailCategories.ts). These use
        // the SERVER's coarser vocabulary — one "mention_task" where the
        // in-app registry splits body/comment — so they get their own
        // label set rather than reusing `categories` above.
        emailCategories: {
            mentionChat: "Mentions in chat",
            mentionThread: "Mentions in threads",
            mentionTask: "Mentions in tasks",
            mentionNote: "Mentions in notes",
            threadReplies: "Thread replies",
            taskComments: "Task comments",
            inbox: "Requests & notices",
            chats: "Every chat message",
            reactions: "Reactions",
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
            // Proactive digest (UX tier model §8) — server-backed
            // opt-out; whether/how often it fires comes from the plan.
            digestHeading: "Genos digest",
            digestDescription:
                "A short personal digest from Genos, delivered to your inbox (weekly on Pro, daily on Max).",
            // Email channel (independent of push/in-app; sent only after
            // you've been away for a while, batched into one email).
            emailHeading: "Email notifications",
            emailDescription:
                "When you're away, Genos emails you what you missed — batched, never one email per event.",
            emailDigestHeading: "Daily email digest",
            emailDigestDescription:
                "One morning email at 8am your time summarizing what you haven't seen — sent only when there's something new.",
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
                agentRunDone:
                    "When an AI answer finishes after you've closed the Spotlight, thread, or note window.",
                messageReminder:
                    "When a reminder you set on a message comes due. Turning this off keeps the reminder in your inbox without a notification.",
            },
        },
        // Completion notice for an agent run that finished while its
        // surface was closed (`agentRunNotice.ts`). `{query}` is the
        // user's own question, truncated client-side.
        agentRun: {
            doneTitle: "Your AI answer is ready",
            failedTitle: "Your AI answer didn't finish",
            body: "{query}",
            bodyNoQuery: "Reopen to read the full answer.",
            surfaceSpotlight: "Spotlight",
            surfaceThread: "Ask about this thread",
            surfaceNote: "Ask about this note",
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
            inboxTitleNoteAccess: "Note access request",
            inboxTitleOwnershipClaim: "Team ownership requested",
        },
    },
} as const;
