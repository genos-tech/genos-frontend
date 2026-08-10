import { describe, expect, it } from "vitest";

import {
    buildSourcesById,
    CITATION_HREF_PREFIX,
    citedChipSources,
    extractBareCitedIds,
    extractInlineCitedIds,
    rewriteCitations,
    sourceToUrl,
} from "../features/agentQA/citationUtils";
import type { SpotlightResult } from "../features/spotlight/types";

// Minimal SpotlightResult — buildSourcesById only reads entity_type /
// entity_id, and the render path only needs the id to be present in the
// map (the resolve-guard is a `.has()` check).
const src = (entity_type: string, entity_id: string, title = ""): SpotlightResult =>
    ({ entity_type, entity_id, title }) as unknown as SpotlightResult;

const noSources = new Map<string, SpotlightResult>();

describe("rewriteCitations — bare token fallback (stripped → chips)", () => {
    it("strips the original chat/task/note/project tokens", () => {
        expect(rewriteCitations("Per the spike [task:42].", noSources)).toBe("Per the spike.");
        expect(rewriteCitations("See the note [note:personal:50].", noSources)).toBe(
            "See the note."
        );
        expect(rewriteCitations("Bob said [chat:dm:9:thread:4] earlier.", noSources)).toBe(
            "Bob said earlier."
        );
        expect(rewriteCitations("In Q2 Roadmap [project:18]:", noSources)).toBe("In Q2 Roadmap:");
    });

    it("strips todo and milestone tokens", () => {
        expect(
            rewriteCitations("The decision was deferred [todo:2026-07-03:item:117].", noSources)
        ).toBe("The decision was deferred.");
        expect(rewriteCitations("Targeting v1.0 launch [milestone:7].", noSources)).toBe(
            "Targeting v1.0 launch."
        );
    });

    it("leaves free-form bracketed prose untouched", () => {
        const prose = "A quick note [reminder: ship by Friday] before we go.";
        expect(rewriteCitations(prose, noSources)).toBe(prose);
    });
});

describe("rewriteCitations — natural-prose links (§4.6 D5)", () => {
    it("rewrites a resolved [prose](type:id) link to the sentinel scheme", () => {
        const sources = buildSourcesById([src("task", "task:42", "framer-motion spike")]);
        expect(
            rewriteCitations("The team [ruled out framer-motion](task:42) early.", sources)
        ).toBe(`The team [ruled out framer-motion](${CITATION_HREF_PREFIX}task:42) early.`);
    });

    it("degrades an UNresolved link to plain prose (no dead link)", () => {
        // task:99 is not in the retrieved sources — resolve-guard drops the link.
        const sources = buildSourcesById([src("task", "task:42")]);
        expect(rewriteCitations("See the [mystery task](task:99) here.", sources)).toBe(
            "See the mystery task here."
        );
    });

    it("leaves a real external markdown link untouched", () => {
        // URL doesn't start with a known entity prefix -> not a citation.
        const answer = "Per the [MDN guide](https://developer.mozilla.org) on this.";
        expect(rewriteCitations(answer, noSources)).toBe(answer);
    });

    it("handles a link and a bare-token fallback in the same answer", () => {
        const sources = buildSourcesById([src("note", "note:personal:9", "perf budget")]);
        const out = rewriteCitations(
            "The [perf budget](note:personal:9) holds [task:42].",
            sources
        );
        // Link -> sentinel; bare token -> stripped.
        expect(out).toBe(`The [perf budget](${CITATION_HREF_PREFIX}note:personal:9) holds.`);
    });

    it("resolves a chat link whose entity_id lacks the chat: prefix", () => {
        // buildSourcesById normalises "dm:9:thread:4" -> "chat:dm:9:thread:4".
        const sources = buildSourcesById([src("chat", "dm:9:thread:4", "DM with Bob")]);
        expect(rewriteCitations("Bob [argued against it](chat:dm:9:thread:4).", sources)).toBe(
            `Bob [argued against it](${CITATION_HREF_PREFIX}chat:dm:9:thread:4).`
        );
    });
});

