// Citation handling — shared between the modal display (clickable
// hyperlinks via ReactMarkdown) and the saved-note serialiser
// (BlockNote inline-link blocks).
//
// Mirrors `rewriteCitations` and `CITATION_PATTERN` in SpotlightOverlay.
// Kept as a separate module here so a refactor that pulls those out
// of SpotlightOverlay can replace this file with a re-export.

import { SpotlightResult } from "../spotlight/types";

// Matches `[type:id...]` tokens emitted by the LLM. Anchored to one of
// the four known entity prefixes so a free-form sentence with literal
// brackets ("[reminder: ship by Friday]") doesn't trip the pattern.
// Same pattern as SpotlightOverlay's CITATION_PATTERN.
export const CITATION_PATTERN = /\[((?:chat|task|note|project):[^\]\s]+)\]/g;

// Sentinel href scheme. ReactMarkdown's anchor override recognises this
// prefix and renders a button that opens the entity instead of a
// standard <a href>. Matches SpotlightOverlay's prefix so any future
// shared anchor renderer can handle both.
export const CITATION_HREF_PREFIX = "spotlight-citation:";

// Build the entity-id → source lookup the rewriter consumes. Chat
// entity ids in the index don't carry the leading "chat:" prefix
// (they're "dm:5:thread:4" not "chat:dm:5:thread:4") so we normalise
// to the prefixed form to match what CITATION_PATTERN captures.
export const buildSourcesById = (sources: SpotlightResult[]): Map<string, SpotlightResult> => {
    const m = new Map<string, SpotlightResult>();
    for (const s of sources) {
        const tokenKey = s.entity_id.startsWith(`${s.entity_type}:`)
            ? s.entity_id
            : `${s.entity_type}:${s.entity_id}`;
        m.set(tokenKey, s);
    }
    return m;
};

// Replace bare `[type:id]` tokens with a markdown link whose label is
// the source's title (or a fallback) and whose href uses the sentinel
// scheme. Tokens that don't match any known source are left alone so
// the user can see what the model intended to cite.
//
// Escapes markdown control chars in the label so a title with a `*`
// or `[` doesn't break the surrounding link/emphasis parsing.
export const rewriteCitations = (
    answer: string,
    sourcesById: Map<string, SpotlightResult>
): string => {
    if (!answer || sourcesById.size === 0) return answer;
    return answer.replace(CITATION_PATTERN, (match, entityId: string) => {
        const source = sourcesById.get(entityId);
        if (!source) return match;
        const rawLabel = (source.title || "").trim() || entitySubtitle(source);
        const safeLabel = rawLabel.replace(/[*[\]()]/g, "");
        return `[*${safeLabel}*](${CITATION_HREF_PREFIX}${entityId})`;
    });
};

// Build a URL that opens the entity. Used by the saved-note serialiser
// to make citation tokens clickable from outside the modal context
// (where we can't call `useCM.moveToSpecificChat`). Returns `null` if
// the source doesn't have enough metadata to deep-link.
//
// URL shapes mirror App.tsx `handleSpotlightSelect` so the routes pick
// up the same way as a Spotlight click.
export const sourceToUrl = (s: SpotlightResult): string | null => {
    if (s.entity_type === "task" && s.task_id && s.project_id) {
        return `/workspace/tasks/project/${s.project_id}/task/${s.task_id}`;
    }
    if (s.entity_type === "project" && s.project_id) {
        return `/workspace/tasks/project/${s.project_id}`;
    }
    if (s.entity_type === "chat" && s.chat_type && s.chat_id) {
        const base = `/workspace/chat/${s.chat_type}/${s.chat_id}`;
        if (s.thread_id) {
            const url = `${base}/thread/${s.thread_id}`;
            return s.message_id ? `${url}/message/${s.message_id}` : url;
        }
        return s.message_id ? `${base}/message/${s.message_id}` : base;
    }
    if (s.entity_type === "note" && s.note_id) {
        if (s.note_type === "personal") {
            return `/workspace/notes/my/${s.note_id}`;
        }
        if (s.note_type === "task" && s.project_id && s.task_id) {
            return `/workspace/notes/task/project/${s.project_id}/task/${s.task_id}/note/${s.note_id}`;
        }
        if (s.note_type === "chat" && s.chat_type && s.chat_id && s.thread_id) {
            return `/workspace/notes/chat/${s.chat_type}/${s.chat_id}/thread/${s.thread_id}/note/${s.note_id}`;
        }
    }
    return null;
};

// Fallback label when a source has no title — match SpotlightOverlay's
// `entitySubtitle` for visual consistency. The spotlight version is more
// elaborate (i18n + per-type subtitles); here we just produce a sensible
// generic label since the modal renders few citations at a time.
const entitySubtitle = (s: SpotlightResult): string => {
    if (s.entity_type === "task") return s.task_display_id || "Task";
    if (s.entity_type === "project") return "Project";
    if (s.entity_type === "chat") {
        const base = s.chat_type ? s.chat_type.toUpperCase() : "Chat";
        return s.thread_id ? `${base} thread` : base;
    }
    if (s.entity_type === "note") return "Note";
    return "Source";
};
