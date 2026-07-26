import { useEffect, useState } from "react";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
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
import { useCurrencyPreference } from "../../hooks/common/useCurrencyPreference";
import { fmt, useTranslation } from "../../i18n";
import { SubscriptionTier } from "../../services/agentApi";
import {
    BillingConfig,
    BillingPlans,
    BillingSubscription,
    fetchBillingConfig,
    fetchBillingPlans,
    fetchBillingSubscription,
    fetchTeamBillingConfig,
    openBillingPortal,
    openTeamBillingPortal,
    PlanPrice,
    PlanTier,
    PurchasablePlan,
    startCheckout,
    startTeamCheckout,
    TeamBillingConfig,
} from "../../services/billingApi";
import { formatPrice } from "../../utils/currency";
import { CurrencyPicker } from "./CurrencyPicker";
import { planCta } from "./planCta";

/**
 * `/workspace/plans` — the tier comparison page.
 *
 * Limits arrive from `GET /billing/plans/`, which serves the backend's
 * enforcement table verbatim — this page can never advertise a limit
 * the quota engine doesn't apply. Prices come from Stripe through the
 * same payload (null price = Stripe dark or contact-sales → the card
 * renders limits without a price line).
 *
 * CTA logic lives in `planCta.ts` (pure, unit-tested): personal tier
 * only (a team-granted effective tier doesn't hide personal upgrades),
 * free → checkout, an existing subscriber → Stripe customer-portal
 * deep links for every switch and the cancel, enterprise →
 * contact-sales mailto.
 */

const CONTACT_SALES_MAILTO = "mailto:genos.support@gmail.com?subject=Genos%20Enterprise";

// Self-serve plans, cheapest first — mirrors `PURCHASABLE_PLANS` in
// genos-api `origin/services/stripe_billing.py`. Used for the team
// per-seat price line; the personal CTA reads the tier list from the
// API instead, so a plan the server hasn't priced never renders.
const PURCHASABLE_PLANS: PurchasablePlan[] = ["core", "pro", "max"];

// Per-plan CTA label keys. A map rather than a ternary so adding a
// fourth plan is a one-line change and can never silently fall through
// to the wrong plan's label.
const UPGRADE_LABEL_KEY = {
    core: "upgradeToCore",
    pro: "upgradeToPro",
    max: "upgradeToMax",
} as const satisfies Record<PurchasablePlan, string>;

const TEAM_UPGRADE_LABEL_KEY = {
    core: "teamUpgradeToCore",
    pro: "teamUpgradeToPro",
    max: "teamUpgradeToMax",
} as const satisfies Record<PurchasablePlan, string>;

// Wording for a move DOWN the ladder. Neutral on purpose — "Downgrade"
// names the direction rather than the action, and the button does the
// same thing the upgrade one does.
const SWITCH_LABEL_KEY = {
    core: "switchToCore",
    pro: "switchToPro",
    max: "switchToMax",
} as const satisfies Record<PurchasablePlan, string>;

// Currencies Stripe stores without decimals — everything else is in
// hundredths (cents). Only the ones plausibly configured here.
const TIER_COLOR: Record<SubscriptionTier, "neutral" | "primary" | "success" | "warning"> = {
    free: "neutral",
    core: "primary",
    pro: "primary",
    max: "success",
    enterprise: "warning",
};