// Weak-model hardening — every input below is a VERBATIM malformation
// gemini-flash produced in a real run (AgentRun cabd15b1, 2026-07-05):
// links whose label is the raw token itself, and tokens with an invented
// `:msg:<uuid>` suffix that isn't in the citation vocabulary. The
// contract: whatever the model emits, the reader never sees a raw
// token, a UUID, or a leaked `spotlight-citation:` sentinel.
describe("rewriteCitations — weak-model malformed citations", () => {
    it("[token](token): swaps the raw-token label for the source title, keeps the link", () => {
        const sources = buildSourcesById([src("task", "task:1905", "CSS prototype spike")]);
        const out = rewriteCitations("…constraints ([task:1905](task:1905)).", sources);
        // The old strip pattern ate the `[task:1905]` LABEL out of the
        // rewritten link, leaving `…constraints ((spotlight-citation:task:1905)).`
        // — a naked sentinel as visible text. The exact match below proves
        // the label survived and the sentinel stays inside the link URL.
        expect(out).toBe(
            `…constraints ([CSS prototype spike](${CITATION_HREF_PREFIX}task:1905)).`
        );
    });

    it("falls back to a generic type label when the source has no title", () => {
        const sources = buildSourcesById([src("task", "task:1905")]);
        const out = rewriteCitations("Excluded ([task:1905](task:1905)).", sources);
        expect(out).toBe(`Excluded ([Task](${CITATION_HREF_PREFIX}task:1905)).`);
    });

    it("resolves an invented :msg: suffix to the retrieved THREAD source (real run shape)", () => {
        // The malformed run retrieved ONLY the thread source; flash cited a
        // per-message id copied from a tool result. Recovery trims the fake
        // `:msg:` tail to the chat base, then extends to the retrieved
        // thread key — the href carries the CANONICAL key so the anchor's
        // exact lookup works.
        const sources = buildSourcesById([
            src("chat", "dm:0738dbef:thread:8995bd1d", "Bob Martinez"),
        ]);
        const out = rewriteCitations(
            "…significant ([chat:dm:0738dbef:msg:58ed60f3](chat:dm:0738dbef:msg:58ed60f3)).",
            sources
        );
        expect(out).toBe(
            `…significant ([Bob Martinez](${CITATION_HREF_PREFIX}chat:dm:0738dbef:thread:8995bd1d)).`
        );
    });

    it("resolves an invented :msg: suffix to a retrieved base-chat source too", () => {
        const sources = buildSourcesById([src("chat", "dm:0738dbef", "DM with Bob")]);
        const out = rewriteCitations(
            "…significant ([chat:dm:0738dbef:msg:58ed60f3](chat:dm:0738dbef:msg:58ed60f3)).",
            sources
        );
        expect(out).toBe(`…significant ([DM with Bob](${CITATION_HREF_PREFIX}chat:dm:0738dbef)).`);
    });

    it("never fuzzy-matches non-chat ids (hallucinated note id stays unresolved)", () => {
        // Structural recovery is chat-only: note:personal:9999 must NOT
        // "recover" to the different note:personal:9.
        const sources = buildSourcesById([src("note", "note:personal:9", "perf budget")]);
        expect(rewriteCitations("Per the [budget note](note:personal:9999).", sources)).toBe(
            "Per the budget note."
        );
    });

    it("drops an unresolvable raw-token-label link entirely (no UUID soup)", () => {
        const sources = buildSourcesById([src("task", "task:42")]);
        const out = rewriteCitations(
            "…redesign ([chat:dm:0738dbef:msg:63b3b58c](chat:dm:0738dbef:msg:63b3b58c)).",
            sources
        );
        expect(out).toBe("…redesign ().");
    });

    it("keeps a PROSE label when its token is unresolvable (existing degrade)", () => {
        const sources = buildSourcesById([src("task", "task:42")]);
        expect(rewriteCitations("See the [mystery spike](task:99).", sources)).toBe(
            "See the mystery spike."
        );
    });

    it("still strips a bare token that is not a link label", () => {
        const sources = buildSourcesById([src("task", "task:42", "spike")]);
        // `[task:42]` followed by ` (` (space) is a bare token, not a label.
        expect(rewriteCitations("Per [task:42] (the spike).", sources)).toBe("Per (the spike).");
    });
});

