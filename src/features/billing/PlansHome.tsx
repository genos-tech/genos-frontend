import { useEffect, useState } from "react";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import {
    Box,
    Button,
    Card,
    Chip,
    Divider,
    LinearProgress,
    Link,
    Stack,
    Typography,
} from "@mui/joy";

import { useAuth } from "../../context/AuthContext";
import { fmt, useTranslation } from "../../i18n";
import { SubscriptionTier } from "../../services/agentApi";
import {
    BillingConfig,
    BillingPlans,
    fetchBillingConfig,
    fetchBillingPlans,
    openBillingPortal,
    PlanPrice,
    PlanTier,
    startCheckout,
} from "../../services/billingApi";

/**
 * `/workspace/plans` — the tier comparison page.
 *
 * Limits arrive from `GET /billing/plans/`, which serves the backend's
 * enforcement table verbatim — this page can never advertise a limit
 * the quota engine doesn't apply. Prices come from Stripe through the
 * same payload (null price = Stripe dark or contact-sales → the card
 * renders limits without a price line).
 *
 * CTA logic mirrors `PlanUsageSection`: personal tier only (a
 * team-granted effective tier doesn't hide personal upgrades), free →
 * checkout buttons, an existing personal subscription → the customer
 * portal (plan switches go through Stripe with proration, never a
 * second checkout), enterprise → contact-sales mailto.
 */

const CONTACT_SALES_MAILTO = "mailto:genos.support@gmail.com?subject=Genos%20Enterprise";

// Currencies Stripe stores without decimals — everything else is in
// hundredths (cents). Only the ones plausibly configured here.
const ZERO_DECIMAL_CURRENCIES = new Set(["jpy", "krw", "vnd"]);

const formatPrice = (price: PlanPrice, locale: string): string | null => {
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
};

const TIER_COLOR: Record<SubscriptionTier, "neutral" | "primary" | "success" | "warning"> = {
    free: "neutral",
    pro: "primary",
    max: "success",
    enterprise: "warning",
};

const LimitRow = ({ label, value }: { label: string; value: string }) => (
    <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
        <Typography level="body-sm">{label}</Typography>
        <Typography level="body-sm" sx={{ color: "text.tertiary", textAlign: "right" }}>
            {value}
        </Typography>
    </Stack>
);

