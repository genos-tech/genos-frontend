/**
 * "Is this message nothing but emoji?" — the test behind the enlarged
 * (Slack-style jumbo) rendering in `LightMessageBody`.
 *
 * Runs on EVERY light-path message render, so it short-circuits on the
 * first disqualifying block/inline and only segments the text runs of
 * bodies that are still candidates. It is also total: any unexpected
 * shape answers "not emoji-only" rather than throwing, because throwing
 * here would take down the whole message list, not one bubble.
 *
 * Custom (team) emoji count as emoji — they read as emoji to the user,
 * and a `:party:`-only message should jumbo like a 🎉-only one.
 */

/** Emoji beyond this many stay at normal size — a wall of jumbo emoji is
 *  a worse message than a small one. Slack's own cut-off is ~23. */
export const MAX_JUMBO_EMOJI = 24;

// Only the sliver of `Intl.Segmenter` used here. Declared locally because
// the project targets the ES2020 lib, which predates it — and the runtime
// guard below is required regardless (Firefox only shipped it in 125).
type GraphemeSegmenter = { segment(input: string): Iterable<{ segment: string }> };
type SegmenterCtor = new (
    locales?: string | string[],
    options?: { granularity: "grapheme" }
) => GraphemeSegmenter;

// Hoisted: constructing a segmenter per message would fight the whole
// point of the light path (~200 rows re-render on a chat switch).
// `undefined` on a runtime without it — callers then treat every body as
// "not emoji-only", which is a missed enlargement, never a broken render.
const graphemes: GraphemeSegmenter | undefined = (() => {
    const ctor = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;
    if (typeof ctor !== "function") return undefined;
    try {
        return new ctor(undefined, { granularity: "grapheme" });
    } catch {
        return undefined;
    }
})();

// A grapheme cluster is an emoji when it CONTAINS a pictographic
// character, is a regional-indicator pair (flags: 🇯🇵), or is a keycap
// sequence (1️⃣, ending U+20E3).
//
// Deliberately not `\p{Emoji}` / `\p{Emoji_Component}`: those match the
// ASCII digits, `#` and `*` that keycaps are built from, so "123" would
// read as three emoji — the classic false positive this rule dodges.
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const REGIONAL_INDICATOR_PAIR = /^\p{Regional_Indicator}{2}$/u;
const KEYCAP = /⃣$/u;

const isEmojiCluster = (cluster: string): boolean =>
    PICTOGRAPHIC.test(cluster) || REGIONAL_INDICATOR_PAIR.test(cluster) || KEYCAP.test(cluster);

/**
 * Emoji in a text run, or `null` if it holds anything else. Whitespace
 * is ignored ("👍 👍" is still emoji-only, per the request).
 */
function countEmojiInText(text: string): number | null {
    if (!graphemes) return null;
    let count = 0;
    for (const { segment } of graphemes.segment(text)) {
        if (segment.trim() === "") continue;
        if (!isEmojiCluster(segment)) return null;
        count += 1;
    }
    return count;
}

type AnyBlock = Record<string, any>;

/**
 * How many emoji this body consists of, or 0 when it is not emoji-only.
 *
 * Emoji-only means: paragraphs only (a heading or list item is its own
 * formatting statement), no nested blocks, and every inline is either a
 * custom emoji or a text run of emoji and whitespace. Empty paragraphs
 * are skipped rather than disqualifying, so a multi-line emoji message
 * still counts.
 *
 * `blocks` is the ALREADY-SLICED list the renderer paints (the composer's
 * trailing empty paragraph removed) — passing the raw body would work
 * too, since a trailing empty paragraph is skipped either way.
 */
export function countEmojiOnlyBody(blocks: unknown): number {
    if (!Array.isArray(blocks) || blocks.length === 0) return 0;

    let total = 0;
    for (const raw of blocks) {
        if (typeof raw !== "object" || raw === null) return 0;
        const block = raw as AnyBlock;

        if ((block.type ?? "paragraph") !== "paragraph") return 0;
        if (Array.isArray(block.children) && block.children.length > 0) return 0;

        const content = block.content;
        if (!Array.isArray(content)) {
            // No inline content at all (an empty paragraph) — neutral.
            if (content == null) continue;
            return 0;
        }

        for (const item of content) {
            if (typeof item === "string") {
                const n = countEmojiInText(item);
                if (n === null) return 0;
                total += n;
                continue;
            }
            if (typeof item !== "object" || item === null) return 0;
            const inline = item as AnyBlock;
            const type = inline.type ?? "text";

            if (type === "customEmoji") {
                total += 1;
                continue;
            }
            if (type === "text") {
                const n = countEmojiInText(typeof inline.text === "string" ? inline.text : "");
                if (n === null) return 0;
                total += n;
                continue;
            }
            // link / mention / mentionGroup / anything else — not emoji.
            return 0;
        }
    }

    return total;
}

/** Should this body render at jumbo size? */
export const isJumboEmojiBody = (blocks: unknown): boolean => {
    const count = countEmojiOnlyBody(blocks);
    return count > 0 && count <= MAX_JUMBO_EMOJI;
};
