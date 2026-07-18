import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Mail, Moon, Sparkles, Sun } from "lucide-react";
import { Link } from "react-router-dom";

import { fmt, I18nProvider, useTranslation } from "../i18n";
import {
    BillingPlans,
    fetchPublicBillingPlans,
    PlanPrice,
    PlanTier,
} from "../services/billingApi";

const APP_URL = "https://genosai.dev";
const CONTACT_SALES_MAILTO = "mailto:genos.support@genosai.dev?subject=Genos%20Enterprise";

// Stripe stores these currencies without decimals; everything else is
// in hundredths (cents). Mirrors PlansHome so the marketing page and
// the in-app page always agree on prices.
const ZERO_DECIMAL_CURRENCIES = new Set(["jpy", "krw", "vnd"]);

function cn(...classes: Array<string | false | undefined>) {
    return classes.filter(Boolean).join(" ");
}

function formatPrice(price: PlanPrice, locale: string): string | null {
    if (price.amount == null) return null;
    const divisor = ZERO_DECIMAL_CURRENCIES.has(price.currency.toLowerCase()) ? 1 : 100;
    try {
        return new Intl.NumberFormat(locale, {
            style: "currency",
            currency: price.currency.toUpperCase(),
            maximumFractionDigits: divisor === 1 ? 0 : 2,
        }).format(price.amount / divisor);
    } catch {
        return `${price.amount / divisor} ${price.currency.toUpperCase()}`;
    }
}

