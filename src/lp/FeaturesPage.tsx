import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    Command,
    FileText,
    Inbox,
    ListChecks,
    MessageSquareText,
    Moon,
    Plug,
    Search,
    Sparkles,
    Sun,
    Zap,
} from "lucide-react";
import { Link } from "react-router-dom";

import { I18nProvider, useTranslation } from "../i18n";

const APP_URL = "https://genosai.dev";

// Order + icon for each entry in `t.featuresPage.features.items`.
const FEATURE_ORDER = [
    "chat",
    "tasks",
    "notes",
    "inbox",
    "calendar",
    "integrations",
    "spotlight",
] as const;

const FEATURE_ICONS: Record<
    (typeof FEATURE_ORDER)[number],
    React.ComponentType<{ className?: string }>
> = {
    chat: MessageSquareText,
    tasks: ListChecks,
    notes: FileText,
    inbox: Inbox,
    calendar: CalendarDays,
    integrations: Plug,
    spotlight: Search,
};

function cn(...classes: Array<string | false | undefined>) {
    return classes.filter(Boolean).join(" ");
}

function SectionHeading({
    eyebrow,
    title,
    lead,
}: {
    eyebrow: string;
    title: string;
    lead?: string;
}) {
    return (
        <motion.div
            className="mx-auto max-w-3xl text-center"
            initial={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.55 }}
            viewport={{ once: true, margin: "-80px" }}
            whileInView={{ opacity: 1, y: 0 }}
        >
            <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                {eyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                {title}
            </h2>
            {lead && (
                <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">{lead}</p>
            )}
        </motion.div>
    );
}

