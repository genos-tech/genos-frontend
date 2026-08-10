// Citation handling — canonical home for the citation-token vocabulary
// shared by every surface that renders agent answers: the thread-Ask
// and note-Ask modals (via `AgentQAConversation`), Spotlight (via
// `SpotlightContent`, which `SpotlightOverlay` renders), and the
// saved-note serialiser.
//
// Spotlight previously kept its own byte-identical inline copy of this
// logic; it has since converged onto this module (see the note beside
// the `rewriteCitations` import in `SpotlightContent.tsx`), so the
// parsing rule can't drift between surfaces (SPOTLIGHT_QUALITY_ARCHITECTURE.md §4.6).

import { canonicalSpotlightHref } from "../../utils/canonicalSpotlightHref";
import { SpotlightResult } from "../spotlight/types";

// Chat entity ids nest under a chat-label segment (`dm|gm|pm|mdm`) and
// are stored WITHOUT the leading "chat:" prefix in the source payload
// ("gm:<uuid>:thread:<t>", see `buildSourcesById`). Models copy that
// un-prefixed form verbatim into citations ("[gm:<uuid>:msg:<id>]"),
// so every pattern below accepts it alongside the canonical prefixed
// vocabulary. The un-prefixed alternation requires the id to START
// with a hex char (chat ids are UUIDs or ints) so bracketed prose like
// "[pm:notes]" isn't swallowed.
const _CHAT_LABEL_TOKEN = "(?:dm|gm|pm|mdm):[0-9a-fA-F]";

// Matches `[type:id...]` tokens emitted by the LLM. Anchored to the
// known entity prefixes so a free-form sentence with literal brackets
// ("[reminder: ship by Friday]") doesn't trip the pattern. This set
// must cover every entity type the agent can inline-cite AND the
// SourceChips row can render (see `_sourceIcon` in SpotlightContent):
// chat / task / note / project / todo / milestone. A type missing here
// renders its raw `[todo:...]` token in the prose instead of being
// stripped into a chip — the exact bug this list guards against.
export const CITATION_PATTERN = new RegExp(
    `\\[((?:chat|task|note|project|todo|milestone):[^\\]\\s]+|${_CHAT_LABEL_TOKEN}[^\\]\\s]*)\\]`,
    "g"
);

// Natural-prose citation form (§4.6 D5): `[descriptive prose](type:id)`.
// The model is taught to emit this so the visible link TEXT is a
// grammatical part of the sentence (unlike the old title-injection form,
// which read awkwardly). Group 1 = the prose label; group 2 = the
// `type:id` token. Real markdown links (`[title](https://…)`) don't match
// because the URL must start with a known entity prefix — they pass
// through untouched and render as normal external links.
export const CITATION_LINK_PATTERN = new RegExp(
    `\\[([^\\]]+?)\\]\\(((?:chat|task|note|project|todo|milestone):[^)\\s]+|${_CHAT_LABEL_TOKEN}[^)\\s]*)\\)`,
    "g"
);

// Sentinel href scheme. ReactMarkdown's anchor override recognises this
// prefix and renders a button that opens the entity instead of a
// standard <a href>. The same prefix drives the anchor renderers in
// both `CitationAnchor` (the Ask modals) and `SpotlightContent`.
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
const _CITATION_STRIP_PATTERN = new RegExp(
    `[ \\t]?\\[(?:(?:chat|task|note|project|todo|milestone):[^\\]\\s]+|${_CHAT_LABEL_TOKEN}[^\\]\\s]*)\\](?!\\()`,
    "g"
);

// Safety net for raw citation ids the model dumped into the prose WITHOUT
// the `[type:id]` / `[prose](type:id)` syntax the two passes handle — the
// user-reported "response body includes raw gm chat id / task id" leak.
// Both patterns above require the brackets; a model that emits a bare
// `gm:8f5e4733-…:msg:9c17…` or `task:42` in a sentence slips past them and
// the reader sees a decode-failure id. This strips those.
//
// The token grammar (the `[\w:-]` id run, stopping at whitespace or
// sentence punctuation like `.`/`,`/`)`) is anchored so it can only fire
// on a genuine leaked id, never on prose:
//   - a UUID anywhere in a `type:…`/`label:…` token — no prose sentence
//     contains a UUID, so this alternative is zero-false-positive;
//   - the exact vocabulary (`task|note|project|todo|milestone`) whose id
//     tail CONTAINS A DIGIT (`task:42`, `note:personal:50`,
//     `todo:2026-07-03:item:117`) — the digit requirement is what keeps
//     "note: remember to…" (space, no digit) and "chat:" as a word safe;
//   - an un-prefixed chat label (`dm|gm|pm|mdm:`) whose id starts with a
//     hex char, mirroring `_CHAT_LABEL_TOKEN` (so "pm: sync" / "dm:notes"
//     — space or non-hex first char — stay untouched).
// The leading `(?<![\w:/.-])` boundary keeps it from biting into a larger
// token such as a URL path segment (`…/project:18`) or a word. One
// optional leading space/tab is consumed so stripping mid-sentence leaves
// no double space (matching `_CITATION_STRIP_PATTERN`); newlines are left
// alone (paragraph significance).
const _UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const _RAW_LEAK_STRIP_PATTERN = new RegExp(
    `[ \\t]?(?<![\\w:/.-])(?:` +
        // any type/label token that carries a UUID (highest confidence)
        `(?:chat|task|note|project|todo|milestone|dm|gm|pm|mdm):[\\w:-]*${_UUID}[\\w:-]*` +
        // OR the exact vocabulary with a digit-bearing id tail. The
        // pre-digit run allows colons so nested ids resolve — the digit
        // in `note:personal:50` / `todo:2026-07-03:item:117` lives past a
        // second colon. A tokens with NO digit at all (`note:mine`,
        // `chat:hello`, `task:done`) can't match and stays as prose.
        `|(?:chat|task|note|project|todo|milestone):[\\w:-]*\\d[\\w:-]*` +
        // OR an un-prefixed chat label with a hex-leading id
        `|(?:dm|gm|pm|mdm):[0-9a-fA-F][\\w:-]*` +
        `)`,
    "g"
);

