import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    ArrowLeft,
    ArrowRight,
    Bot,
    Check,
    Copy,
    CornerDownRight,
    ListTodo,
    MessageSquareText,
    Moon,
    Search,
    Sparkles,
    Sun,
    Workflow,
} from "lucide-react";
import { Link } from "react-router-dom";

import { I18nProvider, useTranslation } from "../i18n";

const APP_URL = "https://genosai.dev";

// Icon per Spotlight prompt group. Keyed by the `id` in
// `demoPage.spotlight.groups`; falls back to Sparkles for anything unmapped.
const GROUP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    search: Search,
    ask: MessageSquareText,
    reason: Workflow,
    followup: CornerDownRight,
    todos: ListTodo,
    thread: Sparkles,
    agent: Bot,
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

// A copy-to-clipboard prompt. Click anywhere on the row to copy the prompt
// text; the trailing icon flips to a check + "Copied" for ~1.5s.
function PromptButton({
    text,
    copyLabel,
    copiedLabel,
    highlight = false,
}: {
    text: string;
    copyLabel: string;
    copiedLabel: string;
    highlight?: boolean;
}) {
    const [copied, setCopied] = useState(false);

    const onCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            // Clipboard API unavailable (e.g. insecure context) — no-op.
        }
    };

    return (
        <button
            aria-label={`${copyLabel}: ${text}`}
            type="button"
            className={cn(
                "group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                highlight
                    ? "border-violet-200 bg-white hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
                    : "border-violet-100 bg-violet-50/50 hover:border-violet-200 hover:bg-violet-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            )}
            onClick={onCopy}
        >
            <span className="flex-1 text-sm font-semibold leading-6 text-slate-800 dark:text-slate-100">
                {text}
            </span>
            <span
                className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black transition",
                    copied
                        ? "bg-violet-600 text-white"
                        : "text-violet-500 group-hover:bg-violet-100 group-hover:text-violet-700 dark:text-slate-400 dark:group-hover:bg-white/10 dark:group-hover:text-violet-100"
                )}
            >
                {copied ? (
                    <>
                        <Check className="h-3.5 w-3.5" />
                        {copiedLabel}
                    </>
                ) : (
                    <Copy className="h-3.5 w-3.5" />
                )}
            </span>
        </button>
    );
}