// Un-prefixed chat tokens — VERBATIM malformations from real runs
// (2026-07-28 screenshots): models copy a source's entity_id ("gm:<uuid>…",
// no "chat:" prefix) straight into citations, sometimes with an invented
// ":msg:<uuid>" tail, sometimes as the LINK LABEL. None of these may ever
// reach the reader raw.
describe("rewriteCitations — un-prefixed dm:/gm: chat tokens", () => {
    it("strips a bare [gm:<uuid>:msg:<uuid>] token from the prose", () => {
        const out = rewriteCitations(
            "Reviewers are needed on the responsive nav PR " +
                "[gm:8f5e4733-cee9-4769-8a7f-859b80fa6713:msg:9c17635a-6d4a-4af2-ad56-664070546e56].",
            noSources
        );
        expect(out).toBe("Reviewers are needed on the responsive nav PR.");
    });

    it("resolves a bare un-prefixed token to the retrieved thread chip", () => {
        const thread = src("chat", "gm:8f5e4733:thread:9c17635a", "Design crew");
        const chips = citedChipSources("Ping the reviewers [gm:8f5e4733:msg:deadbeef].", [thread]);
        expect(chips.map((s) => s.entity_id)).toEqual(["gm:8f5e4733:thread:9c17635a"]);
    });

    it("rewrites a link whose URL lacks the chat: prefix to the canonical key", () => {
        const sources = buildSourcesById([src("chat", "dm:aa771315:thread:282012f2", "Bob DM")]);
        const out = rewriteCitations(
            "Per [the spike thread](dm:aa771315:thread:282012f2).",
            sources
        );
        expect(out).toBe(
            `Per [the spike thread](${CITATION_HREF_PREFIX}chat:dm:aa771315:thread:282012f2).`
        );
    });

    it("swaps an un-prefixed raw-token LABEL for the source title", () => {
        const sources = buildSourcesById([src("chat", "dm:aa771315:thread:282012f2", "Bob DM")]);
        const out = rewriteCitations(
            "See ([dm:aa771315:thread:282012f2](chat:dm:aa771315:thread:282012f2)).",
            sources
        );
        expect(out).toBe(
            `See ([Bob DM](${CITATION_HREF_PREFIX}chat:dm:aa771315:thread:282012f2)).`
        );
    });

    it("treats a UUID-bearing prose label as a raw token (screenshot form)", () => {
        // The label has spaces so the token-shaped regex misses it, but a
        // UUID in a label is never grammatical prose.
        const sources = buildSourcesById([
            src(
                "chat",
                "dm:aa771315-3b1c-4916-8ed1-d79efe90bc37:thread:282012f2-9157-4512-a5cd-c9841fb44ca2",
                "Bob DM"
            ),
        ]);
        const out = rewriteCitations(
            "Adopt a CSS-first approach (" +
                "[dm:aa771315-3b1c-4916-8ed1-d79efe90bc37 thread 282012f2-9157-4512-a5cd-c9841fb44ca2]" +
                "(chat:dm:aa771315-3b1c-4916-8ed1-d79efe90bc37:thread:282012f2-9157-4512-a5cd-c9841fb44ca2)).",
            sources
        );
        expect(out).toBe(
            `Adopt a CSS-first approach ([Bob DM](${CITATION_HREF_PREFIX}chat:dm:aa771315-3b1c-4916-8ed1-d79efe90bc37:thread:282012f2-9157-4512-a5cd-c9841fb44ca2)).`
        );
    });

    it("drops an unresolvable un-prefixed raw-token link entirely", () => {
        const out = rewriteCitations(
            "Check ([gm:8f5e4733:msg:9c17635a](gm:8f5e4733:msg:9c17635a)).",
            noSources
        );
        expect(out).toBe("Check ().");
    });

    it("leaves bracketed prose starting with a chat label untouched", () => {
        // "pm:" followed by a space / non-hex char is prose, not an id.
        const a = "A reminder [pm: sync with design] before we go.";
        expect(rewriteCitations(a, noSources)).toBe(a);
        const b = "The [dm:notes] convention stays.";
        expect(rewriteCitations(b, noSources)).toBe(b);
    });
});

