import type { ManualTopic } from "../../manual/manualSource";
import { parseBlocks, plainText } from "./markdown";

/**
 * A topic's one-line summary: its opening paragraph, cut at a word (or, for Japanese, a sentence)
 * boundary. It is the text under the topic's name on the hub and the page's meta description, so
 * neither needs words the manual does not have.
 */
const MAX = 155;

/** A paragraph worth showing alone: not the title again, not a lead-in that ends with a colon. */
const standsAlone = (text: string, title: string): boolean =>
    text !== title && !/[:：]$/.test(text) && text.length >= 25;

export const topicSummary = (topic: ManualTopic): string => {
    const paragraphs = parseBlocks(topic.markdown).flatMap((b) =>
        b.type === "paragraph" ? [plainText(b.text)] : []
    );
    const text =
        paragraphs.find((t) => standsAlone(t, topic.title)) ?? paragraphs[0] ?? topic.title;
    if (text.length <= MAX) return text;
    const cut = text.slice(0, MAX);
    // Prefer the end of a sentence, then the last space, else cut hard (Japanese has no spaces).
    const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("。"));
    if (sentence > 60) return cut.slice(0, sentence + 1).trim();
    const space = cut.lastIndexOf(" ");
    return `${(space > 60 ? cut.slice(0, space) : cut).replace(/[,;:、]$/, "")}…`;
};
