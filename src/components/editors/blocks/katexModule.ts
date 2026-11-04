/**
 * KaTeX, and its stylesheet, as ONE module that is only ever imported with
 * `import()` (see `loadRenderers.ts`): the editors build their schema, and so need the
 * math specs, as soon as one mounts, but KaTeX (about 78 kB gzip) and its CSS are only
 * needed once a formula is drawn. Nothing else may import this file (a test scans for it).
 */
import katex from "katex";

import "katex/dist/katex.min.css";

export type Katex = typeof katex;

/**
 * KaTeX's output for a formula, as the math package renders it (MathML and HTML,
 * display or inline), with the safety options written out instead of left to defaults.
 * Other people's TeX is rendered in your browser, so `trust` stays false: with it, `\href`,
 * `\includegraphics` and `\htmlClass` would produce links, images and attributes.
 * `MathDiagramSecurity.test.ts` pins this.
 */
export const katexToHtml = (
    source: string,
    inline: boolean
): { html: string; error: string | undefined } => {
    const options = {
        displayMode: !inline,
        output: "htmlAndMathml",
        trust: false,
    } as const;
    try {
        return {
            html: katex.renderToString(source, { ...options, throwOnError: true }),
            error: undefined,
        };
    } catch (error) {
        // The package shows KaTeX's own error rendering next to the message.
        return {
            html: katex.renderToString(source, { ...options, throwOnError: false }),
            error: error instanceof Error ? error.message : String(error),
        };
    }
};

export default katex;
