import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    ArrowRight,
    Bot,
    Check,
    ChevronRight,
    Clock,
    Database,
    FileText,
    HelpCircle,
    Mail,
    MessageSquareText,
    Moon,
    Sparkles,
    Sun,
    Target,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useLpLang } from "./lpLang";
import { SEGMENTS, type Lang, type SegmentKey } from "./segments";
import { AVAILABILITY_LABELS, createSegmentMailtoHref, SHARED_FOOTER } from "./segments/shared";
import { useDocumentMeta } from "./useDocumentMeta";

const APP_URL = "https://genosai.dev";
const LINKEDIN_URL = "https://www.linkedin.com/in/kentaro-kamiya-jp/";
const CONTACT_EMAIL = "genos.support@genosai.dev";
const GOOGLE_FORM_URL =
    "https://docs.google.com/forms/d/e/1FAIpQLSeOlcGhTldzM8mhLkKU3h9hw0eKetSPnV9FQ8z4NhJ6Qi3ziw/viewform?usp=publish-editor";

const SEGMENT_TAGLINE: Record<SegmentKey, Record<Lang, string>> = {
    research: { ja: "研究者向け", en: "For Research" },
    teams: { ja: "チーム向け", en: "For Teams" },
    projects: { ja: "プロジェクト向け", en: "For Projects" },
    students: { ja: "学生向け", en: "For Students" },
};

const CONTACT_COPY: Record<
    Lang,
    {
        eyebrow: string;
        title: string;
        body: string;
        emailTitle: string;
        emailBody: string;
        formTitle: string;
        formBody: string;
        emailCta: string;
        formCta: string;
    }
> = {
    ja: {
        eyebrow: "Contact / Feedback",
        title: "Genosを試して、気になった点を教えてください。",
        body: "MVP公開中のため、実際に使ってみた感想、改善してほしい点、チームで使う上で必要な機能などを募集しています。短いコメントだけでも大歓迎です。",
        emailTitle: "メールで問い合わせる",
        emailBody: "導入相談、バグ報告、チーム利用の相談などはこちらからご連絡ください。",
        formTitle: "フォームでフィードバックする",
        formBody:
            "数分で回答できるフィードバックフォームです。使いづらかった点や欲しい機能を教えてください。",
        emailCta: "メールを送る",
        formCta: "フォームを開く",
    },
    en: {
        eyebrow: "Contact / Feedback",
        title: "Try Genos and tell us what you think.",
        body: "Genos is currently available as an MVP. We are looking for feedback on what feels useful, confusing, missing, or important for team use. Even a short comment helps.",
        emailTitle: "Contact by email",
        emailBody:
            "For product questions, bug reports, team usage, or partnership discussions, reach out by email.",
        formTitle: "Send feedback via form",
        formBody:
            "A short feedback form for sharing your experience, pain points, and feature requests.",
        emailCta: "Send email",
        formCta: "Open form",
    },
};

function cn(...classes: Array<string | false | undefined>) {
    return classes.filter(Boolean).join(" ");
}

function LanguageToggle({ lang, setLang }: { lang: Lang; setLang: (lang: Lang) => void }) {
    return (
        <div className="flex rounded-full border border-violet-200/70 bg-white/70 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10">
            {(["ja", "en"] as Lang[]).map((item) => (
                <button
                    key={item}
                    className={cn(
                        "rounded-full px-3 py-1.5 text-sm font-semibold transition",
                        lang === item
                            ? "bg-violet-600 text-white shadow-sm"
                            : "text-slate-600 hover:text-violet-700 dark:text-slate-300 dark:hover:text-white"
                    )}
                    onClick={() => setLang(item)}
                >
                    {item === "ja" ? "日本語" : "EN"}
                </button>
            ))}
        </div>
    );
}

