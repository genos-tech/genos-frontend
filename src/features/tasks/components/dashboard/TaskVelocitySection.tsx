import { useEffect, useMemo, useState } from "react";
import { keyframes } from "@emotion/react";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import { Box, Card, Chip, Option, Select, Stack, Typography } from "@mui/joy";

import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { DataState } from "../../../../components/ui/feedback/DataState";
import { Spinner } from "../../../../components/ui/feedback/Skeleton";
import { useAuth } from "../../../../context/authState";
import { fmt, useTranslation } from "../../../../i18n";
import { g as tokens } from "../../../../theme/tokens";
import {
    loadTaskVelocity,
    VelocityGranularity,
    VelocityPoint,
} from "../../services/loadTaskVelocity";
import { TaskVelocityChart } from "./TaskVelocityChart";

// One selectable assignee for the "by member" filter, carrying the
// subset of `taskIds` assigned to them (assignee lens — the picked
// member's own sprint tickets, regardless of who touched them).
export type VelocityMember = {
    id: string;
    name: string;
    taskIds: number[];
};

type Props = {
    taskIds: number[];
    teamId: string;
    isDark: boolean;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    // Sprint tab overrides the window with the sprint's dates; My Tasks
    // leaves them undefined and uses the granularity-derived default.
    windowStart?: string;
    windowEnd?: string;
    // When provided (Sprint tab), renders an assignee picker that scopes
    // the chart to one member's tasks. Omitted on My Tasks (already
    // personal).
    members?: VelocityMember[];
    // Last-update time per task id. A task with no activity inside the
    // window can't add to the chart, so ids last updated before it aren't
    // requested (a long-lived project holds thousands of closed tasks).
    // Every audit row is written when the task row is saved, so `updatedAt`
    // is never older than the newest activity. Ids missing here are kept.
    taskUpdatedAt?: Record<number, string | null | undefined>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toIso = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

// Default window when the caller doesn't pin one: the last 14 days in
// day mode (chunky, readable daily bars), ~12 weeks in week mode — each
// enough history to read a trend without an unreadable wall of bars.
const defaultWindow = (granularity: VelocityGranularity): { start: string; end: string } => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (granularity === "day" ? 13 : 7 * 12 - 1));
    return { start: toIso(start), end: toIso(end) };
};

// A switch answered at once must not flash: the dim and the spinner wait this long.
const BUSY_DELAY_MS = 150;

const appear = keyframes`
    from { opacity: 0; }
    to { opacity: 1; }
`;

/**
 * Dashboard "Pace" card — how many tasks were created / started /
 * closed / updated per day or week across `taskIds`. Owns the Day/Week
 * toggle and the cancel-guarded fetch; the chart is presentational.
 */
