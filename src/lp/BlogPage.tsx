import { useMemo } from "react";
import { Link } from "react-router-dom";

import { formatBlogDate, listBlogArticles, type BlogArticle } from "./blog/blog";
import { pictureSize } from "./blog/pictureSize";
import { Flow } from "./guides/Flow";
import { LpShell } from "./kit/LpShell";
import { BLOG_META } from "./seo/pageMeta";
import { useDocumentMeta } from "./useDocumentMeta";

function Cover({ article }: { article: BlogArticle }) {
    if (article.cover) {
        // Decoration: the card's title says what it is.
        return (
            <img
                alt=""
                className="lp-post__cover"
                decoding="async"
                loading="lazy"
                src={article.cover}
                {...pictureSize(article.cover)}
            />
        );
    }
    return (
        <div aria-hidden className="lp-post__cover lp-post__cover--flow">
            <Flow steps={article.coverFlow ?? []} />
        </div>
    );
}

/**
 * `/blog` — a grid of pictures, one per post (MIP-2416). Posts are generated snapshots of
 * genos-docs/marketing/blog; append via articles.json + `npm run blog:sync`.
 */
export default function BlogPage() {
    useDocumentMeta(BLOG_META);
    const articles = useMemo(() => listBlogArticles(), []);

    return (
        <LpShell active="blog">
            {() => (
                <div lang="en">
                    <header className="lp-pagehead">
                        <div className="lp-container lp-stack-m">
                            <p className="lp-kicker">Blog</p>
                            <h1 className="lp-title">What you can do with Genos</h1>
                            <p className="lp-lead">Short posts, mostly pictures.</p>
                        </div>
                    </header>

                    <div className="lp-container lp-pagebody">
                        <div className="lp-postgrid">
                            {articles.map((article) => (
                                <Link
                                    key={article.slug}
                                    className="lp-post"
                                    to={`/blog/${article.slug}`}
                                >
                                    <Cover article={article} />
                                    <div className="lp-post__meta">
                                        <span>{article.category}</span>
                                        <time dateTime={article.publishedAt}>
                                            {formatBlogDate(article.publishedAt)}
                                        </time>
                                    </div>
                                    <h2 className="lp-post__title">{article.title}</h2>
                                    <p className="lp-post__excerpt">{article.excerpt}</p>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </LpShell>
    );
}