function ScreenshotFrame({
    src,
    alt,
    label,
    className = "",
    imageClassName = "",
}: {
    src: string;
    alt: string;
    label?: string;
    className?: string;
    imageClassName?: string;
}) {
    return (
        <div
            className={`relative overflow-hidden rounded-[1.75rem] border border-violet-100 bg-white p-2 shadow-xl shadow-violet-900/5 dark:border-white/10 dark:bg-white/5 ${className}`}
        >
            {label && (
                <div className="mb-2 flex items-center justify-between px-2 py-1">
                    <span className="text-xs font-black text-slate-500 dark:text-slate-400">
                        {label}
                    </span>
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
                        Genos
                    </span>
                </div>
            )}

            <img
                alt={alt}
                className={`w-full rounded-[1.35rem] object-contain ${imageClassName}`}
                loading="lazy"
                src={src}
            />
        </div>
    );
}

function CardIcon({ index }: { index: number }) {
    const className = "h-5 w-5";
    const icons = [MessageSquareText, Target, FileText];
    const Icon = icons[index % icons.length];
    return <Icon className={className} />;
}

function StepFlow({ steps }: { steps: string[] }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {steps.map((step, index) => (
                <React.Fragment key={step}>
                    <span className="rounded-full bg-white/15 px-3.5 py-2 text-xs font-black text-white sm:text-sm">
                        {step}
                    </span>
                    {index < steps.length - 1 && (
                        <span className="h-px w-5 shrink-0 bg-white/30 sm:w-8" />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
}

export default function GenosSegmentPage({ segment }: { segment: SegmentKey }) {
    const { lang, setLang, appHref } = useLpLang();
    const [dark, setDark] = useState(false);
    const config = SEGMENTS[segment];
    const t = config[lang];
    const availability = AVAILABILITY_LABELS[lang];
    const footer = SHARED_FOOTER[lang];

    const year = useMemo(() => new Date().getFullYear(), []);

    useDocumentMeta({
        title: t.meta.pageTitle,
        description: t.meta.metaDescription,
        ogTitle: t.meta.ogTitle,
        ogDescription: t.meta.ogDescription,
    });

    const secondaryHref =
        config.secondaryCtaKind === "anchor"
            ? "#workflow"
            : createSegmentMailtoHref(lang, config.mailtoTag);

    return (
        <div className={cn(dark && "dark")}>
            <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.18),_transparent_32%),linear-gradient(180deg,#ffffff_0%,#faf7ff_44%,#ffffff_100%)] text-slate-950 dark:bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.22),_transparent_32%),linear-gradient(180deg,#020617_0%,#111827_48%,#020617_100%)] dark:text-white">
                <header className="sticky top-0 z-50 border-b border-violet-100/70 bg-white/75 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
                    <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
                        <a className="flex items-center gap-3" href="#top">
                            <div className="flex h-12 items-center justify-center overflow-hidden rounded-2xl border border-violet-100 bg-white px-3.5 shadow-lg shadow-violet-900/10 dark:border-white/10 dark:bg-white">
                                <img
                                    alt="Genos"
                                    className="h-7 object-contain"
                                    src="/genos-logo-with-name.png"
                                />
                            </div>

                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                {SEGMENT_TAGLINE[segment][lang]}
                            </div>
                        </a>

                        <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 dark:text-slate-300 md:flex">
                            <Link
                                className="transition hover:text-violet-700 dark:hover:text-white"
                                to="/home"
                            >
                                {t.nav.home}
                            </Link>
                            <a
                                className="transition hover:text-violet-700 dark:hover:text-white"
                                href="#faq"
                            >
                                {t.nav.faq}
                            </a>
                            <Link
                                className="transition hover:text-violet-700 dark:hover:text-white"
                                to="/plans"
                            >
                                {t.nav.plans}
                            </Link>
                            <a
                                className="transition hover:text-violet-700 dark:hover:text-white"
                                href="#contact"
                            >
                                {t.nav.contact}
                            </a>
                        </nav>

                        <div className="flex items-center gap-2">
                            <LanguageToggle lang={lang} setLang={setLang} />
                            <button
                                aria-label="Toggle dark mode"
                                className="hidden h-10 w-10 items-center justify-center rounded-full border border-violet-200/70 bg-white/70 text-slate-700 shadow-sm transition hover:text-violet-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:text-white sm:flex"
                                onClick={() => setDark((value) => !value)}
                            >
                                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                            </button>
                            <a
                                className="hidden rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-violet-700 dark:bg-white dark:text-slate-950 dark:hover:bg-violet-100 lg:inline-flex"
                                href={appHref(APP_URL)}
                                rel="noreferrer"
                                target="_blank"
                            >
                                {t.nav.demo}
                            </a>
                        </div>
                    </div>
                </header>

                <section
                    className="relative px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pb-28 lg:pt-24"
                    id="top"
                >
                    <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1fr_0.92fr]">
                        <div>
                            <motion.div
                                animate={{ opacity: 1, y: 0 }}
                                className={`mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-4 py-2 ${lang === "en" ? "text-md" : "text-sm"} font-bold text-violet-700 shadow-sm dark:border-violet-400/20 dark:bg-white/10 dark:text-violet-200`}
                                initial={{ opacity: 0, y: 12 }}
                                transition={{ duration: 0.55 }}
                            >
                                <Sparkles className="h-4 w-4" />
                                {t.hero.badge}
                            </motion.div>

                            <motion.h1
                                animate={{ opacity: 1, y: 0 }}
                                className="max-w-4xl font-black tracking-[-0.06em] text-slate-950 dark:text-white text-[38px] sm:text-5xl lg:text-[64px]"
                                initial={{ opacity: 0, y: 16 }}
                                transition={{ duration: 0.65, delay: 0.05 }}
                            >
                                <span className="block">{t.hero.title}</span>

                                {t.hero.titleSub && (
                                    <span className="mt-3 block tracking-[-0.04em] text-violet-700 dark:text-violet-200 text-xl sm:text-2xl lg:text-3xl">
                                        {t.hero.titleSub}
                                    </span>
                                )}
                            </motion.h1>

                            <motion.p
                                animate={{ opacity: 1, y: 0 }}
                                className={`mt-6 max-w-2xl ${lang === "en" ? "text-lg" : "text-md"} leading-8 text-slate-600 dark:text-slate-300 sm:text-xl`}
                                initial={{ opacity: 0, y: 16 }}
                                transition={{ duration: 0.65, delay: 0.12 }}
                            >
                                {t.hero.lead}
                            </motion.p>

                            <motion.div
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-8 flex flex-col gap-3 sm:flex-row"
                                initial={{ opacity: 0, y: 16 }}
                                transition={{ duration: 0.65, delay: 0.18 }}
                            >
                                <a
                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-6 py-4 text-base font-black text-white shadow-xl shadow-violet-600/25 transition hover:-translate-y-0.5 hover:bg-violet-700"
                                    href={appHref(APP_URL)}
                                    rel="noreferrer"
                                    target="_blank"
                                >
                                    {t.hero.primary}
                                    <ArrowRight className="h-5 w-5" />
                                </a>
                                <a
                                    className="inline-flex items-center justify-center gap-2 rounded-full border border-violet-200 bg-white px-6 py-4 text-base font-black text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:text-violet-700 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:border-violet-300/50"
                                    href={secondaryHref}
                                >
                                    {t.hero.secondary}
                                    <ChevronRight className="h-5 w-5" />
                                </a>
                            </motion.div>

                            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                                {t.hero.footnote}
                            </p>

                            <div className="mt-8 grid gap-3 sm:grid-cols-3">
                                {t.socialProof.map((item) => (
                                    <div
                                        key={item}
                                        className="flex items-start gap-2 rounded-2xl border border-violet-100 bg-white/70 p-3 text-sm font-semibold text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                                    >
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <ScreenshotFrame
                            alt="Genos main workspace screenshot"
                            className="mx-auto max-w-2xl p-3"
                            label="Genos Workspace"
                            src="/lp-top.png"
                        />
                    </div>
                </section>

                <section className="px-4 py-16 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl">
                        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                            <div className="rounded-[2rem] border border-violet-100 bg-white p-8 shadow-xl shadow-violet-900/5 dark:border-white/10 dark:bg-white/5">
                                <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                                    {t.problem.eyebrow}
                                </p>
                                <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">
                                    {t.problem.title}
                                </h2>
                                <p className="mt-5 text-base leading-8 text-slate-600 dark:text-slate-300">
                                    {t.problem.body}
                                </p>
                                <ul className="mt-5 space-y-2.5">
                                    {t.problem.questions.map((question) => (
                                        <li
                                            key={question}
                                            className="flex items-start gap-3 text-base font-semibold leading-7 text-slate-800 dark:text-slate-100"
                                        >
                                            <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
                                            {question}
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-6 text-base font-bold leading-8 text-slate-900 dark:text-white">
                                    {t.problem.closing}
                                </p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                                {t.problem.cards.map((card, index) => (
                                    <motion.div
                                        key={card.title}
                                        className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg shadow-violet-900/5 dark:border-white/10 dark:bg-white/5"
                                        initial={{ opacity: 0, y: 18 }}
                                        transition={{ duration: 0.55, delay: index * 0.08 }}
                                        viewport={{ once: true, amount: 0.4 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                    >
                                        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
                                            <CardIcon index={index} />
                                        </div>
                                        <h3 className="text-lg font-black">{card.title}</h3>
                                        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                            {card.body}
                                        </p>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="px-4 py-16 sm:px-6 lg:px-8" id="workflow">
                    <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] border border-violet-200 bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-600 p-8 text-white shadow-2xl shadow-violet-900/20 dark:border-white/10 lg:p-12">
                        <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-100">
                            {t.workflow.eyebrow}
                        </p>
                        <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">
                            {t.workflow.title}
                        </h2>
                        <p className="mt-5 max-w-2xl text-base leading-7 text-violet-50/90">
                            {t.workflow.body}
                        </p>
                        <div className="mt-8">
                            <StepFlow steps={t.workflow.steps} />
                        </div>
                    </div>
                </section>

                <section className="px-4 py-16 sm:px-6 lg:px-8" id="features">
                    <div className="mx-auto max-w-7xl">
                        <div className="mx-auto max-w-3xl text-center">
                            <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                                {t.solution.eyebrow}
                            </p>
                            <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                                {t.solution.title}
                            </h2>
                            <p className="mt-5 text-base leading-8 text-slate-600 dark:text-slate-300">
                                {t.solution.body}
                            </p>
                        </div>

                        <div className="mt-12 grid gap-5 lg:grid-cols-3">
                            {t.features.map((feature, index) => (
                                <motion.div
                                    key={feature.title}
                                    className="group rounded-[2rem] border border-violet-100 bg-white p-7 shadow-xl shadow-violet-900/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-violet-900/10 dark:border-white/10 dark:bg-white/5"
                                    initial={{ opacity: 0, y: 18 }}
                                    transition={{ duration: 0.55, delay: index * 0.08 }}
                                    viewport={{ once: true, amount: 0.35 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                >
                                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-600/20">
                                        <CardIcon index={index} />
                                    </div>
                                    <h3 className="text-xl font-black">{feature.title}</h3>
                                    <p className="mt-2 text-sm font-bold text-violet-700 dark:text-violet-200">
                                        {feature.subtitle}
                                    </p>
                                    <ul className="mt-6 space-y-3">
                                        {feature.bullets.map((bullet) => (
                                            <li
                                                key={bullet}
                                                className="flex items-start gap-3 text-sm leading-6 text-slate-600 dark:text-slate-300"
                                            >
                                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                                                {bullet}
                                            </li>
                                        ))}
                                    </ul>
                                    <ScreenshotFrame
                                        alt={feature.imageAlt}
                                        className="mt-6"
                                        imageClassName="max-h-56"
                                        label={feature.title}
                                        src={feature.image}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="px-4 py-16 sm:px-6 lg:px-8" id="value">
                    <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
                        <div>
                            <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                                {t.context.eyebrow}
                            </p>
                            <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl lg:text-[36px]">
                                {t.context.title}
                            </h2>
                            <p className="mt-5 text-base leading-8 text-slate-600 dark:text-slate-300">
                                {t.context.body}
                            </p>
                            <div className="mt-8 grid gap-3 sm:grid-cols-2">
                                {t.context.points.map((point) => (
                                    <div
                                        key={point}
                                        className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-white/80 p-4 text-sm font-semibold text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                                    >
                                        <Database className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                                        {point}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-violet-500/20 to-fuchsia-400/20 blur-2xl" />
                            <div className="relative rounded-[2rem] border border-violet-100 bg-gradient-to-br from-violet-600 to-fuchsia-500 p-6 shadow-2xl shadow-violet-900/10 dark:border-white/10">
                                <div className="text-sm font-black text-white">
                                    Connected workspace
                                </div>
                                <div className="mt-5">
                                    <StepFlow
                                        steps={[
                                            ...t.features.map((feature) => feature.title),
                                            "AI",
                                        ]}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="px-4 py-16 sm:px-6 lg:px-8" id="ai">
                    <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] border border-violet-200 bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-600 p-8 text-white shadow-2xl shadow-violet-900/20 dark:border-white/10 lg:p-12">
                        <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
                            <div>
                                <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-100">
                                    {t.ai.eyebrow}
                                </p>
                                <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">
                                    {t.ai.title}
                                </h2>
                                <p className="mt-5 text-lg leading-8 text-violet-50/90">
                                    {t.ai.body}
                                </p>
                            </div>
                            <div className="rounded-[2rem] bg-white/10 p-5 backdrop-blur">
                                <div className="flex items-center gap-3 rounded-2xl bg-white p-4 text-slate-950 shadow-xl">
                                    <Bot className="h-6 w-6 text-violet-600" />
                                    <div>
                                        <div className="text-sm font-black">Genos AI</div>
                                        <div className="text-xs text-slate-500">
                                            {t.ai.agentTagline}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 grid gap-3">
                                    {t.ai.examplePrompts.map((prompt) => (
                                        <div key={prompt} className="rounded-2xl bg-white/15 p-4">
                                            <div className="flex items-start gap-2 text-sm font-semibold leading-6 text-violet-50/90">
                                                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-100" />
                                                {prompt}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {t.approvalTrust.steps && (
                    <section className="px-4 py-16 sm:px-6 lg:px-8">
                        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] border border-violet-200 bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 p-8 text-white shadow-2xl shadow-violet-900/20 dark:border-white/10 lg:p-12">
                            <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-200">
                                {t.approvalTrust.eyebrow}
                            </p>
                            <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">
                                {t.approvalTrust.title}
                            </h2>
                            <p className="mt-5 max-w-2xl text-base leading-7 text-violet-50/90">
                                {t.approvalTrust.body}
                            </p>
                            <div className="mt-8">
                                <StepFlow steps={t.approvalTrust.steps} />
                            </div>
                        </div>
                    </section>
                )}

                <section className="px-4 py-16 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl">
                        <div className="grid gap-5 md:grid-cols-2">
                            <div className="rounded-[2rem] border border-violet-100 bg-white p-7 shadow-lg shadow-violet-900/5 dark:border-white/10 dark:bg-white/5">
                                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
                                    <Check className="h-4 w-4" />
                                    {availability.availableNow}
                                </div>
                                <ul className="mt-5 space-y-3">
                                    {t.currentAndNext.availableNow.map((item) => (
                                        <li
                                            key={item}
                                            className="flex items-start gap-3 text-sm leading-6 text-slate-700 dark:text-slate-200"
                                        >
                                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="rounded-[2rem] border border-violet-100 bg-white p-7 shadow-lg shadow-violet-900/5 dark:border-white/10 dark:bg-white/5">
                                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">
                                    <Clock className="h-4 w-4" />
                                    {availability.roadmap}
                                </div>
                                <ul className="mt-5 space-y-3">
                                    {t.currentAndNext.roadmap.map((item) => (
                                        <li
                                            key={item}
                                            className="flex items-start gap-3 text-sm leading-6 text-slate-500 dark:text-slate-400"
                                        >
                                            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="px-4 py-16 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl">
                        <div className="mx-auto max-w-3xl text-center">
                            <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                                {t.audience.eyebrow}
                            </p>
                            <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl lg:text-[40px]">
                                {t.audience.title}
                            </h2>
                        </div>
                        <div className="mx-auto mt-12 grid max-w-3xl gap-3 sm:grid-cols-2">
                            {t.audience.items.map((item) => (
                                <motion.div
                                    key={item}
                                    className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-white/80 p-4 text-sm font-semibold text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                                    initial={{ opacity: 0, y: 12 }}
                                    transition={{ duration: 0.45 }}
                                    viewport={{ once: true, amount: 0.4 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                >
                                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                                    {item}
                                </motion.div>
                            ))}
                        </div>
                        <div className="mx-auto mt-8 max-w-2xl rounded-[2rem] border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-8 text-center shadow-lg shadow-violet-900/5 dark:border-white/10 dark:from-white/10 dark:to-white/5">
                            <p className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                                &ldquo;{t.audience.hookQuote}&rdquo;
                            </p>
                            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
                                {t.audience.hookLine}
                            </p>
                        </div>
                    </div>
                </section>

                <section className="px-4 py-16 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl">
                        <div className="overflow-x-auto">
                            <div className="min-w-[640px] overflow-hidden rounded-[2rem] border border-violet-100 bg-white shadow-xl shadow-violet-900/5 dark:border-white/10 dark:bg-white/5">
                                <div className="grid grid-cols-3 border-b border-violet-100 bg-violet-50 text-sm font-black text-violet-900 dark:border-white/10 dark:bg-white/10 dark:text-white">
                                    {t.comparison.headers.map((header) => (
                                        <div key={header} className="p-4 sm:p-5">
                                            {header}
                                        </div>
                                    ))}
                                </div>
                                {t.comparison.rows.map((row) => (
                                    <div
                                        key={row[0]}
                                        className="grid grid-cols-3 border-b border-violet-100 last:border-b-0 dark:border-white/10"
                                    >
                                        {row.map((cell, cellIndex) => (
                                            <div
                                                key={cell}
                                                className={cn(
                                                    "p-4 text-sm leading-6 sm:p-5",
                                                    cellIndex === 0 &&
                                                        "font-black text-slate-950 dark:text-white",
                                                    cellIndex === 1 &&
                                                        "text-slate-500 dark:text-slate-400",
                                                    cellIndex === 2 &&
                                                        "font-semibold text-violet-700 dark:text-violet-200"
                                                )}
                                            >
                                                {cell}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="px-4 py-16 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl rounded-[2.5rem] border border-violet-100 bg-white p-8 shadow-2xl shadow-violet-900/10 dark:border-white/10 dark:bg-white/5 lg:p-12">
                        <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
                            <div>
                                <h2 className="text-2xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                                    {t.cta.title}
                                </h2>
                                <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                                    {t.cta.body}
                                </p>
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                                <a
                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-6 py-4 text-base font-black text-white shadow-xl shadow-violet-600/25 transition hover:-translate-y-0.5 hover:bg-violet-700"
                                    href={appHref(APP_URL)}
                                    rel="noreferrer"
                                    target="_blank"
                                >
                                    {t.cta.primary}
                                    <ArrowRight className="h-5 w-5" />
                                </a>
                                <a
                                    className="inline-flex items-center justify-center gap-2 rounded-full border border-violet-200 bg-white px-6 py-4 text-base font-black text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:text-violet-700 dark:border-white/10 dark:bg-white/10 dark:text-white"
                                    href={secondaryHref}
                                >
                                    {t.cta.secondary}
                                    <ArrowRight className="h-5 w-5" />
                                </a>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="px-4 py-16 sm:px-6 lg:px-8" id="contact">
                    <div className="mx-auto max-w-7xl">
                        <div className="rounded-[2.5rem] border border-violet-100 bg-white p-8 shadow-2xl shadow-violet-900/10 dark:border-white/10 dark:bg-white/5 lg:p-12">
                            <div className="mx-auto max-w-3xl text-center">
                                <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                                    {CONTACT_COPY[lang].eyebrow}
                                </p>
                                <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                                    {CONTACT_COPY[lang].title}
                                </h2>
                                <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                                    {CONTACT_COPY[lang].body}
                                </p>
                            </div>

                            <div className="mt-10 grid gap-5 md:grid-cols-2">
                                <div className="rounded-[2rem] border border-violet-100 bg-violet-50/60 p-6 dark:border-white/10 dark:bg-white/5">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-sm dark:bg-slate-950 dark:text-violet-200">
                                        <Mail className="h-6 w-6" />
                                    </div>

                                    <h3 className="mt-5 text-xl font-black text-slate-950 dark:text-white">
                                        {CONTACT_COPY[lang].emailTitle}
                                    </h3>

                                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                        {CONTACT_COPY[lang].emailBody}
                                    </p>

                                    <a
                                        className="mt-6 inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-violet-600/25 transition hover:-translate-y-0.5 hover:bg-violet-700"
                                        href={createSegmentMailtoHref(lang, config.mailtoTag)}
                                    >
                                        {CONTACT_COPY[lang].emailCta}
                                        <ArrowRight className="h-4 w-4" />
                                    </a>

                                    <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
                                        {CONTACT_EMAIL}
                                    </p>
                                </div>

                                <div className="rounded-[2rem] border border-violet-100 bg-white p-6 shadow-lg shadow-violet-900/5 dark:border-white/10 dark:bg-white/5">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 shadow-sm dark:bg-violet-500/15 dark:text-violet-200">
                                        <Mail className="h-6 w-6" />
                                    </div>

                                    <h3 className="mt-5 text-xl font-black text-slate-950 dark:text-white">
                                        {CONTACT_COPY[lang].formTitle}
                                    </h3>

                                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                        {CONTACT_COPY[lang].formBody}
                                    </p>

                                    <a
                                        className="mt-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-5 py-3 text-sm font-black text-violet-700 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:bg-white/10 dark:text-violet-100 dark:hover:bg-white/15"
                                        href={GOOGLE_FORM_URL}
                                        rel="noreferrer"
                                        target="_blank"
                                    >
                                        {CONTACT_COPY[lang].formCta}
                                        <ArrowRight className="h-4 w-4" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="px-4 py-16 sm:px-6 lg:px-8" id="faq">
                    <div className="mx-auto max-w-4xl">
                        <div className="text-center">
                            <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
                                {t.faq.eyebrow}
                            </p>
                            <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-5xl">
                                {t.faq.title}
                            </h2>
                        </div>
                        <div className="mt-10 space-y-4">
                            {t.faq.items.map((item) => (
                                <details
                                    key={item.q}
                                    className="group rounded-3xl border border-violet-100 bg-white p-6 shadow-lg shadow-violet-900/5 open:border-violet-200 dark:border-white/10 dark:bg-white/5"
                                >
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-black">
                                        {item.q}
                                        <ChevronRight className="h-5 w-5 shrink-0 text-violet-600 transition group-open:rotate-90" />
                                    </summary>
                                    <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                        {item.a}
                                    </p>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>

                <footer className="border-t border-violet-100 px-4 py-10 sm:px-6 lg:px-8 dark:border-white/10">
                    <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 items-center justify-center overflow-hidden rounded-2xl border border-violet-100 bg-white px-3.5 shadow-lg shadow-violet-900/10 dark:border-white/10 dark:bg-white">
                                    <img
                                        alt="Genos"
                                        className="h-7 object-contain"
                                        src="/genos-logo-with-name.png"
                                    />
                                </div>
                            </div>
                            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                                {footer.line}
                            </p>
                            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                {footer.scopeNote}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
                            <span>© {year} Genos</span>
                            <Link
                                className="transition hover:text-violet-700 dark:hover:text-white"
                                to="/home"
                            >
                                {t.nav.home}
                            </Link>
                            <Link
                                className="transition hover:text-violet-700 dark:hover:text-white"
                                to="/plans"
                            >
                                {t.nav.plans}
                            </Link>
                            <a
                                className="inline-flex items-center gap-2 transition hover:text-violet-700 dark:hover:text-white"
                                href={LINKEDIN_URL}
                                rel="noreferrer"
                                target="_blank"
                            >
                                Created by Kentaro Kamiya
                            </a>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}
