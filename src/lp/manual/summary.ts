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

const firstSentence = (text: string): string => {
    const m = text.match(/^.*?(?:[.!?](?=\s)|[。！？])/);
    return (m ? m[0] : text).trim();
};

export const topicSummary = (topic: ManualTopic): string => {
    const blocks = parseBlocks(topic.markdown);
    const paragraphs = blocks.flatMap((b) => (b.type === "paragraph" ? [plainText(b.text)] : []));
    // A topic that opens with a list has no paragraph: use the first item's first sentence, so the
    // card never repeats the topic's title.
    const items = blocks.flatMap((b) =>
        b.type === "ul" || b.type === "ol" ? b.items.map((i) => firstSentence(plainText(i))) : []
    );
    const text =
        paragraphs.find((t) => standsAlone(t, topic.title)) ??
        items.find((t) => t !== topic.title && t.length >= 10) ??
        paragraphs[0] ??
        topic.title;
    if (text.length <= MAX) return text;
    const cut = text.slice(0, MAX);
    // Prefer the end of a sentence, then the last space, else cut hard (Japanese has no spaces).
    const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("。"));
    if (sentence > 60) return cut.slice(0, sentence + 1).trim();
    const space = cut.lastIndexOf(" ");
    return `${(space > 60 ? cut.slice(0, space) : cut).replace(/[,;:、]$/, "")}…`;
};
