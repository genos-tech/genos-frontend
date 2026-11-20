import { useEffect } from "react";

import { buildHeadTags, htmlLangFor, type HeadTag, type SeoLang } from "./seo/head";

interface DocumentMeta {
    title: string;
    description: string;
    /** Share-card title; defaults to `title`. */
    ogTitle?: string;
    /** Share-card description; defaults to `description`. */
    ogDescription?: string;
    /**
     * The language the page is shown in. Leave it out only if the page cannot know:
     * the hook then reads the language the shell (`LpShell`) is rendering.
     */
    lang?: SeoLang;
    /** Page path, e.g. `/blog/some-slug`. Defaults to the current location. */
    path?: string;
    type?: "website" | "article";
    /** ISO date, for articles. */
    publishedTime?: string;
}

/** Marks the nodes this hook created, so cleanup removes exactly those. */
const OWNED = "data-lp-seo";

const tagSelector = (tag: HeadTag): string => {
    if (tag.kind === "meta") return `meta[${tag.attr}="${tag.key}"]`;
    if (tag.rel === "canonical") return `link[rel="canonical"]`;
    return `link[rel="alternate"][hreflang="${tag.hreflang}"]`;
};

const tagAttrs = (tag: HeadTag): Record<string, string> => {
    if (tag.kind === "meta") return { [tag.attr]: tag.key, content: tag.content };
    if (tag.rel === "canonical") return { rel: "canonical", href: tag.href };
    return { rel: "alternate", hreflang: tag.hreflang, href: tag.href };
};

const valueAttr = (tag: HeadTag): "content" | "href" => (tag.kind === "meta" ? "content" : "href");

/**
 * Writes the tags into `<head>` and returns the function that puts the head
 * back: a tag the page (or index.html) already had gets its old value again,
 * a tag this call created is removed. Without that, leaving a marketing page
 * for the sign-in form would keep that page's canonical on the sign-in form.
 */
function applyHead(tags: HeadTag[]): () => void {
    const undo: Array<() => void> = [];
    for (const tag of tags) {
        const attrs = tagAttrs(tag);
        const attr = valueAttr(tag);
        const existing = document.head.querySelector<HTMLElement>(tagSelector(tag));
        if (existing) {
            const previous = existing.getAttribute(attr);
            existing.setAttribute(attr, attrs[attr]);
            undo.push(() => {
                if (previous === null) existing.removeAttribute(attr);
                else existing.setAttribute(attr, previous);
            });
        } else {
            const node = document.createElement(tag.kind);
            for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
            node.setAttribute(OWNED, "");
            document.head.appendChild(node);
            undo.push(() => node.remove());
        }
    }
    return () => undo.forEach((fn) => fn());
}

/** The language `LpShell` is rendering, for a page that was not told (the shell sets it on `.lp-root`). */
const shellLang = (): SeoLang | undefined => {
    const lang = document.querySelector(".lp-root")?.getAttribute("lang");
    return lang === "ja" || lang === "en" ? lang : undefined;
};

/**
 * Title, description, share-card (Open Graph + Twitter), canonical, hreflang
 * alternates and `<html lang>` for a public marketing page.
 *
 * All of it is written client-side, after the page mounts: the SPA ships one
 * `index.html` for every URL, so a crawler that does not run JavaScript sees
 * only that file's generic head (see index.html). Search engines that render
 * JavaScript, and a browser tab, see this.
 */
export function useDocumentMeta(meta: DocumentMeta) {
    useEffect(() => {
        const path = meta.path ?? window.location.pathname;
        const lang = meta.lang ?? shellLang();
        const tags = buildHeadTags({
            title: meta.title,
            description: meta.description,
            ogTitle: meta.ogTitle ?? meta.title,
            ogDescription: meta.ogDescription ?? meta.description,
            path,
            lang,
            type: meta.type,
            publishedTime: meta.publishedTime,
        });

        const previousTitle = document.title;
        document.title = meta.title;
        const root = document.documentElement;
        const previousLang = root.lang;
        const htmlLang = htmlLangFor(path, lang);
        if (htmlLang) root.lang = htmlLang;
        const restoreHead = applyHead(tags);

        return () => {
            document.title = previousTitle;
            // Only undo what this call set, and only if nothing else (the app's
            // own locale switch) has moved it since.
            if (htmlLang && root.lang === htmlLang) root.lang = previousLang;
            restoreHead();
        };
    }, [
        meta.title,
        meta.description,
        meta.ogTitle,
        meta.ogDescription,
        meta.lang,
        meta.path,
        meta.type,
        meta.publishedTime,
    ]);
}
