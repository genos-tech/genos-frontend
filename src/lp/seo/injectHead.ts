import type { HeadTag, SeoLang } from "./head";

/** Marks every tag written into the served HTML, so the client can drop them before it sets its own. */
export const PRERENDER_ATTR = "data-seo-prerender";

const escapeAttr = (s: string): string =>
    s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeText = (s: string): string =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const render = (tag: HeadTag): string =>
    tag.kind === "meta"
        ? `<meta ${tag.attr}="${escapeAttr(tag.key)}" content="${escapeAttr(tag.content)}" ${PRERENDER_ATTR}>`
        : tag.rel === "canonical"
          ? `<link rel="canonical" href="${escapeAttr(tag.href)}" ${PRERENDER_ATTR}>`
          : `<link rel="alternate" hreflang="${escapeAttr(tag.hreflang)}" href="${escapeAttr(tag.href)}" ${PRERENDER_ATTR}>`;

/** Matches the tag `index.html` already carries for the same key, so it is replaced, not duplicated. */
const existing = (tag: HeadTag): RegExp =>
    tag.kind === "meta"
        ? new RegExp(`<meta\\s+${tag.attr}="${escapeRegExp(tag.key)}"[^>]*>`)
        : tag.rel === "canonical"
          ? /<link\s+rel="canonical"[^>]*>/
          : new RegExp(
                `<link\\s+rel="alternate"\\s+hreflang="${escapeRegExp(tag.hreflang)}"[^>]*>`
            );

export interface InjectSpec {
    title: string;
    htmlLang?: SeoLang;
    tags: readonly HeadTag[];
}

/**
 * The shipped `index.html` with one page's head written into it: the same tags
 * `useDocumentMeta` sets after mount (so a crawler that does not run JavaScript
 * sees them too), the page `<title>` and, where the whole page follows the
 * ja/en toggle, `<html lang>`. Everything else in the file (scripts, JSON-LD,
 * icons) is untouched. Throws if the file has no `<title>` or `</head>`: a
 * template this function cannot read must fail the build, not ship unchanged.
 */
export const injectHead = (indexHtml: string, spec: InjectSpec): string => {
    let html = indexHtml;
    const title = `<title ${PRERENDER_ATTR}>${escapeText(spec.title)}</title>`;
    if (!/<title>[^<]*<\/title>/.test(html) || !html.includes("</head>")) {
        throw new Error("injectHead: index.html has no <title> or </head>");
    }
    html = html.replace(/<title>[^<]*<\/title>/, () => title);
    if (spec.htmlLang) {
        if (!/<html lang="[a-z-]+"/.test(html)) throw new Error("injectHead: no <html lang>");
        html = html.replace(/<html lang="[a-z-]+"/, `<html lang="${spec.htmlLang}"`);
    }
    const added: string[] = [];
    for (const tag of spec.tags) {
        const re = existing(tag);
        if (re.test(html)) html = html.replace(re, () => render(tag));
        else added.push(render(tag));
    }
    if (added.length) {
        html = html.replace("</head>", () => `        ${added.join("\n        ")}\n    </head>`);
    }
    return html;
};
