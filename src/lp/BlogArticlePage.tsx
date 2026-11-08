import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";

import { formatBlogDate, getBlogArticle, listBlogArticles } from "./blog/blog";
import { BlogMarkdown } from "./blog/BlogMarkdown";
import { APP_URL } from "./kit/links";
import { LpShell } from "./kit/LpShell";

/**
 * `/blog/:slug` — one English LP blog article.
 */
export default function BlogArticlePage() {
    const { slug = "" } = useParams<{ slug: string }>();
    const article = getBlogArticle(slug);

    if (!article) {
        return <Navigate to="/blog" replace />;
    }

    const others = listBlogArticles()
        .filter((a) => a.slug !== article.slug)
        .slice(0, 3);

    return (
        <LpShell active="blog">
            {({ appHref }) => (
                <div lang="en">
                    <article>
                        <header className="lp-pagehead">
                            <div className="lp-container lp-container--narrow lp-stack-m">
                                <Link className="lp-link" to="/blog">
                                    <ArrowLeft size={16} aria-hidden />
                                    Blog
                                </Link>
                                <p className="lp-kicker">{article.category}</p>
                                <h1 className="lp-title">{article.title}</h1>
                                <p className="lp-lead">{article.excerpt}</p>
                                <p className="lp-small">
                                    <time dateTime={article.publishedAt}>
                                        {formatBlogDate(article.publishedAt)}
                                    </time>
                                    <span className="lp-sep" aria-hidden>
                                        ·
                                    </span>
                                    Kentaro Kamiya
                                </p>
                            </div>
                        </header>
                        <div className="lp-container lp-container--narrow">
                            <BlogMarkdown markdown={article.body} />
                        </div>
                    </article>

                    <div className="lp-container lp-container--narrow lp-pagebody lp-pagebody--after">
                        <div className="lp-pagesection">
                            <div className="lp-cta">
                                <div className="lp-stack-s">
                                    <h2 className="lp-h3">Try Genos</h2>
                                    <p className="lp-body">
                                        Chat, tasks, and notes in one connected workspace — with AI
                                        that cites its sources. Demo needs no signup.
                                    </p>
                                </div>
                                <a
                                    className="lp-btn lp-btn--primary"
                                    href={appHref(APP_URL)}
                                    rel="noreferrer"
                                    target="_blank"
                                >
                                    Open genosai.dev
                                    <ArrowRight size={16} aria-hidden />
                                </a>
                            </div>
                        </div>

                        {others.length > 0 && (
                            <section className="lp-pagesection lp-stack-m">
                                <h2 className="lp-h3">More from the blog</h2>
                                <div className="lp-posts">
                                    {others.map((other) => (
                                        <Link
                                            key={other.slug}
                                            className="lp-post"
                                            to={`/blog/${other.slug}`}
                                        >
                                            <div className="lp-post__meta">
                                                <span>{other.category}</span>
                                            </div>
                                            <div className="lp-post__title">{other.title}</div>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            )}
        </LpShell>
    );
}
