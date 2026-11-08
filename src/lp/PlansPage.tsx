import { useEffect, useState } from "react";
import { ArrowRight, Check, Mail, X } from "lucide-react";
import { Link } from "react-router-dom";

import { MatrixCell, planMatrixGroups } from "../features/billing/planMatrix";
import { useCurrencyPreference } from "../hooks/common/useCurrencyPreference";
import { I18nProvider, useTranslation } from "../i18n";
import type { Messages } from "../i18n/types";
import { BillingPlans, fetchPublicBillingPlans, PlanTier } from "../services/billingApi";
import { formatPrice } from "../utils/currency";
import { LpShell } from "./kit/LpShell";
import { useSyncAppLocale } from "./kit/useSyncAppLocale";
import type { Lang } from "./lpLang";
import { useDocumentMeta } from "./useDocumentMeta";

const CONTACT_SALES_MAILTO = "mailto:genos.support@genosai.dev?subject=Genos%20Enterprise";

type PlanStrings = Messages["settings"]["planUsage"];

const META: Record<Lang, { title: string; description: string }> = {
    ja: {
        title: "料金 | Genos",
        description:
            "Free・Core・Pro・Max・Enterprise。プランごとの上限と機能を一覧で比べられます。",
    },
    en: {
        title: "Pricing | Genos",
        description:
            "Free, Core, Pro, Max and Enterprise: compare the limits and features of every plan in one table.",
    },
};

/** One matrix cell: included, not included, or a value. Icons are decoration, the words are the content. */
const Cell = ({ cell, p }: { cell: MatrixCell; p: PlanStrings }) => {
    if (cell.kind === "yes") {
        return (
            <span className="lp-cell">
                <Check className="lp-cell__yes" size={16} aria-hidden />
                <span className={cell.label ? undefined : "sr-only"}>
                    {cell.label ?? p.matrixIncluded}
                </span>
            </span>
        );
    }
    if (cell.kind === "no") {
        return (
            <span className="lp-cell lp-cell--no">
                <X size={16} aria-hidden />
                <span className={cell.label ? undefined : "sr-only"}>
                    {cell.label ?? p.matrixNotIncluded}
                </span>
            </span>
        );
    }
    return (
        <span className={cell.emphasis ? "lp-cell lp-cell--strong" : "lp-cell"}>{cell.label}</span>
    );
};

function PlansBody({ lang }: { lang: Lang }) {
    const { t, locale } = useTranslation();
    const p = t.settings.planUsage;
    const [plans, setPlans] = useState<BillingPlans | null>(null);
    const [failed, setFailed] = useState(false);
    const { currency } = useCurrencyPreference();
    useSyncAppLocale(lang);
    useDocumentMeta({
        title: META[lang].title,
        description: META[lang].description,
        ogTitle: META[lang].title,
        ogDescription: META[lang].description,
    });

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
                <a className="lp-btn lp-btn--secondary lp-btn--block" href={CONTACT_SALES_MAILTO}>
                    <Mail size={16} aria-hidden />
                    {p.contactUs}
                </a>
            );
        }
        const highlighted = tier.tier === "pro";
        return (
            <Link
                className={`lp-btn ${highlighted ? "lp-btn--primary" : "lp-btn--secondary"} lp-btn--block`}
                to="/signup"
            >
                {p.startForFree}
                <ArrowRight size={16} aria-hidden />
            </Link>
        );
    };

    return (
        <>
            <section className="lp-hero" style={{ paddingBottom: 40 }}>
                <div className="lp-container">
                    <div className="lp-hero__copy lp-stack-m">
                        <p className="lp-kicker">{p.freeForever}</p>
                        <h1 className="lp-display">{p.plansHero}</h1>
                        <p className="lp-lead">{p.plansHeroSub}</p>
                    </div>
                </div>
            </section>

            <section className="lp-section lp-section--flush" style={{ paddingTop: 0 }}>
                <div className="lp-container">
                    {failed ? (
                        <div className="lp-cta" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
                            <p className="lp-h3">{p.loadError}</p>
                            <Link className="lp-link" to="/home">
                                {t.featuresPage.meta.backToHome}
                            </Link>
                        </div>
                    ) : !plans ? (
                        <p aria-live="polite" className="lp-small" role="status">
                            …
                        </p>
                    ) : (
                        <>
                            <div className="lp-head" style={{ marginBottom: 24 }}>
                                <h2 className="lp-h2">{p.matrixHeading}</h2>
                                <p className="lp-small">
                                    {p.matrixSub}
                                    {/* Five columns cannot fit a phone, so the table scrolls sideways.
                                        Saying so beats leaving the reader to discover it: a cut-off
                                        column reads as a broken page, not as more content. */}
                                    <span className="lp-only-narrow-inline">
                                        {" "}
                                        {p.matrixScrollHint}
                                    </span>
                                </p>
                            </div>
                            <div className="lp-plans">
                                {/* `tabular-nums`: the numeric rows are read DOWN a column as much as
                                    across a row. The min width keeps the columns legible instead of
                                    crushing five onto a phone; the wrapper scrolls and the feature
                                    column is pinned, so you never lose which row you are reading. */}
                                <table className="lp-plans__table">
                                    <caption className="sr-only">{p.matrixHeading}</caption>
                                    <thead>
                                        <tr>
                                            <th className="lp-plans__feature" scope="col">
                                                <span className="lp-small">{p.matrixFeature}</span>
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
                                                        className={
                                                            highlighted
                                                                ? "lp-plans__tier lp-plans__tier--hl"
                                                                : "lp-plans__tier"
                                                        }
                                                    >
                                                        {highlighted && (
                                                            <span className="lp-badge lp-badge--accent">
                                                                {p.bestValue}
                                                            </span>
                                                        )}
                                                        <div className="lp-h3">
                                                            {tierLabel[tier.tier] ?? tier.tier}
                                                        </div>
                                                        <p className="lp-small lp-plans__tagline">
                                                            {tagline[tier.tier] ?? ""}
                                                        </p>
                                                        <div className="lp-plans__price lp-num">
                                                            {tier.tier === "free"
                                                                ? p.freeForever
                                                                : (priceLabel ??
                                                                  (tier.contact_sales
                                                                      ? p.contactUs
                                                                      : null))}
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
                                                    className="lp-plans__group"
                                                    colSpan={plans.tiers.length + 1}
                                                    scope="colgroup"
                                                >
                                                    {group.label}
                                                </th>
                                            </tr>
                                            {group.rows.map((row) => (
                                                <tr key={row.key}>
                                                    <th className="lp-plans__feature" scope="row">
                                                        {row.label}
                                                    </th>
                                                    {row.cells.map((cell, i) => (
                                                        <td
                                                            key={plans.tiers[i].tier}
                                                            className={
                                                                plans.tiers[i].tier === "pro"
                                                                    ? "lp-plans__cell lp-plans__cell--hl"
                                                                    : "lp-plans__cell"
                                                            }
                                                        >
                                                            <Cell cell={cell} p={p} />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    ))}
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </section>
        </>
    );
}

export default function GenosPlansPage() {
    return (
        <I18nProvider>
            <LpShell active="plans">{({ lang }) => <PlansBody lang={lang} />}</LpShell>
        </I18nProvider>
    );
}