export const PlansHome = () => {
    const { accessToken } = useAuth();
    const { t, locale } = useTranslation();
    const [plans, setPlans] = useState<BillingPlans | null>(null);
    const [config, setConfig] = useState<BillingConfig | null>(null);
    const [failed, setFailed] = useState(false);
    // Checkout/portal navigate away on success; stay busy until then.
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    useEffect(() => {
        if (!accessToken) return;
        let cancelled = false;
        void fetchBillingPlans(accessToken).then((res) => {
            if (cancelled) return;
            setPlans(res);
            setFailed(res === null);
        });
        void fetchBillingConfig(accessToken).then((cfg) => {
            if (!cancelled) setConfig(cfg);
        });
        return () => {
            cancelled = true;
        };
    }, [accessToken]);

    const p = t.settings.planUsage;

    const runBillingAction = (action: () => Promise<void>) => {
        if (!accessToken || busy) return;
        setBusy(true);
        setActionError(null);
        action().catch((e: unknown) => {
            setActionError(e instanceof Error && e.message ? e.message : p.billingError);
            setBusy(false);
        });
    };

    if (failed) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography level="body-sm">{p.loadError}</Typography>
            </Box>
        );
    }
    if (!plans) {
        return (
            <Box sx={{ p: 3 }}>
                <LinearProgress size="sm" />
            </Box>
        );
    }

    const tierLabel: Record<SubscriptionTier, string> = {
        free: p.tierFree,
        pro: p.tierPro,
        max: p.tierMax,
        enterprise: p.tierEnterprise,
    };
    const personalTier = config?.personal_tier ?? null;
    const nUnlimited = (n: number | null, template: string) =>
        n == null ? p.unlimited : fmt(template, { n: n.toLocaleString(locale) });

    const renderCta = (tier: PlanTier) => {
        if (tier.tier === personalTier) {
            return (
                <Chip color="success" startDecorator={<CheckCircleRoundedIcon />} variant="soft">
                    {p.currentPlan}
                </Chip>
            );
        }
        if (tier.contact_sales) {
            return (
                <Button component="a" href={CONTACT_SALES_MAILTO} size="sm" variant="outlined">
                    {p.contactUs}
                </Button>
            );
        }
        if (!plans.billing_enabled || !tier.purchasable || !config) return null;
        if (personalTier === "free") {
            return (
                <Button
                    disabled={busy}
                    size="sm"
                    variant={tier.tier === "pro" ? "solid" : "soft"}
                    onClick={() =>
                        runBillingAction(() =>
                            startCheckout(accessToken!, tier.tier as "pro" | "max")
                        )
                    }
                >
                    {tier.tier === "pro" ? p.upgradeToPro : p.upgradeToMax}
                </Button>
            );
        }
        if (config.has_billing_account) {
            // Existing personal subscription: switches happen in the
            // portal with proration — never a second checkout.
            return (
                <Button
                    disabled={busy}
                    size="sm"
                    variant="outlined"
                    onClick={() => runBillingAction(() => openBillingPortal(accessToken!))}
                >
                    {p.manageBilling}
                </Button>
            );
        }
        return null;
    };

    return (
        <Box sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <WorkspacePremiumRoundedIcon />
                <Typography level="h3">{p.plansHeading}</Typography>
            </Stack>
            <Typography level="body-sm" sx={{ color: "text.tertiary", mb: 2.5 }}>
                {p.plansSubheading}
            </Typography>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, 1fr)",
                        lg: "repeat(4, 1fr)",
                    },
                    gap: 2,
                }}
            >
                {plans.tiers.map((tier) => {
                    const priceLabel = tier.price ? formatPrice(tier.price, locale) : null;
                    return (
                        <Card key={tier.tier} sx={{ gap: 1 }} variant="outlined">
                            <Chip
                                color={TIER_COLOR[tier.tier]}
                                size="sm"
                                sx={{ alignSelf: "flex-start" }}
                                variant="soft"
                            >
                                {tierLabel[tier.tier]}
                            </Chip>
                            <Stack alignItems="baseline" direction="row" spacing={0.5}>
                                {tier.contact_sales ? (
                                    <Typography level="title-lg">{p.contactSales}</Typography>
                                ) : tier.price?.amount === 0 ? (
                                    <Typography level="h4">{p.freePrice}</Typography>
                                ) : priceLabel ? (
                                    <>
                                        <Typography level="h4">{priceLabel}</Typography>
                                        <Typography
                                            level="body-xs"
                                            sx={{ color: "text.tertiary" }}
                                        >
                                            {p.perMonth}
                                        </Typography>
                                    </>
                                ) : null}
                            </Stack>
                            <Divider />
                            <Stack spacing={0.75} sx={{ flex: 1 }}>
                                <LimitRow
                                    label={p.aiAsks}
                                    value={nUnlimited(tier.limits.llm_ask_daily, p.perDay)}
                                />
                                <LimitRow
                                    label={p.webSearches}
                                    value={nUnlimited(tier.limits.web_search_daily, p.perDay)}
                                />
                                <LimitRow
                                    label={p.tasksCreated}
                                    value={nUnlimited(
                                        tier.limits.task_create_monthly,
                                        p.perMonthCount
                                    )}
                                />
                                <LimitRow
                                    label={p.notesCreated}
                                    value={nUnlimited(
                                        tier.limits.note_create_monthly,
                                        p.perMonthCount
                                    )}
                                />
                                <LimitRow
                                    label={p.messageHistory}
                                    value={
                                        tier.limits.message_retention_days == null
                                            ? p.unlimited
                                            : fmt(p.messageHistoryDays, {
                                                  days: String(tier.limits.message_retention_days),
                                              })
                                    }
                                />
                                <LimitRow
                                    label={p.maxFileSize}
                                    value={
                                        tier.limits.upload_max_mb == null
                                            ? p.unlimited
                                            : fmt(p.maxFileSizeMb, {
                                                  mb: String(tier.limits.upload_max_mb),
                                              })
                                    }
                                />
                            </Stack>
                            <Box sx={{ mt: 1 }}>{renderCta(tier)}</Box>
                        </Card>
                    );
                })}
            </Box>

            <Typography level="body-xs" sx={{ color: "text.tertiary", mt: 2 }}>
                {p.premiumNote} {plans.billing_enabled ? p.upgradeHint : ""}{" "}
                {/* New tab so the legal doc doesn't interrupt a purchase. */}
                <Link href="/legal" level="body-xs" rel="noreferrer" target="_blank">
                    {p.legalNotice}
                </Link>
            </Typography>
            {actionError && (
                <Typography color="danger" level="body-sm" sx={{ mt: 1 }}>
                    {actionError}
                </Typography>
            )}
        </Box>
    );
};
