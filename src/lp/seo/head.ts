import { routeFor, SHARE_IMAGE_PATH, SHARE_IMAGE_SIZE, SITE_ORIGIN } from "./routes";

/** The two languages the marketing pages are written in (same as `Lang` in lpLang.ts). */
export type SeoLang = "ja" | "en";

export interface HeadSpec {
    title: string;
    description: string;
    ogTitle: string;
    ogDescription: string;
    /** Path of the page, e.g. `/plans` (no origin, no query). */
    path: string;
    /** The language the page is shown in, when it has one (drives hreflang and og:locale). */
    lang?: SeoLang;
    type?: "website" | "article";
    /** ISO date, for articles. */
    publishedTime?: string;
}

export type HeadTag =
    | { kind: "meta"; attr: "name" | "property"; key: string; content: string }
    | { kind: "link"; rel: "canonical"; href: string }
    | { kind: "link"; rel: "alternate"; hreflang: string; href: string };

const OG_LOCALE: Record<SeoLang, string> = { ja: "ja_JP", en: "en_US" };

/** `/path` for English, `/path?lang=ja` for Japanese: the shareable form the app already honours. */
export const pageUrl = (path: string, lang: SeoLang = "en"): string =>
    `${SITE_ORIGIN}${path}${lang === "ja" ? "?lang=ja" : ""}`;

/**
 * Every head tag a public page should carry, as data. `useDocumentMeta` applies
 * them to the live document; tests assert on them directly.
 *
 * Canonical is the page's own URL in the language it is shown in, never a
 * different page: a Japanese page canonicalising to its English twin would
 * tell search engines to drop the Japanese one.
 */
export const buildHeadTags = (spec: HeadSpec): HeadTag[] => {
    const route = routeFor(spec.path);
    const toggles = route?.langs === "toggle";
    const lang = toggles ? (spec.lang ?? "en") : undefined;
    const url = pageUrl(spec.path, lang);
    const image = `${SITE_ORIGIN}${SHARE_IMAGE_PATH}`;
    const m = (attr: "name" | "property", key: string, content: string): HeadTag => ({
        kind: "meta",
        attr,
        key,
        content,
    });

    const tags: HeadTag[] = [
        m("name", "description", spec.description),
        m("property", "og:type", spec.type ?? "website"),
        m("property", "og:site_name", "Genos"),
        m("property", "og:title", spec.ogTitle),
        m("property", "og:description", spec.ogDescription),
        m("property", "og:url", url),
        m("property", "og:image", image),
        m("property", "og:image:width", String(SHARE_IMAGE_SIZE.width)),
        m("property", "og:image:height", String(SHARE_IMAGE_SIZE.height)),
        m("property", "og:image:alt", "Genos"),
        m("name", "twitter:card", "summary_large_image"),
        m("name", "twitter:title", spec.ogTitle),
        m("name", "twitter:description", spec.ogDescription),
        m("name", "twitter:image", image),
        { kind: "link", rel: "canonical", href: url },
    ];
    if (lang) tags.push(m("property", "og:locale", OG_LOCALE[lang]));
    if (spec.type === "article" && spec.publishedTime) {
        tags.push(m("property", "article:published_time", spec.publishedTime));
    }
    if (toggles) {
        tags.push(
            { kind: "link", rel: "alternate", hreflang: "en", href: pageUrl(spec.path, "en") },
            { kind: "link", rel: "alternate", hreflang: "ja", href: pageUrl(spec.path, "ja") },
            { kind: "link", rel: "alternate", hreflang: "x-default", href: pageUrl(spec.path) }
        );
    }
    return tags;
};

/**
 * The `<html lang>` a page should set: only where the page is wholly in one
 * language. A bilingual legal page leaves the app's own value alone.
 */
export const htmlLangFor = (path: string, lang?: SeoLang): SeoLang | undefined => {
    const route = routeFor(path);
    if (route?.langs === "en-only") return "en";
    if (route?.langs === "toggle") return lang ?? "en";
    return undefined;
};
