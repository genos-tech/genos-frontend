import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Moon, Newspaper, Sparkles, Sun } from "lucide-react";
import { Link } from "react-router-dom";

import { formatBlogDate, listBlogArticles } from "./blog/blog";

const APP_URL = "https://genosai.dev";

function cn(...classes: Array<string | false | undefined>) {
    return classes.filter(Boolean).join(" ");
}

/**
 * `/blog` — English marketing / engineering blog for the public LP.
 * Articles are generated snapshots of genos-docs/marketing drafts;
 * append via articles.json + `npm run blog:sync`.
 */
export default function BlogPage() {
    const [dark, setDark] = useState(false);
    const year = useMemo(() => new Date().getFullYear(), []);
    const articles = useMemo(() => listBlogArticles(), []);
    const featured = articles.filter((a) => a.featured);

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
                                to="/home"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to home
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

                <section className="relative px-4 pb-10 pt-16 sm:px-6 lg:px-8 lg:pb-14 lg:pt-20">
                    <div className="mx-auto max-w-4xl text-center">
                        <motion.div
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-4 py-2 text-sm font-bold text-violet-700 shadow-sm dark:border-violet-400/20 dark:bg-white/10 dark:text-violet-200"
                            initial={{ opacity: 0, y: 12 }}
                            transition={{ duration: 0.55 }}
                        >
                            <Newspaper className="h-4 w-4" />
                            Blog
                        </motion.div>
                        <motion.h1
                            animate={{ opacity: 1, y: 0 }}
                            className="font-black tracking-[-0.05em] text-slate-950 dark:text-white text-[38px] sm:text-5xl"
                            initial={{ opacity: 0, y: 16 }}
                            transition={{ duration: 0.65, delay: 0.05 }}
                        >
                            Notes on connected work, AI, and building Genos
                        </motion.h1>
                        <motion.p
                            animate={{ opacity: 1, y: 0 }}
                            className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300"
                            initial={{ opacity: 0, y: 16 }}
                            transition={{ duration: 0.65, delay: 0.12 }}
                        >
                            Product thinking and engineering write-ups from the Genos team —
                            English only, published as we ship.
                        </motion.p>
                    </div>
                </section>

                {featured.length > 0 && (
                    <section className="px-4 pb-8 sm:px-6 lg:px-8">
                        <div className="mx-auto max-w-7xl">
                            <p className="mb-5 text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                                Featured
                            </p>
                            <div className="grid gap-5 lg:grid-cols-2">
                                {featured.map((article, index) => (
                                    <motion.div
                                        key={article.slug}
                                        initial={{ opacity: 0, y: 16 }}
                                        transition={{ duration: 0.5, delay: index * 0.05 }}
                                        viewport={{ once: true, margin: "-40px" }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                    >
                                        <Link
                                            className="group flex h-full flex-col rounded-[1.75rem] border border-violet-100 bg-white p-7 shadow-lg shadow-violet-900/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-violet-900/10 dark:border-white/10 dark:bg-white/5"
                                            to={`/blog/${article.slug}`}
                                        >
                                            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">
                                                <Sparkles className="h-3.5 w-3.5" />
                                                {article.category}
                                            </div>
                                            <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 group-hover:text-violet-700 dark:text-white dark:group-hover:text-violet-200">
                                                {article.title}
                                            </h2>
                                            <p className="mt-3 flex-1 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                                {article.excerpt}
                                            </p>
                                            <div className="mt-6 flex items-center justify-between text-sm font-semibold text-slate-500 dark:text-slate-400">
                                                <time dateTime={article.publishedAt}>
                                                    {formatBlogDate(article.publishedAt)}
                                                </time>
                                                <span className="inline-flex items-center gap-1 text-violet-700 dark:text-violet-300">
                                                    Read
                                                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                                                </span>
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                <section className="px-4 py-12 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl">
                        <p className="mb-5 text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                            All posts
                        </p>
                        <div className="space-y-4">
                            {articles.map((article) => (
                                <Link
                                    key={article.slug}
                                    className="group flex flex-col gap-3 rounded-[1.5rem] border border-violet-100 bg-white/80 p-6 shadow-sm transition hover:border-violet-200 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 sm:flex-row sm:items-center sm:justify-between"
                                    to={`/blog/${article.slug}`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-black uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">
                                            {article.category}
                                        </div>
                                        <h2 className="mt-2 text-lg font-black text-slate-950 group-hover:text-violet-700 dark:text-white dark:group-hover:text-violet-200">
                                            {article.title}
                                        </h2>
                                        <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                            {article.excerpt}
                                        </p>
                                    </div>
                                    <div className="shrink-0 text-sm font-semibold text-slate-500 dark:text-slate-400 sm:text-right">
                                        <time dateTime={article.publishedAt}>
                                            {formatBlogDate(article.publishedAt)}
                                        </time>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>

                <footer className="border-t border-violet-100/70 px-4 py-8 dark:border-white/10 sm:px-6 lg:px-8">
                    <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
                        <Link
                            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-violet-700 dark:text-slate-300 dark:hover:text-white"
                            to="/home"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to home
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
