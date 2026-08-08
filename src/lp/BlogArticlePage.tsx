import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Moon, Sun } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";

import { formatBlogDate, getBlogArticle, listBlogArticles } from "./blog/blog";
import { BlogMarkdown } from "./blog/BlogMarkdown";

const APP_URL = "https://genosai.dev";

function cn(...classes: Array<string | false | undefined>) {
    return classes.filter(Boolean).join(" ");
}

/**
 * `/blog/:slug` — one English LP blog article.
 */
export default function BlogArticlePage() {
    const { slug = "" } = useParams<{ slug: string }>();
    const [dark, setDark] = useState(false);
    const year = useMemo(() => new Date().getFullYear(), []);
    const article = getBlogArticle(slug);

    if (!article) {
        return <Navigate replace to="/blog" />;
    }

    const others = listBlogArticles()
        .filter((a) => a.slug !== article.slug)
        .slice(0, 3);

    return (
        <div className={cn(dark && "dark")}>
            <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.18),_transparent_32%),linear-gradient(180deg,#ffffff_0%,#faf7ff_44%,#ffffff_100%)] text-slate-950 dark:bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.22),_transparent_32%),linear-gradient(180deg,#020617_0%,#111827_48%,#020617_100%)] dark:text-white">
                <header className="sticky top-0 z-50 border-b border-violet-100/70 bg-white/75 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
                    <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
                        <Link className="flex items-center gap-3" to="/home">
                            <div className="flex h-12 items-center justify-center overflow-hidden rounded-2xl border border-violet-100 bg-white px-3.5 shadow-lg shadow-violet-900/10 dark:border-white/10 dark:bg-white">
                                <img
                                    alt="Genos"
                                    className="h-7 object-contain"
                                    src="/genos-logo-with-name.png"
                                />
                            </div>
                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                Connected workspace
                            </div>
                        </Link>

                        <div className="flex items-center gap-2">
                            <Link
                                className="hidden items-center gap-2 rounded-full border border-violet-200/70 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:text-violet-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:text-white sm:inline-flex"
                                to="/blog"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                All posts
                            </Link>
                            <button
                                aria-label="Toggle dark mode"
                                className="hidden h-10 w-10 items-center justify-center rounded-full border border-violet-200/70 bg-white/70 text-slate-700 shadow-sm transition hover:text-violet-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:text-white sm:flex"
                                onClick={() => setDark((value) => !value)}
                            >
                                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                            </button>
                            <a
                                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-violet-700 dark:bg-white dark:text-slate-950 dark:hover:bg-violet-100"
                                href={APP_URL}
                                rel="noreferrer"
                                target="_blank"
                            >
                                Try the demo
                            </a>
                        </div>
                    </div>
                </header>

                <article className="px-4 py-12 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-3xl">
                        <Link
                            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-violet-700 dark:text-slate-400 dark:hover:text-white"
                            to="/blog"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Blog
                        </Link>

                        <p className="mt-8 text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                            {article.category}
                        </p>
                        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl lg:text-5xl">
                            {article.title}
                        </h1>
                        <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">
                            {article.excerpt}
                        </p>
                        <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
                            <time dateTime={article.publishedAt}>
                                {formatBlogDate(article.publishedAt)}
                            </time>
                            <span className="mx-2">·</span>
                            Kentaro Kamiya
                        </p>

                        <div className="mt-10 border-t border-violet-100 pt-2 dark:border-white/10">
                            <BlogMarkdown markdown={article.body} />
                        </div>

                        <div className="mt-14 rounded-[2rem] border border-violet-100 bg-white p-7 shadow-lg shadow-violet-900/5 dark:border-white/10 dark:bg-white/5">
                            <h2 className="text-xl font-black text-slate-950 dark:text-white">
                                Try Genos
                            </h2>
                            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                Chat, tasks, and notes in one connected workspace — with AI that
                                cites its sources. Demo needs no signup.
                            </p>
                            <a
                                className="mt-5 inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-violet-600/25 transition hover:-translate-y-0.5 hover:bg-violet-700"
                                href={APP_URL}
                                rel="noreferrer"
                                target="_blank"
                            >
                                Open genosai.dev
                                <ArrowRight className="h-4 w-4" />
                            </a>
                        </div>

                        {others.length > 0 && (
                            <div className="mt-14">
                                <h2 className="text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                                    More from the blog
                                </h2>
                                <ul className="mt-4 space-y-3">
                                    {others.map((other) => (
                                        <li key={other.slug}>
                                            <Link
                                                className="group block rounded-2xl border border-violet-100 bg-white/70 px-5 py-4 transition hover:border-violet-200 dark:border-white/10 dark:bg-white/5"
                                                to={`/blog/${other.slug}`}
                                            >
                                                <div className="text-xs font-black uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">
                                                    {other.category}
                                                </div>
                                                <div className="mt-1 font-black text-slate-950 group-hover:text-violet-700 dark:text-white dark:group-hover:text-violet-200">
                                                    {other.title}
                                                </div>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </article>

                <footer className="border-t border-violet-100/70 px-4 py-8 dark:border-white/10 sm:px-6 lg:px-8">
                    <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
                        <Link
                            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-violet-700 dark:text-slate-300 dark:hover:text-white"
                            to="/blog"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            All posts
                        </Link>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            © {year} Genos
                        </p>
                    </div>
                </footer>
            </main>
        </div>
    );
}
