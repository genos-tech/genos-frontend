import { useEffect, useMemo, useState } from "react";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import { Box, Card, Chip, CircularProgress, Stack, Typography } from "@mui/joy";

import { useAuth } from "../../../../context/AuthContext";
import { fmt, useTranslation } from "../../../../i18n";
import {
    loadTaskVelocity,
    VelocityGranularity,
    VelocityPoint,
} from "../../services/loadTaskVelocity";
import { TaskVelocityChart } from "./TaskVelocityChart";

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
};

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

/**
 * Dashboard "Velocity" card — how many tasks were created / started /
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
}: Props) => {
    const { t } = useTranslation();
    const v = t.tasks.dashboard.velocity;
    const { accessToken } = useAuth();

    const [granularity, setGranularity] = useState<VelocityGranularity>("day");
    const [data, setData] = useState<VelocityPoint[] | null>(null);
    const [loading, setLoading] = useState(false);

    // Stable primitive so the effect doesn't refetch on a fresh-array
    // identity every render.
    const idsKey = useMemo(() => [...taskIds].sort((a, b) => a - b).join(","), [taskIds]);

    const { start, end } = useMemo(() => {
        if (windowStart && windowEnd) return { start: windowStart, end: windowEnd };
        return defaultWindow(granularity);
    }, [windowStart, windowEnd, granularity]);

    useEffect(() => {
        if (taskIds.length === 0) {
            setData([]);
            return;
        }
        let cancelled = false;
        setLoading(true);
        void loadTaskVelocity(taskIds, start, end, granularity, teamId, accessToken).then(
            (res) => {
                if (cancelled) return;
                setData(res ?? []);
                setLoading(false);
            }
        );
        return () => {
            cancelled = true;
        };
        // `idsKey` stands in for `taskIds` (stable across identity-only
        // changes); start/end already fold in granularity + window.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idsKey, start, end, granularity, teamId, accessToken]);

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
            sx={{ cursor: "pointer", fontWeight: 600 }}
            variant={granularity === g ? "solid" : "soft"}
            onClick={() => setGranularity(g)}
        >
            {g === "day" ? v.day : v.week}
        </Chip>
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
                            sx={{ fontSize: 18, color: isDark ? "#a78bfa" : "#7c3aed" }}
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

                {loading && data === null ? (
                    <Stack alignItems="center" sx={{ py: 4 }}>
                        <CircularProgress size="sm" />
                    </Stack>
                ) : (
                    <>
                        <TaskVelocityChart
                            data={data ?? []}
                            granularity={granularity}
                            isDark={isDark}
                            textMuted={textMuted}
                            textSecondary={textSecondary}
                        />
                        {(data ?? []).length > 0 && (
                            <Typography level="body-xs" sx={{ color: textSecondary }}>
                                {fmt(v.totals, {
                                    created: totals.created,
                                    started: totals.started,
                                    closed: totals.closed,
                                    updated: totals.updated,
                                })}
                            </Typography>
                        )}
                    </>
                )}
            </Stack>
        </Card>
    );
};
