import { useState } from "react";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Box, Chip, IconButton, LinearProgress, Stack, Typography } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { ToneLabel } from "../../components/meta/ToneLabel";
import { DIAGRAM_DEFAULT_Z_INDEX, DiagramZIndexProvider } from "../diagramZIndex";
import { ScheduleOverview, TaskGraphScope } from "../types";
import { HEALTH_TONE } from "../utils/scheduleStatus";
import { BurndownSparkline } from "./BurndownSparkline";
import { HEALTH_COLOR } from "./nodeTone";
import { TaskFlowCanvas } from "./TaskFlowCanvas";

// Exported so LazyTaskDiagram can mirror this signature without a value
// import (a value import there would defeat the whole point).
export type ModalTaskDiagramProps = {
    open: boolean;
    onClose: () => void;
    myself: UserProps;
    /**
     * Any task in the tree to be drawn — the graph loader walks up
     * `parentTaskId` from here to find the chain top and draws that whole
     * hierarchy. Callers opening the diagram from a task preview can pass
     * the previewed task even when it's a leaf sub-task; they do NOT need
     * to resolve the root themselves (and shouldn't use the stored
     * `rootTaskId` column for it, which can lag a milestone move).
     */
    rootTaskId: number;
    /** "tree" (default): the whole hierarchy the task sits in, from its milestone down.
     *  "task": only this task and its subtasks (MIP-1094). */
    scope?: TaskGraphScope;
    /** Required so we can fetch project tasks in one call. */
    projectId: number;
    /** Header title — typically "<displayId> · <title>". */
    rootLabel: string;
    useTM: TaskManagementState;
    /** Needed so a click on an external ghost can switch the current
     *  project before opening that task's preview. */
    usePM: ProjectManagementState;
    /** Optional. When present, the canvas shows sprint info on
     *  milestone nodes + in the header overview pill. */
    useSM?: SprintMilestoneManagementState;
    /** Stacking override for modal-hosted openers — see
     *  `diagramZIndex.ts`. Defaults to DIAGRAM_DEFAULT_Z_INDEX (9999),
     *  the page-hosted layer. */
    zIndex?: number;
    /** Optional. When set, task nodes assigned to this user get a distinct
     *  focus color so the viewer can spot their own tasks/subtasks in the
     *  tree. Opt-in — only the dashboard's "Assigned Milestones" section
     *  passes it; every other opener leaves the graph un-highlighted. */
    highlightAssigneeId?: number | string | null;
};

