// Types mirroring the response of `POST /api/v2/search/` (see
// `backend_django/origin/search_engine/views.py` and
// `search_engine/search.py::_group_by_entity`). The backend groups
// chunk-level hits up into entity-level rows before returning, so each
// item below is one chat/task/note that matched, not one chunk.

export type ChatTypeLabel = "dm" | "gm" | "mdm" | "pm";
export type NoteTypeLabel = "personal" | "task" | "chat";
export type EntityType = "chat" | "task" | "note";

export interface SpotlightResult {
    entity_type: EntityType;
    entity_id: string; // e.g. "dm:5", "pm:1:thread:3", "task:123", "note:personal:42"
    title: string | null;
    snippet: string | null;
    score: number;
    keyword_rank: number | null;
    vector_rank: number | null;
    matched_chunk_types: string[]; // e.g. ["chat_message", "chat_thread_window"]
    updated_at: string | null;

    // Chat-specific (present when entity_type === "chat")
    chat_type: ChatTypeLabel | null;
    chat_id: string | null;
    thread_id: string | null;

    // Task-specific
    task_id: string | null;

    // Note-specific
    note_id: string | null;
    note_type: NoteTypeLabel | null;

    // Cross-cutting
    project_id: string | null;
    related_entity_ids: string[];
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
