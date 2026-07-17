import { useEffect, useState } from "react";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import { Box, Button, Chip, Divider, LinearProgress, Sheet, Stack, Typography } from "@mui/joy";

import { useAuth } from "../../../context/AuthContext";
import { fmt, useTranslation } from "../../../i18n";
import {
    AgentFeatures,
    fetchAgentFeatures,
    QuotaBlock,
    SubscriptionTier,
} from "../../../services/agentApi";
import {
    BillingConfig,
    BillingSubscription,
    fetchBillingConfig,
    fetchBillingSubscription,
    openBillingPortal,
    startCheckout,
} from "../../../services/billingApi";

/**
 * Settings → Plan & Usage.
 *
 * One `fetchAgentFeatures` call renders the user's effective tier
 * (personal tier, or a paying team's plan — shown as "via team X"),
 * a usage bar per metered dimension (AI asks + web searches per day,
 * task/note creations per month), and the plan's static limits
 * (message-history window, per-file upload size).
 *
 * `limit: null` = unlimited for this plan → "Unlimited" text, no bar.
 * The monthly blocks are absent entirely on older backends — rows
 * render only when the payload carries them, so this component is
 * safe to ship ahead of the API.
 *
 * Billing buttons render from `fetchBillingConfig`: free personal
 * tier → Stripe Checkout buttons per purchasable plan; an existing
 * personal subscription → the customer portal (plan changes go
 * through Stripe with proration — never a second checkout). With
 * Stripe unconfigured server-side the tab keeps the disabled
 * "coming soon" placeholder and plans stay operator-managed
 * (`feature_access set-tier` / `set-team-plan`).
 */

const TIER_COLOR: Record<SubscriptionTier, "neutral" | "primary" | "success" | "warning"> = {
    free: "neutral",
    pro: "primary",
    max: "success",
    enterprise: "warning",
};

const UsageRow = ({
    label,
    windowLabel,
    block,
    unlimitedLabel,
}: {
    label: string;
    windowLabel: string;
    block: QuotaBlock;
    unlimitedLabel: string;
}) => {
    const unlimited = block.limit === null;
    const ratio = unlimited || block.limit === 0 ? 0 : Math.min(block.used / block.limit!, 1);
    const atCap = !unlimited && block.limit !== 0 && block.used >= block.limit!;
    return (
        <Box>
            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
                <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                    {label}
                </Typography>
                <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                    {unlimited ? unlimitedLabel : `${block.used} / ${block.limit} ${windowLabel}`}
                </Typography>
            </Stack>
            {!unlimited && (
                <LinearProgress
                    color={atCap ? "warning" : "primary"}
                    determinate
                    sx={{ mt: 0.5 }}
                    thickness={4}
                    value={ratio * 100}
                />
            )}
        </Box>
    );
};

