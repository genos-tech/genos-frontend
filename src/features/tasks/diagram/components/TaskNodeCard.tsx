import { memo, useEffect, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import {
    Box,
    Button,
    Chip,
    Dropdown,
    FormControl,
    FormLabel,
    IconButton,
    Input,
    Menu,
    MenuButton,
    MenuItem,
    Modal,
    ModalDialog,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";
import { Handle, NodeProps, Position } from "@xyflow/react";

import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { purplePalette } from "../../../../theme/purplePalette";
import { StatusChip } from "../../components/autocompletes/ACTaskSelector";
import { CopyableTaskIdChip } from "../../components/CopyableTaskId";
import { statuses } from "../../utils/taskMeta";
import { HANDLE, TaskNodeData } from "../types";
import { getScheduleStatus, TONE_COLOR } from "../utils/scheduleStatus";

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

    const { task, isRoot, isExternal, openBlockerCount, onChange, onAddSubtask, onOpenPreview } =
        props.data as unknown as TaskNodeData;

    const [editing, setEditing] = useState(false);
    const [draftTitle, setDraftTitle] = useState(task.title ?? "");
    // Inline date editor (Issue #5). A small Joy modal opens above the
    // diagram when the user clicks the edit-calendar icon. We keep the
    // drafts local and PUT both fields on Save so the user can pick a
    // start/due pair in one motion instead of two round-trips.
    const [dateEditorOpen, setDateEditorOpen] = useState(false);
    const [draftStart, setDraftStart] = useState<string>(task.startDate ?? "");
    const [draftDue, setDraftDue] = useState<string>(task.dueDate ?? "");

    // Keep drafts in sync when task data changes externally (e.g. a
    // graph refresh after a sibling edit). Only when the editor is
    // closed — don't clobber in-progress input.
    useEffect(() => {
        if (!dateEditorOpen) {
            setDraftStart(task.startDate ?? "");
            setDraftDue(task.dueDate ?? "");
        }
    }, [task.startDate, task.dueDate, dateEditorOpen]);

    const openDateEditor = () => {
        setDraftStart(task.startDate ?? "");
        setDraftDue(task.dueDate ?? "");
        setDateEditorOpen(true);
    };

    const saveDateEditor = () => {
        // Empty strings flow through as `null` so the user can clear
        // a date by blanking the input.
        void onChange({
            startDate: draftStart || null,
            dueDate: draftDue || null,
        });
        setDateEditorOpen(false);
    };

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

    // Visual treatment: ghosts stay neutral (dim + dashed). Internal
    // cards mix the existing purple border with the task's *status*
    // color so the board reads as "all the green cards are closed"
    // at a glance, without the status chip having to do all the work.
    // The schedule tone takes over the left edge stripe (red on
    // overdue) so urgency still pops over status.
    const borderStyle = isExternal ? "dashed" : "solid";
    // `color-mix` is widely supported (Chromium 111+ / Safari 16.2+ /
    // Firefox 113+); we lean on CSS to blend so the result interpolates
    // in both theme modes without two color stops to maintain manually.
    const baseBorder = isRoot ? P.borderStrong : P.border;
    const statusTintColor = meta.color;
    const borderColor = isExternal
        ? (P.borderMuted ?? P.border)
        : statusTintColor
          ? `color-mix(in srgb, ${baseBorder}, ${statusTintColor} 38%)`
          : baseBorder;
    // Subtle status glow on non-ghost cards so the eye sweeps over
    // closed (green) / WIP (orange) tasks as a group.
    const statusGlow =
        !isExternal && statusTintColor
            ? `0 4px 18px ${alpha(statusTintColor, isDark ? 0.18 : 0.12)}`
            : null;
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
                      ? `0 6px 22px ${P.glow}${statusGlow ? `, ${statusGlow}` : ""}`
                      : (statusGlow ?? P.shadowSoft),
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
            {/* Handles — fully inert for ghosts. External tasks are
                a read-only window; editing relations from this diagram
                would surprise the user (they'd need to manage them
                from the other task's own preview/diagram). Structure
                AND dependency handles both disable on ghosts. */}
            <Handle
                type="target"
                position={Position.Top}
                id={HANDLE.structureTop}
                style={{
                    ...HANDLE_BASE,
                    background: P.accent,
                    borderColor: P.accentSoft,
                    opacity: isExternal ? 0.35 : 1,
                }}
                isConnectable={!isExternal}
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id={HANDLE.structureBottom}
                style={{
                    ...HANDLE_BASE,
                    background: P.accent,
                    borderColor: P.accentSoft,
                    opacity: isExternal ? 0.35 : 1,
                }}
                isConnectable={!isExternal}
            />
            <Handle
                type="target"
                position={Position.Left}
                id={HANDLE.dependencyLeft}
                style={{
                    ...HANDLE_BASE,
                    background: "#ff8c00",
                    borderColor: "#fbbf24",
                    opacity: isExternal ? 0.35 : 1,
                }}
                isConnectable={!isExternal}
            />
            <Handle
                type="source"
                position={Position.Right}
                id={HANDLE.dependencyRight}
                style={{
                    ...HANDLE_BASE,
                    background: "#ff8c00",
                    borderColor: "#fbbf24",
                    opacity: isExternal ? 0.35 : 1,
                }}
                isConnectable={!isExternal}
            />

            {/* Header row */}
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
                <CopyableTaskIdChip
                    task={task}
                    size="sm"
                    variant="outlined"
                    sx={{ fontWeight: 600, fontFamily: "monospace", borderRadius: "5px" }}
                />
                {/* Status picker — ghosts stay read-only (their status
                    lives in another tree). For everyone else the chip
                    is a dropdown trigger so users can move a task
                    Open → WIP → Closed without opening the preview. */}
                {isExternal ? (
                    <StatusChip meta={meta} isDark={isDark} />
                ) : (
                    <Dropdown>
                        <MenuButton
                            slots={{ root: Box }}
                            slotProps={{
                                root: {
                                    sx: {
                                        cursor: "pointer",
                                        borderRadius: "5px",
                                        transition: "filter 0.12s ease",
                                        "&:hover": { filter: "brightness(1.08)" },
                                    },
                                },
                            }}
                        >
                            <StatusChip meta={meta} isDark={isDark} />
                        </MenuButton>
                        <Menu size="sm" placement="bottom-start" sx={{ minWidth: 140 }}>
                            {statuses.map((s) => {
                                const isActive = s.status === task.status;
                                return (
                                    <MenuItem
                                        key={s.status}
                                        selected={isActive}
                                        onClick={() => {
                                            if (isActive || s.status == null) return;
                                            void onChange({
                                                status: s.status,
                                                statusCode: s.code,
                                            });
                                        }}
                                        sx={{ fontWeight: isActive ? 700 : 500 }}
                                    >
                                        <Box
                                            sx={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: "50%",
                                                background: s.color ?? "#94a3b8",
                                                flexShrink: 0,
                                                mr: 1,
                                            }}
                                        />
                                        {s.status}
                                    </MenuItem>
                                );
                            })}
                        </Menu>
                    </Dropdown>
                )}
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
                    // Direct "open task" affordance. Clicking jumps to
                    // the task preview and closes the diagram modal
                    // (the canvas wires both into `onOpenPreview`).
                    <Tooltip title="Open task" placement="top" variant="outlined" arrow>
                        <IconButton
                            size="sm"
                            variant="plain"
                            onClick={onOpenPreview}
                            sx={{
                                "--IconButton-size": "22px",
                                color: P.textMuted,
                                opacity: 0.7,
                                borderRadius: "5px",
                                "&:hover": {
                                    opacity: 1,
                                    background: P.hoverBg,
                                    color: P.accentSoft,
                                },
                            }}
                        >
                            <LaunchRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                    </Tooltip>
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
                {/* Date label — clickable on non-external nodes so the
                    user can edit start/due directly. Hover/focus give a
                    subtle hint without a separate icon button. */}
                {(() => {
                    const dateText =
                        schedule.startLabel && schedule.dueLabel
                            ? `${schedule.startLabel} – ${schedule.dueLabel}`
                            : (schedule.startLabel ?? schedule.dueLabel ?? null);
                    const placeholder = "+ Set dates";
                    const isEmpty = dateText == null;
                    const labelText = isEmpty ? placeholder : dateText;
                    const editable = !isExternal;
                    return (
                        <Tooltip
                            title={editable ? "Click to edit dates" : ""}
                            placement="top"
                            variant="outlined"
                            arrow
                            enterDelay={500}
                            disableHoverListener={!editable}
                        >
                            <Typography
                                level="body-xs"
                                onClick={editable ? openDateEditor : undefined}
                                sx={{
                                    color: isEmpty ? P.textMuted : P.text,
                                    fontWeight: 500,
                                    opacity: isEmpty ? 0.7 : 1,
                                    cursor: editable ? "pointer" : "default",
                                    borderRadius: "4px",
                                    px: 0.5,
                                    mx: -0.25,
                                    transition: "background 0.12s ease, color 0.12s ease",
                                    "&:hover": editable
                                        ? {
                                              background: P.hoverBg,
                                              color: P.accentSoft,
                                          }
                                        : undefined,
                                }}
                            >
                                {labelText}
                            </Typography>
                        </Tooltip>
                    );
                })()}
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
                {!isExternal && task.assigneeId && (
                    // Avatar instead of name text — packs more identity
                    // into the same horizontal space and matches the
                    // affordance used everywhere else in the app
                    // (comments, table cells, modals). Tooltip with the
                    // name covers the "who is this?" case.
                    <Tooltip
                        title={task.assigneeName ?? ""}
                        placement="top"
                        variant="outlined"
                        arrow
                        enterDelay={400}
                    >
                        <Box sx={{ display: "inline-flex" }}>
                            <UserAvatar
                                userId={task.assigneeId}
                                size={22}
                                showNameAndEmail={false}
                            />
                        </Box>
                    </Tooltip>
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

            {/* Inline date editor modal — opens above the diagram so
                the user can adjust start/due without leaving the
                canvas. Empty inputs flow as `null`, so the user can
                clear a date by blanking the field. Plain Stack layout
                instead of Joy's DialogTitle/DialogContent: those
                wrappers ship their own padding/typography that fought
                with the compact look we want here. */}
            <Modal open={dateEditorOpen} onClose={() => setDateEditorOpen(false)}>
                <ModalDialog
                    variant="outlined"
                    sx={{
                        minWidth: 340,
                        maxWidth: 380,
                        p: 0,
                        borderRadius: "12px",
                        background: P.surfaceElevated,
                        border: `1px solid ${P.border}`,
                        boxShadow: P.shadow,
                        overflow: "hidden",
                    }}
                >
                    <Stack
                        direction="row"
                        alignItems="center"
                        spacing={1}
                        sx={{
                            px: 2,
                            py: 1.25,
                            borderBottom: `1px solid ${P.border}`,
                        }}
                    >
                        <CalendarMonthRoundedIcon sx={{ fontSize: 18, color: P.accentSoft }} />
                        <Typography level="title-sm" sx={{ fontWeight: 700, color: P.text }}>
                            Edit schedule
                        </Typography>
                    </Stack>
                    <Stack spacing={1.5} sx={{ px: 2, py: 1.75 }}>
                        <FormControl size="sm">
                            <FormLabel sx={{ color: P.textMuted, fontWeight: 600 }}>
                                Start date
                            </FormLabel>
                            <Input
                                type="date"
                                value={draftStart}
                                onChange={(e) => setDraftStart(e.target.value)}
                                sx={{
                                    "& input::-webkit-calendar-picker-indicator": {
                                        filter: isDark ? "invert()" : "none",
                                        cursor: "pointer",
                                    },
                                }}
                            />
                        </FormControl>
                        <FormControl size="sm">
                            <FormLabel sx={{ color: P.textMuted, fontWeight: 600 }}>
                                Due date
                            </FormLabel>
                            <Input
                                type="date"
                                value={draftDue}
                                onChange={(e) => setDraftDue(e.target.value)}
                                sx={{
                                    "& input::-webkit-calendar-picker-indicator": {
                                        filter: isDark ? "invert()" : "none",
                                        cursor: "pointer",
                                    },
                                }}
                            />
                        </FormControl>
                    </Stack>
                    <Stack
                        direction="row"
                        spacing={1}
                        justifyContent="flex-end"
                        sx={{
                            px: 2,
                            py: 1.25,
                            borderTop: `1px solid ${P.border}`,
                            background: P.surface,
                        }}
                    >
                        <Button
                            size="sm"
                            variant="plain"
                            color="neutral"
                            onClick={() => setDateEditorOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button size="sm" variant="solid" onClick={saveDateEditor}>
                            Save
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </Box>
    );
});

TaskNodeCard.displayName = "TaskNodeCard";
