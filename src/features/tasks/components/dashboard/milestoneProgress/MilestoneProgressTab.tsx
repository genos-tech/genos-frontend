import { useEffect, useMemo, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/joy";

import { EmptyState } from "../../../../../components/ui/feedback/EmptyState";
import { useAuth } from "../../../../../context/AuthContext";
import { fmt, useTranslation } from "../../../../../i18n";
import { g } from "../../../../../theme/tokens";
import { TaskProgressPage } from "../../../../../types/tasks";
import { STATUS_TONE, StatusName, toneCss, toneSolid } from "../../../meta/taskTone";
import { loadTaskProgress } from "../../../services/loadTaskProgress";
import { Milestone, Sprint } from "../../../sprint-milestone/types";
import { EffectiveTask } from "../../../utils/effectiveTasks";
import {
    DUE_SOON_DAYS,
    MilestoneProgressSummary,
    summarizeMilestoneProgress,
    summarizeMilestoneProgressOverview,
} from "../../../utils/milestoneProgressSummary";
import { formatRelativeAge } from "../../../utils/relativeAge";
import { StatusLabel } from "../../meta/StatusLabel";

type Msgs = ReturnType<typeof useTranslation>["t"]["tasks"]["dashboard"]["milestoneProgress"];
type AgeMsgs = ReturnType<typeof useTranslation>["t"]["tasks"]["activity"];
type Locale = ReturnType<typeof useTranslation>["locale"];

// MIP-1187: the Milestones tab of the Tasks dashboard. Per ongoing milestone of the
// current project: progress by status, due date against today, what is overdue,
// blocked or due this week, and when anything under it last moved. The numbers come
// from the task rows the dashboard already holds; only "Recent progress" makes a
// request, and only when a card is opened.

const ATTENTION_LIMIT = 6;
const PROGRESS_LIMIT = 5;

type Props = {
    milestones: Milestone[];
    sprints: Sprint[];
    effectiveTasks: EffectiveTask[];
};

type ProgressState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "failed" }
    | { status: "ready"; page: TaskProgressPage };

// One segment per status in the stacked bar and one legend chip per status with tasks.
const segmentColor = (key: string): string => {
    if (key === "Other") return toneSolid("muted").bg;
    return toneSolid(STATUS_TONE[key as StatusName] ?? "muted").bg;
};

export const MilestoneProgressTab = ({ milestones, sprints, effectiveTasks }: Props) => {
    const { t, locale } = useTranslation();
    const { accessToken } = useAuth();
    const m = t.tasks.dashboard.milestoneProgress;
    const age = t.tasks.activity;
    // One clock per computation of the summaries: the due lines and ages read it.
    const { now, summaries } = useMemo(() => {
        const clock = new Date();
        return {
            now: clock,
            summaries: milestones.map((ms) =>
                summarizeMilestoneProgress(ms, effectiveTasks, clock)
            ),
        };
    }, [milestones, effectiveTasks]);
    const overview = useMemo(() => summarizeMilestoneProgressOverview(summaries), [summaries]);

    if (milestones.length === 0) {
        return <EmptyState body={m.empty} data-empty="milestone-progress" size="md" />;
    }

    const tiles: { label: string; value: string; tone?: "danger" | "warning" }[] = [
        { label: m.summaryMilestones, value: String(overview.milestones) },
        {
            label: m.summaryClosed,
            value: overview.tasks > 0 ? `${overview.closed}/${overview.tasks}` : "0",
        },
        {
            label: m.summaryOverdue,
            value: String(overview.overdue),
            tone: overview.overdue > 0 ? "danger" : undefined,
        },
        {
            label: m.summaryBlocked,
            value: String(overview.blocked),
            tone: overview.blocked > 0 ? "warning" : undefined,
        },
        {
            label: m.summaryStalled,
            value: String(overview.stalled),
            tone: overview.stalled > 0 ? "warning" : undefined,
        },
    ];

    return (
        <Stack spacing={2.5}>
            <Box>
                <Typography level="title-md" sx={{ color: g.text.primary, fontWeight: 600 }}>
                    {m.heading}
                </Typography>
                <Typography level="body-sm" sx={{ color: g.text.secondary, mt: 0.5 }}>
                    {m.subtitle}
                </Typography>
            </Box>

            <Box
                aria-label={m.heading}
                role="list"
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "repeat(3, minmax(0, 1fr))",
                        sm: "repeat(5, minmax(0, 1fr))",
                    },
                    gap: 1,
                }}
            >
                {tiles.map((tile) => (
                    <Box
                        key={tile.label}
                        role="listitem"
                        sx={{
                            p: 1.5,
                            borderRadius: "10px",
                            border: "1px solid",
                            borderColor: g.border.subtle,
                            minWidth: 0,
                        }}
                    >
                        <Typography
                            level="title-lg"
                            sx={{
                                color: tile.tone ? toneCss(tile.tone).text : g.text.primary,
                                fontWeight: 600,
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            {tile.value}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                            {tile.label}
                        </Typography>
                    </Box>
                ))}
            </Box>

            <Stack component="ul" spacing={1.5} sx={{ listStyle: "none", m: 0, p: 0 }}>
                {summaries.map((s, i) => {
                    const ms = milestones[i];
                    return (
                        <li key={ms.milestoneId}>
                            <MilestoneCard
                                accessToken={accessToken}
                                labels={{ m, age }}
                                locale={locale}
                                milestone={ms}
                                now={now}
                                summary={s}
                                sprintName={
                                    ms.sprintId == null
                                        ? m.noSprint
                                        : (sprints.find((sp) => sp.sprintId === ms.sprintId)
                                              ?.name ?? m.noSprint)
                                }
                            />
                        </li>
                    );
                })}
            </Stack>
        </Stack>
    );
};

