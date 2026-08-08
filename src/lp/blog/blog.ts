import articlesManifest from "./articles.json";

/**
 * Public LP blog — English articles synced from genos-docs/marketing.
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
    featured?: boolean;
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

/** Newest first. Stable for a given manifest. */
export const listBlogArticles = (): BlogArticle[] =>
    [...bySlug.values()].sort((a, b) => {
        if (a.publishedAt !== b.publishedAt) {
            return a.publishedAt < b.publishedAt ? 1 : -1;
        }
        return a.title.localeCompare(b.title);
    });

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
