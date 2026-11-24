import type { Manual } from "../../manual/manualSource";
import { topicSummary } from "../manual/summary";
import type { SeoLang } from "./head";

/**
 * The head of each `/docs/<topic>` page, taken from the manual JSON: title is the topic's title,
 * description its opening paragraph. Node-safe (no React): the build step that writes the pages'
 * heads and the sitemap (scripts/lpSeo.ts) reads the JSON files and passes them through here.
 */
export type ManualTopicHead = { id: string; title: string; description: string };

/** The topics of each language that has a manual. `en` is the list of pages that exist. */
export type ManualHeads = Partial<Record<SeoLang, readonly ManualTopicHead[]>>;

export const manualTopicHeads = (manual: Manual): ManualTopicHead[] =>
    manual.topics.map((t) => ({ id: t.id, title: t.title, description: topicSummary(t) }));

/** The paths of the manual's topic pages. */
export const manualTopicPaths = (heads: ManualHeads): string[] =>
    (heads.en ?? []).map((t) => `/docs/${t.id}`);