type CardProps = {
    milestone: Milestone;
    summary: MilestoneProgressSummary;
    sprintName: string;
    accessToken: string | null;
    locale: Locale;
    labels: { m: Msgs; age: AgeMsgs };
    now: Date;
};

const MilestoneCard = ({
    milestone,
    summary,
    sprintName,
    accessToken,
    locale,
    labels,
    now,
}: CardProps) => {
    const { m, age } = labels;
    const [open, setOpen] = useState(false);
    const [progress, setProgress] = useState<ProgressState>({ status: "idle" });
    // Bumped by Retry: a new key reads the feed again instead of a cached failure.
    const [attempt, setAttempt] = useState(0);
    const taskId = milestone.taskId;
    const version = summary.lastProgressAt ?? "";

    // Read the recent progress only once the card is opened; a change under the milestone
    // moves `version`, which re-reads it.
    useEffect(() => {
        if (!open || taskId == null) return;
        let cancelled = false;
        setProgress({ status: "loading" });
        loadTaskProgress(accessToken, taskId, {
            minDepth: 1,
            limit: PROGRESS_LIMIT,
            version,
        }).then((page) => {
            if (cancelled) return;
            setProgress(page ? { status: "ready", page } : { status: "failed" });
        });
        return () => {
            cancelled = true;
        };
    }, [open, taskId, version, accessToken, attempt]);

    const total = summary.total;

    let dueText: string;
    let dueTone: "danger" | "warning" | "muted" = "muted";
    const d = summary.dueInDays;
    if (d == null) dueText = m.dueNone;
    else if (d < -1) {
        dueText = fmt(m.overdueBy, { count: -d });
        dueTone = "danger";
    } else if (d === -1) {
        dueText = m.overdueByOne;
        dueTone = "danger";
    } else if (d === 0) {
        dueText = m.dueToday;
        dueTone = "warning";
    } else if (d === 1) {
        dueText = m.dueInOne;
        dueTone = "warning";
    } else {
        dueText = fmt(m.dueIn, { count: d });
        dueTone = d <= DUE_SOON_DAYS ? "warning" : "muted";
    }

    const dueColor = dueTone === "muted" ? g.text.secondary : toneCss(dueTone).text;
    const reasonFor = (
        t: EffectiveTask
    ): { label: string; tone: "danger" | "warning" | "muted" } => {
        if (summary.overdue.includes(t)) return { label: m.reasonOverdue, tone: "danger" };
        if (t.effectiveStatus === "Blocked") return { label: m.reasonBlocked, tone: "warning" };
        return { label: m.reasonDueSoon, tone: "warning" };
    };
    const shownAttention = summary.attention.slice(0, ATTENTION_LIMIT);
    const hiddenAttention = summary.attention.length - shownAttention.length;

    return (
        <Box
            sx={{
                p: 2,
                borderRadius: "12px",
                border: "1px solid",
                borderColor: g.border.subtle,
                bgcolor: g.surface.raised,
                minWidth: 0,
            }}
        >
            <Stack
                alignItems="center"
                direction="row"
                justifyContent="space-between"
                spacing={1}
                sx={{ minWidth: 0 }}
            >
                <Stack alignItems="center" direction="row" spacing={1} sx={{ minWidth: 0 }}>
                    <Typography
                        level="title-sm"
                        sx={{
                            color: g.text.primary,
                            fontWeight: 600,
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {milestone.title}
                    </Typography>
                    <Typography
                        level="body-xs"
                        sx={{ color: g.text.tertiary, whiteSpace: "nowrap" }}
                    >
                        {sprintName}
                    </Typography>
                </Stack>
                <StatusLabel status={milestone.status} />
            </Stack>

            <Stack
                alignItems="baseline"
                direction="row"
                justifyContent="space-between"
                spacing={1}
                sx={{ mt: 1, flexWrap: "wrap" }}
            >
                <Typography
                    level="body-xs"
                    sx={{ color: dueColor, fontWeight: dueTone === "muted" ? 400 : 600 }}
                >
                    {dueText}
                </Typography>
                <Typography
                    level="body-xs"
                    sx={{ color: g.text.secondary, fontVariantNumeric: "tabular-nums" }}
                >
                    {total === 0
                        ? m.noTasks
                        : fmt(m.closedOfTotal, { closed: summary.closed, total })}
                </Typography>
            </Stack>

            {total > 0 && (
                <Box
                    aria-label={fmt(m.closedOfTotal, { closed: summary.closed, total })}
                    role="img"
                    sx={{
                        mt: 1,
                        display: "flex",
                        height: 8,
                        borderRadius: "4px",
                        overflow: "hidden",
                        bgcolor: g.border.subtle,
                    }}
                >
                    {summary.entries.map((e) => (
                        <Box
                            key={e.status}
                            sx={{
                                width: `${(e.count / total) * 100}%`,
                                bgcolor: segmentColor(e.status),
                            }}
                        />
                    ))}
                </Box>
            )}
            {total > 0 && (
                <Stack direction="row" spacing={1.25} sx={{ mt: 0.75, flexWrap: "wrap" }}>
                    {summary.entries.map((e) => (
                        <Stack key={e.status} alignItems="center" direction="row" spacing={0.5}>
                            <Box
                                sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "2px",
                                    bgcolor: segmentColor(e.status),
                                }}
                            />
                            <Typography
                                level="body-xs"
                                sx={{
                                    color: g.text.secondary,
                                    fontVariantNumeric: "tabular-nums",
                                }}
                            >
                                {e.status === "Other" ? m.otherStatus : e.status} {e.count}
                            </Typography>
                        </Stack>
                    ))}
                </Stack>
            )}

            <Typography
                level="body-xs"
                sx={{
                    mt: 1,
                    color: summary.stalled ? toneCss("warning").text : g.text.secondary,
                    fontWeight: summary.stalled ? 600 : 400,
                }}
            >
                {summary.stalled
                    ? fmt(m.stalled, { count: summary.daysSinceProgress ?? 0 })
                    : summary.lastProgressAt
                      ? fmt(m.lastProgress, {
                            age: formatRelativeAge(
                                summary.lastProgressAt,
                                age,
                                now.getTime(),
                                locale
                            ),
                        })
                      : m.noProgress}
            </Typography>

            <Button
                aria-expanded={open}
                color="neutral"
                size="sm"
                sx={{ mt: 1, px: 0, color: g.text.secondary }}
                variant="plain"
                onClick={() => setOpen((v) => !v)}
            >
                {open ? m.detailsHide : m.detailsShow}
            </Button>

            {open && (
                <Stack
                    spacing={2}
                    sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid", borderColor: g.border.subtle }}
                >
                    <Box>
                        <Typography
                            level="title-sm"
                            sx={{ color: g.text.primary, fontWeight: 600, mb: 0.5 }}
                        >
                            {m.attentionHeading}
                        </Typography>
                        {shownAttention.length === 0 ? (
                            <EmptyState
                                body={m.attentionNone}
                                data-empty="milestone-attention-none"
                                size="xs"
                            />
                        ) : (
                            <Stack
                                component="ul"
                                spacing={0.75}
                                sx={{ listStyle: "none", m: 0, p: 0 }}
                            >
                                {shownAttention.map((t) => {
                                    const reason = reasonFor(t);
                                    return (
                                        <Stack
                                            key={String(t.id)}
                                            alignItems="baseline"
                                            component="li"
                                            direction="row"
                                            spacing={1}
                                            sx={{ minWidth: 0 }}
                                        >
                                            <Typography
                                                level="body-xs"
                                                sx={{
                                                    color: toneCss(reason.tone).text,
                                                    fontWeight: 600,
                                                    whiteSpace: "nowrap",
                                                    minWidth: 72,
                                                }}
                                            >
                                                {reason.label}
                                            </Typography>
                                            <Typography
                                                level="body-xs"
                                                sx={{
                                                    color: g.text.primary,
                                                    minWidth: 0,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                    flex: 1,
                                                }}
                                            >
                                                {t.title}
                                            </Typography>
                                            <Typography
                                                level="body-xs"
                                                sx={{
                                                    color: g.text.tertiary,
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {t.assigneeName ?? m.noAssignee}
                                            </Typography>
                                        </Stack>
                                    );
                                })}
                                {hiddenAttention > 0 && (
                                    <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                                        {fmt(m.attentionMore, { count: hiddenAttention })}
                                    </Typography>
                                )}
                            </Stack>
                        )}
                    </Box>

                    <Box>
                        <Typography
                            level="title-sm"
                            sx={{ color: g.text.primary, fontWeight: 600, mb: 0.5 }}
                        >
                            {m.recentHeading}
                        </Typography>
                        <RecentProgress
                            labels={{ m, age }}
                            locale={locale}
                            now={now}
                            progress={progress}
                            onRetry={() => setAttempt((n) => n + 1)}
                        />
                    </Box>
                </Stack>
            )}
        </Box>
    );
};

const RecentProgress = ({
    progress,
    labels,
    locale,
    now,
    onRetry,
}: {
    onRetry: () => void;
    progress: ProgressState;
    labels: { m: Msgs; age: AgeMsgs };
    locale: Locale;
    now: Date;
}) => {
    const { m, age } = labels;
    if (progress.status === "loading" || progress.status === "idle") {
        return (
            <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                {m.recentLoading}
            </Typography>
        );
    }
    if (progress.status === "failed") {
        return (
            <Stack alignItems="center" direction="row" spacing={1}>
                <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                    {m.recentFailed}
                </Typography>
                <Button color="neutral" size="sm" variant="plain" onClick={onRetry}>
                    {m.recentRetry}
                </Button>
            </Stack>
        );
    }
    const entries = progress.page.entries;
    if (entries.length === 0) {
        return <EmptyState body={m.recentNone} data-empty="milestone-recent-none" size="xs" />;
    }
    return (
        <Stack component="ul" spacing={0.75} sx={{ listStyle: "none", m: 0, p: 0 }}>
            {entries.map((e) => (
                <Stack
                    key={e.activityId}
                    alignItems="baseline"
                    component="li"
                    direction="row"
                    spacing={1}
                    sx={{ minWidth: 0 }}
                >
                    <Typography
                        level="body-xs"
                        sx={{ color: g.text.tertiary, whiteSpace: "nowrap", minWidth: 72 }}
                    >
                        {formatRelativeAge(e.tsCreatedAt, age, now.getTime(), locale)}
                    </Typography>
                    <Typography
                        level="body-xs"
                        sx={{
                            color: g.text.primary,
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                        }}
                    >
                        {e.sourceTask
                            ? `${e.sourceTask.displayId} ${e.sourceTask.title ?? ""}`
                            : ""}
                    </Typography>
                    {e.actor?.userName && (
                        <Typography
                            level="body-xs"
                            sx={{ color: g.text.secondary, whiteSpace: "nowrap" }}
                        >
                            {fmt(m.byActor, { name: e.actor.userName })}
                        </Typography>
                    )}
                </Stack>
            ))}
        </Stack>
    );
};
