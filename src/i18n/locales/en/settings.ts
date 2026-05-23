export const settings = {
    title: "Settings",
    tabs: {
        general: "General",
        chat: "Chat",
        tasks: "Tasks",
        spotlight: "Spotlight",
        notifications: "Notifications",
        mentionGroups: "Mention groups",
        shortcuts: "Shortcuts",
        integrations: "Integrations",
    },
    appearance: {
        heading: "Appearance",
        description:
            'Choose how the app looks. "System" follows your OS theme and updates automatically when it changes.',
        themeLabel: "Theme",
        themeHelper: "Applies immediately and persists across sessions.",
        themeLight: "Light",
        themeDark: "Dark",
        themeSystem: "System",
    },
    messageLayout: {
        heading: "Message layout",
        description:
            "Bubble: flexible-width balloons aligned by author (current). Compact: full-width squared rows with author on the left (Slack-style).",
        styleLabel: "Style",
        styleHelper: "Applies immediately to chat, threads, and task comments.",
        styleBubble: "Bubble",
        styleCompact: "Compact",
    },
    doubleClickTodo: {
        heading: "Double-click action",
        description: "Choose what happens when you double-click a message bubble.",
        toggleLabel: "Add message to To-Do on double-click",
        toggleHelper:
            "Turn this off to use double-click for selecting text instead. Applies to chat messages, thread messages, and task comments.",
    },
    spotlight: {
        heading: "Spotlight",
        description:
            "Spotlight always searches your chats, tasks, and notes. The toggles below gate the optional LLM-powered answers, which count against your daily ask quota.",
        aiAnswersLabel: "AI answers",
        aiAnswersHelper:
            'Lets the "Ask" button send your query to the agent. When off, Spotlight returns search results only.',
        webSearchLabel: "Web search",
        webSearchHelper:
            "Allow the agent to browse the web when answering. Requires AI answers to be on.",
    },
    privacy: {
        heading: "Privacy & analytics",
        description:
            "Helps us understand which features get used so we can focus on the right things.",
        shareLabel: "Share anonymous usage data",
        shareHelper:
            "Sends your user ID, team, and role plus the pages you visit. No message content, no clicks tracked. Turn off to opt out completely.",
    },
    shortcuts: {
        heading: "Keyboard shortcuts",
        global: {
            title: "Global",
            description:
                "Available anywhere. The letter shortcuts now compose navigation with a creation action; the cycle gesture works like the macOS Cmd+Tab switcher.",
            rows: {
                spotlight: "Open Spotlight search",
                tasksNew: "Open Tasks and start a new task",
                notesNew: "Open Notes and create a new My Note",
                calendar: "Open compact calendar",
                meetClipboard: "Copy a fresh Meet link to clipboard",
                openHistory: "Open history",
                openTaskDiagram: "Open task graph for the previewed task",
                cycle: "Cycle through services",
            },
            cycleCombo: {
                hold: "Hold ⌘",
                tap: "Tap Ctrl to cycle",
                release: "Release ⌘ to switch",
            },
        },
        chat: {
            title: "Chat",
            description:
                "Active while a chat surface is mounted. Editable text fields keep platform text-selection shortcuts.",
            rows: {
                switchTab: "Switch chat tab",
                moveSelection: "Move selection in chat list",
                openThread: "Open thread of a message",
            },
            clickMessage: "Click message",
        },
    },
    language: {
        heading: "Language",
        description: "Choose the language used throughout the app.",
        label: "Language",
        helper: "Some translations may be incomplete; missing values fall back to English.",
        english: "English",
        japanese: "日本語",
        spanish: "Español",
        french: "Français",
        chinese: "中文",
        arabic: "العربية",
        hindi: "हिन्दी",
    },
    autoCloseOnPrMerge: {
        heading: "Auto-close on PR merge",
        description:
            "When a GitHub PR is merged, automatically close the task whose ID is in the PR's head branch name (e.g. branch `feature/GEN-42-foo` closes task GEN-42). Only fires for tasks you are assigned to.",
        toggleLabel: "Close my tasks when their PR merges",
        toggleHelper:
            "Disabled by default. Branch must follow the convention `…<TASK-ID>…` for the match to fire.",
    },
    autoSyncCalendar: {
        heading: "Auto-sync to Google Calendar",
        description:
            "Automatically add tasks with due dates to your Google Calendar as all-day events. One-way: deleting an event on Google won't affect your tasks.",
        toggleLabel: "Auto-sync task due dates",
        toggleHelper:
            "Off by default. Only tasks assigned to you sync. Past-due tasks are skipped on backfill.",
        connectPrompt: "Connect Google Calendar in Integrations to enable this.",
        grantPrompt: "Calendar access hasn't been granted yet — grant it to enable auto-sync.",
        grantButton: "Grant Calendar access",
        backfillButton: "Sync existing tasks now",
        backfillRunning: "Syncing…",
        backfillSuccess: "Synced {total} task(s) ({created} new, {patched} updated).",
        backfillSuccessWithCleared:
            "Synced {total} task(s) ({created} new, {patched} updated). Cleared {cleared} stale link(s) — events deleted on Google were NOT re-created.",
        backfillOnlyCleared:
            "Cleared {cleared} stale link(s) — events were deleted on Google. Per the never-re-create rule, no new events were posted.",
        backfillUpToDate: "Already up to date — no tasks needed syncing.",
        backfillFailed: "Backfill failed. Try again.",
    },
    taskSort: {
        heading: "Task sort",
        description:
            "Pick up to two sort keys for each surface. The primary key sorts first; the secondary key breaks ties. Applies immediately and persists across sessions.",
        sprintBoardLabel: "Board",
        sprintBoardHelper:
            "Cards within each column are sorted by these keys. Default leaves the order as the filter pipeline produced it.",
        tableLabel: "Task table",
        tableHelper:
            "Column-header clicks override the primary key (and toggle direction). The secondary key is preserved.",
        primaryLabel: "Primary",
        secondaryLabel: "Secondary",
        fieldNone: "None",
        directionAsc: "Ascending",
        directionDesc: "Descending",
    },
} as const;
