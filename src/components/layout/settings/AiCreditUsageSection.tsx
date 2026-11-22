import { useEffect, useMemo, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/joy";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../../context/authState";
import { fmt, useTranslation } from "../../../i18n";
import {
    CreditCharge,
    CreditUsage,
    CreditUsageJob,
    fetchCreditCharges,
    fetchCreditUsage,
} from "../../../services/agentApi";
import { g, type } from "../../../theme/tokens";
import { formatCredits } from "../../../utils/formatCredits";
import { DashboardCard, formatRelativeTime, ProportionBar, StatTile } from "../../ui/dashboard";
import { LoadMoreList } from "../../ui/misc/LoadMoreList";

/**
 * Settings → AI credit usage (MIP-1971). Which AI job spent how many credits, for the signed-in
 * member only: the endpoint takes no user, so nobody else's usage can be asked for here.
 *
 * Numbers are the ledger's; this view adds no money logic. A job key the client does not know
 * (a new billable source) reads as "Other AI use", with a line saying what that can include, and
 * its Recent charges row names the raw source (MIP-2024). Recent charges start at 5 rows and page
 * by cursor from the API ("Load more"); the totals above always count every charge.
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
    const [charges, setCharges] = useState<CreditCharge[]>([]);
    const [nextCursor, setNextCursor] = useState<number | null>(null);
    const [moreBusy, setMoreBusy] = useState(false);
    const [moreFailed, setMoreFailed] = useState(false);

    useEffect(() => {
        if (!accessToken) return;
        let cancelled = false;
        // Loading only when nothing is shown yet: a refreshed token refetches in the background.
        setState((prev) => (prev === "ready" ? prev : "loading"));
        void fetchCreditUsage(accessToken).then((usage) => {
            if (cancelled) return;
            if (usage) {
                setData(usage);
                setCharges(usage.recent);
                setNextCursor(usage.next_cursor ?? null);
                setMoreFailed(false);
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

    const loadMoreCharges = async () => {
        if (!accessToken || nextCursor === null) return;
        setMoreBusy(true);
        setMoreFailed(false);
        const page = await fetchCreditCharges(accessToken, nextCursor);
        setMoreBusy(false);
        if (!page) {
            setMoreFailed(true);
            return;
        }
        setCharges((prev) => [...prev, ...page.recent]);
        setNextCursor(page.next_cursor);
    };

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

    // A line under a job that needs one: what "connected apps" and "Other AI use" can include.
    const jobHint = (job: CreditUsageJob): string =>
        job === "connected_app" ? u.connectedAppHint : job === "other" ? u.otherHint : "";

    const noUse = state === "ready" && (data?.by_job.length ?? 0) === 0;
    const hasRecent = charges.length > 0;
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
                                    <Box sx={{ flex: 1, minWidth: 0, py: 0.5 }}>
                                        <Typography
                                            sx={{ ...type("body-sm"), color: g.text.primary }}
                                            title={u.jobs[r.job]}
                                            noWrap
                                        >
                                            {u.jobs[r.job]}
                                        </Typography>
                                        {jobHint(r.job) && (
                                            <Typography
                                                sx={{
                                                    ...type("body-xs"),
                                                    color: g.text.secondary,
                                                }}
                                            >
                                                {jobHint(r.job)}
                                            </Typography>
                                        )}
                                    </Box>
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
                    <LoadMoreList
                        ariaLabel={u.recentListAria}
                        emptyLabel={u.emptyBody}
                        endLabel={u.end}
                        failed={moreFailed}
                        failedLabel={u.loadError}
                        footerSx={{ px: { xs: 1.5, md: 2 }, pb: 1 }}
                        getKey={(r) => r.id}
                        hasMore={nextCursor !== null}
                        items={charges}
                        loading={moreBusy}
                        loadMoreLabel={u.loadMore}
                        retryLabel={u.retry}
                        shownLabel={(n) => fmt(u.shown, { n: numberFormat.format(n) })}
                        itemSx={{
                            px: { xs: 1.5, md: 2 },
                            py: 0.75,
                            borderTop: `1px solid ${g.border.subtle}`,
                        }}
                        renderItem={(r) => (
                            <ChargeRow
                                charge={r}
                                credits={formatCredits(r.credits)}
                                dateFormat={dateFormat}
                                jobName={u.jobs[asJob(r.job)]}
                                locale={locale}
                                sourceOther={u.sourceOther}
                            />
                        )}
                        onLoadMore={() => void loadMoreCharges()}
                    />
                </DashboardCard>
            )}
        </Stack>
    );
};

const ChargeRow = ({
    charge: r,
    dateFormat,
    locale,
    jobName,
    sourceOther,
    credits,
}: {
    charge: CreditCharge;
    dateFormat: Intl.DateTimeFormat;
    locale: string;
    jobName: string;
    sourceOther: string;
    credits: string;
}) => {
    const at = Date.parse(r.at);
    // The real source on every row: a schedule's name, or the raw ledger name of a source no job
    // names ("Other AI use (new_thing)").
    const name =
        asJob(r.job) === "other" && r.source ? fmt(sourceOther, { source: r.source }) : jobName;
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                    sx={{ ...type("body-sm"), color: g.text.primary }}
                    title={r.detail ? `${name} · ${r.detail}` : name}
                    noWrap
                >
                    {name}
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
                    title={Number.isNaN(at) ? undefined : dateFormat.format(at)}
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
                {credits}
            </Typography>
        </Box>
    );
};
