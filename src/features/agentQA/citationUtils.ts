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
//
// The `(?!\()` lookahead keeps this from matching the LABEL of a link
// whose label is itself a raw token — weak models emit `[token](token)`,
// which pass 1 rewrites to `[token](spotlight-citation:token)`; stripping
// the `[token]` label out of that would shatter the link and leak the
// naked `(spotlight-citation:…)` URL as visible text (the exact bug seen
// with gemini-flash).
const _CITATION_STRIP_PATTERN =
    /[ \t]?\[(?:chat|task|note|project|todo|milestone):[^\]\s]+\](?!\()/g;

// A link LABEL that is itself a raw citation token (`[task:42](task:42)`)
// — the tell of a model that ignored the natural-prose instruction. Such
// labels are swapped for the source title (resolved) or dropped
// (unresolved) instead of showing the user a raw id/UUID.
const _RAW_TOKEN_LABEL = /^(?:chat|task|note|project|todo|milestone):\S+$/;

// Resolve a citation token to a retrieved source.
//
// Exact match for every entity type — the strict resolve-guard against
// hallucinated ids stays intact (a `task:99` we never retrieved must NOT
// fuzzy-match `task:9`).
//
// CHAT tokens additionally get structural recovery, because their ids
// nest (`chat:<label>:<chat_id>[:thread:<id>]`) and weak models mangle
// the tail — gemini-flash emits `chat:dm:<id>:msg:<uuid>` (a per-message
// id copied from tool results, not part of the citation vocabulary).
// Working from the longest base down to `chat:<label>:<chat_id>` (never
// shorter), try the exact key, then a retrieved key that EXTENDS the
// base (`chat:dm:X` recovers to the retrieved `chat:dm:X:thread:T`; if
// several threads of the same chat were retrieved, the first in source
// order — the backend's ranked order — wins). Both directions stay
// inside the same real chat container, so the worst miss is opening a
// sibling thread — strictly better than dropping the citation.
//
// Returns the canonical map key alongside the source so callers rewrite
// hrefs/chip filters in the form the anchor components look up.
export const resolveCitationToken = (
    token: string,
    sourcesById: Map<string, SpotlightResult>
): { key: string; source: SpotlightResult } | null => {
    const exact = sourcesById.get(token);
    if (exact) return { key: token, source: exact };
    if (!token.startsWith("chat:")) return null;
    const parts = token.split(":");
    // Need at least `chat:<label>:<chat_id>` to anchor recovery.
    if (parts.length < 3) return null;
    for (let n = parts.length; n >= 3; n--) {
        const base = parts.slice(0, n).join(":");
        if (n < parts.length) {
            const hit = sourcesById.get(base);
            if (hit) return { key: base, source: hit };
        }
        const prefix = `${base}:`;
        for (const [k, s] of sourcesById) {
            if (k.startsWith(prefix)) return { key: k, source: s };
        }
    }
    return null;
};

// Rewrite the model's citations for rendering (§4.6 D5).
//
// Two forms coexist:
//   1. Natural-prose link `[prose](type:id)` — the preferred form. We
//      rewrite its URL to the `spotlight-citation:` sentinel so the
//      ReactMarkdown `a` override (CitationAnchor / CitationLink) renders
//      a click-to-preview citation whose visible text is the model's
//      grammatical prose. Resolve-guard: only when `type:id` is a source
//      we actually retrieved (`sourcesById`, with `resolveCitationToken`'s
//      trim-fallback for model-invented suffixes like `:msg:<uuid>`). An
//      unresolved link degrades to its plain prose — no dead link, the
//      sentence stays readable. This is the MVP guard against a
//      hallucinated link to a bogus id.
//   2. Bare `[type:id]` token — the fallback the model emits when it
//      can't phrase a grammatical link. We strip it; the source surfaces
//      in the `SourceChips` row below the answer instead.
//
// Weak-model hardening (seen with gemini-flash; cheap models ignore the
// natural-prose instruction): a link whose LABEL is itself a raw token
// (`[task:42](task:42)`) renders with the source's title instead of the
// id — and if the token resolves to nothing, the whole link is dropped
// rather than leaking an id/UUID into the prose. Whatever the model
// emits, the reader never sees a raw token.
//
// History: an earlier inline form injected the entity TITLE as the link
// text unconditionally, which read awkwardly ("… per the perf-budget
// decision Lighthouse >= 95 task"). Letting the MODEL choose the prose
// (form 1) is what makes inline attribution readable — the title swap
// above applies ONLY when the model's label is a raw token, where the
// title is strictly better than the id.
export const rewriteCitations = (
    answer: string,
    sourcesById: Map<string, SpotlightResult>
): string => {
    if (!answer) return answer;
    // Pass 1: natural-prose links → sentinel links (resolved) or plain prose.
    const withLinks = answer.replace(
        new RegExp(CITATION_LINK_PATTERN.source, "g"),
        (_full, label: string, token: string) => {
            const hit = resolveCitationToken(token, sourcesById);
            const rawTokenLabel = _RAW_TOKEN_LABEL.test(label.trim());
            if (!hit) {
                // Unresolved: prose labels survive as prose; raw-token
                // labels are dropped entirely.
                return rawTokenLabel ? "" : label;
            }
            const displayLabel = rawTokenLabel
                ? // Strip brackets from injected titles so they can't
                  // break the markdown link we're building.
                  (hit.source.title || "").replace(/[[\]]/g, "").trim() ||
                  entitySubtitle(hit.source)
                : label;
            // Canonical key in the href so the anchor components'
            // exact-match lookup resolves suffix-trimmed tokens too.
            return `[${displayLabel}](${CITATION_HREF_PREFIX}${hit.key})`;
        }
    );
    // Pass 2: strip any remaining bare `[type:id]` tokens (chips fallback).
    // The sentinel links from pass 1 aren't touched — their id lives in
    // parens, and the `(?!\()` lookahead protects raw-token labels.
    return withLinks.replace(_CITATION_STRIP_PATTERN, "");
};

// Extract the set of entity ids the answer renders INLINE as a
// natural-prose hyperlink — i.e. those in the `[prose](type:id)` link
// form (`CITATION_LINK_PATTERN`), which render as clickable links in the
// prose. `citedChipSources` also surfaces these as chips, so a source
// cited inline appears both in the prose and in the chip row.
//
// `sourcesById`, when provided, applies the same resolve-guard as
// `rewriteCitations` (including the suffix-trim fallback): an unresolved
// link degrades to plain prose (no inline link), so its id must not be
// treated as inline here either. Resolved ids are returned in canonical
// key form (what `buildSourcesById` maps), not the raw emitted token.
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
        if (!sourcesById) {
            ids.add(token);
            continue;
        }
        const hit = resolveCitationToken(token, sourcesById);
        if (hit) ids.add(hit.key);
    }
    return ids;
};

