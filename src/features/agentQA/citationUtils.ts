// Citation handling — canonical home for the citation-token vocabulary
// shared by every surface that renders agent answers (the thread-Ask
// modal, future note-Ask modals, the saved-note serialiser).
//
// SpotlightOverlay still has its own inline copy of this logic; both
// trees emit `[type:id]` tokens with the same shape, and they'll
// converge once Spotlight migrates onto `useAgentQA` (stretch goal —
// see the agentQA refactor plan).

import { SpotlightResult } from "../spotlight/types";

// Matches `[type:id...]` tokens emitted by the LLM. Anchored to the
// known entity prefixes so a free-form sentence with literal brackets
// ("[reminder: ship by Friday]") doesn't trip the pattern. This set
// must cover every entity type the agent can inline-cite AND the
// SourceChips row can render (see `_sourceIcon` in SpotlightOverlay):
// chat / task / note / project / todo / milestone. A type missing here
// renders its raw `[todo:...]` token in the prose instead of being
// stripped into a chip — the exact bug this list guards against.
export const CITATION_PATTERN = /\[((?:chat|task|note|project|todo|milestone):[^\]\s]+)\]/g;

// Natural-prose citation form (§4.6 D5): `[descriptive prose](type:id)`.
// The model is taught to emit this so the visible link TEXT is a
// grammatical part of the sentence (unlike the old title-injection form,
// which read awkwardly). Group 1 = the prose label; group 2 = the
// `type:id` token. Real markdown links (`[title](https://…)`) don't match
// because the URL must start with a known entity prefix — they pass
// through untouched and render as normal external links.
export const CITATION_LINK_PATTERN =
    /\[([^\]]+?)\]\(((?:chat|task|note|project|todo|milestone):[^)\s]+)\)/g;

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

// Token-with-preceding-space pattern for the BARE `[type:id]` form. We
// consume one optional space or tab before the bracket so stripping
// doesn't leave a double-space or " ." artifact. Newlines are NOT
// consumed — they have markdown significance (blank line = paragraph
// break) and we mustn't merge paragraphs accidentally.
const _CITATION_STRIP_PATTERN = /[ \t]?\[(?:chat|task|note|project|todo|milestone):[^\]\s]+\]/g;

// Rewrite the model's citations for rendering (§4.6 D5).
//
// Two forms coexist:
//   1. Natural-prose link `[prose](type:id)` — the preferred form. We
//      rewrite its URL to the `spotlight-citation:` sentinel so the
//      ReactMarkdown `a` override (CitationAnchor / CitationLink) renders
//      a click-to-preview citation whose visible text is the model's
//      grammatical prose. Resolve-guard: only when `type:id` is a source
//      we actually retrieved (`sourcesById`). An unresolved link degrades
//      to its plain prose — no dead link, sentence stays readable. This
//      is the MVP guard against a hallucinated link to a bogus id.
//   2. Bare `[type:id]` token — the fallback the model emits when it
//      can't phrase a grammatical link. We strip it; the source surfaces
//      in the `SourceChips` row below the answer instead.
//
// History: an earlier inline form injected the entity TITLE as the link
// text, which read awkwardly ("… per the perf-budget decision Lighthouse
// >= 95 task"). Letting the MODEL choose the prose (form 1) is what makes
// inline attribution readable.
export const rewriteCitations = (
    answer: string,
    sourcesById: Map<string, SpotlightResult>
): string => {
    if (!answer) return answer;
    // Pass 1: natural-prose links → sentinel links (resolved) or plain prose.
    const withLinks = answer.replace(
        new RegExp(CITATION_LINK_PATTERN.source, "g"),
        (_full, label: string, token: string) =>
            sourcesById.has(token) ? `[${label}](${CITATION_HREF_PREFIX}${token})` : label
    );
    // Pass 2: strip any remaining bare `[type:id]` tokens (chips fallback).
    // The sentinel links from pass 1 aren't touched — their bracket text is
    // prose, not a `type:` prefix, and the id lives in parens.
    return withLinks.replace(_CITATION_STRIP_PATTERN, "");
};

// Extract the set of entity ids the answer renders INLINE as a
// natural-prose hyperlink — i.e. those in the `[prose](type:id)` link
// form (`CITATION_LINK_PATTERN`). These are already clickable in the
// prose, so `sourcesNotInline` drops them from the chip row to avoid
// duplication. Bare `[type:id]` tokens are intentionally NOT counted:
// `rewriteCitations` strips them, so their source SHOULD surface as a
// chip.
//
// `sourcesById`, when provided, applies the same resolve-guard as
// `rewriteCitations`: an unresolved link degrades to plain prose (no
// inline link), so its id must not be treated as inline here either.
export const extractInlineCitedIds = (
    answer: string,
    sourcesById?: Map<string, SpotlightResult>
): Set<string> => {
    const ids = new Set<string>();
    if (!answer) return ids;
    const re = new RegExp(CITATION_LINK_PATTERN.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(answer)) !== null) {
        const token = m[2];
        if (!sourcesById || sourcesById.has(token)) {
            ids.add(token);
        }
    }
    return ids;
};

// Returns the sources to render as chips beneath the answer: every
// source EXCEPT those already linked inline in the prose (§4.6 —
// inline links for cited claims, chips as the complement/fallback for
// uncited or bare-token sources). Reuses `buildSourcesById`'s
// normalisation so a chat source whose `entity_id` lacks the "chat:"
// prefix still matches the prefixed token form the model emits.
export const sourcesNotInline = (
    answer: string,
    sources: SpotlightResult[]
): SpotlightResult[] => {
    const inline = extractInlineCitedIds(answer, buildSourcesById(sources));
    if (inline.size === 0) return sources;
    return sources.filter((s) => {
        const tokenKey = s.entity_id.startsWith(`${s.entity_type}:`)
            ? s.entity_id
            : `${s.entity_type}:${s.entity_id}`;
        return !inline.has(tokenKey);
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