// Full-screen diagram modal. Substantially larger than every other
// modal in the codebase (the largest, SettingsModal, tops out at
// ~700px). Graphs need real estate; we go to 94vw × 90vh so the
// graph has room to breathe. The chrome (header + close) is
// kept minimal so the canvas dominates.
const fmtDateLabel = (iso: string | null): string | null => {
    if (!iso) return null;
    const d = new Date(iso.length >= 10 ? iso.slice(0, 10) : iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const ModalTaskDiagram = ({
    open,
    onClose,
    myself,
    rootTaskId,
    scope,
    projectId,
    rootLabel,
    useTM,
    usePM,
    useSM,
    zIndex,
    highlightAssigneeId,
}: ModalTaskDiagramProps) => {
    const { t } = useTranslation();
    const effectiveZIndex = zIndex ?? DIAGRAM_DEFAULT_Z_INDEX;

    // Schedule rollup published by the canvas after each graph load.
    // Null while the first load is in flight.
    const [overview, setOverview] = useState<ScheduleOverview | null>(null);

    // When on, the canvas collapses every Closed branch — a Closed task
    // and its WHOLE subtree (open descendants included) drop out, then
    // the layout re-runs so the remaining tree fills the canvas. ON by default —
    // a diagram is usually opened to reason about what's LEFT to do, so
    // finished branches are tucked away until the user opts back in via the
    // header toggle (which brings every task back). The toggle stays
    // reachable: the canvas computes its schedule overview from the full
    // (unfiltered) graph, so `overview.closed > 0` still gates the button
    // on even while closed tasks are hidden. Not persisted — "by default"
    // means the initial state each time the diagram opens, not a saved
    // preference.
    const [hideClosed, setHideClosed] = useState(true);

    const rawSpanLabel = (() => {
        if (!overview) return null;
        const start = fmtDateLabel(overview.spanStart);
        const end = fmtDateLabel(overview.spanEnd);
        if (start && end) return `${start} – ${end}`;
        return start ?? end ?? null;
    })();
    const sprintLabel = overview?.sprint
        ? `${fmtDateLabel(overview.sprint.startDate)} – ${fmtDateLabel(overview.sprint.endDate)}`
        : null;
    // Suppress the span row when it duplicates the sprint row — the
    // sprint chip already carries that period, and showing the same
    // dates twice in the header reads as a UI bug. Span still renders
    // when no sprint is set or the task span actually differs from the
    // sprint window.
    const spanLabel = sprintLabel && rawSpanLabel === sprintLabel ? null : rawSpanLabel;
    const progressPct =
        overview && overview.total > 0
            ? Math.round((overview.closed / overview.total) * 100)
            : null;
    const showOverview =
        overview != null && (spanLabel != null || overview.total > 0 || overview.sprint != null);
    const healthLabel = overview?.health
        ? overview.health.tone === "on-track"
            ? t.tasks.diagram.schedule.onTrack
            : overview.health.tone === "at-risk"
              ? t.tasks.diagram.schedule.atRisk
              : t.tasks.diagram.schedule.behind
        : null;

    // The graph dialog keeps the layer its opener gave it (see diagramZIndex.ts): 9999 on
    // a page, host + DIAGRAM_LIFT inside a modal-hosted preview. The task-preview
    // BlockNote floating UI is pinned at 1400, so the dialog has to clear that; it
    // owns no listbox (the node popups pin themselves from the same context).
    const accessoryItems = (
        <>
            {/* Schedule-health chip — the headline verdict for
                        the whole tree. Tooltip explains the maths so a
                        "Behind" verdict isn't mysterious. Hidden when
                        no window is available. */}
            {overview?.health && (
                <AppTooltip
                    placement="bottom"
                    title={fmt(t.tasks.diagram.tooltips.healthSummary, {
                        actualPct: Math.round(overview.health.actualPct),
                        expectedPct: Math.round(overview.health.expectedPct),
                    })}
                >
                    {/* A plain element for the tooltip to anchor on: ToneLabel is not a ref target. */}
                    <Box component="span" sx={{ display: "inline-flex", cursor: "help" }}>
                        <ToneLabel size="sm" tone={HEALTH_TONE[overview.health.tone]} dot>
                            {healthLabel}
                        </ToneLabel>
                    </Box>
                </AppTooltip>
            )}

            {/* Schedule overview pill — only renders when at
                        least one of (span, progress) is computable.
                        Tries to read as a quick at-a-glance summary
                        for the milestone or sub-tree. */}
            {showOverview && (
                <Stack
                    alignItems="center"
                    direction="row"
                    spacing={1.5}
                    sx={{
                        px: 1.5,
                        py: 0.75,
                        borderRadius: "10px",
                        background: g.bg.subtle,
                        border: `1px solid ${g.border.default}`,
                        flexWrap: "wrap",
                        rowGap: 0.5,
                    }}
                >
                    {overview?.sprint && (
                        <Stack alignItems="center" direction="row" spacing={0.6}>
                            <BoltRoundedIcon sx={{ fontSize: 16, color: g.accent.text }} />
                            <Typography
                                level="body-sm"
                                sx={{ color: g.text.primary, fontWeight: 600 }}
                            >
                                {overview.sprint.name}
                            </Typography>
                            {sprintLabel && (
                                <Typography
                                    level="body-xs"
                                    sx={{ color: g.text.secondary, fontWeight: 500 }}
                                >
                                    {sprintLabel}
                                </Typography>
                            )}
                        </Stack>
                    )}
                    {spanLabel && (
                        <Stack alignItems="center" direction="row" spacing={0.6}>
                            <CalendarMonthRoundedIcon
                                sx={{
                                    fontSize: 16,
                                    color: g.text.secondary,
                                    opacity: 0.85,
                                }}
                            />
                            <Typography
                                level="body-sm"
                                sx={{ color: g.text.primary, fontWeight: 600 }}
                            >
                                {spanLabel}
                            </Typography>
                            {overview?.spanDays != null && (
                                <Chip
                                    size="sm"
                                    variant="outlined"
                                    sx={{
                                        fontSize: "0.65rem",
                                        fontWeight: 600,
                                        borderRadius: "5px",
                                        color: g.text.secondary,
                                    }}
                                >
                                    {fmt(t.tasks.diagram.durationDays, {
                                        count: overview.spanDays,
                                    })}
                                </Chip>
                            )}
                        </Stack>
                    )}
                    {overview &&
                        (overview.overdueCount > 0 ||
                            overview.dueSoonCount > 0 ||
                            overview.blockedCount > 0) && (
                            <Stack
                                alignItems="center"
                                direction="row"
                                spacing={0.5}
                                sx={{ flexWrap: "wrap", rowGap: 0.5 }}
                            >
                                {overview.overdueCount > 0 && (
                                    <ToneLabel
                                        icon={<WarningAmberRoundedIcon sx={{ fontSize: 12 }} />}
                                        tone="danger"
                                    >
                                        {fmt(t.tasks.diagram.overdueCount, {
                                            count: overview.overdueCount,
                                        })}
                                    </ToneLabel>
                                )}
                                {overview.dueSoonCount > 0 && (
                                    <ToneLabel
                                        icon={<ScheduleRoundedIcon sx={{ fontSize: 12 }} />}
                                        tone="warning"
                                    >
                                        {fmt(t.tasks.diagram.dueSoonCount, {
                                            count: overview.dueSoonCount,
                                        })}
                                    </ToneLabel>
                                )}
                                {overview.blockedCount > 0 && (
                                    <ToneLabel
                                        icon={<BlockRoundedIcon sx={{ fontSize: 12 }} />}
                                        tone="danger"
                                    >
                                        {fmt(t.tasks.diagram.blockedCount, {
                                            count: overview.blockedCount,
                                        })}
                                    </ToneLabel>
                                )}
                            </Stack>
                        )}
                    {progressPct != null && overview && (
                        <Stack
                            alignItems="center"
                            direction="row"
                            spacing={0.75}
                            sx={{ minWidth: 140 }}
                        >
                            {/* Progress bar with an absolutely-positioned
                                        "expected by now" marker. The marker sits
                                        at `expectedPct%`; visible gap between the
                                        marker and the bar's filled edge IS the
                                        schedule-health story. */}
                            <Box sx={{ flex: 1, minWidth: 60, position: "relative" }}>
                                <LinearProgress
                                    color={progressPct === 100 ? "success" : "primary"}
                                    size="sm"
                                    sx={{ "--LinearProgress-thickness": "6px" }}
                                    value={progressPct}
                                    determinate
                                />
                                {overview.health && overview.total > 0 && (
                                    <AppTooltip
                                        title={fmt(t.tasks.diagram.tooltips.expectedByToday, {
                                            expectedPct: Math.round(overview.health.expectedPct),
                                        })}
                                    >
                                        <Box
                                            sx={{
                                                position: "absolute",
                                                top: -2,
                                                bottom: -2,
                                                left: `${overview.health.expectedPct}%`,
                                                width: "2px",
                                                background: HEALTH_COLOR[overview.health.tone],
                                                borderRadius: "1px",
                                                boxShadow: `0 0 0 1px ${g.surface.raised}`,
                                                cursor: "help",
                                            }}
                                        />
                                    </AppTooltip>
                                )}
                            </Box>
                            <Typography
                                level="body-xs"
                                sx={{
                                    color: g.text.secondary,
                                    fontWeight: 600,
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {overview.closed}/{overview.total}
                            </Typography>
                        </Stack>
                    )}
                    {/* {overview?.burndown &&
                                overview.burndown.length > 0 &&
                                overview.health &&
                                overview.total > 0 && (
                                    <BurndownSparkline
                                        data={overview.burndown}
                                        total={overview.total}
                                        tone={overview.health.tone}
                                    />
                                )} */}
                </Stack>
            )}

            {/* Hide / show closed tasks. Gated on having at
                        least one closed descendant — toggling on an
                        otherwise-clean tree would be a no-op and the
                        button would be confusing. */}
            {(overview?.closed ?? 0) > 0 && (
                <AppTooltip
                    placement="bottom"
                    title={
                        hideClosed
                            ? t.tasks.diagram.tooltips.showClosed
                            : t.tasks.diagram.tooltips.hideClosed
                    }
                >
                    <IconButton
                        color="neutral"
                        size="sm"
                        variant="plain"
                        sx={{
                            color: hideClosed ? g.accent.text : g.text.secondary,
                            "&:hover": { color: g.text.primary },
                        }}
                        onClick={() => setHideClosed((v) => !v)}
                    >
                        {hideClosed ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                    </IconButton>
                </AppTooltip>
            )}
        </>
    );
    // The row of schedule facts sits in the header from `sm` up. On a phone it would squeeze
    // the title to nothing, so it is a row of its own under the header there.
    const accessorySx = {
        alignItems: "center",
        flexWrap: "wrap",
        justifyContent: "flex-end",
        gap: 1.25,
    } as const;

    return (
        <ModalFrame
            closeLabel={t.tasks.diagram.tooltips.close}
            description={rootLabel}
            icon={<AccountTreeRoundedIcon sx={{ color: g.accent.text }} />}
            open={open}
            size="canvas"
            title={t.tasks.diagram.title}
            zIndex={effectiveZIndex}
            headerAccessory={
                <Box
                    sx={{
                        ...accessorySx,
                        display: { xs: "none", sm: "flex" },
                        maxWidth: "min(760px, 62vw)",
                    }}
                >
                    {accessoryItems}
                </Box>
            }
            fillBody
            flush
            headerDivider
            onClose={onClose}
        >
            {/* Everything inside re-derives its own stacking layer
                (node-card popups, canvas-node preview opens) from
                the dialog's effective z, see diagramZIndex.ts. */}
            <DiagramZIndexProvider value={effectiveZIndex}>
                <Box
                    sx={{
                        ...accessorySx,
                        display: { xs: "flex", sm: "none" },
                        justifyContent: "flex-start",
                        flexShrink: 0,
                        px: 2.5,
                        py: 1,
                        borderBottom: `1px solid ${g.border.subtle}`,
                    }}
                >
                    {accessoryItems}
                </Box>
                {/* Canvas fills the rest of the dialog */}
                <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
                    {open && (
                        <TaskFlowCanvas
                            hideClosed={hideClosed}
                            highlightAssigneeId={highlightAssigneeId}
                            myself={myself}
                            projectId={projectId}
                            rootTaskId={rootTaskId}
                            scope={scope}
                            usePM={usePM}
                            useSM={useSM}
                            useTM={useTM}
                            onCloseModal={onClose}
                            onOverviewChange={setOverview}
                        />
                    )}
                </Box>
            </DiagramZIndexProvider>
        </ModalFrame>
    );
};