// Pass 3 — the raw-id leak the user reported: a model that dumps a bare
// "gm:<uuid>:msg:<uuid>" / "task:42" straight into a sentence, WITHOUT the
// `[type:id]` or `[prose](type:id)` syntax the first two passes handle. The
// reader would otherwise see a decode-failure id. The strip must be
// high-precision: it may never bite prose, times, ratios, URLs, or the
// `spotlight-citation:` links pass 1 produced.
describe("rewriteCitations — Pass 3: unbracketed raw-id leaks", () => {
    it("strips a bare un-prefixed gm:<uuid>:msg:<uuid> id from the prose", () => {
        const out = rewriteCitations(
            "Reviewers needed on the nav PR " +
                "gm:8f5e4733-cee9-4769-8a7f-859b80fa6713:msg:9c17635a-6d4a-4af2-ad56-664070546e56 " +
                "now.",
            noSources
        );
        expect(out).toBe("Reviewers needed on the nav PR now.");
    });

    it("strips a bare chat:dm:<uuid> id", () => {
        const out = rewriteCitations(
            "Bob chat:dm:0738dbef-1111-2222-3333-444455556666:thread:9 said so.",
            noSources
        );
        expect(out).toBe("Bob said so.");
    });

    it("strips digit-bearing vocab ids (task:42, note:personal:50, project:18, milestone:7)", () => {
        expect(rewriteCitations("Per the spike task:42 done.", noSources)).toBe(
            "Per the spike done."
        );
        expect(rewriteCitations("See note:personal:50 here.", noSources)).toBe("See here.");
        expect(rewriteCitations("In project:18 we shipped.", noSources)).toBe("In we shipped.");
        expect(rewriteCitations("Target milestone:7 soon.", noSources)).toBe("Target soon.");
    });

    it("strips a bare structured todo id", () => {
        expect(rewriteCitations("Deferred todo:2026-07-03:item:117 already.", noSources)).toBe(
            "Deferred already."
        );
    });

    it("strips a bare hex-leading un-prefixed chat label", () => {
        expect(rewriteCitations("See dm:aa771315:thread:282012f2 now.", noSources)).toBe(
            "See now."
        );
    });

    it("does NOT touch a resolved spotlight-citation link (pass 1 output survives)", () => {
        // The whole point of the leading boundary: the token in a sentinel
        // URL is preceded by a colon, so the pattern can't bite it.
        const sources = buildSourcesById([
            src(
                "chat",
                "dm:aa771315-3b1c-4916-8ed1-d79efe90bc37:thread:282012f2-9157-4512-a5cd-c9841fb44ca2",
                "Bob DM"
            ),
        ]);
        const out = rewriteCitations(
            "Per [the thread](chat:dm:aa771315-3b1c-4916-8ed1-d79efe90bc37:thread:282012f2-9157-4512-a5cd-c9841fb44ca2) we shipped.",
            sources
        );
        expect(out).toBe(
            `Per [the thread](${CITATION_HREF_PREFIX}chat:dm:aa771315-3b1c-4916-8ed1-d79efe90bc37:thread:282012f2-9157-4512-a5cd-c9841fb44ca2) we shipped.`
        );
    });

    it("does NOT touch prose, times, ratios, or non-hex chat labels", () => {
        // These are the false-positive traps the digit / hex-leading /
        // boundary guards exist for.
        for (const prose of [
            "Meet at 3:30 today.",
            "A 1:1 meeting later.",
            "reminder pm: sync with design now.",
            "The dm:notes convention stays.",
            "Mark task:done please.",
            "TODO Task: fix this bug.",
        ]) {
            expect(rewriteCitations(prose, noSources)).toBe(prose);
        }
    });

    it("does NOT strip an id embedded in a URL path", () => {
        // The leading `(?<![\\w:/.-])` boundary rejects a `/` before the token.
        const a = "See https://ex.com/project:18 for details.";
        expect(rewriteCitations(a, noSources)).toBe(a);
        const b = "Open [the doc](https://ex.com/task:42) now.";
        expect(rewriteCitations(b, noSources)).toBe(b);
    });
});

