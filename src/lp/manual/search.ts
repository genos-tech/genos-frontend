import type { Manual } from "../../manual/manualSource";
import { parseBlocks, plainText } from "./markdown";

/**
 * The search over the manual (MIP-2331). It runs in the visitor's browser over the same JSON the
 * pages render from; nothing is sent anywhere. Plain substring matching on normalised text works
 * for Japanese (no spaces between words) as well as English, and finds a setting by the name the
 * app shows for it.
 */

export type SearchEntry = {
    kind: "section" | "setting";
    topicId: string;
    topicTitle: string;
    /** The section heading, or the setting's name. Null for a topic's opening text. */
    heading: string | null;
    /** Anchor inside the topic page, or null for the top of it. */
    anchor: string | null;
    text: string;
    /** Normalised title, heading and text, for matching. */
    haystack: string;
    titleHay: string;
    headingHay: string;
};

export type SearchHit = {
    entry: SearchEntry;
    score: number;
    snippet: { before: string; match: string; after: string } | null;
};

/** Lower-case, full-width to half-width, so "ＡＰＩ" and "api" meet. */
export const normalise = (text: string): string => text.normalize("NFKC").toLowerCase();

const entry = (
    kind: SearchEntry["kind"],
    topicId: string,
    topicTitle: string,
    heading: string | null,
    anchor: string | null,
    text: string
): SearchEntry => ({
    kind,
    topicId,
    topicTitle,
    heading,
    anchor,
    text,
    haystack: normalise(`${topicTitle}\n${heading ?? ""}\n${text}`),
    titleHay: normalise(topicTitle),
    headingHay: normalise(heading ?? ""),
});

/** One entry per `##` section of every topic, and one per setting of the settings map. */
export const buildSearchIndex = (manual: Manual): SearchEntry[] => {
    const out: SearchEntry[] = [];
    const headingIds = new Map<string, Map<string, string>>();

    for (const topic of manual.topics) {
        const blocks = parseBlocks(topic.markdown);
        const ids = new Map<string, string>();
        let heading: string | null = null;
        let anchor: string | null = null;
        let body: string[] = [];
        const flush = () => {
            const text = body.join(" ").trim();
            if (heading !== null || text !== "") {
                out.push(entry("section", topic.id, topic.title, heading, anchor, text));
            }
            body = [];
        };
        for (const block of blocks) {
            if (block.type === "heading") {
                ids.set(normalise(block.text), block.id);
                if (block.level === 2) {
                    flush();
                    heading = plainText(block.text);
                    anchor = block.id;
                } else {
                    body.push(plainText(block.text));
                }
            } else if (block.type === "paragraph") {
                body.push(plainText(block.text));
            } else if (block.type === "ul" || block.type === "ol") {
                body.push(...block.items.map(plainText));
            } else {
                body.push(...block.head.map(plainText));
                for (const row of block.rows) body.push(row.map(plainText).join(" "));
            }
        }
        flush();
        headingIds.set(topic.id, ids);
    }

    // Settings: link each to the topic that explains it, else to its tab's heading in Settings A-Z.
    const tabLabel = new Map(
        manual.settings.filter((s) => s.kind === "tab").map((s) => [s.tab, s.label])
    );
    const explainedBy = (id: string, tab: string): string | undefined =>
        manual.topics.find((t) => t.settings.includes(id))?.id ??
        manual.topics.find((t) => t.settings.includes(tab))?.id;
    const reference = manual.topics.find((t) => t.id === "settings-reference");
    for (const setting of manual.settings) {
        const label = plainText(setting.label);
        const tab = tabLabel.get(setting.tab) ?? setting.tab;
        const topicId = explainedBy(setting.id, setting.tab);
        const topic = manual.topics.find((t) => t.id === topicId) ?? reference;
        if (!topic) continue;
        // Where it is listed: the explaining topic's top, or the tab's heading in Settings A-Z.
        const anchor =
            topic === reference ? (headingIds.get(topic.id)?.get(normalise(tab)) ?? null) : null;
        const where = setting.kind === "row" ? `${tab} · ${label}` : label;
        out.push(entry("setting", topic.id, topic.title, label, anchor, where));
    }
    return out;
};

const SNIPPET_RADIUS = 70;

const snippetFor = (text: string, term: string): SearchHit["snippet"] => {
    const at = normalise(text).indexOf(term);
    // Normalising can change the length (full-width characters keep it, ligatures do not), so a
    // position from the normalised copy is only used when the lengths agree.
    if (at < 0 || normalise(text).length !== text.length) return null;
    const start = Math.max(0, at - SNIPPET_RADIUS);
    const end = Math.min(text.length, at + term.length + SNIPPET_RADIUS);
    return {
        before: `${start > 0 ? "…" : ""}${text.slice(start, at)}`,
        match: text.slice(at, at + term.length),
        after: `${text.slice(at + term.length, end)}${end < text.length ? "…" : ""}`,
    };
};

/** Every word of the query must appear; title and heading matches rank above body matches. */
export const search = (index: readonly SearchEntry[], query: string, limit = 20): SearchHit[] => {
    const terms = normalise(query).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    const hits: SearchHit[] = [];
    for (const e of index) {
        if (!terms.every((t) => e.haystack.includes(t))) continue;
        let score = e.kind === "setting" ? 6 : 0;
        for (const t of terms) {
            if (e.headingHay.includes(t)) score += e.kind === "setting" ? 12 : 8;
            if (e.titleHay.includes(t)) score += 4;
            if (normalise(e.text).includes(t)) score += 1;
        }
        hits.push({ entry: e, score, snippet: e.text ? snippetFor(e.text, terms[0]) : null });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, limit);
};

/** The page address of a hit. */
export const hitPath = (e: SearchEntry): string =>
    `/docs/${e.topicId}${e.anchor ? `#${e.anchor}` : ""}`;
