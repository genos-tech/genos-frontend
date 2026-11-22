import { useEffect, useMemo, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/joy";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";
import { fmt, useTranslation } from "../../../i18n";
import { CreditUsage, CreditUsageJob, fetchCreditUsage } from "../../../services/agentApi";
import { g, type } from "../../../theme/tokens";
import { formatCredits } from "../../../utils/formatCredits";
import { DashboardCard, formatRelativeTime, ProportionBar, StatTile } from "../../ui/dashboard";

/**
 * Settings → AI credit usage (MIP-1971). Which AI job spent how many credits, for the signed-in
 * member only: the endpoint takes no user, so nobody else's usage can be asked for here.
 *
 * Numbers are the ledger's; this view adds no money logic. A job key the client does not know
 * (a new billable source) reads as "Other AI use".
 */

const JOB_ORDER: CreditUsageJob[] = ["ask", "connected_app", "schedule", "summary", "other"];
const JOB_COLOR: Record<CreditUsageJob, string> = {
    ask: g.chart.series1,
    connected_app: g.chart.series2,
    schedule: g.chart.series3,
    summary: g.chart.series4,
    other: g.text.secondary,
};

const asJob = (job: string): CreditUsageJob =>
    (JOB_ORDER as string[]).includes(job) ? (job as CreditUsageJob) : "other";

export const AiCreditUsageSection = ({ onNavigateAway }: { onNavigateAway?: () => void } = {}) => {
    const { t, locale } = useTranslation();
    const u = t.settings.aiCreditUsage;
    const { accessToken } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState<CreditUsage | null>(null);
    const [state, setState] = useState<"loading" | "error" | "ready">("loading");
    const [reload, setReload] = useState(0);

    useEffect(() => {
        if (!accessToken) return;
        let cancelled = false;
        // Loading only when nothing is shown yet: a refreshed token refetches in the background.
        setState((prev) => (prev === "ready" ? prev : "loading"));
        void fetchCreditUsage(accessToken).then((usage) => {
            if (cancelled) return;
            if (usage) {
                setData(usage);
                setState("ready");
            } else {
                setState((prev) => (prev === "ready" ? prev : "error"));
            }
        });
        return () => {
            cancelled = true;
        };
    }, [accessToken, reload]);

    const byJob = useMemo(() => {
        const rows = new Map((data?.by_job ?? []).map((r) => [asJob(r.job), r]));
        return JOB_ORDER.map((job) => ({
            job,
            count: rows.get(job)?.count ?? 0,
            credits: rows.get(job)?.credits ?? 0,
        }));
    }, [data]);

    const dateFormat = useMemo(
        () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
        [locale]
    );

    // The allowance resets at the first instant of next UTC month: say that date, in UTC.
    const renewsOn = useMemo(() => {
        const end = data?.period_end_iso ? new Date(data.period_end_iso) : null;
        if (!end || Number.isNaN(end.getTime())) return "";
        return new Intl.DateTimeFormat(locale, {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
        }).format(end);
    }, [data, locale]);

    const credits = data?.credits ?? null;
    const unlimited = !!credits && (credits.unlimited || credits.balance === null);
    const balance = credits && credits.balance !== null ? Math.max(credits.balance, 0) : 0;
    const depleted = !!credits && !unlimited && balance <= 0;
    const low = !!credits && !unlimited && !depleted && balance < credits.per_request_max;
    const goPlans = (hash = "") => {
        onNavigateAway?.();
        navigate(`/workspace/plans${hash}`);
    };

    const noUse = state === "ready" && (data?.by_job.length ?? 0) === 0;
    const hasRecent = (data?.recent.length ?? 0) > 0;
    const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);

    return (
        <Stack spacing={2}>
            <Box>
                <Typography level="title-md">{u.heading}</Typography>
                <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                    {u.description}
                </Typography>
            </Box>

            {state === "ready" && data && credits && (
                <Box
                    sx={{
                        display: "grid",
                        gap: 1.5,
                        gridTemplateColumns: {
                            xs: "repeat(2, minmax(0, 1fr))",
                            sm: "repeat(3, minmax(0, 1fr))",
                        },
                        // Phone: the balance gets the full row, the other two share the next.
                        "& > :first-of-type": { gridColumn: { xs: "1 / -1", sm: "auto" } },
                    }}
                >
                    <StatTile
                        label={u.remaining}
                        raw={unlimited ? undefined : balance}
                        tone={depleted ? "danger" : low ? "warning" : "neutral"}
                        value={unlimited ? u.unlimited : formatCredits(balance)}
                        sub={
                            !unlimited && (credits.purchased_balance ?? 0) > 0
                                ? fmt(u.purchasedSub, {
                                      n: formatCredits(credits.purchased_balance ?? 0),
                                  })
                                : undefined
                        }
                    />
                    <StatTile
                        label={u.usedThisMonth}
                        raw={data.month_total_credits}
                        value={formatCredits(data.month_total_credits)}
                    />
                    {renewsOn && <StatTile label={u.renews} value={renewsOn} />}
                </Box>
            )}

            {state === "ready" && data && !credits && (
                <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                    {u.notAuthoritative}
                </Typography>
            )}

            {state === "ready" && (depleted || low) && (
                <Typography level="body-sm" sx={{ color: "warning.plainColor" }}>
                    {depleted ? u.depletedWarning : u.lowWarning}
                </Typography>
            )}

            {state === "ready" && credits && !unlimited && (
                <Stack direction="row" flexWrap="wrap" gap={1}>
                    <Button size="sm" variant="solid" onClick={() => goPlans("#credit-packs")}>
                        {u.buyCredits}
                    </Button>
                    {data?.tier === "free" && (
                        <Button size="sm" variant="outlined" onClick={() => goPlans()}>
                            {u.upgrade}
                        </Button>
                    )}
                </Stack>
            )}

            <DashboardCard
                emptyBody={u.emptyBody}
                emptyTitle={u.emptyTitle}
                errorTitle={u.loadError}
                minBodyHeight={96}
                retryLabel={u.retry}
                state={state === "ready" ? (noUse ? "empty" : "ready") : state}
                title={u.byJobHeading}
                onRetry={() => setReload((n) => n + 1)}
            >
                {data && (
                    <Stack spacing={1.5}>
                        <ProportionBar
                            legend={false}
                            ariaLabel={fmt(u.byJobAria, {
                                list: byJob
                                    .filter((r) => r.count > 0)
                                    .map((r) => `${u.jobs[r.job]} ${formatCredits(r.credits)}`)
                                    .join(", "),
                            })}
                            segments={byJob.map((r) => ({
                                key: r.job,
                                label: u.jobs[r.job],
                                value: r.credits,
                                color: JOB_COLOR[r.job],
                            }))}
                        />
                        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
                            {byJob.map((r) => (
                                <Box
                                    key={r.job}
                                    component="li"
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        minHeight: g.row.default,
                                        opacity: r.count === 0 ? 0.6 : 1,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 8,
                                            height: 8,
                                            flexShrink: 0,
                                            borderRadius: g.radius.full,
                                            background: JOB_COLOR[r.job],
                                        }}
                                        aria-hidden
                                    />
                                    <Typography
                                        title={u.jobs[r.job]}
                                        sx={{
                                            ...type("body-sm"),
                                            color: g.text.primary,
                                            flex: 1,
                                            minWidth: 0,
                                        }}
                                        noWrap
                                    >
                                        {u.jobs[r.job]}
                                    </Typography>
                                    <Typography
                                        sx={{
                                            ...type("body-xs"),
                                            color: g.text.secondary,
                                            flexShrink: 0,
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {fmt(u.jobCount, { n: numberFormat.format(r.count) })}
                                    </Typography>
                                    <Typography
                                        sx={{
                                            ...type("body-sm"),
                                            color: g.text.primary,
                                            flexShrink: 0,
                                            minWidth: 48,
                                            textAlign: "end",
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {formatCredits(r.credits)}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    </Stack>
                )}
            </DashboardCard>

            {state === "ready" && hasRecent && data && (
                <DashboardCard subtitle={u.recentCap} title={u.recentHeading} variant="flush">
                    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
                        {data.recent.map((r) => {
                            const job = asJob(r.job);
                            const at = Date.parse(r.at);
                            return (
                                <Box
                                    key={r.id}
                                    component="li"
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1.5,
                                        px: { xs: 1.5, md: 2 },
                                        py: 0.75,
                                        borderTop: `1px solid ${g.border.subtle}`,
                                    }}
                                >
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography
                                            sx={{ ...type("body-sm"), color: g.text.primary }}
                                            title={
                                                r.detail
                                                    ? `${u.jobs[job]} · ${r.detail}`
                                                    : u.jobs[job]
                                            }
                                            noWrap
                                        >
                                            {u.jobs[job]}
                                            {r.detail ? (
                                                <>
                                                    {" · "}
                                                    <bdi>{r.detail}</bdi>
                                                </>
                                            ) : null}
                                        </Typography>
                                        <Typography
                                            component="time"
                                            dateTime={r.at}
                                            sx={{ ...type("body-xs"), color: g.text.secondary }}
                                            title={
                                                Number.isNaN(at)
                                                    ? undefined
                                                    : dateFormat.format(at)
                                            }
                                        >
                                            {formatRelativeTime(at, locale)}
                                        </Typography>
                                    </Box>
                                    <Typography
                                        sx={{
                                            ...type("body-sm"),
                                            color: g.text.primary,
                                            flexShrink: 0,
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {formatCredits(r.credits)}
                                    </Typography>
                                </Box>
                            );
                        })}
                    </Box>
                </DashboardCard>
            )}
        </Stack>
    );
};