export const PlanUsageSection = () => {
    const { accessToken } = useAuth();
    const { t, locale } = useTranslation();
    const [data, setData] = useState<AgentFeatures | null>(null);
    const [failed, setFailed] = useState(false);
    const [billing, setBilling] = useState<BillingConfig | null>(null);
    const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
    // In-flight guard for the checkout/portal buttons: the click ends
    // in a full-page navigation to Stripe, so the button stays busy
    // until the browser leaves (or an error surfaces below it).
    const [billingBusy, setBillingBusy] = useState(false);
    const [billingError, setBillingError] = useState<string | null>(null);

    useEffect(() => {
        if (!accessToken) return;
        let cancelled = false;
        void fetchAgentFeatures(accessToken).then((features) => {
            if (cancelled) return;
            setData(features);
            setFailed(features === null);
        });
        // Billing availability is independent of the usage payload —
        // a null config (old backend / Stripe unset) keeps the
        // "coming soon" placeholder.
        void fetchBillingConfig(accessToken).then((cfg) => {
            if (!cancelled) setBilling(cfg);
        });
        // Renewal/expiry row. Null (no billing account, no live
        // subscription, or any failure) just hides the row.
        void fetchBillingSubscription(accessToken).then((sub) => {
            if (!cancelled) setSubscription(sub);
        });
        return () => {
            cancelled = true;
        };
    }, [accessToken]);

    const runBillingAction = (action: () => Promise<void>) => {
        if (!accessToken || billingBusy) return;
        setBillingBusy(true);
        setBillingError(null);
        action().catch((e: unknown) => {
            // Success navigates away — only failures return here.
            setBillingError(
                e instanceof Error && e.message ? e.message : t.settings.planUsage.billingError
            );
            setBillingBusy(false);
        });
    };

    const p = t.settings.planUsage;

    if (failed) {
        return (
            <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
                <Typography level="body-sm">{p.loadError}</Typography>
            </Sheet>
        );
    }
    if (!data) {
        return (
            <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
                <LinearProgress size="sm" />
            </Sheet>
        );
    }

    const tierLabel = {
        free: p.tierFree,
        pro: p.tierPro,
        max: p.tierMax,
        enterprise: p.tierEnterprise,
    }[data.tier];

    return (
        <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <WorkspacePremiumRoundedIcon />
                <Typography level="title-md">{p.heading}</Typography>
                <Box sx={{ flex: 1 }} />
                <Chip color={TIER_COLOR[data.tier]} size="sm" variant="soft">
                    {tierLabel}
                </Chip>
            </Stack>
            {data.tier_source === "team" && data.tier_team && (
                <Typography level="body-xs" sx={{ color: "text.tertiary", mb: 0.5 }}>
                    {fmt(p.viaTeam, { team: data.tier_team })}
                </Typography>
            )}
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {p.description}
            </Typography>

            <Stack spacing={1.25}>
                <UsageRow
                    block={data.llm_ask}
                    label={p.aiAsks}
                    unlimitedLabel={p.unlimited}
                    windowLabel={p.todaySuffix}
                />
                <UsageRow
                    block={data.web_search}
                    label={p.webSearches}
                    unlimitedLabel={p.unlimited}
                    windowLabel={p.todaySuffix}
                />
                {data.task_create && (
                    <UsageRow
                        block={data.task_create}
                        label={p.tasksCreated}
                        unlimitedLabel={p.unlimited}
                        windowLabel={p.monthSuffix}
                    />
                )}
                {data.note_create && (
                    <UsageRow
                        block={data.note_create}
                        label={p.notesCreated}
                        unlimitedLabel={p.unlimited}
                        windowLabel={p.monthSuffix}
                    />
                )}
            </Stack>

            <Divider sx={{ my: 1.5 }} />

            <Stack spacing={0.75}>
                <Stack alignItems="center" direction="row" justifyContent="space-between">
                    <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                        {p.messageHistory}
                    </Typography>
                    <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                        {data.message_retention_days == null
                            ? p.unlimited
                            : fmt(p.messageHistoryDays, {
                                  days: String(data.message_retention_days),
                              })}
                    </Typography>
                </Stack>
                <Stack alignItems="center" direction="row" justifyContent="space-between">
                    <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                        {p.maxFileSize}
                    </Typography>
                    <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                        {data.upload_max_mb == null
                            ? p.unlimited
                            : fmt(p.maxFileSizeMb, { mb: String(data.upload_max_mb) })}
                    </Typography>
                </Stack>
                {(() => {
                    // Renewal / expiry row for a live personal
                    // subscription. `cancel_at` wins over the period
                    // end when a cancellation is scheduled (Stripe sets
                    // both; cancel_at is the authoritative stop date).
                    if (!subscription) return null;
                    const willEnd =
                        subscription.cancel_at_period_end || subscription.cancel_at !== null;
                    const endTs = subscription.cancel_at ?? subscription.current_period_end;
                    if (endTs == null) return null;
                    const dateLabel = new Date(endTs * 1000).toLocaleDateString(locale, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                    });
                    return (
                        <>
                            <Stack
                                alignItems="center"
                                direction="row"
                                justifyContent="space-between"
                            >
                                <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                                    {willEnd ? p.planEnds : p.planRenews}
                                </Typography>
                                <Typography
                                    color={willEnd ? "warning" : undefined}
                                    level="body-sm"
                                    sx={willEnd ? undefined : { color: "text.tertiary" }}
                                >
                                    {dateLabel}
                                </Typography>
                            </Stack>
                            {willEnd && (
                                <Typography color="warning" level="body-xs">
                                    {p.cancelScheduled}
                                </Typography>
                            )}
                            {subscription.status === "past_due" && (
                                <Typography color="danger" level="body-xs">
                                    {p.pastDue}
                                </Typography>
                            )}
                        </>
                    );
                })()}
            </Stack>

            <Divider sx={{ my: 1.5 }} />

            {billing?.enabled ? (
                <Stack spacing={1}>
                    <Stack alignItems="center" direction="row" spacing={1.5}>
                        {/* Personal upgrades key off the user's OWN tier —
                            a team-granted effective tier doesn't hide them
                            (someone on team-pro may still buy personal max).
                            A user with an existing personal subscription
                            changes plans through the PORTAL (proration,
                            no duplicate subscription), never a second
                            checkout. An operator-set paid tier without a
                            Stripe account shows neither. */}
                        {billing.personal_tier === "free" && (
                            <>
                                {billing.plans.includes("pro") && (
                                    <Button
                                        disabled={billingBusy}
                                        size="sm"
                                        variant="solid"
                                        onClick={() =>
                                            runBillingAction(() =>
                                                startCheckout(accessToken!, "pro")
                                            )
                                        }
                                    >
                                        {p.upgradeToPro}
                                    </Button>
                                )}
                                {billing.plans.includes("max") && (
                                    <Button
                                        disabled={billingBusy}
                                        size="sm"
                                        variant="soft"
                                        onClick={() =>
                                            runBillingAction(() =>
                                                startCheckout(accessToken!, "max")
                                            )
                                        }
                                    >
                                        {p.upgradeToMax}
                                    </Button>
                                )}
                            </>
                        )}
                        {billing.personal_tier !== "free" && billing.has_billing_account && (
                            <Button
                                disabled={billingBusy}
                                size="sm"
                                variant="outlined"
                                onClick={() =>
                                    runBillingAction(() => openBillingPortal(accessToken!))
                                }
                            >
                                {p.manageBilling}
                            </Button>
                        )}
                        <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                            {billing.personal_tier !== "free" && billing.has_billing_account
                                ? p.manageBillingHint
                                : p.upgradeHint}
                        </Typography>
                    </Stack>
                    {billingError && (
                        <Typography color="danger" level="body-xs">
                            {billingError}
                        </Typography>
                    )}
                </Stack>
            ) : (
                <Stack alignItems="center" direction="row" spacing={1.5}>
                    {/* Stripe not configured server-side (or old backend). */}
                    <Button disabled size="sm" variant="solid">
                        {p.upgradeCta}
                    </Button>
                    <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                        {p.upgradeComingSoon}
                    </Typography>
                </Stack>
            )}
        </Sheet>
    );
};