function DemoPageInner() {
    const { t } = useTranslation();
    const copy = t.demoPage;
    const [dark, setDark] = useState(false);
    const year = useMemo(() => new Date().getFullYear(), []);

    return (
        <div className={cn(dark && "dark")}>
            <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.18),_transparent_32%),linear-gradient(180deg,#ffffff_0%,#faf7ff_44%,#ffffff_100%)] text-slate-950 dark:bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.22),_transparent_32%),linear-gradient(180deg,#020617_0%,#111827_48%,#020617_100%)] dark:text-white">
                {/* Header */}
                <header className="sticky top-0 z-50 border-b border-violet-100/70 bg-white/75 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
                    <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
                        <Link className="flex items-center gap-3" to="/home">
                            {/* The full lockup already carries the wordmark, so the
                                separate "Genos" line is gone. The plate stays white in
                                dark mode (`dark:bg-white`) — the wordmark is a fixed
                                purple and would all but vanish on a dark surface. */}
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
                                {copy.meta.openApp}
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

                {/* Getting in — sign in as a demo user */}
                <section className="px-4 py-16 sm:px-6 lg:px-8" id="get-started">
                    <div className="mx-auto max-w-7xl">
                        <SectionHeading
                            eyebrow={copy.login.eyebrow}
                            lead={copy.login.lead}
                            title={copy.login.title}
                        />

                        <div className="mt-12 grid gap-5 sm:grid-cols-3">
                            {copy.login.steps.map((step, index) => (
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

                        <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-5 text-center">
                            <p className="text-sm leading-7 text-slate-500 dark:text-slate-400">
                                {copy.login.note}
                            </p>
                            <a
                                className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-violet-600/25 transition hover:-translate-y-0.5 hover:bg-violet-700"
                                href={APP_URL}
                                rel="noreferrer"
                                target="_blank"
                            >
                                {copy.login.cta}
                                <ArrowRight className="h-4 w-4" />
                            </a>
                        </div>
                    </div>
                </section>

                {/* What's inside — the demo workspace */}
                <section className="px-4 py-16 sm:px-6 lg:px-8" id="workspace">
                    <div className="mx-auto max-w-7xl">
                        <SectionHeading
                            eyebrow={copy.data.eyebrow}
                            lead={copy.data.lead}
                            title={copy.data.title}
                        />

                        <div className="mx-auto mt-10 max-w-3xl">
                            <p className="text-center text-sm font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                {copy.data.castTitle}
                            </p>
                            <div className="mt-5 flex flex-wrap justify-center gap-3">
                                {copy.data.cast.map((member) => (
                                    <div
                                        key={member.name}
                                        className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white px-4 py-2 shadow-sm dark:border-white/10 dark:bg-white/5"
                                    >
                                        <span className="text-sm font-black text-slate-950 dark:text-white">
                                            {member.name}
                                        </span>
                                        <span className="text-xs font-semibold text-violet-600 dark:text-violet-300">
                                            {member.role}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            {copy.data.cards.map((card, index) => (
                                <motion.div
                                    key={card.title}
                                    className="rounded-[1.75rem] border border-violet-100 bg-white p-6 shadow-lg shadow-violet-900/5 dark:border-white/10 dark:bg-white/5"
                                    initial={{ opacity: 0, y: 16 }}
                                    transition={{ duration: 0.5, delay: index * 0.05 }}
                                    viewport={{ once: true, margin: "-60px" }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                >
                                    <h3 className="text-lg font-black text-slate-950 dark:text-white">
                                        {card.title}
                                    </h3>
                                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                        {card.body}
                                    </p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* The main event — use Genos AI yourself */}
                <section className="px-4 py-16 sm:px-6 lg:px-8" id="spotlight">
                    <div className="mx-auto max-w-7xl">
                        <SectionHeading
                            eyebrow={copy.spotlight.eyebrow}
                            lead={copy.spotlight.lead}
                            title={copy.spotlight.title}
                        />

                        <div className="mx-auto mt-6 flex max-w-3xl items-center justify-center gap-2 text-center">
                            <Copy className="h-4 w-4 shrink-0 text-violet-500" />
                            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                                {copy.spotlight.copyHint}
                            </p>
                        </div>

                        <div className="mt-12 grid gap-5 lg:grid-cols-2">
                            {copy.spotlight.groups.map((groupItem, index) => {
                                const isHeadline =
                                    "headline" in groupItem && groupItem.headline === true;
                                const Icon = GROUP_ICONS[groupItem.id] ?? Sparkles;
                                return (
                                    <motion.div
                                        key={groupItem.id}
                                        initial={{ opacity: 0, y: 16 }}
                                        transition={{ duration: 0.5, delay: (index % 2) * 0.05 }}
                                        viewport={{ once: true, margin: "-60px" }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        className={cn(
                                            "flex flex-col rounded-[1.75rem] border p-6 shadow-lg shadow-violet-900/5",
                                            isHeadline
                                                ? "border-violet-300 bg-gradient-to-br from-violet-50 to-white ring-2 ring-violet-200 dark:border-violet-400/30 dark:from-violet-500/10 dark:to-white/5 dark:ring-violet-400/20 lg:col-span-2"
                                                : "border-violet-100 bg-white dark:border-white/10 dark:bg-white/5"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 shadow-sm dark:bg-violet-500/15 dark:text-violet-200">
                                                <Icon className="h-6 w-6" />
                                            </div>
                                            <h3 className="text-xl font-black text-slate-950 dark:text-white">
                                                {groupItem.title}
                                            </h3>
                                            {isHeadline && (
                                                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
                                                    <Sparkles className="h-3.5 w-3.5" />
                                                    {copy.spotlight.headlineBadge}
                                                </span>
                                            )}
                                        </div>

                                        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                            {groupItem.desc}
                                        </p>

                                        <div
                                            className={cn(
                                                "mt-5 grid gap-2.5",
                                                isHeadline && "sm:grid-cols-2"
                                            )}
                                        >
                                            {groupItem.prompts.map((prompt) => (
                                                <PromptButton
                                                    key={prompt}
                                                    copiedLabel={copy.spotlight.copiedLabel}
                                                    copyLabel={copy.spotlight.copyLabel}
                                                    highlight={isHeadline}
                                                    text={prompt}
                                                />
                                            ))}
                                        </div>
                                    </motion.div>
                                );
                            })}
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

export default function GenosDemoPage() {
    return (
        <I18nProvider>
            <DemoPageInner />
        </I18nProvider>
    );
}
