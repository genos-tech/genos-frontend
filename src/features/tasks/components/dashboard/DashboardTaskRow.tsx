import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import { Box, Card, Chip, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { fmt, useTranslation } from "../../../../i18n";
import { TaskTableProps } from "../../../../types/tasks";
import { formatDueLabel, PRIORITY_COLORS } from "../../utils/dashboardRowFormat";
import { computeTaskWeight, MAX_TASK_WEIGHT, weightBand } from "../../utils/taskWeight";
import { CopyableTaskIdText } from "../CopyableTaskId";
import { SprintChip } from "../SprintChip";
import { STATUS_COLORS, TaskStatusChip } from "../TaskStatusChip";

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
    const hideOnXs = { display: { xs: "none", sm: "inline-flex" } } as const;

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
            <Stack alignItems="center" direction="row" spacing={1.5}>
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

                {task.priority && (
                    <Chip
                        size="sm"
                        variant="soft"
                        sx={{
                            fontSize: "0.65rem",
                            fontWeight: 600,
                            backgroundColor: `${pColor}1F`,
                            color: pColor,
                            flexShrink: 0,
                            ...hideOnXs,
                        }}
                    >
                        {task.priority}
                    </Chip>
                )}

                <TaskStatusChip status={task.effectiveStatus} />

                <Typography
                    level="body-xs"
                    sx={{
                        color: dueColor,
                        fontWeight: due.tone === "overdue" ? 700 : 500,
                        flexShrink: 0,
                        minWidth: 90,
                        textAlign: "right",
                    }}
                >
                    {due.text}
                </Typography>

                <Box sx={hideOnXs}>
                    <SprintChip name={sprintName} />
                </Box>

                {/* Assignee, rightmost. Deliberately NOT clickable: the row
                    itself opens the task, and a clickable avatar's own
                    handler would bubble into that — one click would both
                    open the profile modal and navigate. The pulse dot is
                    off because its placement is calibrated for 26/32px and
                    floats outside the circle at this size. Unassigned rows
                    render nothing rather than a "?" bubble. */}
                {task.assigneeId && (
                    <Box sx={{ ...hideOnXs, flexShrink: 0 }}>
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
                    </Box>
                )}
            </Stack>
        </Card>
    );
};
