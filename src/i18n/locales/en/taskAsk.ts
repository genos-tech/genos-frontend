// Strings for "Ask Genos about this task or milestone" (MIP-1057): the window a task's or milestone's
// "..." menu opens, which holds THAT object's own conversation. See features/taskAsk/. Send, Cancel,
// Close and the mention list's label are the shared `common` and `spotlight` strings.

export const taskAsk = {
    modal: {
        titleTask: "Ask Genos about this task",
        titleMilestone: "Ask Genos about this milestone",
    },
    loading: "Opening your conversation…",
    // The task or milestone cannot be opened any more: deleted, or access lost. The server gives
    // one answer for both (and for a task that was never there), so this says what is known and no more.
    gone: {
        titleTask: "This task can't be opened any more",
        titleMilestone: "This milestone can't be opened any more",
        body: "It may have been deleted, or you may no longer have access to it. Your earlier questions stay in your past conversations.",
        askInGeneral: "Ask Genos in general",
    },
    conversation: {
        emptyTask:
            "Ask anything about this task. Genos has its details, and your questions stay together with it so you can pick them up later.",
        emptyMilestone:
            "Ask anything about this milestone. Genos has its details, and your questions stay together with it so you can pick them up later.",
        placeholderTask: "Ask about this task…",
        placeholderMilestone: "Ask about this milestone…",
        newConversation: "New conversation",
        // Read out with the button: what it does to the conversation that is there now.
        newConversationHint:
            "Start a fresh conversation about it. The current one stays in your past conversations.",
        // Announced once when it starts (the page does not otherwise change for a screen reader).
        newConversationStarted: "Started a new conversation.",
    },
} as const;
