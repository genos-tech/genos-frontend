import { useEffect, useId, useMemo, useState } from "react";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Box, Button, IconButton, Stack, Typography } from "@mui/joy";
import { Link } from "react-router-dom";

import { AppTooltip } from "../../../../../components/ui/AppTooltip";
import { AvatarGroup, BaseAvatar } from "../../../../../components/ui/avatars/BaseAvatar";
import {
    DashboardCard,
    ProportionBar,
    SectionHeading,
    StatStrip,
    StatTile,
    useNumberFormat,
} from "../../../../../components/ui/dashboard";
import { DataState } from "../../../../../components/ui/feedback/DataState";
import { EmptyState } from "../../../../../components/ui/feedback/EmptyState";
import { SkeletonLines } from "../../../../../components/ui/feedback/Skeleton";
import { useAuth } from "../../../../../context/AuthContext";
import { fmt, useTranslation } from "../../../../../i18n";
import { g } from "../../../../../theme/tokens";
import { TaskProgressPage } from "../../../../../types/tasks";
import { requestAskGenosWithDraft } from "../../../../spotlight/askGenosAbout";
import { useAskGenosAvailable } from "../../../../spotlight/useAskGenosAvailable";
import { STATUS_TONE, StatusName, toneCss } from "../../../meta/taskTone";
import { loadTaskProgress } from "../../../services/loadTaskProgress";
import { Milestone, Sprint } from "../../../sprint-milestone/types";
import { EffectiveTask } from "../../../utils/effectiveTasks";
import {
    DUE_SOON_DAYS,
    groupMilestonesBySprint,
    MilestoneProgressSummary,
    summarizeMilestoneProgress,
    summarizeMilestoneProgressOverview,
} from "../../../utils/milestoneProgressSummary";
import { formatRelativeAge } from "../../../utils/relativeAge";
import { SourceTaskLine } from "../../contents/base/sub/TaskProgressFeed";
import { StatusLabel } from "../../meta/StatusLabel";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

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
    /** False until the project's milestone list has loaded: a skeleton, never "no milestones". */
    milestonesLoaded: boolean;
    milestones: Milestone[];
    sprints: Sprint[];
    effectiveTasks: EffectiveTask[];
    /** The project the tab is about: named in the question "Ask Genos" starts. */
    projectName?: string | null;
    /** Opens the milestone's preview (the "Milestones in sprint" list of the old Sprint tab did). */
    onOpenMilestone?: (milestoneId: number) => void;
};

type StatusLabels = ReturnType<typeof useTranslation>["t"]["tasks"]["dashboard"]["statusLabels"];

// The dashboard's own words for a status ("Completed", not the stored "Closed"); a status the
// dashboard has no word for (or the "Other" bucket) falls back to the caller's text.
const statusText = (status: string, labels: StatusLabels, other: string): string => {
    if (status === "Other") return other;
    const key = status.toLowerCase() as keyof StatusLabels;
    return labels[key] ?? status;
};

