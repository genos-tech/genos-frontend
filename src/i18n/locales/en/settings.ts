export const settings = {
    title: "Settings",
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
    taskSort: {
        heading: "Task sort",
        description:
            "Default ordering for the sprint board columns and the task table. Applies immediately and persists across sessions.",
        sprintBoardLabel: "Sprint board",
        sprintBoardHelper:
            "Same selector lives in the board toolbar — changes in either place stay in sync.",
        tableLabel: "Task table",
        tableHelper:
            "Clicking a column header still re-sorts the table; that choice persists too.",
        tablePresetPriorityDesc: "Priority — High to Low",
        tablePresetDueDateAsc: "Due date — Earliest first",
        tablePresetStatusAsc: "Status — Active first",
        tablePresetUpdatedAtDesc: "Last updated — Recent first",
        tablePresetCreatedDateDesc: "Created — Recent first",
        tablePresetIdAsc: "ID — Ascending",
        tablePresetCustom: "Custom (column-driven)",
    },
} as const;
