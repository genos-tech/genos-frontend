// Strings for the "Ask about this note" modal launched from
// NoteHeaderActions. Mirrors the threadAsk namespace; "thread" → "note"
// throughout. See features/noteAsk/.

export const noteAsk = {
    headerButton: {
        label: "Ask",
        tooltip: "Ask AI about this note",
    },
    modal: {
        title: "Ask about this note",
        close: "Close",
    },
    summary: {
        loading: "Summarising note…",
        regenerating: "Refreshing summary…",
        sectionTitle: "Summary",
        refresh: "Refresh summary",
        updatedJustNow: "updated just now",
        updatedMinutes:
            "{count, plural, one {updated # minute ago} other {updated # minutes ago}}",
        updatedHours: "{count, plural, one {updated # hour ago} other {updated # hours ago}}",
        updatedDays: "{count, plural, one {updated # day ago} other {updated # days ago}}",
        empty: "This note doesn't have any content yet.",
        stale: {
            banner: "The note was updated since this summary was generated.",
            refreshAction: "Refresh summary",
        },
    },
    conversation: {
        header: "Follow-up Q&A",
        empty: "Ask a follow-up below — the AI has the note summary above as context.",
        turnLabelQ: "Q",
        turnLabelA: "A",
        placeholder: "Ask anything about this note…",
        send: "Send",
        cancel: "Cancel",
        clear: "Clear conversation",
    },
    mentions: {
        ariaLabel: "Mention suggestions",
    },
    states: {
        streaming: "streaming…",
        thinking: "Thinking…",
    },
    actions: {
        approve: "Approve",
        reject: "Reject",
        copyAnswer: "Copy answer",
        copied: "Copied",
        retry: "Ask again",
    },
    approval: {
        // `{toolName}` is replaced with the write tool the agent
        // proposed (e.g. "create_task", "add_comment").
        titleWithTool: "Approval required: {toolName}",
    },
    errors: {
        loadFailed: "Couldn't load the note summary.",
        retry: "Retry",
        forbidden: "You don't have access to this note.",
    },
} as const;