function PlansPageInner() {
    const { t, locale } = useTranslation();
    const p = t.settings.planUsage;
    const meta = t.featuresPage.meta;
    const [dark, setDark] = useState(false);
    const [plans, setPlans] = useState<BillingPlans | null>(null);
    const [failed, setFailed] = useState(false);
    const year = useMemo(() => new Date().getFullYear(), []);

    useEffect(() => {
        let cancelled = false;
        void fetchPublicBillingPlans().then((res) => {
            if (cancelled) return;
            setPlans(res);
            setFailed(res === null);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const tierLabel: Record<string, string> = {
        free: p.tierFree,
        pro: p.tierPro,
        max: p.tierMax,
        enterprise: p.tierEnterprise,
    };
    const tagline: Record<string, string> = {
        free: p.taglineFree,
        pro: p.taglinePro,
        max: p.taglineMax,
        enterprise: p.taglineEnterprise,
    };

    // Benefit-phrased rows, fed by the enforcement table exactly like
    // PlansHome so the two pages can never disagree: history first, then
    // AI volume, premium models (paid only), searches, tasks, notes.
    const benefitRows = (tier: PlanTier): string[] => {
        const L = tier.limits;
        const n = (v: number) => v.toLocaleString(locale);
        const rows = [
            L.message_retention_days == null
                ? p.benefitHistoryUnlimited
                : fmt(p.benefitHistoryDays, { days: String(L.message_retention_days) }),
            L.llm_ask_daily == null
                ? p.benefitAiAsksUnlimited
                : fmt(p.benefitAiAsks, { n: n(L.llm_ask_daily) }),
        ];
        if (tier.tier !== "free") rows.push(p.benefitPremiumModels);
        rows.push(
            L.web_search_daily == null
                ? p.benefitWebSearchesUnlimited
                : fmt(p.benefitWebSearches, { n: n(L.web_search_daily) }),
            L.task_create_monthly == null
                ? p.benefitTasksUnlimited
                : fmt(p.benefitTasks, { n: n(L.task_create_monthly) }),
            L.note_create_monthly == null
                ? p.benefitNotesUnlimited
                : fmt(p.benefitNotes, { n: n(L.note_create_monthly) })
        );
        if (L.upload_max_mb != null) {
            rows.push(fmt(p.benefitUpload, { mb: String(L.upload_max_mb) }));
        }
        return rows;
    };

    const renderCta = (tier: PlanTier) => {
        if (tier.contact_sales) {
            return (
                <a
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full border border-violet-200 bg-white px-5 py-3 text-sm font-black text-violet-700 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:bg-white/10 dark:text-violet-100 dark:hover:bg-white/15"
                    href={CONTACT_SALES_MAILTO}
                >
                    <Mail className="h-4 w-4" />
                    {p.contactUs}
                </a>
            );
        }
        const highlighted = tier.tier === "pro";
        return (
            <Link
                to="/signup"
                className={cn(
                    "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition hover:-translate-y-0.5",
                    highlighted
                        ? "bg-violet-600 text-white shadow-lg shadow-violet-600/25 hover:bg-violet-700"
                        : "border border-violet-200 bg-white text-violet-700 shadow-sm hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:bg-white/10 dark:text-violet-100 dark:hover:bg-white/15"
                )}
            >
                {p.startForFree}
                <ArrowRight className="h-4 w-4" />
            </Link>
        );
    };

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
                                {meta.backToHome}
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
                                {meta.tryDemo}
                            </a>
                        </div>
                    </div>
                </header>

                {/* Hero */}
                <section className="relative px-4 pb-10 pt-16 sm:px-6 lg:px-8 lg:pb-14 lg:pt-20">
                    <div className="mx-auto max-w-3xl text-center">
                        <motion.div
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-4 py-2 text-sm font-bold text-violet-700 shadow-sm dark:border-violet-400/20 dark:bg-white/10 dark:text-violet-200"
                            initial={{ opacity: 0, y: 12 }}
                            transition={{ duration: 0.5 }}
                        >
                            <Sparkles className="h-4 w-4" />
                            {p.freeForever}
                        </motion.div>

                        <motion.h1
                            animate={{ opacity: 1, y: 0 }}
                            className="font-black tracking-[-0.04em] text-slate-950 dark:text-white text-[34px] sm:text-5xl lg:text-[56px]"
                            initial={{ opacity: 0, y: 16 }}
                            transition={{ duration: 0.6, delay: 0.05 }}
                        >
                            {p.plansHero}
                        </motion.h1>

                        <motion.p
                            animate={{ opacity: 1, y: 0 }}
                            className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300"
                            initial={{ opacity: 0, y: 16 }}
                            transition={{ duration: 0.6, delay: 0.12 }}
                        >
                            {p.plansHeroSub}
                        </motion.p>
                    </div>
                </section>

                {/* Pricing */}
                <section className="px-4 pb-20 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl">
                        {failed ? (
                            <div className="mx-auto max-w-xl rounded-[2rem] border border-violet-100 bg-white p-10 text-center shadow-lg shadow-violet-900/5 dark:border-white/10 dark:bg-white/5">
                                <p className="text-lg font-black text-slate-950 dark:text-white">
                                    {p.loadError}
                                </p>
                                <Link
                                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-violet-600/25 transition hover:-translate-y-0.5 hover:bg-violet-700"
                                    to="/home"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    {meta.backToHome}
                                </Link>
                            </div>
                        ) : !plans ? (
                            <div className="flex justify-center py-16">
                                <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
                            </div>
                        ) : (
                            <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
                                {plans.tiers.map((tier, index) => {
                                    const highlighted = tier.tier === "pro";
                                    const isFree = tier.tier === "free";
                                    const priceLabel = tier.price
                                        ? formatPrice(tier.price, locale)
                                        : null;
                                    return (
                                        <motion.div
                                            key={tier.tier}
                                            animate={{ opacity: 1, y: 0 }}
                                            initial={{ opacity: 0, y: 18 }}
                                            transition={{ duration: 0.5, delay: index * 0.06 }}
                                            className={cn(
                                                "relative flex flex-col rounded-[1.75rem] border bg-white p-6 shadow-lg shadow-violet-900/5 dark:bg-white/5",
                                                highlighted
                                                    ? "border-violet-500 ring-1 ring-violet-500 dark:border-violet-400/60"
                                                    : "border-violet-100 dark:border-white/10"
                                            )}
                                        >
                                            {highlighted && (
                                                <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-violet-600 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-sm">
                                                    {p.bestValue}
                                                </span>
                                            )}

                                            <h3 className="text-xl font-black text-slate-950 dark:text-white">
                                                {tierLabel[tier.tier] ?? tier.tier}
                                            </h3>
                                            <p className="mt-2 min-h-[2.5rem] text-sm leading-6 text-slate-600 dark:text-slate-300">
                                                {tagline[tier.tier] ?? ""}
                                            </p>

                                            <div className="mt-4 min-h-[2.5rem]">
                                                {isFree ? (
                                                    <span className="text-3xl font-black text-slate-950 dark:text-white">
                                                        {p.freeForever}
                                                    </span>
                                                ) : priceLabel ? (
                                                    <span className="text-3xl font-black text-slate-950 dark:text-white">
                                                        {priceLabel}
                                                    </span>
                                                ) : tier.contact_sales ? (
                                                    <span className="text-lg font-black text-slate-700 dark:text-slate-200">
                                                        {p.contactUs}
                                                    </span>
                                                ) : null}
                                            </div>

                                            <ul className="mt-5 flex-1 space-y-2.5">
                                                {benefitRows(tier).map((row) => (
                                                    <li
                                                        key={row}
                                                        className="flex items-start gap-2.5 text-sm leading-6 text-slate-700 dark:text-slate-200"
                                                    >
                                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
                                                        {row}
                                                    </li>
                                                ))}
                                            </ul>

                                            {renderCta(tier)}
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>

                <footer className="border-t border-violet-100/70 px-4 py-8 dark:border-white/10 sm:px-6 lg:px-8">
                    <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
                        <Link
                            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-violet-700 dark:text-slate-300 dark:hover:text-white"
                            to="/home"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            {meta.backToHome}
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

export default function GenosPlansPage() {
    return (
        <I18nProvider>
            <PlansPageInner />
        </I18nProvider>
    );
}
