import { useId, useState } from "react";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { Box, Button, Stack, Typography } from "@mui/joy";

import { UserAvatar } from "../../../../../components/ui/avatars/UserAvatar";
import { DashboardCard, MeterRow, useNumberFormat } from "../../../../../components/ui/dashboard";
import { EmptyState } from "../../../../../components/ui/feedback/EmptyState";
import { fmt, useTranslation } from "../../../../../i18n";
import { focusRing, g, type } from "../../../../../theme/tokens";
import { toneSolid, type Tone } from "../../../meta/taskTone";
import type { DueBucket } from "../../../utils/taskWeight";
import type { TaskHomeData } from "../useTaskHomeData";

type Props = Pick<TaskHomeData, "teamCapacity" | "maxCapacityTotal" | "assigneeWorkload"> & {
    open: boolean;
    onToggle: (open: boolean) => void;
};

// Soonest first, so a bar reads left to right as overdue, then later: the same red, amber, blue,
// grey order as the old Team Capacity bars, now from the tone maps instead of hex.
const BUCKET_TONE: Record<DueBucket, Tone> = {
    overdue: "danger",
    today: "warning",
    week: "info",
    later: "neutral",
    none: "muted",
};
const BUCKETS: DueBucket[] = ["overdue", "today", "week", "later", "none"];

/**
 * "Team load" on the People tab (MIP-1963): Team Capacity and Assignee Workload in one card. One
 * meter row per person on a scale shared by all rows (effort load split by due window, counted
 * across every project), and the per-status counts one click away. Collapsed by default: its body
 * renders only while open, which is also when the team-wide task read is made.
 */
export const TeamLoadCard = ({
    teamCapacity,
    maxCapacityTotal,
    assigneeWorkload,
    open,
    onToggle,
}: Props) => {
    const { t } = useTranslation();
    const nf = useNumberFormat();
    const c = t.tasks.dashboard.capacity;
    const p = t.tasks.dashboard.people;
    const regionId = useId();
    const [breakdown, setBreakdown] = useState(false);
    const labelOf: Record<DueBucket, string> = {
        overdue: c.overdue,
        today: c.today,
        week: c.week,
        later: c.later,
        none: c.none,
    };

    return (
        <DashboardCard
            help={c.help.body}
            helpLabel={c.help.title}
            subtitle={c.subtitle}
            title={c.title}
            actions={
                <Button
                    aria-controls={regionId}
                    aria-expanded={open}
                    size="sm"
                    variant="plain"
                    endDecorator={
                        <ExpandMoreRoundedIcon
                            sx={{
                                transform: open ? "rotate(180deg)" : "none",
                                transition: "transform 120ms",
                            }}
                        />
                    }
                    onClick={() => onToggle(!open)}
                >
                    {open ? p.teamLoadHide : p.teamLoadShow}
                </Button>
            }
        >
            <Box hidden={!open} id={regionId}>
                {open && teamCapacity.length === 0 && (
                    <EmptyState data-empty="home-capacity" size="xs" title={c.empty} />
                )}
                {open && teamCapacity.length > 0 && (
                    <Stack spacing={1.5}>
                        <Stack
                            direction="row"
                            sx={{ flexWrap: "wrap", columnGap: 2, rowGap: 0.5 }}
                            aria-hidden
                        >
                            {BUCKETS.map((b) => (
                                <Stack key={b} alignItems="center" direction="row" spacing={0.75}>
                                    <Box
                                        sx={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: g.radius.full,
                                            background: toneSolid(BUCKET_TONE[b]).bg,
                                        }}
                                    />
                                    <Typography
                                        sx={{ ...type("body-xs"), color: g.text.secondary }}
                                    >
                                        {labelOf[b]}
                                    </Typography>
                                </Stack>
                            ))}
                        </Stack>
                        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
                            {teamCapacity.map((m) => (
                                <li key={m.id}>
                                    <MeterRow
                                        name={m.name}
                                        total={maxCapacityTotal}
                                        value={fmt(c.tasksCount, { count: nf.number(m.count) })}
                                        ariaLabel={`${m.name}: ${BUCKETS.map(
                                            (b) => `${labelOf[b]} ${nf.number(m.buckets[b] ?? 0)}`
                                        ).join(", ")}; ${c.nearTerm} ${nf.number(m.nearTerm)}`}
                                        avatar={
                                            <UserAvatar
                                                clickable={m.id !== "__unassigned__"}
                                                fallbackInitial={m.name.charAt(0).toUpperCase()}
                                                showPulseDot={false}
                                                size="sm"
                                                userId={m.id === "__unassigned__" ? null : m.id}
                                            />
                                        }
                                        segments={BUCKETS.map((b) => ({
                                            key: b,
                                            label: labelOf[b],
                                            value: m.buckets[b] ?? 0,
                                            tone: BUCKET_TONE[b],
                                            display: nf.number(m.buckets[b] ?? 0),
                                        }))}
                                    />
                                </li>
                            ))}
                        </Box>
                        <Box>
                            <Button
                                aria-expanded={breakdown}
                                size="sm"
                                sx={{ px: 0, "&:focus-visible": focusRing }}
                                variant="plain"
                                onClick={() => setBreakdown(!breakdown)}
                            >
                                {breakdown ? p.statusBreakdownHide : p.statusBreakdownShow}
                            </Button>
                            {breakdown && (
                                <WorkloadTable
                                    assigneeWorkload={assigneeWorkload}
                                    nearTermById={
                                        new Map(teamCapacity.map((m) => [m.id, m.nearTerm]))
                                    }
                                />
                            )}
                        </Box>
                    </Stack>
                )}
            </Box>
        </DashboardCard>
    );
};

