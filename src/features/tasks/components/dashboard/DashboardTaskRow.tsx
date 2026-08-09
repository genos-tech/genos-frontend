import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import { Box, Card, Chip, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { fmt, useTranslation } from "../../../../i18n";
import { TaskTableProps } from "../../../../types/tasks";
import { formatDueLabel, PRIORITY_COLORS } from "../../utils/dashboardRowFormat";
import { taskMetaLabel } from "../../utils/taskMeta";
import { computeTaskWeight, MAX_TASK_WEIGHT, weightBand } from "../../utils/taskWeight";
import { CopyableTaskIdText } from "../CopyableTaskId";
import { SprintChip } from "../SprintChip";
import { STATUS_COLORS, TaskStatusChip } from "../TaskStatusChip";

/**
 * Reserved width per metadata column.
 *
 * Kept as TIGHT as the widest label each column can hold, because any
 * leftover inside a column shows up as gap between that chip and the next
 * one. Sizing these generously is what makes a columned layout look
 * padded, so they're deliberately near the content width:
 *
 *   priority  "Critical"          — 8 chars @ 0.65rem chip
 *   status    "Blocked"/"Pending" — 7 chars @ 0.65rem chip + 12px icon
 *   due       "Due tomorrow" / "Overdue 123d" — 12 chars @ body-xs
 *   sprint    matches `SprintChip`'s own maxWidth, so a long sprint name
 *             can never overflow its column
 *
 * Fixed pixels rather than a CSS grid: every row is its own <Card>, so
 * grid columns can't be shared across rows. Locales with longer strings
 * ellipsis inside their column rather than widening it, which keeps the
 * list aligned at the cost of truncating an outlier.
 */
const SLOT_WIDTH = {
    assignee: 24,
    due: 80,
    priority: 58,
    sprint: 130,
    status: 70,
} as const;

// Structural, so both `EffectiveTask` (dashboard) and any future caller
// holding a plain task + a resolved status can pass one in without this
// module depending on `TaskHomeContent`.
export type DashboardRowTask = TaskTableProps & { effectiveStatus: string };

type DashboardTaskRowProps = {
    task: DashboardRowTask;
    /**
     * Resolved sprint name for `task.sprintId`; the caller owns the lookup.
     * Null / undefined renders `SprintChip`'s muted "No Sprint" state.
     */
    sprintName: string | null | undefined;
    onClick: () => void;
};

/**
 * One task row on the dashboard.
 *
 * Shared by "Up Next" (My Tasks / Member's Tasks) and "Top by Weight"
 * (Overall Insights). Those two were near-identical copies that had
 * already drifted — different status-chip implementations, a stray
 * assignee-name column, and a different hover color — so "keep them
 * consistent" is enforced structurally here rather than by remembering
 * to edit both.
 *
 * Layout: weight badge · id · title … priority · status · due · sprint ·
 * assignee.
 */
export const DashboardTaskRow = ({ task, sprintName, onClick }: DashboardTaskRowProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    const cardBg = isDark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.7)";
    const cardBorder = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    const textPrimary = isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)";
    const textMuted = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";

    const sc = STATUS_COLORS[task.effectiveStatus] || STATUS_COLORS.Open;
    const pSwatch = task.priority ? PRIORITY_COLORS[task.priority] : undefined;
    const pColor = pSwatch ? (isDark ? pSwatch.dark : pSwatch.light) : textMuted;
    const weight = computeTaskWeight(task);
    const wb = weightBand(weight);
    const due = formatDueLabel(task.dueDate);
    const dueColor =
        due.tone === "overdue"
            ? "#ef4444"
            : due.tone === "today" || due.tone === "soon"
              ? "#f59e0b"
              : textMuted;

    // Hidden on xs so the compact row can't wrap. Status and due date stay
    // visible at every width — they're the two the row is scanned for.
    // `display: none` also releases the slot's reserved width, so the xs
    // layout doesn't carry gaps for chips it isn't drawing.
    const hideOnXs = { display: { xs: "none", sm: "flex" } } as const;

    // A fixed-width column for one piece of metadata.
    //
    // The metadata cluster is pushed right by the title's `flex: 1`, so
    // with naturally-sized chips the cluster's total width — and therefore
    // where it starts — changed with every row's content ("Overdue 62d" vs
    // "No due date", "Sprint 1 (2026)" vs "No Sprint", priority chip
    // present vs absent). Down a list that reads as ragged, mismatched
    // spacing between rows.
    //
    // Reserving a fixed column per slot lines the chips up vertically, and
    // an absent chip holds its place instead of dragging its neighbours
    // left. Each row is its own <Card>, so a real CSS grid can't align
    // across rows — fixed widths are what works here.
    //
    // Contents are left-aligned so every column shares a hard left edge —
    // the strongest "these are aligned" signal down a list. Centring would
    // split each chip's leftover space onto both sides, which reads as a
    // wide, uneven gap between neighbouring chips.
    const slot = (width: number, hideOnNarrow: boolean, children: React.ReactNode) => (
        <Box
            sx={{
                width,
                flexShrink: 0,
                alignItems: "center",
                justifyContent: "flex-start",
                overflow: "hidden",
                ...(hideOnNarrow ? hideOnXs : { display: "flex" }),
            }}
        >
            {children}
        </Box>
    );

    return (
        <Card
            variant="outlined"
            sx={{
                p: 1.25,
                cursor: "pointer",
                background: cardBg,
                borderColor: cardBorder,
                transition: "all 0.2s ease",
                "&:hover": {
                    borderColor: sc.text,
                    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.9)",
                },
            }}
            onClick={onClick}
        >
            <Stack alignItems="center" direction="row" spacing={0.5}>
                {/* Task Weight badge, leftmost — squared heat chip. */}
                <AppTooltip
                    title={`${fmt(t.tasks.table.weightTooltip, {
                        weight,
                        max: MAX_TASK_WEIGHT,
                    })} · ${t.tasks.table.weightBands[wb.band]}`}
                >
                    <Box
                        sx={{
                            width: 30,
                            height: 30,
                            borderRadius: "8px",
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: "0.8rem",
                            color: "white",
                            backgroundColor: wb.color,
                        }}
                    >
                        {weight}
                    </Box>
                </AppTooltip>

                <Stack
                    alignItems="center"
                    direction="row"
                    spacing={0.75}
                    sx={{ flex: 1, minWidth: 0 }}
                >
                    <CopyableTaskIdText
                        level="body-xs"
                        sx={{ fontWeight: 600, color: textMuted, flexShrink: 0 }}
                        task={task}
                    />
                    {task.isMilestone === true && (
                        <FlagRoundedIcon sx={{ fontSize: 12, color: "#f97316", flexShrink: 0 }} />
                    )}
                    <Typography
                        level="body-sm"
                        sx={{
                            fontWeight: 500,
                            color: textPrimary,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {task.title || t.tasks.dashboard.untitledTask}
                    </Typography>
                </Stack>

                {slot(
                    SLOT_WIDTH.priority,
                    true,
                    task.priority ? (
                        <Chip
                            size="sm"
                            variant="soft"
                            sx={{
                                fontSize: "0.65rem",
                                fontWeight: 600,
                                backgroundColor: `${pColor}1F`,
                                color: pColor,
                                maxWidth: "100%",
                            }}
                        >
                            {taskMetaLabel(task.priority, t.tasks.filters)}
                        </Chip>
                    ) : null
                )}

                {slot(SLOT_WIDTH.status, false, <TaskStatusChip status={task.effectiveStatus} />)}

                {slot(
                    SLOT_WIDTH.due,
                    false,
                    <Typography
                        level="body-xs"
                        sx={{
                            color: dueColor,
                            fontWeight: due.tone === "overdue" ? 700 : 500,
                            // Long translations of these labels (e.g. ar/hi)
                            // ellipsis instead of blowing the fixed column.
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {due.text}
                    </Typography>
                )}

                {slot(SLOT_WIDTH.sprint, true, <SprintChip name={sprintName} />)}

                {/* Assignee, rightmost. Deliberately NOT clickable: the row
                    itself opens the task, and a clickable avatar's own
                    handler would bubble into that — one click would both
                    open the profile modal and navigate. The pulse dot is
                    off because its placement is calibrated for 26/32px and
                    floats outside the circle at this size. Unassigned rows
                    keep the empty slot so the columns stay aligned. */}
                {slot(
                    SLOT_WIDTH.assignee,
                    true,
                    task.assigneeId ? (
                        <AppTooltip title={task.assigneeName ?? ""}>
                            <Box sx={{ display: "flex" }}>
                                <UserAvatar
                                    clickable={false}
                                    showPulseDot={false}
                                    size={22}
                                    userId={task.assigneeId}
                                />
                            </Box>
                        </AppTooltip>
                    ) : null
                )}
            </Stack>
        </Card>
    );
};
