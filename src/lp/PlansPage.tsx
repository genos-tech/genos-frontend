import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Mail, Moon, Sparkles, Sun, X } from "lucide-react";
import { Link } from "react-router-dom";

import { CurrencyPicker } from "../features/billing/CurrencyPicker";
import { MatrixCell, planMatrixGroups } from "../features/billing/planMatrix";
import { useCurrencyPreference } from "../hooks/common/useCurrencyPreference";
import { fmt, I18nProvider, useTranslation } from "../i18n";
import {
    BillingPlans,
    fetchPublicBillingPlans,
    PlanPrice,
    PlanTier,
} from "../services/billingApi";
import { formatPrice } from "../utils/currency";

const APP_URL = "https://genosai.dev";
const CONTACT_SALES_MAILTO = "mailto:genos.support@genosai.dev?subject=Genos%20Enterprise";

// Stripe stores these currencies without decimals; everything else is
// in hundredths (cents). Mirrors PlansHome so the marketing page and
// the in-app page always agree on prices.
function cn(...classes: Array<string | false | undefined>) {
    return classes.filter(Boolean).join(" ");
}

/**
 * One cell of the comparison table.
 *
 * A missing capability renders an EXPLICIT dimmed cross rather than an
 * empty cell — the rule the card layout already followed, and it matters
 * more here: in a grid an empty cell reads as an omission, so the one
 * thing separating two tiers would look like a bug.
 *
 * `sr-only` text rides along with each icon. A screen reader hitting a
 * row of bare ticks learns nothing about which column it is in, and this
 * table is the page's entire argument.
 */
const Cell = ({ cell }: { cell: MatrixCell }) => {
    if (cell.kind === "yes") {
        return (
            <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <Check className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
                <span className={cell.label ? undefined : "sr-only"}>{cell.label ?? "Yes"}</span>
            </span>
        );
    }
    if (cell.kind === "no") {
        return (
            <span className="inline-flex items-center gap-2 text-slate-400 dark:text-slate-600">
                <X className="h-4 w-4 shrink-0" />
                <span className={cell.label ? undefined : "sr-only"}>{cell.label ?? "No"}</span>
            </span>
        );
    }
    return (
        <span
            className={cn(
                cell.emphasis
                    ? "font-black text-violet-700 dark:text-violet-300"
                    : "font-semibold text-slate-700 dark:text-slate-200"
            )}
        >
            {cell.label}
        </span>
    );
};

