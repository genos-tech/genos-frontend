import articlesManifest from "./articles.json";

/**
 * Public LP blog — English posts synced from genos-docs/marketing/blog. Picture first, short
 * (MIP-2416; `lpBlogVisualMIP2416.test.tsx` pins it).
 *
 * To add a post:
 *   1. Write the draft in genos-docs/marketing (English).
 *   2. Append one entry to `articles.json` (slug, source, bodyHeading, …).
 *   3. Run `npm run blog:sync` in genos-frontend (needs sibling genos-docs).
 *   4. Commit the updated `articles.json` + generated `articles/<slug>.md`.
 *
 * Deploy never reads genos-docs; only the generated snapshots ship.
 */

export type BlogArticleMeta = {
    slug: string;
    source: string;
    bodyHeading: string;
    stopHeading?: string;
    title: string;
    excerpt: string;
    language: "en";
    category: string;
    publishedAt: string;
    /** The card's picture, a path under `public/`. A post has this or `coverFlow`. */
    cover?: string;
    /** The card's diagram, for a post with no screenshot. */
    coverFlow?: string[];
};

export type BlogArticle = BlogArticleMeta & {
    body: string;
};

const bodies = import.meta.glob("./articles/*.md", {
    query: "?raw",
    import: "default",
    eager: true,
}) as Record<string, string>;

const stripGeneratedBanner = (raw: string): string =>
    raw.replace(/^<!--[\s\S]*?-->\s*/u, "").trim();

const bySlug = new Map<string, BlogArticle>();

for (const meta of articlesManifest as BlogArticleMeta[]) {
    if (meta.language !== "en") continue;
    const key = `./articles/${meta.slug}.md`;
    const raw = bodies[key];
    if (!raw) {
        throw new Error(
            `Blog article "${meta.slug}" is listed in articles.json but ` +
                `src/lp/blog/articles/${meta.slug}.md is missing. Run npm run blog:sync.`
        );
    }
    bySlug.set(meta.slug, { ...meta, body: stripGeneratedBanner(raw) });
}

/** Newest first; posts of one day keep the manifest's order. */
export const listBlogArticles = (): BlogArticle[] =>
    [...bySlug.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

export const getBlogArticle = (slug: string): BlogArticle | undefined => bySlug.get(slug);

export const formatBlogDate = (isoDate: string): string => {
    const [year, month, day] = isoDate.split("-").map(Number);
    if (!year || !month || !day) return isoDate;
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
    });
};
