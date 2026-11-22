import { HOME_COPY } from "../copy/home";
import { SEGMENTS, type SegmentKey } from "../segments";
import { buildHeadTags, htmlLangFor, type HeadSpec, type HeadTag, type SeoLang } from "./head";
import { injectHead } from "./injectHead";
import {
    ACCESSIBILITY_META,
    articleMeta,
    BLOG_META,
    CHANGELOG_META,
    CONTACT_META,
    COOKIES_META,
    DEVELOPERS_META,
    DOCS_META,
    LEGAL_META,
    MIGRATE_META,
    PRIVACY_META,
    SECURITY_META,
    SUBPROCESSORS_META,
    SUPPORT_META,
    TERMS_META,
} from "./pageMeta";
import { LP_ROUTES, routeFor } from "./routes";

/**
 * The head of every public page as plain data, for the build step that writes it
 * into the served HTML (scripts/lpSeo.ts) and for tests. Node-safe: no React.
 *
 * Every title and description here is the SAME object the page itself passes to
 * `useDocumentMeta`, so the HTML a crawler receives and the head the page sets
 * after it mounts cannot drift apart. (Plans, features and demo keep their
 * metas here rather than inside the page component for that reason.)
 */

type Meta = { title: string; description: string };

export const PLANS_META: Record<SeoLang, Meta> = {
    ja: {
        title: "料金 | Genos",
        description:
            "Free・Core・Pro・Max・Enterprise。プランごとの上限と機能を一覧で比べられます。",
    },
    en: {
        title: "Pricing | Genos",
        description:
            "Free, Core, Pro, Max and Enterprise: compare the limits and features of every plan in one table.",
    },
};

export const FEATURES_META: Record<SeoLang, Meta> = {
    ja: {
        title: "機能 | Genos",
        description:
            "チャット・タスク・ノート・受信箱・カレンダー、そしてGenos AIとMCP。Genosでできることを一覧で。",
    },
    en: {
        title: "Features | Genos",
        description:
            "Chat, tasks, notes, Inbox and calendar, plus Genos AI and MCP: everything Genos does, in one list.",
    },
};

export const DEMO_META: Record<SeoLang, Meta> = {
    ja: {
        title: "デモの見方 | Genos",
        description:
            "サンプルチームのワークスペースで、Genosの検索とAIを試すためのガイド。そのまま貼って使える質問つき。",
    },
    en: {
        title: "Demo guide | Genos",
        description:
            "A guide to the sample-team workspace: what is inside, and prompts you can paste to see Genos search and AI work.",
    },
};

export interface BlogArticleHead {
    slug: string;
    title: string;
    excerpt: string;
    publishedAt: string;
    language: string;
}

const SEGMENT_PATHS: Record<string, SegmentKey> = {
    "/for-research": "research",
    "/for-teams": "teams",
    "/for-projects": "projects",
    "/for-students": "students",
};

const TOGGLE_META: Record<string, Record<SeoLang, Meta>> = {
    "/plans": PLANS_META,
    "/features-guide": FEATURES_META,
    "/demo-guide": DEMO_META,
    "/contact": CONTACT_META,
    "/support": SUPPORT_META,
    "/migrate": MIGRATE_META,
    "/docs": DOCS_META,
    "/security": SECURITY_META,
    "/accessibility": ACCESSIBILITY_META,
    "/changelog": CHANGELOG_META,
};

const SINGLE_META: Record<string, Meta> = {
    "/blog": BLOG_META,
    "/developers": DEVELOPERS_META,
    "/privacy": PRIVACY_META,
    "/subprocessors": SUBPROCESSORS_META,
    "/cookies": COOKIES_META,
    "/legal": LEGAL_META,
    "/terms": TERMS_META,
};

/** The head spec of a public page, or undefined when the page has no meta of its own. */
export const headSpecFor = (
    path: string,
    lang: SeoLang,
    articles: readonly BlogArticleHead[] = []
): HeadSpec | undefined => {
    const route = routeFor(path);
    if (!route) return undefined;
    const key = route.path;
    const toggles = route.langs === "toggle";
    const shown = toggles ? lang : undefined;
    const withLang = (m: Meta, extra: Partial<HeadSpec> = {}): HeadSpec => ({
        title: m.title,
        description: m.description,
        ogTitle: m.title,
        ogDescription: m.description,
        path: key,
        lang: shown,
        ...extra,
    });

    if (key === "/" || key === "/home") {
        const m = HOME_COPY[lang].meta;
        return withLang(m);
    }
    const segment = SEGMENT_PATHS[key];
    if (segment) {
        const m = SEGMENTS[segment][lang].meta;
        return withLang(m, { ogTitle: m.ogTitle, ogDescription: m.ogDescription });
    }
    const toggle = TOGGLE_META[key];
    if (toggle) return withLang(toggle[lang]);
    const single = SINGLE_META[key];
    if (single) return withLang(single);

    const slug = /^\/blog\/([^/]+)$/.exec(key.toLowerCase())?.[1];
    const article = slug ? articles.find((a) => a.slug.toLowerCase() === slug) : undefined;
    if (article) {
        return withLang(articleMeta(article), {
            ogTitle: article.title,
            type: "article",
            publishedTime: article.publishedAt,
            path: `/blog/${article.slug}`,
        });
    }
    return undefined;
};

export interface PageHead {
    /** Request path the file answers, e.g. `/plans`. */
    path: string;
    /** `ja` for the `?lang=ja` version of a toggle route, else `en`. */
    lang: SeoLang;
    title: string;
    htmlLang: SeoLang | undefined;
    tags: HeadTag[];
}

/**
 * One entry per distinct served head: every fixed route (and its `?lang=ja`
 * twin where the page toggles) and every English blog article.
 */
export const allPageHeads = (articles: readonly BlogArticleHead[]): PageHead[] => {
    const paths = [
        ...LP_ROUTES.map((r) => r.path),
        ...articles.filter((a) => a.language === "en").map((a) => `/blog/${a.slug}`),
    ];
    const out: PageHead[] = [];
    for (const path of paths) {
        const toggles = routeFor(path)?.langs === "toggle";
        for (const lang of toggles ? (["en", "ja"] as const) : (["en"] as const)) {
            const spec = headSpecFor(path, lang, articles);
            if (!spec) continue;
            out.push({
                path,
                lang,
                title: spec.title,
                htmlLang: htmlLangFor(spec.path, spec.lang),
                tags: buildHeadTags(spec),
            });
        }
    }
    return out;
};

export interface SeoPage {
    path: string;
    lang: SeoLang;
    /** Where the file goes inside dist/. */
    file: string;
    html: string;
}

/** The `_seo/**` copies of `index.html` the build writes, one per `allPageHeads` entry. */
export const buildSeoPages = (template: string, articles: readonly BlogArticleHead[]): SeoPage[] =>
    allPageHeads(articles).map((head) => ({
        path: head.path,
        lang: head.lang,
        file: `_seo/${head.lang}${head.path === "/" ? "/index" : head.path}.html`,
        html: injectHead(template, head),
    }));