function FeaturesPageInner() {
    const { t } = useTranslation();
    const copy = t.featuresPage;
    const [dark, setDark] = useState(false);
    const year = useMemo(() => new Date().getFullYear(), []);

    return (
        <div className={cn(dark && "dark")}>
            <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.18),_transparent_32%),linear-gradient(180deg,#ffffff_0%,#faf7ff_44%,#ffffff_100%)] text-slate-950 dark:bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.22),_transparent_32%),linear-gradient(180deg,#020617_0%,#111827_48%,#020617_100%)] dark:text-white">
                {/* Header */}
                <header className="sticky top-0 z-50 border-b border-violet-100/70 bg-white/75 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
                    <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
                        <Link className="flex items-center gap-3" to="/home">
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-lg shadow-violet-900/10 dark:border-white/10 dark:bg-white">
                                <img
                                    alt="Genos"
                                    className="h-11 w-11 object-contain"
                                    src="/genos_tech.png"
                                />
                            </div>
                            <div>
                                <div className="text-lg font-black tracking-tight">Genos</div>
                                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Connected workspace
                                </div>
                            </div>
                        </Link>

                        <div className="flex items-center gap-2">
                            <Link
                                className="hidden items-center gap-2 rounded-full border border-violet-200/70 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:text-violet-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:text-white sm:inline-flex"
                                to="/home"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                {copy.meta.backToHome}
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
                                {copy.meta.tryDemo}
                            </a>
                        </div>
                    </div>
                </header>

                {/* Hero */}
                <section className="relative px-4 pb-14 pt-16 sm:px-6 lg:px-8 lg:pb-20 lg:pt-20">
                    <div className="mx-auto max-w-4xl text-center">
                        <motion.div
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-4 py-2 text-sm font-bold text-violet-700 shadow-sm dark:border-violet-400/20 dark:bg-white/10 dark:text-violet-200"
                            initial={{ opacity: 0, y: 12 }}
                            transition={{ duration: 0.55 }}
                        >
                            <Sparkles className="h-4 w-4" />
                            {copy.hero.badge}
                        </motion.div>

                        <motion.h1
                            animate={{ opacity: 1, y: 0 }}
                            className="font-black tracking-[-0.05em] text-slate-950 dark:text-white text-[38px] sm:text-5xl lg:text-6xl"
                            initial={{ opacity: 0, y: 16 }}
                            transition={{ duration: 0.65, delay: 0.05 }}
                        >
                            {copy.hero.title}
                        </motion.h1>

                        <motion.p
                            animate={{ opacity: 1, y: 0 }}
                            className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300"
                            initial={{ opacity: 0, y: 16 }}
                            transition={{ duration: 0.65, delay: 0.12 }}
                        >
                            {copy.hero.lead}
                        </motion.p>
                    </div>
                </section>

                {/* How to use / Getting started */}
                <section className="px-4 py-16 sm:px-6 lg:px-8" id="how-to-use">
                    <div className="mx-auto max-w-7xl">
                        <SectionHeading
                            eyebrow={copy.gettingStarted.eyebrow}
                            lead={copy.gettingStarted.lead}
                            title={copy.gettingStarted.title}
                        />

                        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            {copy.gettingStarted.steps.map((step, index) => (
                                <motion.div
                                    key={step.title}
                                    className="relative rounded-[1.75rem] border border-violet-100 bg-white p-6 shadow-lg shadow-violet-900/5 dark:border-white/10 dark:bg-white/5"
                                    initial={{ opacity: 0, y: 16 }}
                                    transition={{ duration: 0.5, delay: index * 0.05 }}
                                    viewport={{ once: true, margin: "-60px" }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                >
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-base font-black text-white shadow-sm">
                                        {index + 1}
                                    </div>
                                    <h3 className="mt-5 text-lg font-black text-slate-950 dark:text-white">
                                        {step.title}
                                    </h3>
                                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                        {step.body}
                                    </p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Major features */}
                <section className="px-4 py-16 sm:px-6 lg:px-8" id="features">
                    <div className="mx-auto max-w-7xl">
                        <SectionHeading
                            eyebrow={copy.features.eyebrow}
                            lead={copy.features.lead}
                            title={copy.features.title}
                        />

                        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                            {FEATURE_ORDER.map((key, index) => {
                                const item = copy.features.items[key];
                                const Icon = FEATURE_ICONS[key];
                                return (
                                    <motion.div
                                        key={key}
                                        className="flex flex-col rounded-[1.75rem] border border-violet-100 bg-white p-6 shadow-lg shadow-violet-900/5 dark:border-white/10 dark:bg-white/5"
                                        initial={{ opacity: 0, y: 16 }}
                                        transition={{ duration: 0.5, delay: (index % 3) * 0.05 }}
                                        viewport={{ once: true, margin: "-60px" }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                    >
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 shadow-sm dark:bg-violet-500/15 dark:text-violet-200">
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <h3 className="mt-5 text-xl font-black text-slate-950 dark:text-white">
                                            {item.title}
                                        </h3>
                                        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                            {item.desc}
                                        </p>
                                        <ul className="mt-5 space-y-2.5">
                                            {item.bullets.map((bullet) => (
                                                <li
                                                    key={bullet}
                                                    className="flex items-start gap-2.5 text-sm leading-6 text-slate-700 dark:text-slate-200"
                                                >
                                                    <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet-500" />
                                                    {bullet}
                                                </li>
                                            ))}
                                        </ul>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Keyboard shortcuts */}
                <section className="px-4 py-16 sm:px-6 lg:px-8" id="shortcuts">
                    <div className="mx-auto max-w-4xl">
                        <SectionHeading
                            eyebrow={copy.shortcuts.eyebrow}
                            title={copy.shortcuts.title}
                        />

                        <div className="mt-10 overflow-hidden rounded-[2rem] border border-violet-100 bg-white shadow-xl shadow-violet-900/5 dark:border-white/10 dark:bg-white/5">
                            <div className="flex items-center gap-2 border-b border-violet-100 px-6 py-4 text-sm font-black uppercase tracking-[0.14em] text-slate-500 dark:border-white/10 dark:text-slate-400">
                                <Command className="h-4 w-4" />
                                <span className="flex-1">{copy.shortcuts.keysHeader}</span>
                                <span className="flex-[2]">{copy.shortcuts.actionHeader}</span>
                            </div>
                            <ul>
                                {copy.shortcuts.items.map((shortcut) => (
                                    <li
                                        key={shortcut.keys}
                                        className="flex flex-col gap-2 border-b border-violet-50 px-6 py-4 last:border-b-0 dark:border-white/5 sm:flex-row sm:items-center"
                                    >
                                        <div className="flex-1">
                                            <span className="inline-flex items-center rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-black text-violet-700 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-violet-100">
                                                {shortcut.keys}
                                            </span>
                                        </div>
                                        <p className="flex-[2] text-sm leading-6 text-slate-700 dark:text-slate-200">
                                            {shortcut.label}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <p className="mt-5 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                            {copy.shortcuts.platformNote}
                        </p>
                    </div>
                </section>

                {/* Tips & tricks */}
                <section className="px-4 py-16 sm:px-6 lg:px-8" id="tricks">
                    <div className="mx-auto max-w-7xl">
                        <SectionHeading eyebrow={copy.tricks.eyebrow} title={copy.tricks.title} />

                        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                            {copy.tricks.items.map((trick, index) => (
                                <motion.div
                                    key={trick.title}
                                    className="rounded-[1.75rem] border border-violet-100 bg-white p-6 shadow-lg shadow-violet-900/5 dark:border-white/10 dark:bg-white/5"
                                    initial={{ opacity: 0, y: 16 }}
                                    transition={{ duration: 0.5, delay: (index % 3) * 0.05 }}
                                    viewport={{ once: true, margin: "-60px" }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                >
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-sm dark:bg-slate-950 dark:text-violet-200">
                                        <Zap className="h-5 w-5" />
                                    </div>
                                    <h3 className="mt-5 text-lg font-black text-slate-950 dark:text-white">
                                        {trick.title}
                                    </h3>
                                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                        {trick.desc}
                                    </p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Footer CTA */}
                <section className="px-4 py-16 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl">
                        <div className="rounded-[2.5rem] border border-violet-100 bg-white p-8 text-center shadow-2xl shadow-violet-900/10 dark:border-white/10 dark:bg-white/5 lg:p-12">
                            <h2 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                                {copy.footerCta.title}
                            </h2>
                            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                                {copy.footerCta.body}
                            </p>
                            <a
                                className="mt-8 inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-violet-600/25 transition hover:-translate-y-0.5 hover:bg-violet-700"
                                href={APP_URL}
                                rel="noreferrer"
                                target="_blank"
                            >
                                {copy.footerCta.button}
                                <ArrowRight className="h-4 w-4" />
                            </a>
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
                            {copy.meta.backToHome}
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

export default function GenosFeaturesPage() {
    return (
        <I18nProvider>
            <FeaturesPageInner />
        </I18nProvider>
    );
}