// Extract the set of entity ids the answer cites as a BARE `[type:id]`
// token (`CITATION_PATTERN`) — the fallback form the model emits when it
// can't phrase a grammatical inline link. `rewriteCitations` strips these
// from the prose; `citedChipSources` surfaces them (alongside inline-cited
// sources) in the chip row. Inline `[prose](type:id)` links are matched by
// `extractInlineCitedIds`, not here (their id lives in parens).
export const extractBareCitedIds = (answer: string): Set<string> => {
    const ids = new Set<string>();
    if (!answer) return ids;
    // Fresh RegExp so the shared global pattern's `lastIndex` isn't
    // carried between calls.
    const re = new RegExp(CITATION_PATTERN.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(answer)) !== null) {
        ids.add(m[1]);
    }
    return ids;
};

// Returns the sources to render as chips beneath the answer: every source
// the answer actually CITED, in EITHER form —
//   - an inline `[prose](type:id)` link, or
//   - a bare `[type:id]` token.
// Uncited sources (RETRIEVED by a tool but never referenced in the answer)
// are dropped as chip-row noise. The agent prompt enforces citation
// discipline (cite every entity-level claim you use; a revise pass
// re-checks it), so an uncited retrieved source is one the answer did not
// rely on. This makes the chip row "what the answer used", not "what RAG
// returned" (SPOTLIGHT_QUALITY_ARCHITECTURE.md §4.6).
//
// An inline-cited source appears BOTH as a link in the prose AND as a chip
// here — a deliberate "sources used" list (footnote link + bibliography).
// The model's preferred citation form is the inline link, so matching ONLY
// bare tokens would leave the chip row empty on most answers; including
// inline-cited sources keeps it populated. An answer that cites nothing
// (e.g. an aggregate/summary reply the prompt exempts from per-item
// citation) still shows an EMPTY chip row.
//
// Token normalisation matches `buildSourcesById` so a chat source whose
// `entity_id` lacks the "chat:" prefix still matches the prefixed token
// form the model emits.
export const citedChipSources = (
    answer: string,
    sources: SpotlightResult[]
): SpotlightResult[] => {
    // Union of both citation forms, resolved to canonical source keys so
    // suffix-mangled tokens (`…:msg:<uuid>`) still chip their retrieved
    // parent. Unresolvable citations match nothing and drop out.
    const byId = buildSourcesById(sources);
    const cited = new Set<string>();
    for (const token of extractInlineCitedIds(answer)) {
        const hit = resolveCitationToken(token, byId);
        if (hit) cited.add(hit.key);
    }
    for (const token of extractBareCitedIds(answer)) {
        const hit = resolveCitationToken(token, byId);
        if (hit) cited.add(hit.key);
    }
    if (cited.size === 0) return [];
    return sources.filter((s) => {
        const tokenKey = s.entity_id.startsWith(`${s.entity_type}:`)
            ? s.entity_id
            : `${s.entity_type}:${s.entity_id}`;
        return cited.has(tokenKey);
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

// Fallback label when a raw-token link label must be replaced but the
// source has no title (see `rewriteCitations`' weak-model hardening) —
// matches SpotlightOverlay's `entitySubtitle` vocabulary for visual
// consistency. The spotlight version is more elaborate (i18n + per-type
// subtitles); here a sensible generic label suffices since it only shows
// for title-less sources.
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
