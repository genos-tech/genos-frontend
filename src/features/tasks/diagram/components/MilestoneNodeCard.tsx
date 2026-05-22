import { memo } from "react";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import { Box, Chip, IconButton, LinearProgress, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";
import { Handle, NodeProps, Position } from "@xyflow/react";

import { purplePalette } from "../../../../theme/purplePalette";
import { StatusChip } from "../../components/autocompletes/ACTaskSelector";
import { CopyableTaskIdChip } from "../../components/CopyableTaskId";
import { statuses } from "../../utils/taskMeta";
import { HANDLE, TaskNodeData } from "../types";
import { getScheduleStatus, TONE_COLOR } from "../utils/scheduleStatus";

const fmtDate = (iso: string | null | undefined): string => {
    if (!iso) return "";
    const d = new Date(iso.length >= 10 ? iso.slice(0, 10) : iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const statusMeta = (label: string | null | undefined) => {
    const found = statuses.find((s) => s.status === label);
    return (
        found ?? {
            code: 0,
            status: label ?? "—",
            color: null as string | null,
            textColor: null as string | null,
        }
    );
};

const HANDLE_BASE = {
    width: 10,
    height: 10,
    border: "2px solid",
    borderRadius: "50%",
} as const;

// Milestone variant of TaskNodeCard. Read-only structure-side; the
// dependency handles stay live so a milestone can still be a
// blocker / blocked target. Adds a progress bar + the same rich
// schedule chips as TaskNodeCard so the milestone reads as the
// "header" of its tree.
export const MilestoneNodeCard = memo((props: NodeProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const P = isDark ? purplePalette.dark : purplePalette.light;

    const { task, closedDescendantCount, totalDescendantCount, sprint, onOpenPreview } =
        props.data as unknown as TaskNodeData;

    const meta = statusMeta(task.status);
    const schedule = getScheduleStatus(task.startDate, task.dueDate, task.status);
    const toneColor = TONE_COLOR[schedule.tone];

    const total = totalDescendantCount ?? 0;
    const closed = closedDescendantCount ?? 0;
    const pct = total > 0 ? Math.round((closed / total) * 100) : 0;
    const progressColor = pct === 100 ? "success" : "primary";

    const flagColor = "#f97316";

    return (
        <Box
            sx={{
                width: 260,
                p: 1.25,
                pt: 1.5,
                borderRadius: "12px",
                background: P.surfaceElevated,
                border: "1.5px solid",
                borderColor: isDark ? "rgba(249,115,22,0.45)" : "rgba(234,88,12,0.45)",
                boxShadow: isDark
                    ? "0 6px 22px rgba(249,115,22,0.18)"
                    : "0 6px 22px rgba(234,88,12,0.14)",
                position: "relative",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                "&:hover": {
                    borderColor: isDark ? "rgba(249,115,22,0.7)" : "rgba(234,88,12,0.7)",
                },
                "&::before": {
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 8,
                    right: 8,
                    height: "2px",
                    borderRadius: "0 0 2px 2px",
                    background: "linear-gradient(90deg, #fbbf24 0%, #f97316 50%, #ef4444 100%)",
                    opacity: 0.9,
                },
            }}
        >
            <Handle
                type="target"
                position={Position.Top}
                id={HANDLE.structureTop}
                style={{ ...HANDLE_BASE, background: P.accent, borderColor: P.accentSoft }}
                isConnectable={false}
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id={HANDLE.structureBottom}
                style={{ ...HANDLE_BASE, background: P.accent, borderColor: P.accentSoft }}
                isConnectable={false}
            />
            <Handle
                type="target"
                position={Position.Left}
                id={HANDLE.dependencyLeft}
                style={{ ...HANDLE_BASE, background: "#ff8c00", borderColor: "#fbbf24" }}
            />
            <Handle
                type="source"
                position={Position.Right}
                id={HANDLE.dependencyRight}
                style={{ ...HANDLE_BASE, background: "#ff8c00", borderColor: "#fbbf24" }}
            />

            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
                <Box
                    sx={{
                        width: 22,
                        height: 22,
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: isDark ? "rgba(249,115,22,0.18)" : "rgba(234,88,12,0.12)",
                        color: flagColor,
                    }}
                >
                    <FlagRoundedIcon sx={{ fontSize: 14 }} />
                </Box>
                <CopyableTaskIdChip
                    task={task}
                    size="sm"
                    variant="outlined"
                    sx={{ fontWeight: 600, fontFamily: "monospace", borderRadius: "5px" }}
                />
                <StatusChip meta={meta} isDark={isDark} />
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Open milestone" placement="top" variant="outlined" arrow>
                    <IconButton
                        size="sm"
                        variant="plain"
                        onClick={onOpenPreview}
                        sx={{
                            "--IconButton-size": "22px",
                            color: P.textMuted,
                            opacity: 0.7,
                            "&:hover": { opacity: 1, color: P.text },
                        }}
                    >
                        <LaunchRoundedIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                </Tooltip>
            </Stack>

            <Typography
                level="body-sm"
                sx={{
                    fontWeight: 700,
                    mb: 0.75,
                    color: P.text,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    wordBreak: "break-word",
                    lineHeight: 1.3,
                    minHeight: "2.6em",
                }}
            >
                {task.title || "Untitled milestone"}
            </Typography>

            {/* Schedule row */}
            <Stack
                direction="row"
                alignItems="center"
                spacing={0.5}
                sx={{ mb: 0.5, minHeight: 22, flexWrap: "wrap", rowGap: 0.5 }}
            >
                <CalendarMonthRoundedIcon
                    sx={{ fontSize: 14, color: P.textMuted, opacity: 0.7 }}
                />
                {schedule.startLabel && schedule.dueLabel ? (
                    <Typography level="body-xs" sx={{ color: P.text, fontWeight: 500 }}>
                        {schedule.startLabel} – {schedule.dueLabel}
                    </Typography>
                ) : schedule.startLabel || schedule.dueLabel ? (
                    <Typography level="body-xs" sx={{ color: P.text, fontWeight: 500 }}>
                        {schedule.startLabel ?? schedule.dueLabel}
                    </Typography>
                ) : (
                    <Typography level="body-xs" sx={{ color: P.textMuted, opacity: 0.6 }}>
                        No dates
                    </Typography>
                )}
                {schedule.durationDays != null && (
                    <Chip
                        size="sm"
                        variant="outlined"
                        sx={{
                            fontSize: "0.6rem",
                            fontWeight: 600,
                            borderRadius: "4px",
                            "--Chip-paddingInline": "5px",
                            color: P.textMuted,
                        }}
                    >
                        {schedule.durationDays}d
                    </Chip>
                )}
                {schedule.relativeLabel && (
                    <Chip
                        size="sm"
                        variant="soft"
                        startDecorator={<ScheduleRoundedIcon sx={{ fontSize: 11 }} />}
                        sx={{
                            fontSize: "0.6rem",
                            fontWeight: 700,
                            borderRadius: "4px",
                            "--Chip-paddingInline": "5px",
                            background: alpha(toneColor, isDark ? 0.22 : 0.16),
                            color: toneColor,
                        }}
                    >
                        {schedule.relativeLabel}
                    </Chip>
                )}
            </Stack>

            {/* Sprint linkage — when the milestone is attached to a
                sprint we surface its name + date range so the milestone
                reads as scheduled within a concrete cycle. Sits between
                the schedule row and the progress bar so milestone
                window and sprint cadence read side by side. */}
            {sprint && (
                <Stack
                    direction="row"
                    alignItems="center"
                    spacing={0.5}
                    sx={{ mb: 0.75, minHeight: 22, flexWrap: "wrap", rowGap: 0.5 }}
                >
                    <BoltRoundedIcon sx={{ fontSize: 14, color: P.accentSoft, opacity: 0.9 }} />
                    <Typography level="body-xs" sx={{ color: P.text, fontWeight: 600 }} noWrap>
                        {sprint.name}
                    </Typography>
                    <Typography
                        level="body-xs"
                        sx={{ color: P.textMuted, fontWeight: 500 }}
                        noWrap
                    >
                        {fmtDate(sprint.startDate)} – {fmtDate(sprint.endDate)}
                    </Typography>
                </Stack>
            )}

            {/* Progress bar — only when the milestone has descendants. */}
            {total > 0 && (
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                    <Box sx={{ flex: 1 }}>
                        <LinearProgress
                            determinate
                            value={pct}
                            size="sm"
                            color={progressColor}
                            sx={{ "--LinearProgress-thickness": "5px" }}
                        />
                    </Box>
                    <Typography
                        level="body-xs"
                        sx={{
                            color: P.textMuted,
                            fontWeight: 600,
                            minWidth: 42,
                            textAlign: "right",
                        }}
                    >
                        {closed}/{total}
                    </Typography>
                </Stack>
            )}

            <Stack
                direction="row"
                alignItems="center"
                spacing={0.75}
                sx={{ mt: total > 0 ? 0.5 : 0 }}
            >
                <Chip
                    size="sm"
                    variant="soft"
                    sx={{
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        borderRadius: "4px",
                        "--Chip-paddingInline": "5px",
                        background: isDark ? "rgba(249,115,22,0.15)" : "rgba(234,88,12,0.1)",
                        color: flagColor,
                    }}
                >
                    Milestone
                </Chip>
            </Stack>
        </Box>
    );
});

MilestoneNodeCard.displayName = "MilestoneNodeCard";