export const PlansHome = () => {
    const { accessToken } = useAuth();
    const { t, locale } = useTranslation();
    // Display currency. The subscription's REAL currency is read off
    // Stripe and is unaffected by this — see useCurrencyPreference.
    const { currency, setCurrency } = useCurrencyPreference(locale);
    const [plans, setPlans] = useState<BillingPlans | null>(null);
    const [config, setConfig] = useState<BillingConfig | null>(null);
    const [teamConfig, setTeamConfig] = useState<TeamBillingConfig | null>(null);
    const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
    const [failed, setFailed] = useState(false);
    // Checkout/portal navigate away on success; stay busy until then.
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    useEffect(() => {
        if (!accessToken) return;
        let cancelled = false;
        void fetchBillingPlans(accessToken, currency).then((res) => {
            if (cancelled) return;
            setPlans(res);
            setFailed(res === null);
        });
        void fetchBillingConfig(accessToken).then((cfg) => {
            if (!cancelled) setConfig(cfg);
        });
        // Owned teams only — empty for everyone else, so the team
        // section simply doesn't render.
        void fetchTeamBillingConfig(accessToken).then((cfg) => {
            if (!cancelled) setTeamConfig(cfg);
        });
        // Null for a free user, an operator-set tier, or any failure —
        // the banner then falls back to its no-Stripe copy rather than
        // showing a renewal date it doesn't have.
        void fetchBillingSubscription(accessToken).then((sub) => {
            if (!cancelled) setSubscription(sub);
        });
        return () => {
            cancelled = true;
        };
        // `currency` is a dependency: the amounts in `plans` are quoted
        // in whichever currency they were requested in, so switching
        // has to re-ask the server rather than re-render stale numbers
        // under a new symbol.
    }, [accessToken, currency]);

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
        core: p.tierCore,
        pro: p.tierPro,
        max: p.tierMax,
        enterprise: p.tierEnterprise,
    };
    const personalTier = config?.personal_tier ?? null;

    // "Renews on X" / "Ends on X" for a live Stripe subscription.
    // `cancel_at` wins over `current_period_end`: Stripe sets BOTH when a
    // cancellation is scheduled, and cancel_at is the authoritative stop
    // date — showing the period end there would promise a renewal that
    // isn't coming. Same rule as PlanUsageSection.
    const renewalLabel = () => {
        if (!subscription) return null;
        const willEnd = subscription.cancel_at_period_end || subscription.cancel_at !== null;
        const endTs = subscription.cancel_at ?? subscription.current_period_end;
        if (endTs == null) return null;
        const dateLabel = new Date(endTs * 1000).toLocaleDateString(locale, {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
        return (
            <Typography
                color={willEnd ? "warning" : undefined}
                level="body-sm"
                sx={willEnd ? undefined : { color: "text.tertiary" }}
            >
                {`${willEnd ? p.planEnds : p.planRenews} ${dateLabel}`}
            </Typography>
        );
    };

    const renderCta = (tier: PlanTier) => {
        const cta = planCta({
            cardTier: tier.tier,
            personalTier: (personalTier as SubscriptionTier | null) ?? null,
            billingEnabled: plans.billing_enabled && config !== null,
            purchasable: tier.purchasable,
            contactSales: tier.contact_sales,
            subscription,
        });
        switch (cta.kind) {
            case "none":
                return null;
            case "current":
                return (
                    <Chip
                        color="success"
                        startDecorator={<CheckCircleRoundedIcon />}
                        variant="soft"
                    >
                        {p.currentPlan}
                    </Chip>
                );
            case "contact":
                return (
                    <Button
                        fullWidth
                        component="a"
                        href={CONTACT_SALES_MAILTO}
                        size="sm"
                        variant="outlined"
                    >
                        {p.contactUs}
                    </Button>
                );
            case "checkout":
                return (
                    <Button
                        fullWidth
                        disabled={busy}
                        size="sm"
                        // Pro is the tier we expect most people to buy,
                        // so it carries the solid (primary) treatment;
                        // core and max flank it as soft.
                        variant={cta.plan === "pro" ? "solid" : "soft"}
                        onClick={() =>
                            runBillingAction(() => startCheckout(accessToken!, cta.plan, currency))
                        }
                    >
                        {p[UPGRADE_LABEL_KEY[cta.plan]]}
                    </Button>
                );
            // Both switch directions are the SAME portal call — Stripe
            // prorates either way. Only the wording and the emphasis
            // differ, so an upgrade still reads as the positive move.
            case "upgrade":
            case "downgrade":
                return (
                    <Button
                        fullWidth
                        disabled={busy}
                        size="sm"
                        variant={cta.kind === "upgrade" ? "solid" : "outlined"}
                        onClick={() =>
                            runBillingAction(() =>
                                openBillingPortal(accessToken!, "update", cta.plan)
                            )
                        }
                    >
                        {cta.kind === "upgrade"
                            ? p[UPGRADE_LABEL_KEY[cta.plan]]
                            : p[SWITCH_LABEL_KEY[cta.plan]]}
                    </Button>
                );
            case "cancel":
                return (
                    <Button
                        fullWidth
                        color="neutral"
                        disabled={busy}
                        size="sm"
                        variant="outlined"
                        onClick={() =>
                            runBillingAction(() => openBillingPortal(accessToken!, "cancel"))
                        }
                    >
                        {p.cancelPlan}
                    </Button>
                );
        }
    };

    // Benefit-phrased checkmark rows, still fed by the enforcement
    // table — selling order: history first (the classic upgrade
    // trigger), then AI volume, premium models, and the rest.
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
        // Free blocks opus-class models entirely; every paid tier
        // includes them (with per-model daily caps).
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

    const tagline: Record<SubscriptionTier, string> = {
        free: p.taglineFree,
        core: p.taglineCore,
        pro: p.taglinePro,
        max: p.taglineMax,
        enterprise: p.taglineEnterprise,
    };

    return (
        <Box sx={{ p: 3, maxWidth: 1440, mx: "auto" }}>
            <Stack alignItems="center" spacing={1} sx={{ mb: 4, mt: 1, textAlign: "center" }}>
                <Typography level="h2">{p.plansHero}</Typography>
                <Typography level="body-md" sx={{ color: "text.tertiary", maxWidth: 640 }}>
                    {p.plansHeroSub}
                </Typography>
                {/* Renders nothing until a second currency is configured
                    server-side, so this is invisible today and appears on
                    its own once USD prices exist in Stripe. */}
                <CurrencyPicker
                    ariaLabel={p.currencyLabel}
                    supported={plans?.supported_currencies}
                    value={plans?.currency || currency}
                    onChange={setCurrency}
                />
            </Stack>

            {/* Manage-your-subscription banner.
                Without this the ONLY route to a downgrade or a cancel was
                the portal button buried on some OTHER tier's card, which
                (a) reads as "switch to that plan" and (b) doesn't render
                at all for an operator-set tier (`has_billing_account`
                false) — leaving a paying-looking user with no visible way
                out. The banner is the single answer to "how do I change
                or cancel my plan", and it states plainly when there is
                nothing to self-manage instead of offering a dead button. */}
            {personalTier && (personalTier !== "free" || config?.has_billing_account) && (
                <Card sx={{ mb: 3 }} variant="soft">
                    <Stack
                        alignItems={{ xs: "flex-start", sm: "center" }}
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1.5}
                        sx={{ width: "100%" }}
                    >
                        <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                                {p.yourPlanHeading}
                            </Typography>
                            <Stack alignItems="center" direction="row" flexWrap="wrap" gap={1}>
                                <Chip
                                    color={TIER_COLOR[personalTier as SubscriptionTier]}
                                    size="sm"
                                    variant="soft"
                                >
                                    {tierLabel[personalTier as SubscriptionTier] ?? personalTier}
                                </Chip>
                                {config?.has_billing_account ? (
                                    renewalLabel()
                                ) : (
                                    <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                                        {p.planSetByAdmin}
                                    </Typography>
                                )}
                            </Stack>
                            {/* With a live subscription the cards below
                                carry the switch/cancel buttons, so point
                                at them; the generic hint (portal does
                                everything) only applies when there's no
                                subscription for those buttons to act on. */}
                            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                                {!config?.has_billing_account
                                    ? p.planSetByAdminHint
                                    : subscription
                                      ? p.planChangeHint
                                      : p.manageBillingHint}
                            </Typography>
                            {subscription?.status === "past_due" && (
                                <Typography color="danger" level="body-xs">
                                    {p.pastDue}
                                </Typography>
                            )}
                        </Stack>
                        {config?.has_billing_account && (
                            <Button
                                disabled={busy}
                                size="sm"
                                variant="solid"
                                onClick={() =>
                                    runBillingAction(() => openBillingPortal(accessToken!))
                                }
                            >
                                {p.manageBilling}
                            </Button>
                        )}
                    </Stack>
                </Card>
            )}

            <Box
                sx={{
                    display: "grid",
                    // 5 tiers: a 4-column grid stranded Enterprise alone
                    // on a second row. 3 columns gives a clean 3 + 2
                    // (free/core/pro, then max/enterprise); very wide
                    // viewports get all five across.
                    gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, 1fr)",
                        lg: "repeat(3, 1fr)",
                        xl: "repeat(5, 1fr)",
                    },
                    gap: 2,
                    alignItems: "stretch",
                }}
            >
                {plans.tiers.map((tier) => {
                    const priceLabel = tier.price ? formatPrice(tier.price, locale) : null;
                    // Slack-style highlight on the plan most users
                    // should pick.
                    const highlighted = tier.tier === "pro";
                    return (
                        <Card
                            key={tier.tier}
                            sx={{
                                gap: 1,
                                overflow: "visible",
                                position: "relative",
                                ...(highlighted && {
                                    borderColor: "primary.solidBg",
                                    borderWidth: 2,
                                    boxShadow: "md",
                                }),
                            }}
                            variant="outlined"
                        >
                            {highlighted && (
                                <Chip
                                    color="primary"
                                    size="sm"
                                    sx={{
                                        position: "absolute",
                                        top: -12,
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                    }}
                                    variant="solid"
                                >
                                    {p.bestValue}
                                </Chip>
                            )}
                            <Typography level="title-lg" sx={{ mt: highlighted ? 0.5 : 0 }}>
                                {tierLabel[tier.tier]}
                            </Typography>
                            {/* Fixed-height tagline keeps the price rows
                                aligned across cards. */}
                            <Typography
                                level="body-sm"
                                sx={{ color: "text.tertiary", minHeight: 40 }}
                            >
                                {tagline[tier.tier]}
                            </Typography>
                            <Stack
                                alignItems="baseline"
                                direction="row"
                                spacing={0.5}
                                sx={{ minHeight: 44 }}
                            >
                                {tier.contact_sales ? (
                                    <Typography level="title-lg">{p.contactSales}</Typography>
                                ) : tier.price?.amount === 0 ? (
                                    <>
                                        <Typography level="h2">{p.freePrice}</Typography>
                                        <Typography
                                            level="body-xs"
                                            sx={{ color: "text.tertiary" }}
                                        >
                                            {p.freeForever}
                                        </Typography>
                                    </>
                                ) : priceLabel ? (
                                    <>
                                        <Typography level="h2">{priceLabel}</Typography>
                                        <Typography
                                            level="body-xs"
                                            sx={{ color: "text.tertiary" }}
                                        >
                                            {p.perMonth}
                                        </Typography>
                                    </>
                                ) : null}
                            </Stack>
                            <Box sx={{ minHeight: 36 }}>{renderCta(tier)}</Box>
                            <Divider />
                            <Stack spacing={0.75} sx={{ flex: 1 }}>
                                {benefitRows(tier).map((row) => (
                                    <Typography
                                        key={row}
                                        level="body-sm"
                                        startDecorator={
                                            <CheckRoundedIcon
                                                sx={{
                                                    fontSize: 16,
                                                    color: "success.solidBg",
                                                }}
                                            />
                                        }
                                    >
                                        {row}
                                    </Typography>
                                ))}
                            </Stack>
                        </Card>
                    );
                })}
            </Box>

            {/* Team plans — only for teams the viewer OWNS (the config
                endpoint returns an empty list for everyone else). Per-seat
                on the SAME prices as the personal cards above; price math
                comes from the plans payload so it can't drift. */}
            {teamConfig?.enabled && teamConfig.teams.length > 0 && (
                <>
                    <Typography level="h4" sx={{ mt: 4, mb: 0.5 }}>
                        {p.teamPlansHeading}
                    </Typography>
                    <Typography level="body-sm" sx={{ color: "text.tertiary", mb: 1.5 }}>
                        {p.teamPlansSubheading}
                    </Typography>
                    <Stack spacing={1.5}>
                        {teamConfig.teams.map((team) => {
                            const seatPrice = (plan: PurchasablePlan) => {
                                const tierInfo = plans.tiers.find((t) => t.tier === plan);
                                const label = tierInfo?.price
                                    ? formatPrice(tierInfo.price, locale)
                                    : null;
                                return label
                                    ? fmt(p.perSeatMonth, {
                                          price: label,
                                          n: String(team.seats),
                                      })
                                    : null;
                            };
                            return (
                                <Card key={team.team_id} variant="outlined">
                                    <Stack
                                        alignItems="center"
                                        direction="row"
                                        flexWrap="wrap"
                                        spacing={1.5}
                                        useFlexGap
                                    >
                                        <Typography level="title-md">{team.team_name}</Typography>
                                        <Chip
                                            color={TIER_COLOR[team.plan]}
                                            size="sm"
                                            variant="soft"
                                        >
                                            {tierLabel[team.plan]}
                                        </Chip>
                                        <Typography
                                            level="body-sm"
                                            sx={{ color: "text.tertiary" }}
                                        >
                                            {fmt(p.teamSeats, { n: String(team.seats) })}
                                        </Typography>
                                        <Box sx={{ flex: 1 }} />
                                        {team.plan === "free" ? (
                                            <>
                                                {PURCHASABLE_PLANS.map((plan) => (
                                                    <Button
                                                        key={plan}
                                                        disabled={busy}
                                                        size="sm"
                                                        variant={plan === "pro" ? "solid" : "soft"}
                                                        onClick={() =>
                                                            runBillingAction(() =>
                                                                startTeamCheckout(
                                                                    accessToken!,
                                                                    team.team_id,
                                                                    plan,
                                                                    currency
                                                                )
                                                            )
                                                        }
                                                    >
                                                        {p[TEAM_UPGRADE_LABEL_KEY[plan]]}
                                                    </Button>
                                                ))}
                                            </>
                                        ) : (
                                            team.has_billing_account && (
                                                // A paying team had ONE
                                                // generic portal button and
                                                // therefore no visible answer
                                                // to "switch plan" or "cancel"
                                                // — same complaint as the
                                                // personal cards. Switching
                                                // uses the "switch" PICKER,
                                                // not a per-plan deep link: a
                                                // team row is one row for all
                                                // tiers, so no button here
                                                // could name a target plan
                                                // honestly.
                                                <>
                                                    <Button
                                                        disabled={busy}
                                                        size="sm"
                                                        variant="soft"
                                                        onClick={() =>
                                                            runBillingAction(() =>
                                                                openTeamBillingPortal(
                                                                    accessToken!,
                                                                    team.team_id,
                                                                    "switch"
                                                                )
                                                            )
                                                        }
                                                    >
                                                        {p.changeTeamPlan}
                                                    </Button>
                                                    <Button
                                                        color="neutral"
                                                        disabled={busy}
                                                        size="sm"
                                                        variant="outlined"
                                                        onClick={() =>
                                                            runBillingAction(() =>
                                                                openTeamBillingPortal(
                                                                    accessToken!,
                                                                    team.team_id,
                                                                    "cancel"
                                                                )
                                                            )
                                                        }
                                                    >
                                                        {p.cancelPlan}
                                                    </Button>
                                                    <Button
                                                        disabled={busy}
                                                        size="sm"
                                                        variant="plain"
                                                        onClick={() =>
                                                            runBillingAction(() =>
                                                                openTeamBillingPortal(
                                                                    accessToken!,
                                                                    team.team_id
                                                                )
                                                            )
                                                        }
                                                    >
                                                        {p.manageTeamBilling}
                                                    </Button>
                                                </>
                                            )
                                        )}
                                    </Stack>
                                    {team.plan === "free" && (
                                        <Typography
                                            level="body-xs"
                                            sx={{ color: "text.tertiary" }}
                                        >
                                            {PURCHASABLE_PLANS.map(seatPrice)
                                                .filter(Boolean)
                                                .join(" · ")}
                                        </Typography>
                                    )}
                                </Card>
                            );
                        })}
                    </Stack>
                </>
            )}

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
