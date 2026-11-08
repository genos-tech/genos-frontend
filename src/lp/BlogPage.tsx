import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { formatBlogDate, listBlogArticles, type BlogArticle } from "./blog/blog";
import { LpShell } from "./kit/LpShell";

function PostMeta({ article }: { article: BlogArticle }) {
    return (
        <div className="lp-post__meta">
            <span>{article.category}</span>
            <time dateTime={article.publishedAt}>{formatBlogDate(article.publishedAt)}</time>
        </div>
    );
}

/**
 * `/blog` — English marketing / engineering blog for the public LP.
 * Articles are generated snapshots of genos-docs/marketing drafts;
 * append via articles.json + `npm run blog:sync`.
 */
export default function BlogPage() {
    const articles = useMemo(() => listBlogArticles(), []);
    const featured = articles.filter((a) => a.featured);

    return (
        <LpShell active="blog">
            {() => (
                <div lang="en">
                    <header className="lp-pagehead">
                        <div className="lp-container lp-container--narrow lp-stack-m">
                            <p className="lp-kicker">Blog</p>
                            <h1 className="lp-title">
                                Notes on connected work, AI, and building Genos
                            </h1>
                            <p className="lp-lead">
                                Product thinking and engineering write-ups from the Genos team —
                                English only, published as we ship.
                            </p>
                        </div>
                    </header>

                    <div className="lp-container lp-container--narrow lp-pagebody">
                        {featured.length > 0 && (
                            <section className="lp-pagesection lp-stack-m">
                                <h2 className="lp-h3">Featured</h2>
                                <div className="lp-featured">
                                    {featured.map((article) => (
                                        <Link
                                            key={article.slug}
                                            className="lp-post"
                                            to={`/blog/${article.slug}`}
                                        >
                                            <PostMeta article={article} />
                                            <h3 className="lp-post__title">{article.title}</h3>
                                            <p className="lp-post__excerpt">{article.excerpt}</p>
                                            <span className="lp-link">
                                                Read
                                                <ArrowRight size={16} aria-hidden />
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        )}

                        <section className="lp-pagesection lp-stack-m">
                            <h2 className="lp-h3">All posts</h2>
                            <div className="lp-posts">
                                {articles.map((article) => (
                                    <Link
                                        key={article.slug}
                                        className="lp-post"
                                        to={`/blog/${article.slug}`}
                                    >
                                        <PostMeta article={article} />
                                        <h3 className="lp-post__title">{article.title}</h3>
                                        <p className="lp-post__excerpt">{article.excerpt}</p>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            )}
        </LpShell>
    );
}
