export const spotlight = {
    placeholder: {
        askBusy: "Wait for the current answer to finish…",
        aiOff: "Search chats, tasks, notes (AI answers off)",
        followUp: "Ask a follow-up — or click ‘Back to search’ to start over",
        default: "Search chats, tasks, notes — press Enter to ask Genos",
    },
    actions: {
        ask: "Ask",
        cancel: "Cancel",
        approve: "Approve",
        reject: "Reject",
        copyAnswer: "Copy answer",
        feedbackUp: "Good answer",
        feedbackDown: "Needs work",
        retry: "Ask again",
        showLess: "Show less",
        moreCount: "+{count} more",
        backToSearch: "Back to search",
    },
    states: {
        searching: "Searching…",
        thinking: "Thinking…",
        streaming: "streaming…",
        awaitingApproval: "awaiting your approval",
        untitled: "(untitled)",
    },
    empty: {
        initial: "Start typing to search across chats, tasks, and notes.",
        noMatches: "No matches yet — try different keywords.",
    },
    // One-click starter questions, shown under the Genos page's empty
    // input. An empty box is a dead end for a first-time visitor: nothing
    // on the page says what Genos can be *asked* (as opposed to searched),
    // so the placeholder's "press Enter to ask" goes unread and the visitor
    // may never ask anything at all.
    //
    // Deliberately generic — no project, person or product name. Unlike
    // `demoPage.spotlight.groups[].prompts`, which are pinned verbatim to
    // the seeded demo content, these fire against whatever workspace the
    // viewer is in, including a brand-new one, and a starter that returns
    // nothing is worse than no starter. Each also demonstrates a different
    // capability — catch-up, retrieval-with-rationale, triage — rather than
    // three rephrasings of "search".
    //
    // `items` is an array, and `deepMerge` replaces arrays wholesale, so a
    // locale may ship any number of starters (including none) without
    // half-translated output. The renderer reads `.length`, so nothing here
    // assumes three.
    starters: {
        label: "Try asking",
        items: [
            "What happened in my projects this week?",
            "What did we decide about our current priorities, and why?",
            "What's blocked right now, and who owns it?",
        ],
    },
    filter: {
        ariaLabel: "Filter results by service",
        label: "Filters",
        chat: "Chats",
        task: "Tasks",
        note: "Notes",
        todo: "Todos",
        // Filters to the collected past-Genos-answer lane (entity type
        // spotlight_answer); "Genos answers" is the user-facing branding.
        answer: "Genos answers",
        // Project scope picker, sitting right after the service chips.
        // A dropdown rather than more chips — a team can have dozens of
        // projects.
        projectAriaLabel: "Filter results by project",
        projectPlaceholder: "All projects",
        projectScopeLabel: "in",
        // Clears the whole project selection in one click. Shows the
        // count because the picker collapses its tags to "+N".
        projectClear: "{count, plural, one {# project ×} other {# projects ×}}",
        // Shown on Todos / Genos answers while a project is scoped —
        // neither carries a project, so the combination can only ever
        // return nothing.
        projectScopeIncompatible: "Not available when filtering by project",
    },
    mentions: {
        ariaLabel: "Mention suggestions",
    },
    errors: {
        noTeam: "No team selected.",
        searchFailed: "Search failed. Please try again.",
        enableAiHint: "Enable AI answers in Settings",
    },
    conversation: {
        header: "AI conversation",
        turnCount: "{count, plural, one {# turn} other {# turns}}",
        backToSearchTooltip: "Clear this conversation and return to the search view",
        turnLabelQ: "Q",
        turnLabelA: "A",
        answeredIn: "Answered in {duration}",
    },
    history: {
        header: "History",
        detailHeader: "Past conversation",
        openTooltip: "View past conversations",
        closeTooltip: "Close history",
        backToList: "All conversations",
        backToListTooltip: "Back to the history list",
        loading: "Loading history…",
        empty: "No past conversations yet.",
        loadFailed: "Couldn’t load this conversation.",
        turnCount: "{count, plural, one {# turn} other {# turns}}",
        relativeJustNow: "just now",
        relativeMinutes: "{count, plural, one {# minute ago} other {# minutes ago}}",
        relativeHours: "{count, plural, one {# hour ago} other {# hours ago}}",
        relativeDays: "{count, plural, one {# day ago} other {# days ago}}",
        readOnlyHint: "Read-only — start a new conversation to ask a follow-up.",
    },
    settings: {
        title: "Spotlight settings",
        openTooltip: "Spotlight settings — AI effort & answers",
    },
    approval: {
        titleWithTool: "Approval required: {toolName}",
    },
    entitySubtitle: {
        dm: "Direct message",
        gm: "Group chat",
        mdm: "Multi-DM",
        pm: "Project chat",
        chatFallback: "Chat",
        task: "Task",
        milestone: "Milestone",
        project: "Project",
        previousAnswer: "Previous answer",
        todo: "Todo",
        todoWithDate: "Todo · {date}",
        notePersonal: "My note",
        // Same backend type as notePersonal — the space comes from the
        // sidebar, not the note. See `personalNoteScopes`.
        noteTeam: "Team note",
        noteShared: "Shared note",
        noteTask: "Task note",
        noteChat: "Chat note",
        noteFallback: "Note",
    },
    badges: {
        thread: "Thread",
        comment: "Comment",
    },
    chip: {
        taskComment: "{subtitle} {id} comment{sep}",
        taskPlain: "{subtitle} {id}{sep}",
        milestone: "{subtitle}{sep}",
        chatThread: "{subtitle} thread{sep}",
        chatPlain: "{subtitle}{sep}",
        noteThread: "{subtitle} (thread){sep}",
        notePlain: "{subtitle}{sep}",
        projectPlain: "{subtitle}{sep}",
        todo: "{subtitle}{sep}",
    },
} as const;