describe("citedChipSources — msg-suffixed citations chip the parent source", () => {
    it("resolves the :msg: token to the retrieved thread and shows its chip", () => {
        const thread = src("chat", "dm:0738dbef:thread:8995bd1d", "Bob Martinez");
        const uncited = src("task", "task:42");
        const chips = citedChipSources(
            "Agreed ([chat:dm:0738dbef:msg:58ed60f3](chat:dm:0738dbef:msg:58ed60f3)).",
            [thread, uncited]
        );
        expect(chips.map((s) => s.entity_id)).toEqual(["dm:0738dbef:thread:8995bd1d"]);
    });
});

describe("extractInlineCitedIds — link form only", () => {
    it("captures resolved link-form ids and ignores bare tokens", () => {
        const sources = buildSourcesById([
            src("task", "task:42"),
            src("milestone", "milestone:7"),
        ]);
        const answer =
            "The [spike](task:42) and [launch](milestone:7) — but [note:personal:9] is a chip.";
        const ids = extractInlineCitedIds(answer, sources);
        expect(ids.has("task:42")).toBe(true);
        expect(ids.has("milestone:7")).toBe(true);
        // Bare token is stripped → chip, not inline.
        expect(ids.has("note:personal:9")).toBe(false);
    });

    it("does not count an unresolved link (resolve-guard)", () => {
        const sources = buildSourcesById([src("task", "task:42")]);
        const ids = extractInlineCitedIds("A [ghost](task:99) here.", sources);
        expect(ids.has("task:99")).toBe(false);
    });
});

describe("extractBareCitedIds — bare token form only", () => {
    it("captures bare [type:id] tokens and ignores inline links", () => {
        const answer = "A [spike](task:42) link, a [note:personal:9] chip, [milestone:7] too.";
        const ids = extractBareCitedIds(answer);
        // Inline-link id lives in parens → not a bare token.
        expect(ids.has("task:42")).toBe(false);
        expect(ids.has("note:personal:9")).toBe(true);
        expect(ids.has("milestone:7")).toBe(true);
    });

    it("returns an empty set for an answer with no citations", () => {
        expect(extractBareCitedIds("Just prose, no tokens.").size).toBe(0);
    });
});

