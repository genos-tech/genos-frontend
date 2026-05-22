import { memo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import {
    Box,
    Chip,
    Dropdown,
    IconButton,
    Input,
    Menu,
    MenuButton,
    MenuItem,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";
import { Handle, NodeProps, Position } from "@xyflow/react";

import { purplePalette } from "../../../../theme/purplePalette";
import { StatusChip } from "../../components/autocompletes/ACTaskSelector";
import { CopyableTaskIdChip } from "../../components/CopyableTaskId";
import { statuses } from "../../utils/taskMeta";
import { getScheduleStatus, TONE_COLOR } from "../utils/scheduleStatus";
import { HANDLE, TaskNodeData } from "../types";

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

export const TaskNodeCard = memo((props: NodeProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const P = isDark ? purplePalette.dark : purplePalette.light;

    const {
        task,
        isRoot,
        isExternal,
        openBlockerCount,
        onChange,
        onAddSubtask,
        onDelete,
        onOpenPreview,
    } = props.data as unknown as TaskNodeData;

    const [editing, setEditing] = useState(false);
    const [draftTitle, setDraftTitle] = useState(task.title ?? "");

    const meta = statusMeta(task.status);
    const schedule = getScheduleStatus(task.startDate, task.dueDate, task.status);
    const toneColor = TONE_COLOR[schedule.tone];

    // Ghost (external) project name is stashed on the task object via
    // the `refToGhostTask` synthesizer. Falls back to a generic
    // "External" label when missing.
    const projectName = (task as { projectName?: string | null }).projectName ?? null;

    const commitTitle = () => {
        const next = draftTitle.trim();
        setEditing(false);
        if (next && next !== task.title) {
            void onChange({ title: next });
        } else {
            setDraftTitle(task.title ?? "");
        }
    };

    // Visual treatment: ghosts dim, dashed, no glow. Internal cards
    // get the existing accent treatment with an additional schedule
    // tone stripe on the left edge (red wins on overdue).
    const borderStyle = isExternal ? "dashed" : "solid";
    const borderColor = isExternal
        ? P.borderMuted ?? P.border
        : isRoot
          ? P.borderStrong
          : P.border;
    const stripeColor = isExternal
        ? null
        : schedule.tone === "neutral" || schedule.tone === "success"
          ? null
          : toneColor;

    return (
        <Box
            onClick={isExternal ? () => onOpenPreview() : undefined}
            sx={{
                width: 260,
                p: 1.25,
                pl: stripeColor ? 1.5 : 1.25,
                borderRadius: "12px",
                background: P.surfaceElevated,
                border: "1px solid",
                borderStyle,
                borderColor,
                opacity: isExternal ? 0.92 : 1,
                cursor: isExternal ? "pointer" : "default",
                boxShadow: isExternal
                    ? "none"
                    : isRoot
                      ? `0 6px 22px ${P.glow}`
                      : P.shadowSoft,
                transition: "border-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease",
                position: "relative",
                "&:hover": isExternal
                    ? { opacity: 1, borderColor: P.borderStrong }
                    : { borderColor: P.borderStrong },
                "&::before": stripeColor
                    ? {
                          content: '""',
                          position: "absolute",
                          left: 0,
                          top: 8,
                          bottom: 8,
                          width: "3px",
                          borderRadius: "0 3px 3px 0",
                          background: stripeColor,
                      }
                    : undefined,
            }}
        >
            {/* Handles — inert for ghosts so users can't accidentally
                build edges that wouldn't make sense (we don't know the
                external task's structure, so a parent-child connection
                would be wrong). Dependency handles stay active —
                forming a NEW dependency to an external task is the same
                op as forming one to any other task. */}
            <Handle
                type="target"
                position={Position.Top}
                id={HANDLE.structureTop}
                style={{ ...HANDLE_BASE, background: P.accent, borderColor: P.accentSoft }}
                isConnectable={!isExternal}
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id={HANDLE.structureBottom}
                style={{ ...HANDLE_BASE, background: P.accent, borderColor: P.accentSoft }}
                isConnectable={!isExternal}
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

            {/* Header row */}
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
                <CopyableTaskIdChip
                    task={task}
                    size="sm"
                    variant="outlined"
                    sx={{ fontWeight: 600, fontFamily: "monospace", borderRadius: "5px" }}
                />
                <StatusChip meta={meta} isDark={isDark} />
                {openBlockerCount > 0 && !isExternal && (
                    <Tooltip
                        title={`${openBlockerCount} open blocker${openBlockerCount > 1 ? "s" : ""}`}
                        placement="top"
                        variant="outlined"
                        arrow
                    >
                        <Chip
                            size="sm"
                            color="warning"
                            variant="soft"
                            startDecorator={<BlockRoundedIcon sx={{ fontSize: 12 }} />}
                            sx={{
                                fontSize: "0.65rem",
                                fontWeight: 700,
                                borderRadius: "5px",
                                "--Chip-paddingInline": "6px",
                            }}
                        >
                            {openBlockerCount}
                        </Chip>
                    </Tooltip>
                )}
                <Box sx={{ flex: 1 }} />
                {isExternal ? (
                    // Ghost cards don't get the "…" menu — instead, a
                    // small "open in preview" hint so the click target
                    // is obvious.
                    <Tooltip
                        title="Open this task in preview"
                        placement="top"
                        variant="outlined"
                        arrow
                    >
                        <OpenInNewRoundedIcon
                            sx={{ fontSize: 14, color: P.textMuted, opacity: 0.7 }}
                        />
                    </Tooltip>
                ) : (
                    <Dropdown>
                        <MenuButton
                            slots={{ root: IconButton }}
                            slotProps={{
                                root: {
                                    size: "sm",
                                    variant: "plain",
                                    sx: {
                                        "--IconButton-size": "22px",
                                        color: P.textMuted,
                                        opacity: 0.7,
                                        "&:hover": { opacity: 1 },
                                    },
                                },
                            }}
                        >
                            <MoreHorizRoundedIcon sx={{ fontSize: 16 }} />
                        </MenuButton>
                        <Menu size="sm" placement="bottom-end">
                            <MenuItem onClick={onOpenPreview}>
                                <LaunchRoundedIcon sx={{ fontSize: 16 }} />
                                Open in preview
                            </MenuItem>
                            <MenuItem color="danger" onClick={() => void onDelete()}>
                                <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                                Delete task
                            </MenuItem>
                        </Menu>
                    </Dropdown>
                )}
            </Stack>

            {/* Title — double-click to edit (disabled for ghosts) */}
            {editing && !isExternal ? (
                <Input
                    autoFocus
                    size="sm"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onBlur={commitTitle}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") commitTitle();
                        if (e.key === "Escape") {
                            setEditing(false);
                            setDraftTitle(task.title ?? "");
                        }
                    }}
                    sx={{ mb: 0.75, fontWeight: 600 }}
                />
            ) : (
                <Tooltip
                    title={isExternal ? "" : "Double-click to rename"}
                    placement="top"
                    variant="outlined"
                    arrow
                    enterDelay={500}
                    disableHoverListener={isExternal}
                >
                    <Typography
                        level="body-sm"
                        sx={{
                            fontWeight: 600,
                            mb: 0.75,
                            color: P.text,
                            cursor: isExternal ? "pointer" : "text",
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            wordBreak: "break-word",
                            lineHeight: 1.3,
                            minHeight: "2.6em",
                        }}
                        onDoubleClick={() => {
                            if (isExternal) return;
                            setDraftTitle(task.title ?? "");
                            setEditing(true);
                        }}
                    >
                        {task.title || "Untitled"}
                    </Typography>
                </Tooltip>
            )}

            {/* Schedule row — dates + duration + relative status. The
                triple-pill row is the diagram's key scheduling cue and
                deliberately reads compact-but-complete. */}
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

            {/* Footer row */}
            <Stack direction="row" alignItems="center" spacing={0.75}>
                {isExternal ? (
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
                            background: isDark
                                ? "rgba(148,163,184,0.18)"
                                : "rgba(100,116,139,0.14)",
                            color: P.textMuted,
                        }}
                    >
                        External
                    </Chip>
                ) : (
                    task.priority && (
                        <Chip
                            size="sm"
                            variant="outlined"
                            sx={{
                                fontSize: "0.65rem",
                                borderRadius: "5px",
                                "--Chip-paddingInline": "6px",
                                color: P.textMuted,
                            }}
                        >
                            {task.priority}
                        </Chip>
                    )
                )}
                {projectName && (
                    <Typography
                        level="body-xs"
                        sx={{
                            color: P.textMuted,
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                            minWidth: 0,
                        }}
                    >
                        {projectName}
                    </Typography>
                )}
                {!isExternal && task.assigneeName && (
                    <Typography
                        level="body-xs"
                        sx={{
                            color: P.textMuted,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                            minWidth: 0,
                        }}
                    >
                        {task.assigneeName}
                    </Typography>
                )}
                <Box sx={{ flex: 1 }} />
                {!isExternal && (
                    <Tooltip title="Add sub-task" placement="top" variant="outlined" arrow>
                        <IconButton
                            size="sm"
                            variant="plain"
                            onClick={() => void onAddSubtask()}
                            sx={{
                                "--IconButton-size": "24px",
                                color: P.accentSoft,
                                opacity: 0.8,
                                borderRadius: "6px",
                                "&:hover": { opacity: 1, background: P.hoverBg },
                            }}
                        >
                            <AddRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>
                )}
            </Stack>
        </Box>
    );
});

TaskNodeCard.displayName = "TaskNodeCard";
