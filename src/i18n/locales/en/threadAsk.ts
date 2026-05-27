// Strings for the "Ask about this thread" modal launched from
// ThreadChatPaneHeader. See features/threadAsk/.

export const threadAsk = {
    headerButton: {
        label: "Ask",
        tooltip: "Ask AI about this thread",
    },
    modal: {
        title: "Ask about this thread",
        close: "Close",
    },
    summary: {
        loading: "Summarising thread…",
        regenerating: "Refreshing summary…",
        sectionTitle: "Summary",
        refresh: "Refresh summary",
        updatedJustNow: "updated just now",
        updatedMinutes:
            "{count, plural, one {updated # minute ago} other {updated # minutes ago}}",
        updatedHours: "{count, plural, one {updated # hour ago} other {updated # hours ago}}",
        updatedDays: "{count, plural, one {updated # day ago} other {updated # days ago}}",
        empty: "This thread doesn't have any messages yet.",
        stale: {
            banner: "New messages have arrived in this thread.",
            refreshAction: "Refresh summary",
        },
    },
    conversation: {
        header: "Follow-up Q&A",
        empty: "Ask a follow-up below — the AI has the thread summary above as context.",
        turnLabelQ: "Q",
        turnLabelA: "A",
        placeholder: "Ask anything about this thread…",
        send: "Send",
        cancel: "Cancel",
        clear: "Clear conversation",
    },
    states: {
        streaming: "streaming…",
        thinking: "Thinking…",
    },
    saveAsNote: {
        button: "Save as Chat Note",
        saving: "Saving…",
        success: "Saved as Chat Note.",
        nothingToSave: "Nothing to save yet — ask a question first.",
        failed: "Couldn't save as note. Please try again.",
        noteTitle: "Thread summary — {chatName} ({date})",
    },
    errors: {
        loadFailed: "Couldn't load the thread summary.",
        retry: "Retry",
        forbidden: "You don't have access to this thread.",
    },
} as const;
