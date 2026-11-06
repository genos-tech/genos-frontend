// A source for something the person just made, in the shape every host's
// source-click already understands (`onPreview`): the overlay closes and routes,
// the Ask modals quick-look. The same fields a search hit for it would carry.

import type { SpotlightResult } from "../../spotlight/types";

const blank = (over: Partial<SpotlightResult>): SpotlightResult => ({
    entity_type: "task",
    entity_id: "",
    title: "",
    snippet: null,
    score: 1,
    keyword_rank: null,
    vector_rank: null,
    matched_chunk_types: [],
    matched_terms: [],
    updated_at: null,
    chat_type: null,
    chat_id: null,
    thread_id: null,
    message_id: null,
    task_id: null,
    task_display_id: null,
    note_id: null,
    note_type: null,
    project_id: null,
    related_entity_ids: [],
    ...over,
});

/** A note in My Notes. */
export const savedNoteSource = (noteId: number, title: string): SpotlightResult =>
    blank({
        entity_type: "note",
        entity_id: `note:personal:${noteId}`,
        title,
        note_id: String(noteId),
        note_type: "personal",
    });

export const createdTaskSource = (
    taskId: number,
    projectId: number,
    title: string,
    displayId: string | null
): SpotlightResult =>
    blank({
        entity_type: "task",
        entity_id: `task:${taskId}`,
        title,
        task_id: String(taskId),
        task_display_id: displayId,
        project_id: String(projectId),
    });