describe("citedChipSources — cited sources (inline + bare), uncited dropped", () => {
    it("keeps every cited source — inline link OR bare token — and drops uncited", () => {
        const linked = src("task", "task:42", "spike"); // inline link → chip (and prose)
        const bareCited = src("note", "note:personal:9", "methodology"); // bare token → chip
        const uncited = src("project", "project:7", "roadmap"); // retrieved, never cited → dropped
        const answer = "The [spike](task:42) explains it — see [note:personal:9].";
        const chips = citedChipSources(answer, [linked, bareCited, uncited]);
        expect(chips.map((s) => s.entity_id)).toEqual(["task:42", "note:personal:9"]);
    });

    it("keeps a source cited ONLY as an inline link (the empty-chip-row regression)", () => {
        const linked = src("task", "task:42", "spike");
        const uncited = src("note", "note:personal:9");
        // Only an inline link, no bare token — must still produce a chip.
        const chips = citedChipSources("The [spike](task:42) settled it.", [linked, uncited]);
        expect(chips.map((s) => s.entity_id)).toEqual(["task:42"]);
    });

    it("drops uncited retrieved sources (RAG noise)", () => {
        const cited = src("task", "task:42");
        const uncited = src("note", "note:personal:9");
        const chips = citedChipSources("Only [task:42] matters here.", [cited, uncited]);
        expect(chips.map((s) => s.entity_id)).toEqual(["task:42"]);
    });

    it("returns an empty chip row when the answer cites nothing (aggregate/summary)", () => {
        const a = src("task", "task:42");
        const b = src("note", "note:personal:9");
        // e.g. "You have 2 tasks due this week." — prompt exempts aggregate stats from citation.
        expect(citedChipSources("You have 2 tasks due this week.", [a, b])).toEqual([]);
    });

    it("always keeps an operated (write-tool) source, even uncited", () => {
        const operated = {
            ...src("note", "note:personal:88", "Launch plan"),
            operated: true,
        } as SpotlightResult;
        const uncited = src("task", "task:42");
        // The model forgot the citation — the operated chip must survive.
        const chips = citedChipSources("Done — I created the note.", [operated, uncited]);
        expect(chips.map((s) => s.entity_id)).toEqual(["note:personal:88"]);
    });

    it("keeps every cited source, incl. a chat entity_id without the chat: prefix", () => {
        const a = src("task", "task:42");
        const b = src("chat", "dm:9:thread:4"); // normalises to chat:dm:9:thread:4 for matching
        const chips = citedChipSources("Both [task:42] and [chat:dm:9:thread:4].", [a, b]);
        expect(chips).toHaveLength(2);
    });
});

// A milestone is backed by a task (same task_id), so the backend can
// return — and the answer can cite — BOTH a `milestone` chip and the
// `task` chip for its backing task. That's one object shown twice; the
// milestone chip wins and the redundant backing-task chip is dropped.
describe("citedChipSources — milestone / backing-task dedup", () => {
    // task_id lives on the row, not in entity_id — build with the richer helper.
    const withTaskId = (
        entity_type: string,
        entity_id: string,
        task_id: string,
        over: Partial<SpotlightResult> = {}
    ): SpotlightResult =>
        ({ entity_type, entity_id, task_id, title: "", ...over }) as unknown as SpotlightResult;

    it("drops the backing-task chip when its milestone chip is also cited", () => {
        const milestone = withTaskId("milestone", "milestone:7", "500", { title: "v1 launch" });
        const backingTask = withTaskId("task", "task:500", "500", { title: "v1 launch" });
        const answer = "Targeting [v1 launch](milestone:7) — see [task:500].";
        const chips = citedChipSources(answer, [milestone, backingTask]);
        expect(chips.map((s) => s.entity_id)).toEqual(["milestone:7"]);
    });

    it("keeps a task chip whose id does NOT match any cited milestone", () => {
        const milestone = withTaskId("milestone", "milestone:7", "500");
        const otherTask = withTaskId("task", "task:42", "42", { title: "unrelated" });
        const answer = "Milestone [v1](milestone:7) and task [task:42].";
        const chips = citedChipSources(answer, [milestone, otherTask]);
        expect(chips.map((s) => s.entity_id)).toEqual(["milestone:7", "task:42"]);
    });

    it("drops an OPERATED backing-task chip too (milestone chip is the ref)", () => {
        // The write tool marks both the milestone and its backing task
        // `operated`; without dedup the user would see two chips for one
        // created milestone. The milestone chip is the meaningful one.
        const milestone = withTaskId("milestone", "milestone:7", "500", { operated: true });
        const backingTask = withTaskId("task", "task:500", "500", { operated: true });
        const chips = citedChipSources("Done — I created the milestone.", [
            milestone,
            backingTask,
        ]);
        expect(chips.map((s) => s.entity_id)).toEqual(["milestone:7"]);
    });

    it("leaves task chips untouched when no milestone chip is present", () => {
        const t1 = withTaskId("task", "task:500", "500");
        const t2 = withTaskId("task", "task:42", "42");
        const chips = citedChipSources("Both [task:500] and [task:42].", [t1, t2]);
        expect(chips.map((s) => s.entity_id)).toEqual(["task:500", "task:42"]);
    });
});

