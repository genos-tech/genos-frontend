// Strings for "Save as note" and "Save as task" on an Ask Genos answer, in the
// per-turn action bar and the status line under the answer. See
// features/agentQA/saveAnswer/.

export const agentSave = {
    note: {
        button: "Save as note",
        tooltip: "Save this answer as a note in My Notes",
        saving: "Saving to My Notes…",
        saved: "Saved to My Notes",
        open: "Open",
        retry: "Try again",
        failed: "Couldn't save the note. Please try again.",
        tooLong: "This answer is too long to save as a note.",
        limitReached: "You've reached your plan's limit for notes. See Settings → Plan & Usage.",
        // The first line of the saved note, above the answer.
        intro: "Genos answer to: {question}",
        // The note's title when the question is empty.
        fallbackTitle: "Genos answer",
    },
    task: {
        button: "Save as task",
        tooltip: "Create a task from this answer",
        saved: "Task created",
        open: "Open",
        tooLong: "This answer is too long to turn into a task.",
        modal: {
            heading: "Create a task from this answer",
            description:
                "Copies the answer into the new task's description. The answer stays where it is.",
        },
    },
} as const;