export const TaskVelocitySection = ({
    taskIds,
    teamId,
    isDark,
    textPrimary,
    textSecondary,
    textMuted,
    windowStart,
    windowEnd,
    members,
    taskUpdatedAt,
}: Props) => {
    const { t } = useTranslation();
    const v = t.tasks.dashboard.velocity;
    const { accessToken } = useAuth();

    const [granularity, setGranularity] = useState<VelocityGranularity>("day");
    // "" = all members. Only used when `members` is provided.
    const [selectedMemberId, setSelectedMemberId] = useState<string>("");
    // The series is kept WITH the granularity it was asked in: while the next one loads, the old
    // bars stay on screen and must keep their own labels (a day is not "W of").
    const [series, setSeries] = useState<{
        points: VelocityPoint[];
        granularity: VelocityGranularity;
    } | null>(null);
    const data = series?.points ?? null;
    const [loading, setLoading] = useState(false);
    // The last request failed (`loadTaskVelocity` resolves `null`). It is NOT a
    // quiet week: an empty series would draw as "nothing happened".
    const [failed, setFailed] = useState(false);
    // Bumped by Retry to ask again with the same inputs.
    const [retryKey, setRetryKey] = useState(0);

    // Reset the picker to "All" when the member set changes out from under
    // it (e.g. switching sprints), so it can't point at a stale member.
    useEffect(() => {
        if (selectedMemberId && !members?.some((m) => m.id === selectedMemberId)) {
            setSelectedMemberId("");
        }
    }, [members, selectedMemberId]);

    // Task ids actually charted: the picked member's subset, or all.
    const activeTaskIds = useMemo(() => {
        if (!selectedMemberId) return taskIds;
        return members?.find((m) => m.id === selectedMemberId)?.taskIds ?? taskIds;
    }, [selectedMemberId, members, taskIds]);

    const { start, end } = useMemo(() => {
        if (windowStart && windowEnd) return { start: windowStart, end: windowEnd };
        return defaultWindow(granularity);
    }, [windowStart, windowEnd, granularity]);

    // The ids worth asking about: those touched since the window opened. A
    // day of slack covers the server stamping in UTC and the window in
    // local time.
    const loadIds = useMemo(() => {
        if (!taskUpdatedAt) return activeTaskIds;
        const from = new Date(`${start}T00:00:00`).getTime() - DAY_MS;
        return activeTaskIds.filter((id) => {
            const at = taskUpdatedAt[id];
            if (!at) return true;
            const ms = new Date(at).getTime();
            return Number.isNaN(ms) || ms >= from;
        });
    }, [activeTaskIds, taskUpdatedAt, start]);

    // Stable primitive so the effect doesn't refetch on a fresh-array
    // identity every render.
    const idsKey = useMemo(() => [...loadIds].sort((a, b) => a - b).join(","), [loadIds]);

    useEffect(() => {
        if (loadIds.length === 0) {
            setSeries({ points: [], granularity });
            setFailed(false);
            // A request still in flight was just cancelled: nothing else will clear this.
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setFailed(false);
        void loadTaskVelocity(loadIds, start, end, granularity, teamId, accessToken).then(
            (res) => {
                if (cancelled) return;
                if (res === null) {
                    // Drop the old series too: it is for other inputs (another
                    // member, window or granularity) and would be a wrong chart.
                    setSeries(null);
                    setFailed(true);
                } else {
                    setSeries({ points: res, granularity });
                }
                setLoading(false);
            }
        );
        return () => {
            cancelled = true;
        };
        // `idsKey` stands in for `loadIds` (stable across identity-only
        // changes); start/end already fold in granularity + window.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idsKey, start, end, granularity, teamId, accessToken, retryKey]);

    const totals = useMemo(() => {
        const acc = { created: 0, started: 0, closed: 0, updated: 0 };
        for (const p of data ?? []) {
            acc.created += p.created;
            acc.started += p.started;
            acc.closed += p.closed;
            acc.updated += p.updated;
        }
        return acc;
    }, [data]);

    const toggle = (g: VelocityGranularity) => (
        <Chip
            color={granularity === g ? "primary" : "neutral"}
            size="sm"
            slotProps={{ action: { "aria-pressed": granularity === g } }}
            sx={{ cursor: "pointer", fontWeight: 600 }}
            variant={granularity === g ? "solid" : "soft"}
            onClick={() => setGranularity(g)}
        >
            {g === "day" ? v.day : v.week}
        </Chip>
    );

    // A new series is being asked for while the last one is still on screen. It can take
    // seconds (Week is a long window), so it must be seen to be working (MIP-2442).
    const refreshing = loading && series !== null;

    // Avatar + name, shared by the dropdown options AND the closed
    // Select's selected-value display (via `renderValue`).
    const memberRow = (m: VelocityMember, avatarSize: number) => (
        <Stack alignItems="center" direction="row" spacing={1}>
            <UserAvatar clickable={false} showPulseDot={false} size={avatarSize} userId={m.id} />
            <Typography level="body-sm" sx={{ whiteSpace: "nowrap" }}>
                <bdi className="g-bidi-island">{m.name}</bdi>
            </Typography>
        </Stack>
    );

    return (
        <Card
            variant="soft"
            sx={{
                p: 2.5,
                background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
                border: "1px solid",
                borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
            }}
        >
            <Stack spacing={1.5}>
                <Stack
                    alignItems="center"
                    direction="row"
                    justifyContent="space-between"
                    spacing={1}
                >
                    <Stack alignItems="center" direction="row" spacing={1}>
                        <TrendingUpRoundedIcon
                            sx={{
                                fontSize: 18,
                                color: isDark ? "var(--gp-brandalt-400)" : "var(--gp-brand-700)",
                            }}
                        />
                        <Box>
                            <Typography
                                level="title-sm"
                                sx={{ color: textPrimary, fontWeight: 600 }}
                            >
                                {v.title}
                            </Typography>
                            <Typography level="body-xs" sx={{ color: textMuted }}>
                                {v.subtitle}
                            </Typography>
                        </Box>
                    </Stack>
                    <Stack direction="row" spacing={0.5}>
                        {toggle("day")}
                        {toggle("week")}
                    </Stack>
                </Stack>

                {/* Assignee filter (Sprint tab only). Scopes the chart to
                    one member's sprint tickets; "All members" is the
                    default. Own row so it never crowds the Day/Week
                    toggles on narrow widths. */}
                {members && members.length > 0 && (
                    <Stack alignItems="center" direction="row" spacing={1}>
                        <Typography level="body-xs" sx={{ color: textMuted, fontWeight: 600 }}>
                            {v.memberLabel}
                        </Typography>
                        <Select
                            size="sm"
                            sx={{ minWidth: 160 }}
                            value={selectedMemberId}
                            renderValue={(option) => {
                                const m =
                                    option && option.value
                                        ? members.find((x) => x.id === option.value)
                                        : undefined;
                                return m ? memberRow(m, 20) : v.allMembers;
                            }}
                            onChange={(_, val) => setSelectedMemberId(val ?? "")}
                        >
                            <Option value="">{v.allMembers}</Option>
                            {members.map((m) => (
                                <Option key={m.id} label={m.name} value={m.id}>
                                    {memberRow(m, 22)}
                                </Option>
                            ))}
                        </Select>
                    </Stack>
                )}

                <DataState
                    error={failed}
                    hasData={data !== null}
                    loading={loading}
                    size="sm"
                    errorState={{
                        title: v.loadFailed,
                        onRetry: () => setRetryKey((k) => k + 1),
                        "data-error": "task-velocity",
                    }}
                    skeleton={
                        <Stack alignItems="center" sx={{ py: 4 }}>
                            <Spinner />
                        </Stack>
                    }
                >
                    <Box
                        sx={{
                            position: "relative",
                            // Room for the loading sign when the old series was only a line of text.
                            minHeight: refreshing ? 96 : undefined,
                        }}
                    >
                        {/* The old bars stay, dimmed, with their own labels. */}
                        <Stack
                            aria-busy={refreshing}
                            data-testid="pace-series"
                            spacing={1.5}
                            sx={{
                                opacity: refreshing ? 0.35 : 1,
                                pointerEvents: refreshing ? "none" : undefined,
                                transition: refreshing
                                    ? `opacity ${tokens.motion.fast} ${BUSY_DELAY_MS}ms`
                                    : undefined,
                                "@media (prefers-reduced-motion: reduce)": { transition: "none" },
                            }}
                        >
                            <TaskVelocityChart
                                data={data ?? []}
                                granularity={series?.granularity ?? granularity}
                                isDark={isDark}
                                textMuted={textMuted}
                                textSecondary={textSecondary}
                            />
                            {(data ?? []).some(
                                (d) => d.created + d.started + d.closed + d.updated > 0
                            ) && (
                                <Typography level="body-xs" sx={{ color: textSecondary }}>
                                    {fmt(v.totals, {
                                        created: totals.created,
                                        started: totals.started,
                                        closed: totals.closed,
                                        updated: totals.updated,
                                    })}
                                </Typography>
                            )}
                        </Stack>
                        {refreshing && (
                            <Stack
                                alignItems="center"
                                data-testid="pace-loading"
                                justifyContent="center"
                                sx={{
                                    position: "absolute",
                                    inset: 0,
                                    animation: `${appear} 0.2s ease-out ${BUSY_DELAY_MS}ms both`,
                                }}
                            >
                                <Spinner caption={t.common.feedback.loading} size="md" stacked />
                            </Stack>
                        )}
                    </Box>
                </DataState>
            </Stack>
        </Card>
    );
};
