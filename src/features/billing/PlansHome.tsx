import { useEffect, useState } from "react";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Box, Button, Card, Chip, LinearProgress, Link, Sheet, Stack, Typography } from "@mui/joy";

import { CreditBalance } from "../../components/layout/settings/CreditBalance";
import { useAuth } from "../../context/AuthContext";
import { useCurrencyPreference } from "../../hooks/common/useCurrencyPreference";
import { fmt, useTranslation } from "../../i18n";
import type { Messages } from "../../i18n/types";
import { CreditsBlock, fetchAgentFeatures, SubscriptionTier } from "../../services/agentApi";
import {
    BillingConfig,
    BillingPlans,
    BillingSubscription,
    CreditPackCatalogue,
    fetchBillingConfig,
    fetchBillingPlans,
    fetchBillingSubscription,
    fetchCreditPacks,
    fetchTeamBillingConfig,
    openBillingPortal,
    openTeamBillingPortal,
    PlanPrice,
    PlanTier,
    PurchasablePlan,
    startCheckout,
    startCreditPackCheckout,
    startTeamCheckout,
    TeamBillingConfig,
} from "../../services/billingApi";
import { formatPrice } from "../../utils/currency";
import { CurrencyPicker } from "./CurrencyPicker";
import { planCta } from "./planCta";
import { MatrixCell, planMatrixGroups } from "./planMatrix";

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

type PlanStrings = Messages["settings"]["planUsage"];

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

/**
 * One cell of the comparison table, in Joy.
 *
 * Mirrors the public page's cell semantics exactly, because the two
 * render the same facts and a reader who checks both must not find them
 * saying different things: an absent capability is an EXPLICIT dimmed
 * cross (an empty cell in a grid reads as a rendering bug, so the one
 * row separating two plans would look broken), and "Unlimited" carries
 * more weight than a number in the same column.
 */
const PlanCell = ({ cell, p }: { cell: MatrixCell; p: PlanStrings }) => {
    if (cell.kind === "yes") {
        return (
            <Typography
                level="body-sm"
                startDecorator={
                    <CheckRoundedIcon sx={{ fontSize: 16, color: "success.solidBg" }} />
                }
            >
                <Box component="span" sx={{ position: "absolute", left: -9999 }}>
                    {cell.label ?? p.matrixIncluded}
                </Box>
            </Typography>
        );
    }
    if (cell.kind === "no") {
        return (
            <Typography
                level="body-sm"
                sx={{ color: "text.tertiary" }}
                startDecorator={
                    <CloseRoundedIcon sx={{ fontSize: 16, color: "neutral.plainDisabledColor" }} />
                }
            >
                <Box component="span" sx={{ position: "absolute", left: -9999 }}>
                    {cell.label ?? p.matrixNotIncluded}
                </Box>
            </Typography>
        );
    }
    return (
        <Typography
            level="body-sm"
            sx={
                cell.emphasis
                    ? { fontWeight: "xl", color: "primary.plainColor" }
                    : { fontWeight: "md" }
            }
        >
            {cell.label}
        </Typography>
    );
};

