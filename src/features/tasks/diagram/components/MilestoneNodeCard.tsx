import { memo } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import { Box, LinearProgress } from "@mui/joy";
import { NodeProps } from "@xyflow/react";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { fmt, useTranslation } from "../../../../i18n";
import { g, type } from "../../../../theme/tokens";
import {
    DueText,
    MilestoneFlag,
    TaskCardFrame,
    TaskIdText,
    TaskTitle,
} from "../../components/card";
import { StatusLabel } from "../../components/meta/StatusLabel";
import { TaskNodeData } from "../types";
import { NODE_WIDTH } from "../utils/layoutDiagram";
import { computeHealth, getMilestoneWindow, getScheduleStatus } from "../utils/scheduleStatus";
import { DurationText, HealthLabel, NodeBadge, NodeHandles, NodeIconButton } from "./nodeParts";
import { dueToneOf, HEALTH_COLOR, useScheduleLabel } from "./nodeTone";

const fmtDate = (iso: string | null | undefined): string => {
    if (!iso) return "";
    const d = new Date(iso.length >= 10 ? iso.slice(0, 10) : iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const TITLE_MIN_HEIGHT = `calc(2 * ${type("body-sm").lineHeight})`;

/**
 * A milestone as a node of the graph (MIP-1124 3/3): the family's card surface
 * with the milestone flag, the same schedule rows as `TaskNodeCard`, and a
 * progress bar. Read-only on the structure side; the dependency handles stay
 * live so a milestone can still be a blocker / blocked target. Like the task
 * node it renders from the node's `data` alone; `withHandles` is the canvas's.
 *
 * A milestone's identity is the flag (as on the board and in the table) and a
 * stronger border, not an orange frame; the "current preview" highlight is the
 * same accent as on a task node.
 */
export const MilestoneNodeView = ({
    data,
    withHandles = false,
}: {
    data: TaskNodeData;
    withHandles?: boolean;
}) => {
    const { t } = useTranslation();

    const {
        task,
        isCurrentPreview,
        closedDescendantCount,
        totalDescendantCount,
        sprint,
        onAddSubtask,
        onOpenPreview,
    } = data;

    const schedule = getScheduleStatus(task.startDate, task.dueDate, task.status);
    const scheduleLabel = useScheduleLabel(schedule, task.status);

    const total = totalDescendantCount ?? 0;
    const closed = closedDescendantCount ?? 0;
    const pct = total > 0 ? Math.round((closed / total) * 100) : 0;

    // Per-milestone health verdict — same maths as the modal header but scoped
    // to *this* milestone's own descendants and window. When a tree contains
    // multiple milestones the user sees a verdict per milestone without opening
    // each.
    const health = computeHealth(
        getMilestoneWindow({
            sprint: sprint ? { startDate: sprint.startDate, endDate: sprint.endDate } : null,
            spanStart: task.startDate ?? null,
            spanEnd: task.dueDate ?? null,
        }),
        total,
        closed
    );
    const healthLabel = health
        ? health.tone === "on-track"
            ? t.tasks.diagram.schedule.onTrack
            : health.tone === "at-risk"
              ? t.tasks.diagram.schedule.atRisk
              : t.tasks.diagram.schedule.behind
        : null;

    const dateText =
        schedule.startLabel && schedule.dueLabel
            ? `${schedule.startLabel} – ${schedule.dueLabel}`
            : (schedule.startLabel ?? schedule.dueLabel ?? null);

    return (
        <TaskCardFrame
            clickable={false}
            emphasis={isCurrentPreview ? "current" : undefined}
            width={NODE_WIDTH}
            prominent
        >
            {withHandles && <NodeHandles structureConnectable={false} dependencyConnectable />}

            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    minHeight: 22,
                    minWidth: 0,
                }}
            >
                <MilestoneFlag size={16} />
                <TaskIdText task={task} />
                <StatusLabel status={task.status} />
                {/* Schedule health — visible per milestone so the user spots a
                    slipping milestone inside a multi-milestone tree without
                    opening each card. Skipped when there's no window or no
                    descendants. */}
                {health && total > 0 && healthLabel && (
                    <HealthLabel
                        label={healthLabel}
                        tone={health.tone}
                        tooltip={fmt(t.tasks.diagram.tooltips.healthSummary, {
                            actualPct: Math.round(health.actualPct),
                            expectedPct: Math.round(health.expectedPct),
                        })}
                    />
                )}
                <Box sx={{ flex: 1 }} />
                <AppTooltip title={t.tasks.diagram.tooltips.openMilestone}>
                    <Box component="span" sx={{ display: "inline-flex" }}>
                        <NodeIconButton onClick={onOpenPreview}>
                            <LaunchRoundedIcon sx={{ fontSize: 14 }} />
                        </NodeIconButton>
                    </Box>
                </AppTooltip>
            </Box>

            <Box sx={{ display: "flex", minHeight: TITLE_MIN_HEIGHT }}>
                <TaskTitle lines={2}>{task.title || t.tasks.milestones.untitled}</TaskTitle>
            </Box>

            {/* Schedule row */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 0.75,
                    rowGap: 0.5,
                    minHeight: 22,
                }}
            >
                <CalendarMonthRoundedIcon
                    aria-hidden="true"
                    sx={{ fontSize: 14, color: g.text.tertiary, "--Icon-color": g.text.tertiary }}
                />
                <Box
                    component="span"
                    data-testid="node-dates"
                    sx={{
                        ...type("body-xs"),
                        fontWeight: 500,
                        color: dateText ? g.text.primary : g.text.tertiary,
                    }}
                >
                    {dateText ?? t.tasks.diagram.noDates}
                </Box>
                {schedule.durationDays != null && (
                    <DurationText>
                        {fmt(t.tasks.diagram.durationDays, { count: schedule.durationDays })}
                    </DurationText>
                )}
                {scheduleLabel && (
                    <DueText text={scheduleLabel} tone={dueToneOf(schedule.tone)} icon />
                )}
            </Box>

            {/* Sprint linkage — when the milestone is attached to a sprint we
                surface its name + date range so the milestone reads as
                scheduled within a concrete cycle. */}
            {sprint && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 0.75,
                        rowGap: 0.5,
                        minHeight: 22,
                    }}
                >
                    <BoltRoundedIcon
                        aria-hidden="true"
                        sx={{ fontSize: 14, color: g.accent.text, "--Icon-color": g.accent.text }}
                    />
                    <Box
                        component="span"
                        sx={{
                            ...type("body-xs"),
                            fontWeight: 500,
                            color: g.text.primary,
                            whiteSpace: "nowrap",
                        }}
                    >
                        {sprint.name}
                    </Box>
                    <Box
                        component="span"
                        sx={{ ...type("body-xs"), color: g.text.tertiary, whiteSpace: "nowrap" }}
                    >
                        {fmtDate(sprint.startDate)} – {fmtDate(sprint.endDate)}
                    </Box>
                </Box>
            )}

            {/* Progress bar — only when the milestone has descendants. A vertical
                "expected by now" marker overlays the bar at health.expectedPct
                so the gap between actual and expected progress is visible right
                on the card. */}
            {total > 0 && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ flex: 1, position: "relative" }}>
                        <LinearProgress
                            color={pct === 100 ? "success" : "primary"}
                            size="sm"
                            sx={{ "--LinearProgress-thickness": "5px" }}
                            value={pct}
                            determinate
                        />
                        {health && (
                            <Box
                                data-health={health.tone}
                                data-testid="node-expected-marker"
                                sx={{
                                    position: "absolute",
                                    top: -2,
                                    bottom: -2,
                                    left: `${health.expectedPct}%`,
                                    width: "2px",
                                    background: HEALTH_COLOR[health.tone],
                                    borderRadius: "1px",
                                    boxShadow: `0 0 0 1px ${g.surface.default}`,
                                }}
                            />
                        )}
                    </Box>
                    <Box
                        component="span"
                        sx={{
                            ...type("body-xs"),
                            fontWeight: 500,
                            color: g.text.tertiary,
                            minWidth: 42,
                            textAlign: "end",
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {closed}/{total}
                    </Box>
                </Box>
            )}

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <NodeBadge>{t.tasks.titleBlock.milestoneBadge}</NodeBadge>
                <Box sx={{ flex: 1 }} />
                <AppTooltip title={t.tasks.diagram.tooltips.addTaskToMilestone}>
                    <Box component="span" sx={{ display: "inline-flex" }}>
                        <NodeIconButton size={24} onClick={() => void onAddSubtask()}>
                            <AddRoundedIcon sx={{ fontSize: 16 }} />
                        </NodeIconButton>
                    </Box>
                </AppTooltip>
            </Box>
        </TaskCardFrame>
    );
};

export const MilestoneNodeCard = memo((props: NodeProps) => (
    <MilestoneNodeView data={props.data as unknown as TaskNodeData} withHandles />
));

MilestoneNodeCard.displayName = "MilestoneNodeCard";