const WorkloadTable = ({
    assigneeWorkload,
    nearTermById,
}: {
    assigneeWorkload: TaskHomeData["assigneeWorkload"];
    nearTermById: Map<string, number>;
}) => {
    const { t } = useTranslation();
    const nf = useNumberFormat();
    const d = t.tasks.dashboard;
    const columns = [
        ["Open", d.open],
        ["WIP", d.wip],
        ["Blocked", d.blocked],
        ["Pending", d.pending],
        ["Closed", d.closed],
    ] as const;
    const cell = (value: number, key?: string) => (
        <Box
            component="td"
            data-status-count={key}
            sx={{
                color: value > 0 ? g.text.primary : g.text.secondary,
                fontVariantNumeric: "tabular-nums",
                px: 1,
                py: 0.75,
                textAlign: "center",
            }}
        >
            {nf.number(value)}
        </Box>
    );
    return (
        <Box sx={{ overflowX: "auto", mt: 1 }}>
            <Box
                component="table"
                sx={{
                    ...type("body-sm"),
                    borderCollapse: "collapse",
                    width: "100%",
                    "& th": {
                        ...type("body-xs"),
                        color: g.text.secondary,
                        fontWeight: 500,
                        px: 1,
                        py: 0.75,
                        textAlign: "center",
                    },
                    "& tbody tr": { borderTop: `1px solid ${g.border.subtle}` },
                }}
            >
                <thead>
                    <tr>
                        <Box component="th" scope="col" sx={{ textAlign: "start !important" }}>
                            {d.member}
                        </Box>
                        {columns.map(([k, label]) => (
                            <th key={k} scope="col">
                                {label}
                            </th>
                        ))}
                        <th scope="col">{d.total}</th>
                        <th scope="col">{d.closedSprint}</th>
                        <th scope="col">{d.capacity.nearTerm}</th>
                    </tr>
                </thead>
                <tbody>
                    {assigneeWorkload.map((a) => (
                        <tr key={a.id}>
                            <Box component="td" sx={{ px: 1, py: 0.75, minWidth: 120 }}>
                                <Stack alignItems="center" direction="row" spacing={1}>
                                    <UserAvatar
                                        clickable={a.id !== "__unassigned__"}
                                        fallbackInitial={a.name.charAt(0).toUpperCase()}
                                        showPulseDot={false}
                                        size="sm"
                                        userId={a.id === "__unassigned__" ? null : a.id}
                                    />
                                    <Typography
                                        sx={{ ...type("body-sm"), color: g.text.primary }}
                                        noWrap
                                    >
                                        <bdi className="g-bidi-island">{a.name}</bdi>
                                    </Typography>
                                </Stack>
                            </Box>
                            {cell(a.open, "Open")}
                            {cell(a.wip, "WIP")}
                            {cell(a.blocked, "Blocked")}
                            {cell(a.pending, "Pending")}
                            {cell(a.closed, "Closed")}
                            {cell(a.total)}
                            {cell(a.closedInSprint)}
                            {cell(nearTermById.get(a.id) ?? 0)}
                        </tr>
                    ))}
                </tbody>
            </Box>
        </Box>
    );
};