export const PlansHome = () => {
    const { accessToken } = useAuth();
    const { t, locale } = useTranslation();
    // Display currency. The subscription's REAL currency is read off
    // Stripe and is unaffected by this — see useCurrencyPreference.
    const { currency, setCurrency } = useCurrencyPreference();
    const [plans, setPlans] = useState<BillingPlans | null>(null);
    const [config, setConfig] = useState<BillingConfig | null>(null);
    const [teamConfig, setTeamConfig] = useState<TeamBillingConfig | null>(null);
    const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
    const [creditPacks, setCreditPacks] = useState<CreditPackCatalogue | null>(null);
    // The BALANCE cannot come from the billing payload: `/billing/plans/`
    // is AllowAny and its key list says "never add a per-user value
    // here". So the packs section reads it from the agent features
    // endpoint, which is authenticated and already serves it elsewhere.
    const [credits, setCredits] = useState<CreditsBlock | null>(null);
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
        // Both fail soft to null: a packs section that cannot load is
        // simply not offered, which is better than a page that breaks
        // over an upsell.
        void fetchCreditPacks(accessToken, currency).then((catalogue) => {
            if (!cancelled) setCreditPacks(catalogue);
        });
        void fetchAgentFeatures(accessToken).then((features) => {
            if (!cancelled) setCredits(features?.credits ?? null);
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
            <Box sx={{ flex: 1, minWidth: 0, p: 3 }}>
                <Typography level="body-sm">{p.loadError}</Typography>
            </Box>
        );
    }
    // `flex: 1` on every branch, not just the loaded one: a content-sized
    // flex item here renders as a ~50px sliver beside the sidebar, then
    // snaps to full width the moment the plans arrive.
    if (!plans) {
        return (
            <Box sx={{ flex: 1, minWidth: 0, p: 3 }}>
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
                        component="a"
                        href={CONTACT_SALES_MAILTO}
                        size="sm"
                        variant="outlined"
                        fullWidth
                    >
                        {p.contactUs}
                    </Button>
                );
            case "checkout":
                return (
                    <Button
                        disabled={busy}
                        variant={cta.plan === "pro" ? "solid" : "soft"}
                        size="sm"
                        // Pro is the tier we expect most people to buy,
                        // so it carries the solid (primary) treatment;
                        // core and max flank it as soft.
                        fullWidth
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
                        disabled={busy}
                        size="sm"
                        variant={cta.kind === "upgrade" ? "solid" : "outlined"}
                        fullWidth
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
                        color="neutral"
                        disabled={busy}
                        size="sm"
                        variant="outlined"
                        fullWidth
                        onClick={() =>
                            runBillingAction(() => openBillingPortal(accessToken!, "cancel"))
                        }
                    >
                        {p.cancelPlan}
                    </Button>
                );
        }
    };

    const tagline: Record<SubscriptionTier, string> = {
        free: p.taglineFree,
        core: p.taglineCore,
        pro: p.taglinePro,
        max: p.taglineMax,
        enterprise: p.taglineEnterprise,
    };

    return (
        <Box
            sx={{
                // The page owns its scroll. The app shell (`#root`) is
                // `overflow: hidden`, so a route taller than the viewport
                // scrolls the DOCUMENT instead — and the sidebar rides up with
                // it, because its `position: sticky` can only pin against a
                // scrollport it shares, which the document isn't. Bounding the
                // page at one viewport keeps the shell that tall and leaves the
                // sidebar where it belongs.
                flex: 1,
                minWidth: 0,
                height: "100dvh",
                overflowY: "auto",
            }}
        >
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
                                        {tierLabel[personalTier as SubscriptionTier] ??
                                            personalTier}
                                    </Chip>
                                    {config?.has_billing_account ? (
                                        renewalLabel()
                                    ) : (
                                        <Typography
                                            level="body-sm"
                                            sx={{ color: "text.tertiary" }}
                                        >
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

                {/* One table, not five cards. A card answers "what do I get
                    on Pro?"; someone on this page is asking "what does the
                    next plan give me that mine doesn't", and five parallel
                    lists make them diff by eye.

                    Rendered from `planMatrixGroups` — the SAME builder the
                    public /plans page uses. That is the point: this page and
                    marketing previously had separate row builders and drifted,
                    most recently over MCP. One renderer, one set of facts. */}
                <Sheet
                    sx={{ borderRadius: "lg", overflowX: "auto", overflowY: "hidden" }}
                    variant="outlined"
                >
                    <Box
                        component="table"
                        sx={{
                            width: "100%",
                            minWidth: 900,
                            borderCollapse: "collapse",
                            textAlign: "start",
                            // Digits are read DOWN a column as much as across
                            // a row; proportional figures make 150 and 30 sit
                            // at different optical widths.
                            fontVariantNumeric: "tabular-nums",
                            "& th, & td": { p: 1.5, verticalAlign: "middle" },
                            "& thead th": { verticalAlign: "top", pt: 4, pb: 2 },
                        }}
                    >
                        <Box component="thead">
                            <Box component="tr">
                                <Box
                                    component="th"
                                    scope="col"
                                    sx={{
                                        position: "sticky",
                                        insetInlineStart: 0,
                                        zIndex: 2,
                                        width: 210,
                                        // Opaque, and the same colour as the
                                        // Sheet: a translucent pinned column
                                        // shows the rows sliding under it.
                                        bgcolor: "background.surface",
                                        verticalAlign: "bottom !important",
                                    }}
                                >
                                    <Typography
                                        level="body-xs"
                                        sx={{
                                            textTransform: "uppercase",
                                            letterSpacing: "0.14em",
                                        }}
                                    >
                                        {p.matrixFeature}
                                    </Typography>
                                </Box>
                                {plans.tiers.map((tier) => {
                                    const priceLabel = tier.price
                                        ? formatPrice(tier.price, locale)
                                        : null;
                                    const highlighted = tier.tier === "pro";
                                    return (
                                        <Box
                                            key={tier.tier}
                                            component="th"
                                            scope="col"
                                            sx={{
                                                position: "relative",
                                                borderInlineStart: "1px solid",
                                                borderColor: highlighted
                                                    ? "primary.solidBg"
                                                    : "divider",
                                                bgcolor: highlighted
                                                    ? "primary.softBg"
                                                    : "transparent",
                                            }}
                                        >
                                            {highlighted && (
                                                <Chip
                                                    color="primary"
                                                    size="sm"
                                                    variant="solid"
                                                    sx={{
                                                        // Out of flow, or it
                                                        // pushes this column's
                                                        // name, price and CTA
                                                        // down by its own
                                                        // height while the
                                                        // other four stay put.
                                                        position: "absolute",
                                                        top: 8,
                                                        insetInlineStart: 12,
                                                    }}
                                                >
                                                    {p.bestValue}
                                                </Chip>
                                            )}
                                            <Typography level="title-lg">
                                                {tierLabel[tier.tier]}
                                            </Typography>
                                            <Typography
                                                level="body-xs"
                                                sx={{ color: "text.tertiary", minHeight: 34 }}
                                            >
                                                {tagline[tier.tier]}
                                            </Typography>
                                            <Stack
                                                alignItems="baseline"
                                                direction="row"
                                                spacing={0.5}
                                                sx={{ minHeight: 40 }}
                                            >
                                                {tier.contact_sales ? (
                                                    <Typography level="title-md">
                                                        {p.contactSales}
                                                    </Typography>
                                                ) : tier.price?.amount === 0 ? (
                                                    <>
                                                        <Typography level="h3">
                                                            {p.freePrice}
                                                        </Typography>
                                                        <Typography
                                                            level="body-xs"
                                                            sx={{ color: "text.tertiary" }}
                                                        >
                                                            {p.freeForever}
                                                        </Typography>
                                                    </>
                                                ) : priceLabel ? (
                                                    <>
                                                        <Typography level="h3">
                                                            {priceLabel}
                                                        </Typography>
                                                        <Typography
                                                            level="body-xs"
                                                            sx={{ color: "text.tertiary" }}
                                                        >
                                                            {p.perMonth}
                                                        </Typography>
                                                    </>
                                                ) : null}
                                            </Stack>
                                            <Box sx={{ minHeight: 36, mt: 1 }}>
                                                {renderCta(tier)}
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>

                        {planMatrixGroups(plans.tiers, p, locale).map((group) => (
                            <Box key={group.key} component="tbody">
                                <Box component="tr">
                                    <Box
                                        colSpan={plans.tiers.length + 1}
                                        component="th"
                                        scope="colgroup"
                                        sx={{
                                            position: "sticky",
                                            insetInlineStart: 0,
                                            bgcolor: "background.level1",
                                            borderBlock: "1px solid",
                                            borderColor: "divider",
                                            textAlign: "start",
                                        }}
                                    >
                                        <Typography
                                            level="body-xs"
                                            sx={{
                                                fontWeight: "lg",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.14em",
                                            }}
                                        >
                                            {group.label}
                                        </Typography>
                                    </Box>
                                </Box>
                                {group.rows.map((row) => (
                                    <Box
                                        key={row.key}
                                        component="tr"
                                        sx={{
                                            borderBottom: "1px solid",
                                            borderColor: "divider",
                                            "&:last-of-type": { borderBottom: "none" },
                                        }}
                                    >
                                        <Box
                                            component="th"
                                            scope="row"
                                            sx={{
                                                position: "sticky",
                                                insetInlineStart: 0,
                                                zIndex: 1,
                                                bgcolor: "background.surface",
                                                textAlign: "start",
                                            }}
                                        >
                                            <Typography level="body-sm" sx={{ fontWeight: "md" }}>
                                                {row.label}
                                            </Typography>
                                        </Box>
                                        {row.cells.map((cell, i) => (
                                            <Box
                                                key={plans.tiers[i].tier}
                                                component="td"
                                                sx={{
                                                    borderInlineStart: "1px solid",
                                                    borderColor:
                                                        plans.tiers[i].tier === "pro"
                                                            ? "primary.solidBg"
                                                            : "divider",
                                                    bgcolor:
                                                        plans.tiers[i].tier === "pro"
                                                            ? "primary.softBg"
                                                            : "transparent",
                                                }}
                                            >
                                                <PlanCell cell={cell} p={p} />
                                            </Box>
                                        ))}
                                    </Box>
                                ))}
                            </Box>
                        ))}
                    </Box>
                </Sheet>

                {/* Credit packs — the answer to "I had a heavy week" that
                    is not "change your subscription". Placed under the plan
                    table because it only makes sense once you know what a
                    plan includes, and it carries the current balance for
                    the same reason: "buy more" needs a "more than what". */}
                {creditPacks?.packs?.length ? (
                    <Sheet sx={{ borderRadius: "lg", mt: 4, p: 2.5 }} variant="outlined">
                        <Typography level="title-md">{p.creditsPacksHeading}</Typography>
                        <Typography level="body-sm" sx={{ color: "text.tertiary", mt: 0.5 }}>
                            {p.creditsPacksBlurb}
                        </Typography>

                        {credits && (
                            <Box sx={{ maxWidth: 420, mt: 2 }}>
                                <CreditBalance credits={credits} hideUpgradeNote />
                            </Box>
                        )}

                        {creditPacks.available ? (
                            <Stack direction="row" flexWrap="wrap" spacing={1} sx={{ mt: 2 }}>
                                {creditPacks.packs.map((pack) => (
                                    <Button
                                        key={pack.pack}
                                        disabled={busy}
                                        size="sm"
                                        variant="outlined"
                                        onClick={() =>
                                            runBillingAction(() =>
                                                startCreditPackCheckout(
                                                    accessToken!,
                                                    pack.pack,
                                                    currency
                                                )
                                            )
                                        }
                                    >
                                        {fmt(p.creditsPackBuy, { n: String(pack.credits) })}
                                        {pack.price ? ` · ${formatPrice(pack.price, locale)}` : ""}
                                    </Button>
                                ))}
                            </Stack>
                        ) : (
                            <Typography level="body-sm" sx={{ color: "text.tertiary", mt: 2 }}>
                                {creditPacks.unavailable_reason || p.creditsPacksUnavailable}
                            </Typography>
                        )}
                    </Sheet>
                ) : null}

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
                                            <Typography level="title-md">
                                                {team.team_name}
                                            </Typography>
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
                                                            variant={
                                                                plan === "pro" ? "solid" : "soft"
                                                            }
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
        </Box>
    );
};