// A link LABEL that is itself a raw citation token (`[task:42](task:42)`)
// — the tell of a model that ignored the natural-prose instruction. Such
// labels are swapped for the source title (resolved) or dropped
// (unresolved) instead of showing the user a raw id/UUID.
const _RAW_TOKEN_LABEL = new RegExp(
    `^(?:(?:chat|task|note|project|todo|milestone):\\S+|${_CHAT_LABEL_TOKEN}\\S*)$`
);

// A UUID anywhere in a link label is the same tell in a wordier form —
// weak models emit labels like "dm:<uuid> thread <uuid>" (spaces, so
// `_RAW_TOKEN_LABEL` misses it). No grammatical prose label contains a
// raw UUID, so treat any such label as a raw token: swap for the source
// title when resolved, drop when not.
const _UUID_IN_LABEL =
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

// A raw-token-shaped label in either form — see `rewriteCitations`.
const _isRawTokenLabel = (label: string): boolean =>
    _RAW_TOKEN_LABEL.test(label.trim()) || _UUID_IN_LABEL.test(label);

// Canonicalise an emitted token to the prefixed form `buildSourcesById`
// maps: un-prefixed chat-label tokens ("gm:<uuid>…") gain the leading
// "chat:". Every other token passes through unchanged.
export const normalizeCitationToken = (token: string): string =>
    /^(?:dm|gm|pm|mdm):/.test(token) ? `chat:${token}` : token;

// Resolve a citation token to a retrieved source.
//
// The token is first canonicalised via `normalizeCitationToken`, so the
// un-prefixed chat forms models copy from source entity_ids
// ("gm:<uuid>:thread:<t>") resolve the same as `chat:gm:…`.
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
    rawToken: string,
    sourcesById: Map<string, SpotlightResult>
): { key: string; source: SpotlightResult } | null => {
    const token = normalizeCitationToken(rawToken);
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
            const rawTokenLabel = _isRawTokenLabel(label);
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
    const withoutBareTokens = withLinks.replace(_CITATION_STRIP_PATTERN, "");
    // Pass 3: safety net for UNbracketed raw ids the model dumped straight
    // into prose (passes 1 & 2 both require the brackets). This is the
    // "response body includes raw gm chat id / task id" leak. The
    // `spotlight-citation:` links from pass 1 are safe: their token is
    // always preceded by a colon, which the pattern's leading boundary
    // (`(?<![\w:/.-])`) rejects — so a valid citation link is never bitten.
    return withoutBareTokens.replace(_RAW_LEAK_STRIP_PATTERN, "");
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
            ids.add(normalizeCitationToken(token));
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
// EXCEPTION: `operated` sources (entities an approved WRITE tool created
// or updated — the backend marks them) are always kept, cited or not.
// "I created the note" with no clickable ref to the note is a broken
// answer, and the model occasionally forgets the citation — the chip is
// the guarantee the prose can't provide.
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
    return sources.filter((s) => {
        if (s.operated) return true;
        if (cited.size === 0) return false;
        const tokenKey = s.entity_id.startsWith(`${s.entity_type}:`)
            ? s.entity_id
            : `${s.entity_type}:${s.entity_id}`;
        return cited.has(tokenKey);
    });
};

// Build a URL that opens the entity. Used by CitationAnchor / SourceChips
// (to prefer a UrlLinkModal preview) and by the saved-note serialiser (to
// make citation tokens clickable outside the modal context). Returns
// `null` if the source doesn't have enough metadata to deep-link.
//
// Delegates to the canonical `canonicalSpotlightHref` — the SAME builder
// the Spotlight surface routes clicks through — so the agentQA surfaces
// can't drift from it. This is what closes two dead-link bugs the old
// hand-copied subset had: milestone citations (no `milestone` branch → a
// clickable link that no-op'd) and main-channel chat notes (the note-chat
// branch hard-required a truthy `thread_id`, so a threadless note fell
// through to null). `canonicalSpotlightHref` handles both (milestone deep
// link + the `thread_id ?? "0"` sentinel).
//
// One capability `canonicalSpotlightHref` intentionally omits is a bare
// `project` link (projects have no modal view yet), but the chip/inline
// click path still wants to navigate there and the saved-note export
// still wants a real href — so keep the project branch here as a fallback.
export const sourceToUrl = (s: SpotlightResult): string | null => {
    const href = canonicalSpotlightHref(s);
    if (href) return href;
    if (s.entity_type === "project" && s.project_id) {
        return `/workspace/tasks/project/${s.project_id}`;
    }
    return null;
};

// Fallback label when a raw-token link label must be replaced but the
// source has no title (see `rewriteCitations`' weak-model hardening) —
// matches SpotlightContent's `entitySubtitle` vocabulary for visual
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
    if (s.entity_type === "todo") return "Todo";
    return "Source";
};
