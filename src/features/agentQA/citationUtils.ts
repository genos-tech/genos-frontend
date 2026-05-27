// Citation handling — canonical home for the citation-token vocabulary
// shared by every surface that renders agent answers (the thread-Ask
// modal, future note-Ask modals, the saved-note serialiser).
//
// SpotlightOverlay still has its own inline copy of this logic; both
// trees emit `[type:id]` tokens with the same shape, and they'll
// converge once Spotlight migrates onto `useAgentQA` (stretch goal —
// see the agentQA refactor plan).

import { SpotlightResult } from "../spotlight/types";

// Matches `[type:id...]` tokens emitted by the LLM. Anchored to one of
// the four known entity prefixes so a free-form sentence with literal
// brackets ("[reminder: ship by Friday]") doesn't trip the pattern.
export const CITATION_PATTERN = /\[((?:chat|task|note|project):[^\]\s]+)\]/g;

// Sentinel href scheme. ReactMarkdown's anchor override recognises this
// prefix and renders a button that opens the entity instead of a
// standard <a href>. Shared with SpotlightOverlay so a single anchor
// renderer can handle both.
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

// Detect whether a source's title is already present in the answer
// prose right before a citation token. The LLM commonly writes
// "**Title**" or "Title" inline and then emits `[type:id]` right
// next to it — replacing the token with the same title text would
// render the title twice (once from the prose, once from the link).
//
// We look at the 200 chars immediately before the token's offset.
// That window covers same-line and previous-line mentions (markdown
// bullets often wrap the title onto its own line before the token).
// Normalisation strips markdown emphasis chars, lowercases, and
// collapses whitespace so the comparison ignores bold/italic markers
// and line wraps.
//
// Min-length guard avoids matching very short titles like "Bug"
// which could coincidentally appear unrelated in the prose.
const titleAppearsBefore = (answer: string, offset: number, title: string): boolean => {
    if (title.length < 6) return false;
    const window = answer.slice(Math.max(0, offset - 200), offset);
    const norm = (s: string) => s.toLowerCase().replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
    return norm(window).includes(norm(title));
};

// Replace bare `[type:id]` tokens with a markdown link whose label is
// the source's title (or a fallback) and whose href uses the sentinel
// scheme. Tokens that don't match any known source are left alone so
// the user can see what the model intended to cite.
//
// De-duplication rule: when the source's title already appears in the
// prose just before the token (LLM wrote "**Title** [task:42]"),
// strip the token entirely instead of emitting a same-text link. The
// SourceChips row below the answer picks the source up — it shows
// any "referenced but not inline-hyperlinked" source as a chip — so
// the user still gets one clickable affordance, just without the
// awkward duplicate prose.
//
// Escapes markdown control chars in the label so a title with a `*`
// or `[` doesn't break the surrounding link/emphasis parsing.
export const rewriteCitations = (
    answer: string,
    sourcesById: Map<string, SpotlightResult>
): string => {
    if (!answer || sourcesById.size === 0) return answer;
    return answer.replace(CITATION_PATTERN, (match, entityId: string, offset: number) => {
        const source = sourcesById.get(entityId);
        if (!source) return match;
        const rawLabel = (source.title || "").trim() || entitySubtitle(source);
        if (titleAppearsBefore(answer, offset, rawLabel)) return "";
        const safeLabel = rawLabel.replace(/[*[\]()]/g, "");
        return `[*${safeLabel}*](${CITATION_HREF_PREFIX}${entityId})`;
    });
};

// Extract the set of citation-token entity ids that appear inline in
// the answer text — used to decide whether a given `SpotlightResult`
// is already represented as a hyperlink (in which case it shouldn't
// also render as a chip below) or "free-floating" (chip-worthy).
//
// Tokens are normalised to the "<type>:<rest>" form CITATION_PATTERN
// captures: chat entity_ids that don't carry the leading "chat:"
// prefix in the index still match here because the model emits the
// prefixed token form.
//
// `sourcesById` is optional but should match what `rewriteCitations`
// receives: when present, tokens that `rewriteCitations` would strip
// (because the title duplicates nearby prose) are NOT counted here
// either. That way the source flows to the chip row instead of being
// orphaned — the user still has one clickable affordance.
export const extractInlineCitedIds = (
    answer: string,
    sourcesById?: Map<string, SpotlightResult>
): Set<string> => {
    const ids = new Set<string>();
    if (!answer) return ids;
    const re = new RegExp(CITATION_PATTERN.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(answer)) !== null) {
        const entityId = m[1];
        if (sourcesById) {
            const source = sourcesById.get(entityId);
            const rawLabel = (source?.title || "").trim();
            if (rawLabel && titleAppearsBefore(answer, m.index, rawLabel)) {
                // Treated as "not inline" so the chip row picks it up.
                continue;
            }
        }
        ids.add(entityId);
    }
    return ids;
};

// Return the subset of `sources` that the answer text does NOT cite
// inline — i.e. the ones we want to render as chips. Used by the
// thread modal to follow the user's two-style rule: inline citations
// become hyperlinks (handled in `rewriteCitations`), and the leftover
// references show as a chip row beneath the answer.
//
// Builds its own sourcesById so the duplication-aware logic in
// `extractInlineCitedIds` runs end-to-end without the caller having
// to thread the map through.
export const sourcesNotInline = (
    answer: string,
    sources: SpotlightResult[]
): SpotlightResult[] => {
    if (sources.length === 0) return sources;
    const sourcesById = buildSourcesById(sources);
    const cited = extractInlineCitedIds(answer, sourcesById);
    if (cited.size === 0) return sources;
    return sources.filter((s) => {
        const tokenKey = s.entity_id.startsWith(`${s.entity_type}:`)
            ? s.entity_id
            : `${s.entity_type}:${s.entity_id}`;
        return !cited.has(tokenKey);
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