// A richer builder for sourceToUrl, which reads the deep-link fields
// (project_id / task_id / note_id / chat_*) the minimal `src` helper omits.
const fullSrc = (fields: Partial<SpotlightResult>): SpotlightResult =>
    ({ entity_type: "task", entity_id: "", title: "", ...fields }) as unknown as SpotlightResult;

describe("sourceToUrl — todo deep links", () => {
    it("builds the item URL from the backend entity_id convention", () => {
        expect(sourceToUrl(src("todo", "todo:2026-07-12:item:88"))).toBe(
            "/workspace/todo/2026-07-12/item/88"
        );
    });

    it("returns null for a mangled todo entity_id (navigate fallback)", () => {
        expect(sourceToUrl(src("todo", "todo::item:88"))).toBeNull();
        expect(sourceToUrl(src("todo", ""))).toBeNull();
    });
});

// Delegation to canonicalSpotlightHref closed two dead-link bugs the old
// hand-copied subset had. These pin that the agentQA surface now builds the
// SAME deep links the Spotlight surface does.
describe("sourceToUrl — dead-link fixes via canonicalSpotlightHref delegation", () => {
    it("builds a milestone deep link (old copy had no milestone branch → dead click)", () => {
        const url = sourceToUrl(
            fullSrc({ entity_type: "milestone", entity_id: "milestone:7", project_id: "18" })
        );
        expect(url).toBe("/workspace/tasks/project/18/milestone/7");
    });

    it("links a main-channel chat note with NO thread (old copy hard-required thread_id)", () => {
        // thread_id null → the `thread_id ?? "0"` sentinel path. The old
        // subset returned null here, so the citation no-op'd.
        const url = sourceToUrl(
            fullSrc({
                entity_type: "note",
                entity_id: "note:chat:55",
                note_id: "55",
                note_type: "chat",
                chat_type: "gm",
                chat_id: "12",
                thread_id: null,
            })
        );
        expect(url).toBe("/workspace/notes/chat/gm/12/thread/0/note/55");
    });

    it("still builds the ordinary task / personal-note / chat deep links", () => {
        expect(sourceToUrl(fullSrc({ entity_type: "task", task_id: "9", project_id: "3" }))).toBe(
            "/workspace/tasks/project/3/task/9"
        );
        expect(
            sourceToUrl(fullSrc({ entity_type: "note", note_id: "42", note_type: "personal" }))
        ).toBe("/workspace/notes/my/42");
        expect(
            sourceToUrl(
                fullSrc({ entity_type: "chat", chat_type: "dm", chat_id: "9", thread_id: "4" })
            )
        ).toBe("/workspace/chat/dm/9/thread/4");
    });

    it("keeps the project fallback canonicalSpotlightHref intentionally omits", () => {
        // Projects have no modal view, so canonicalSpotlightHref returns
        // null — but chips/saved-note export still want to navigate there.
        expect(sourceToUrl(fullSrc({ entity_type: "project", project_id: "18" }))).toBe(
            "/workspace/tasks/project/18"
        );
    });

    it("returns null when a source lacks the ids needed to deep-link", () => {
        expect(
            sourceToUrl(fullSrc({ entity_type: "task", task_id: null, project_id: null }))
        ).toBeNull();
        expect(sourceToUrl(fullSrc({ entity_type: "project", project_id: null }))).toBeNull();
    });
});