export const MilestoneProgressTab = ({
    milestonesLoaded,
    milestones,
    sprints,
    effectiveTasks,
    projectName,
    onOpenMilestone,
}: Props) => {
    const { t, locale } = useTranslation();
    const nf = useNumberFormat();
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
    const groups = useMemo(
        () => groupMilestonesBySprint(milestones, summaries, sprints),
        [milestones, summaries, sprints]
    );
    const askAvailable = useAskGenosAvailable();
    const idBase = useId();

    const projectLabel = projectName?.trim() || m.thisProject;

    if (!milestonesLoaded) {
        return <SkeletonLines lines={4} />;
    }
    if (milestones.length === 0) {
        return <EmptyState body={m.empty} data-empty="milestone-progress" size="md" />;
    }

    const tiles: { label: string; value: string; sub?: string; tone?: "danger" | "warning" }[] = [
        { label: m.summaryMilestones, value: nf.number(overview.milestones) },
        {
            label: m.summaryClosed,
            value: nf.number(overview.closed),
            sub: overview.tasks > 0 ? `/ ${nf.number(overview.tasks)}` : undefined,
        },
        {
            label: m.summaryOverdue,
            value: nf.number(overview.overdue),
            tone: overview.overdue > 0 ? "danger" : undefined,
        },
        {
            label: m.summaryBlocked,
            value: nf.number(overview.blocked),
            tone: overview.blocked > 0 ? "warning" : undefined,
        },
        {
            label: m.summaryStalled,
            value: nf.number(overview.stalled),
            tone: overview.stalled > 0 ? "warning" : undefined,
        },
    ];

    return (
        <Stack spacing={2.5}>
            <Stack
                alignItems={{ xs: "stretch", sm: "flex-start" }}
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                spacing={1}
            >
                <SectionHeading description={m.subtitle} title={m.heading} />
                {askAvailable ? (
                    <AskGenosButton
                        label={m.askProject}
                        onClick={() =>
                            requestAskGenosWithDraft(
                                fmt(m.askProjectQuestion, { project: projectLabel })
                            )
                        }
                    />
                ) : null}
            </Stack>

            <StatStrip>
                {tiles.map((tile) => (
                    <StatTile
                        key={tile.label}
                        label={tile.label}
                        sub={tile.sub}
                        tone={tile.tone}
                        value={tile.value}
                    />
                ))}
            </StatStrip>

            <Stack spacing={3}>
                {groups.map((group) => {
                    const name = group.sprint?.name ?? m.noSprint;
                    const headingId = `${idBase}-${group.sprint?.sprintId ?? "none"}`;
                    const r = group.rollup;
                    return (
                        <Box
                            key={group.sprint?.sprintId ?? "none"}
                            aria-labelledby={headingId}
                            component="section"
                            data-testid="milestone-sprint-group"
                        >
                            <Stack
                                alignItems={{ xs: "stretch", sm: "center" }}
                                direction={{ xs: "column", sm: "row" }}
                                justifyContent="space-between"
                                spacing={1}
                                sx={{ mb: 1.5 }}
                            >
                                <Box sx={{ minWidth: 0 }}>
                                    <Stack alignItems="center" direction="row" spacing={1}>
                                        <Typography
                                            id={headingId}
                                            level="title-sm"
                                            sx={{
                                                color: g.text.primary,
                                                fontWeight: 600,
                                                minWidth: 0,
                                                overflowWrap: "anywhere",
                                            }}
                                        >
                                            {name}
                                        </Typography>
                                        {group.sprint?.status === "active" ? (
                                            <Typography
                                                level="body-xs"
                                                sx={{
                                                    color: toneCss("success").text,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {m.sprintActive}
                                            </Typography>
                                        ) : null}
                                    </Stack>
                                    <Typography
                                        level="body-xs"
                                        sx={{ color: g.text.secondary, mt: 0.25 }}
                                    >
                                        {fmt(m.sprintRollup, {
                                            closed: r.closed,
                                            tasks: r.tasks,
                                            blocked: r.blocked,
                                            overdue: r.overdue,
                                        })}
                                        {r.lastProgressAt
                                            ? ` · ${fmt(m.lastProgress, {
                                                  age: formatRelativeAge(
                                                      r.lastProgressAt,
                                                      age,
                                                      now.getTime(),
                                                      locale
                                                  ),
                                              })}`
                                            : ""}
                                    </Typography>
                                </Box>
                                {askAvailable && group.sprint ? (
                                    <AskGenosButton
                                        label={m.askSprint}
                                        onClick={() =>
                                            requestAskGenosWithDraft(
                                                fmt(m.askSprintQuestion, {
                                                    sprint: name,
                                                    project: projectLabel,
                                                })
                                            )
                                        }
                                    />
                                ) : null}
                            </Stack>
                            <Stack
                                component="ul"
                                spacing={1.5}
                                sx={{ listStyle: "none", m: 0, p: 0 }}
                            >
                                {group.items.map(({ milestone: ms, summary: s }) => (
                                    <li key={ms.milestoneId}>
                                        <MilestoneCard
                                            accessToken={accessToken}
                                            locale={locale}
                                            milestone={ms}
                                            now={now}
                                            summary={s}
                                            labels={{
                                                m,
                                                age,
                                                status: t.tasks.dashboard.statusLabels,
                                            }}
                                            onOpenMilestone={onOpenMilestone}
                                        />
                                    </li>
                                ))}
                            </Stack>
                        </Box>
                    );
                })}
            </Stack>
        </Stack>
    );
};

type CardProps = {
    milestone: Milestone;
    summary: MilestoneProgressSummary;
    accessToken: string | null;
    locale: Locale;
    labels: { m: Msgs; age: AgeMsgs; status: StatusLabels };
    now: Date;
    onOpenMilestone?: (milestoneId: number) => void;
};

const MilestoneCard = ({
    milestone,
    summary,
    accessToken,
    locale,
    labels,
    now,
    onOpenMilestone,
}: CardProps) => {
    const { m, age, status: statusLabels } = labels;
    const nf = useNumberFormat();
    const [open, setOpen] = useState(false);
    // The last page read, kept on screen while a refresh runs or fails (MIP-1187).
    const [page, setPage] = useState<TaskProgressPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const detailsId = useId();
    // Bumped by Retry: a new key reads the feed again instead of a cached failure.
    const [attempt, setAttempt] = useState(0);
    const taskId = milestone.taskId;
    const version = summary.lastProgressAt ?? "";

    // Read the recent progress only once the card is opened; a change under the milestone
    // moves `version`, which re-reads it.
    useEffect(() => {
        // A legacy milestone with no backing task has no feed to read.
        if (!open || taskId == null) return;
        let cancelled = false;
        setLoading(true);
        setFailed(false);
        loadTaskProgress(accessToken, taskId, {
            minDepth: 1,
            limit: PROGRESS_LIMIT,
            version,
        }).then((next) => {
            if (cancelled) return;
            setLoading(false);
            if (next) setPage(next);
            else setFailed(true);
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
    const assigneeOf = (t: EffectiveTask): string => t.assigneeName || m.noAssignee;
    const shownAttention = summary.attention.slice(0, ATTENTION_LIMIT);
    const hiddenAttention = summary.attention.length - shownAttention.length;

    const { t: tr } = useTranslation();
    const openLabel = tr.tasks.dashboard.project.openMilestoneFor;
    return (
        <DashboardCard
            title={milestone.title}
            actions={
                <Stack alignItems="center" direction="row" spacing={1}>
                    {(milestone.assignees?.length ?? 0) > 0 && (
                        <AvatarGroup size="sm">
                            {(milestone.assignees ?? []).slice(0, 4).map((a, idx) => (
                                <BaseAvatar
                                    key={a.userId != null ? String(a.userId) : `idx-${idx}`}
                                    alt={a.username ?? ""}
                                    name={a.username}
                                    src={
                                        a.profileImageUrl
                                            ? `${media_url}${a.profileImageUrl}`
                                            : undefined
                                    }
                                />
                            ))}
                        </AvatarGroup>
                    )}
                    <StatusLabel status={milestone.status} />
                    {onOpenMilestone && (
                        <AppTooltip title={fmt(openLabel, { title: milestone.title })}>
                            <IconButton
                                aria-label={fmt(openLabel, { title: milestone.title })}
                                size="sm"
                                variant="plain"
                                onClick={() => onOpenMilestone(milestone.milestoneId)}
                            >
                                <OpenInNewRoundedIcon />
                            </IconButton>
                        </AppTooltip>
                    )}
                </Stack>
            }
        >
            <Stack
                alignItems="baseline"
                direction="row"
                justifyContent="space-between"
                spacing={1}
                sx={{ flexWrap: "wrap" }}
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
                        : fmt(m.closedOfTotal, {
                              closed: nf.number(summary.closed),
                              total: nf.number(total),
                          })}
                </Typography>
            </Stack>

            {total > 0 && (
                <Box sx={{ mt: 1 }}>
                    <ProportionBar
                        ariaLabel={fmt(m.closedOfTotal, {
                            closed: nf.number(summary.closed),
                            total: nf.number(total),
                        })}
                        segments={summary.entries.map((e) => ({
                            key: e.status,
                            label: statusText(e.status, statusLabels, m.otherStatus),
                            value: e.count,
                            tone:
                                e.status === "Other"
                                    ? "muted"
                                    : (STATUS_TONE[e.status as StatusName] ?? "muted"),
                            display: nf.number(e.count),
                        }))}
                    />
                </Box>
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
                    ? fmt(m.stalled, { count: summary.idleDays ?? 0 })
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
                aria-controls={detailsId}
                aria-expanded={open}
                color="neutral"
                size="sm"
                sx={{ mt: 1, px: 0, color: g.text.secondary }}
                variant="plain"
                aria-label={fmt(open ? m.detailsHideFor : m.detailsShowFor, {
                    title: milestone.title,
                })}
                onClick={() => setOpen((v) => !v)}
            >
                {open ? m.detailsHide : m.detailsShow}
            </Button>

            {open && (
                <Stack
                    id={detailsId}
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
                                                <Link
                                                    to={`/workspace/tasks/project/${milestone.projectId}/task/${t.id}`}
                                                    style={{
                                                        color: "inherit",
                                                        textDecoration: "none",
                                                    }}
                                                >
                                                    {t.title}
                                                </Link>
                                            </Typography>
                                            <Typography
                                                level="body-xs"
                                                sx={{
                                                    color: g.text.tertiary,
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {assigneeOf(t)}
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

                    {taskId != null && (
                        <Box>
                            <Typography
                                level="title-sm"
                                sx={{ color: g.text.primary, fontWeight: 600, mb: 0.5 }}
                            >
                                {m.recentHeading}
                            </Typography>
                            <DataState
                                error={failed}
                                hasData={page != null && page.entries.length > 0}
                                loading={loading}
                                size="xs"
                                skeleton={<SkeletonLines lines={3} />}
                                empty={{
                                    body: m.recentNone,
                                    "data-empty": "milestone-recent-none",
                                }}
                                errorState={{
                                    title: m.recentFailed,
                                    onRetry: () => setAttempt((n) => n + 1),
                                    "data-error": "milestone-recent",
                                }}
                            >
                                <RecentProgress
                                    entries={page?.entries ?? []}
                                    labels={{ m, age }}
                                    locale={locale}
                                    now={now}
                                    projectId={milestone.projectId}
                                />
                            </DataState>
                        </Box>
                    )}
                </Stack>
            )}
        </DashboardCard>
    );
};

const RecentProgress = ({
    entries,
    labels,
    locale,
    now,
    projectId,
}: {
    entries: TaskProgressPage["entries"];
    labels: { m: Msgs; age: AgeMsgs };
    locale: Locale;
    now: Date;
    projectId: number;
}) => {
    const { m, age } = labels;
    const { t } = useTranslation();
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
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        {e.sourceTask && (
                            <SourceTaskLine
                                deletedLabel={t.tasks.activity.progress.deleted}
                                projectId={projectId}
                                source={e.sourceTask}
                                dense
                            />
                        )}
                    </Box>
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

const AskGenosButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <Button
        color="neutral"
        size="sm"
        startDecorator={<AutoAwesomeRoundedIcon sx={{ fontSize: 18 }} />}
        sx={{ alignSelf: { xs: "stretch", sm: "flex-start" }, flexShrink: 0, textAlign: "start" }}
        variant="soft"
        onClick={onClick}
    >
        {label}
    </Button>
);
