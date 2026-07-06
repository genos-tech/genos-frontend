// Copy for the public "/features-guide" page (linked from the landing page).
// English is the base dictionary; other locales fall back to these values.
export const featuresPage = {
    meta: {
        backToHome: "Back to home",
        tryDemo: "Try the demo",
    },
    hero: {
        badge: "Product guide",
        title: "Everything you can do in Genos",
        lead: "Genos is a connected workspace that keeps your team's chat, tasks, and notes in one place — and makes them searchable by Genos AI. New here? Start with “How to use”, then explore the features and the shortcuts that make it fast.",
    },
    gettingStarted: {
        eyebrow: "How to use",
        title: "Getting started in four steps",
        lead: "The essentials for your first session. You can try Genos in your browser without installing anything.",
        steps: [
            {
                title: "Open Genos and sign in",
                body: "Genos runs in any modern browser — no install needed. Sign in, or try it out first; create an account when you want your work to persist.",
            },
            {
                title: "Join a team and workspace",
                body: "Your work lives inside a team. Pick or create one, invite teammates, and you're ready to collaborate in shared chats, tasks, and notes.",
            },
            {
                title: "Move between the four services",
                body: "Genos is organized into Inbox, Chat, Tasks, and Notes. Switch between them from the sidebar, or hold ⌘ and tap Ctrl to flip through them instantly.",
            },
            {
                title: "Capture work and let AI connect it",
                body: "Discuss in Chat, break work into Tasks, and write specs in Notes. Then press ⌘K to search everything at once or ask Genos AI a question.",
            },
        ],
    },
    features: {
        eyebrow: "Major features",
        title: "What Genos can do",
        lead: "The core building blocks your team works in every day.",
        items: {
            chat: {
                title: "Chat",
                desc: "Real-time messaging for the whole team, with the context that AI can read later.",
                bullets: [
                    "Channels, direct messages, and group chats",
                    "Threads and replies to keep discussions focused",
                    "@mentions, mention groups, and emoji reactions",
                    "File and image attachments, plus shared Google Meet links",
                ],
            },
            tasks: {
                title: "Tasks",
                desc: "Plan and track work across sprints, from a quick list to a full project view.",
                bullets: [
                    "Table, Kanban sprint board, and dashboard views",
                    "Dependencies, subtasks, sprints, and milestones",
                    "Tags and projects to organize everything",
                    "A visual task diagram of how work connects",
                ],
            },
            notes: {
                title: "Notes",
                desc: "Write specs, meeting notes, and PRDs together, linked to the work they describe.",
                bullets: [
                    "Rich block editor with a slash menu",
                    "Real-time collaborative editing and autosave",
                    "Version history you can view and restore",
                    "Personal, task, and chat notes in a nested tree",
                ],
            },
            inbox: {
                title: "Inbox",
                desc: "One place to catch up on what needs your attention.",
                bullets: [
                    "Requests and Activities tabs",
                    "Unread and pending-request counts at a glance",
                ],
            },
            calendar: {
                title: "Calendar",
                desc: "See your schedule without leaving your work.",
                bullets: ["Compact calendar you can open anywhere", "Month and Timeline views"],
            },
            integrations: {
                title: "Integrations",
                desc: "Connect the tools your team already uses.",
                bullets: [
                    "Google Calendar to bring in your events",
                    "GitHub to link pull requests to tasks with live status",
                ],
            },
            spotlight: {
                title: "Spotlight AI",
                desc: "Search everything and ask Genos AI — from one keyboard shortcut.",
                bullets: [
                    "Instant search across chats, tasks, and notes",
                    "“Ask AI” answers with citations to the source",
                    "AI actions that pause for your approval",
                    "Multi-turn conversations with history",
                ],
            },
        },
    },
    shortcuts: {
        eyebrow: "Shortcuts",
        title: "Keyboard shortcuts",
        platformNote: "On macOS use ⌘; on Windows and Linux use Alt in its place.",
        keysHeader: "Shortcut",
        actionHeader: "What it does",
        items: [
            { keys: "⌘K", label: "Open Spotlight AI search" },
            {
                keys: "Hold ⌘ + tap Ctrl",
                label: "Cycle Inbox → Chat → Tasks → Notes (Shift reverses)",
            },
            { keys: "Ctrl + ⌘ + T", label: "Open Tasks and start a new task" },
            { keys: "Ctrl + ⌘ + N", label: "Open Notes and create a new note" },
            { keys: "Ctrl + ⌘ + C", label: "Open the Calendar" },
            { keys: "Ctrl + ⌘ + M", label: "Generate a Google Meet link and copy it" },
            { keys: "Ctrl + ⌘ + H", label: "Toggle History of recently opened items" },
            { keys: "Ctrl + ⌘ + G", label: "Open the task diagram for the current task" },
            {
                keys: "↑ / ↓, Enter",
                label: "In Spotlight: move through results, then open or ask",
            },
        ],
    },
    tricks: {
        eyebrow: "Tips & tricks",
        title: "Get more out of Genos",
        items: [
            {
                title: "Slash commands",
                desc: "Type “/” in any editor to insert headings, lists, and more without leaving the keyboard.",
            },
            {
                title: "Mentions and mention groups",
                desc: "Type “@” to notify a person or a whole group; click a mention to open their profile.",
            },
            {
                title: "Hashtags",
                desc: "Type “#” to tag and organize your writing with quick suggestions.",
            },
            {
                title: "Reactions",
                desc: "React to any message or task comment with an emoji to acknowledge without a reply.",
            },
            {
                title: "Drag and drop",
                desc: "Drag cards on the Kanban board, reorder the task table, and rearrange nodes in the task diagram.",
            },
            {
                title: "Ask a thread or note",
                desc: "Ask Genos AI about a specific chat thread or note, and save the answer straight into your notes.",
            },
            {
                title: "Notifications your way",
                desc: "Mute specific conversations, tune categories, and enable push so you only hear what matters.",
            },
        ],
    },
    footerCta: {
        title: "Ready to try it?",
        body: "Open Genos in your browser and start connecting your team's work.",
        button: "Try the demo",
    },
} as const;
