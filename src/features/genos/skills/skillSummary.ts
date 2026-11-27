/**
 * The one line that says what a skill does where it is chosen (MIP-2441): the first sentence of
 * its description. Only the first, because some descriptions go on to steps a scheduled run never
 * takes ("after a yes set the due dates"). The segmenter knows "。", "؟" and "।", and does not end a
 * sentence at "2.5" or "e.g. tasks". Without it (Firefox before 125) the whole description is
 * returned; the list clamps it to two lines either way.
 */
const sentences = (() => {
    if (typeof Intl.Segmenter !== "function") return undefined;
    return new Intl.Segmenter(undefined, { granularity: "sentence" });
})();

export const skillSummary = (description: string): string => {
    const text = description.trim();
    if (!sentences) return text;
    for (const { segment } of sentences.segment(text)) return segment.trim();
    return "";
};
