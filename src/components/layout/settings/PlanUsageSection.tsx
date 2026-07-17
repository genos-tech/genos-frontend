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
 * The upgrade CTA is a placeholder until the Stripe billing phase —
 * plans are currently changed by an operator (`feature_access
 * set-tier` / `set-team-plan`).
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
    const { t } = useTranslation();
    const [data, setData] = useState<AgentFeatures | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!accessToken) return;
        let cancelled = false;
        void fetchAgentFeatures(accessToken).then((features) => {
            if (cancelled) return;
            setData(features);
            setFailed(features === null);
        });
        return () => {
            cancelled = true;
        };
    }, [accessToken]);

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
            </Stack>

            <Divider sx={{ my: 1.5 }} />

            <Stack alignItems="center" direction="row" spacing={1.5}>
                {/* Placeholder until the Stripe billing phase ships. */}
                <Button disabled size="sm" variant="solid">
                    {p.upgradeCta}
                </Button>
                <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                    {p.upgradeComingSoon}
                </Typography>
            </Stack>
        </Sheet>
    );
};
