// Types mirroring the response of `POST /api/v2/search/` (see
// `backend_django/origin/search_engine/views.py` and
// `search_engine/search.py::_group_by_entity`). The backend groups
// chunk-level hits up into entity-level rows before returning, so each
// item below is one chat/task/note that matched, not one chunk.

export type ChatTypeLabel = "dm" | "gm" | "mdm" | "pm";
export type NoteTypeLabel = "personal" | "task" | "chat";
// "project" only appears in agent-emitted citation chips (the search
// backend never returns project rows). It links to the project's
// task-list view; no project-preview modal exists.
// "spotlight_answer" is a collected past Spotlight answer (the team-shared
// answer-reuse lane). It surfaces in typeahead and carries `answer_text` +
// `answer_sources` so the UI can render the past answer with clickable
// source chips. See backend `chunkers/spotlight_answer_chunker.py`.
// "milestone" carries the backing task's `task_id` + `project_id`, so it
// deep-links through the same task view the app uses to open milestones.
export type EntityType =
    | "chat"
    | "task"
    | "milestone"
    | "note"
    | "project"
    | "todo"
    | "spotlight_answer";

export interface SpotlightResult {
    entity_type: EntityType;
    entity_id: string; // e.g. "dm:5", "pm:1:thread:3", "task:123", "note:personal:42"
    title: string | null;
    snippet: string | null;
    score: number;
    keyword_rank: number | null;
    vector_rank: number | null;
    matched_chunk_types: string[]; // e.g. ["chat_message", "chat_thread_window"]
    // Analyzer-aware tokens (incl. stemmed/synonym forms) extracted from
    // the OpenSearch highlight response. Empty for vector-only hits.
    // The frontend merges these with the literal query tokens when
    // bolding matches.
    matched_terms: string[];
    updated_at: string | null;

    // Chat-specific (present when entity_type === "chat")
    chat_type: ChatTypeLabel | null;
    chat_id: string | null;
    thread_id: string | null;
    // The specific message inside the chat / thread that matched.
    // Null when the matching chunk wasn't a single message (e.g. a
    // thread-window chunk or an anchor chunk), or for non-chat results.
    // Spotlight uses it to deep-link the chat URL down to the bubble.
    message_id: string | null;

    // Task-specific
    task_id: string | null;
    // Human-readable task identifier ("<project.code>-<project_task_number>",
    // e.g. "PRJ-42"). Always shown to end users in place of the raw
    // task_id. Null on legacy rows or when the task lacks a project.
    task_display_id: string | null;

    // Note-specific
    note_id: string | null;
    note_type: NoteTypeLabel | null;

    // Cross-cutting
    project_id: string | null;
    related_entity_ids: string[];

    // spotlight_answer lane only (a collected past answer). `answer_text` is
    // the stored answer body with inline `[type:id]` citation tokens;
    // `answer_sources` are the SpotlightResult-shaped sources the answer cited.
    // Both absent on every other entity type.
    answer_text?: string | null;
    answer_sources?: SpotlightResult[];
}

export interface SearchResponse {
    query: string;
    results: SpotlightResult[];
}

export interface SearchRequest {
    query: string;
    team_id: string;
    entity_types?: EntityType[];
    date_from?: string;
    date_to?: string;
    limit?: number;
    use_vector?: boolean;
}

// Chat-type label (backend) → integer code expected by
// `useCM.moveToSpecificChat`. Mirrors CHAT_TYPE constants in
// `backend_django/origin/views/chat/*_views.py`.
export const CHAT_TYPE_CODE: Record<ChatTypeLabel, number> = {
    dm: 1,
    gm: 2,
    pm: 3,
    mdm: 4,
};