function PlansPageInner() {
    const { t, locale } = useTranslation();
    const p = t.settings.planUsage;
    const meta = t.featuresPage.meta;
    const [dark, setDark] = useState(false);
    const [plans, setPlans] = useState<BillingPlans | null>(null);
    const [failed, setFailed] = useState(false);
    const year = useMemo(() => new Date().getFullYear(), []);
    // Display currency only — nobody is a subscriber on this page.
    const { currency, setCurrency } = useCurrencyPreference();

    useEffect(() => {
        let cancelled = false;
        void fetchPublicBillingPlans(currency).then((res) => {
            if (cancelled) return;
            setPlans(res);
            setFailed(res === null);
        });
        return () => {
            cancelled = true;
        };
        // Amounts are quoted in the currency they were requested in, so
        // a switch has to re-ask rather than re-render stale numbers.
    }, [currency]);

    const tierLabel: Record<string, string> = {
        free: p.tierFree,
        core: p.tierCore,
        pro: p.tierPro,
        max: p.tierMax,
        enterprise: p.tierEnterprise,
    };
    const tagline: Record<string, string> = {
        free: p.taglineFree,
        core: p.taglineCore,
        pro: p.taglinePro,
        max: p.taglineMax,
        enterprise: p.taglineEnterprise,
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

                        {/* Invisible until a second currency has prices
                            configured server-side. */}
                        <div className="mt-6 flex justify-center">
                            <CurrencyPicker
                                ariaLabel={p.currencyLabel}
                                className="rounded-full border border-violet-200 bg-white/80 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-200"
                                supported={plans?.supported_currencies}
                                value={plans?.currency || currency}
                                onChange={setCurrency}
                            />
                        </div>
                    </div>
                </section>

                {/* Pricing */}
                <section className="px-4 pb-20 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-[1440px]">
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
                            // One table, not five cards. A card answers "what
                            // do I get on Pro?"; nobody arrives asking that.
                            // They ask "what does Pro give me that Core
                            // doesn't?", and five parallel lists make the
                            // reader do the diffing by eye — the rows are in
                            // different positions and worded per tier. Here a
                            // feature is a ROW and the answer is read across.
                            //
                            // The pricing cards become the table HEAD, so the
                            // price and the CTA stay glued to the column they
                            // belong to at every scroll position.
                            <>
                                <div className="mb-6 text-center">
                                    <h2 className="text-2xl font-black tracking-[-0.02em] text-slate-950 dark:text-white">
                                        {p.matrixHeading}
                                    </h2>
                                    <p className="mt-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
                                        {p.matrixSub}
                                        {/* Five columns cannot fit a phone, so the
                                            table scrolls sideways. Saying so beats
                                            leaving the reader to discover it — a
                                            cut-off column reads as a broken page,
                                            not as more content. */}
                                        <span className="lg:hidden"> {p.matrixScrollHint}</span>
                                    </p>
                                </div>
                                <motion.div
                                    animate={{ opacity: 1, y: 0 }}
                                    className="overflow-x-auto rounded-[1.75rem] border border-violet-100 bg-white shadow-lg shadow-violet-900/5 dark:border-white/10 dark:bg-slate-900"
                                    initial={{ opacity: 0, y: 18 }}
                                    transition={{ duration: 0.5 }}
                                >
                                    {/* min-w keeps the columns legible instead of
                                    crushing five of them onto a phone; the
                                    wrapper scrolls and the feature column is
                                    pinned, so you never lose track of which
                                    row you are reading. */}
                                    <table className="w-full min-w-[64rem] border-collapse text-left">
                                        <caption className="sr-only">{p.matrixHeading}</caption>
                                        <thead>
                                            <tr>
                                                <th
                                                    className="sticky left-0 z-20 w-48 bg-white p-5 align-bottom sm:w-56 dark:bg-slate-900"
                                                    scope="col"
                                                >
                                                    <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                                                        {p.matrixFeature}
                                                    </span>
                                                </th>
                                                {plans.tiers.map((tier) => {
                                                    const highlighted = tier.tier === "pro";
                                                    const priceLabel = tier.price
                                                        ? formatPrice(tier.price, locale)
                                                        : null;
                                                    return (
                                                        <th
                                                            key={tier.tier}
                                                            scope="col"
                                                            className={cn(
                                                                "relative border-l p-5 align-top",
                                                                highlighted
                                                                    ? "border-violet-200 bg-violet-50/60 dark:border-violet-400/20 dark:bg-violet-400/10"
                                                                    : "border-violet-100/70 dark:border-white/10"
                                                            )}
                                                        >
                                                            {highlighted && (
                                                                <span className="mb-2 inline-flex items-center rounded-full bg-violet-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-white">
                                                                    {p.bestValue}
                                                                </span>
                                                            )}
                                                            <div className="text-lg font-black text-slate-950 dark:text-white">
                                                                {tierLabel[tier.tier] ?? tier.tier}
                                                            </div>
                                                            <p className="mt-1 min-h-[2.25rem] text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                                                                {tagline[tier.tier] ?? ""}
                                                            </p>
                                                            <div className="mt-3 min-h-[2rem]">
                                                                {tier.tier === "free" ? (
                                                                    <span className="text-2xl font-black text-slate-950 dark:text-white">
                                                                        {p.freeForever}
                                                                    </span>
                                                                ) : priceLabel ? (
                                                                    <span className="text-2xl font-black text-slate-950 dark:text-white">
                                                                        {priceLabel}
                                                                    </span>
                                                                ) : tier.contact_sales ? (
                                                                    <span className="text-base font-black text-slate-700 dark:text-slate-200">
                                                                        {p.contactUs}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                            {renderCta(tier)}
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>

                                        {planMatrixGroups(plans.tiers, p, locale).map((group) => (
                                            <tbody key={group.key}>
                                                <tr>
                                                    <th
                                                        className="sticky left-0 border-y border-violet-100 bg-violet-50/70 px-5 py-2.5 text-left text-xs font-black uppercase tracking-[0.14em] text-violet-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-violet-200"
                                                        colSpan={plans.tiers.length + 1}
                                                        scope="colgroup"
                                                    >
                                                        {group.label}
                                                    </th>
                                                </tr>
                                                {group.rows.map((row) => (
                                                    <tr
                                                        key={row.key}
                                                        className="border-b border-violet-50 last:border-b-0 dark:border-white/5"
                                                    >
                                                        <th
                                                            className="sticky left-0 z-10 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                                            scope="row"
                                                        >
                                                            {row.label}
                                                        </th>
                                                        {row.cells.map((cell, i) => (
                                                            <td
                                                                key={plans.tiers[i].tier}
                                                                className={cn(
                                                                    "border-l px-5 py-3.5 text-sm",
                                                                    plans.tiers[i].tier === "pro"
                                                                        ? "border-violet-200 bg-violet-50/40 dark:border-violet-400/20 dark:bg-violet-400/[0.06]"
                                                                        : "border-violet-100/70 dark:border-white/10"
                                                                )}
                                                            >
                                                                <Cell cell={cell} />
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        ))}
                                    </table>
                                </motion.div>
                            </>
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
