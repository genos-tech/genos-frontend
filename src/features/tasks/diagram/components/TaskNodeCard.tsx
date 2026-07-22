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
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";
import { Handle, NodeProps, Position } from "@xyflow/react";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { fmt, useTranslation } from "../../../../i18n";
import { purplePalette } from "../../../../theme/purplePalette";
import { StatusChip } from "../../components/autocompletes/ACTaskSelector";
import { CopyableTaskIdChip } from "../../components/CopyableTaskId";
import { statuses } from "../../utils/taskMeta";
import { useDiagramZIndex } from "../diagramZIndex";
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

// Focus color for "assigned to the viewer" nodes (dashboard's Assigned
// Milestones section). Deliberately amber — a hue distinct from the purple
// `isCurrentPreview` accent, so a card that is BOTH the anchor and one of the
// viewer's tasks never blurs the two treatments together.
const ASSIGNED_FOCUS_COLOR = "#f59e0b";

export const TaskNodeCard = memo((props: NodeProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const P = isDark ? purplePalette.dark : purplePalette.light;
    // Popups (status menu, date editor) must stack ABOVE the enclosing
    // diagram dialog, whose z varies by host surface — see
    // diagramZIndex.ts. Default context (9999) keeps the historical
    // 10000 for page-hosted diagrams.
    const popupZIndex = useDiagramZIndex() + 1;

    const {
        task,
        isRoot,
        isCurrentPreview,
        isAssignedToViewer,
        isExternal,
        openBlockerCount,
        projectName,
        onChange,
        onAddSubtask,
        onOpenPreview,
    } = props.data as unknown as TaskNodeData;

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
    // "Current preview" takes the strongest border so it pops from a
    // tree of siblings; root falls back to `borderStrong`; regular
    // tasks use the default border. Status tint still mixes in.
    const baseBorder = isCurrentPreview ? P.accent : isRoot ? P.borderStrong : P.border;
    const statusTintColor = meta.color;
    const borderColor = isExternal
        ? (P.borderMuted ?? P.border)
        : isCurrentPreview
          ? // Current-preview card keeps the accent border pure (no
            // status mix) so it reads as an unambiguous "you are here"
            // marker regardless of the task's status color.
            P.accent
          : isAssignedToViewer
            ? // Viewer's own task — amber-tinted border (takes precedence
              // over the status tint; status is still legible via the chip
              // and glow). Paired with the amber ring below.
              `color-mix(in srgb, ${baseBorder}, ${ASSIGNED_FOCUS_COLOR} 55%)`
            : statusTintColor
              ? `color-mix(in srgb, ${baseBorder}, ${statusTintColor} 38%)`
              : baseBorder;
    // Subtle status glow on non-ghost cards so the eye sweeps over
    // closed (green) / WIP (orange) tasks as a group.
    const statusGlow =
        !isExternal && statusTintColor
            ? `0 4px 18px ${alpha(statusTintColor, isDark ? 0.18 : 0.12)}`
            : null;
    // "Current preview" ring: an accent-colored outline drawn via an
    // outer box-shadow layer so it sits OUTSIDE the card's border
    // without nudging layout. Combined with whatever existing glow the
    // card already has so root + current cards still show their glow.
    const currentRing = isCurrentPreview
        ? `0 0 0 2px ${alpha(P.accent, isDark ? 0.85 : 0.7)}, 0 0 22px ${alpha(P.accent, isDark ? 0.35 : 0.25)}`
        : null;
    // "Assigned to viewer" ring — same additive box-shadow trick as
    // `currentRing`, but amber. Skipped when the card is already the
    // current-preview anchor so the two rings don't double up (the anchor
    // treatment wins; the amber border tint still marks it as the viewer's).
    const assignedRing =
        isAssignedToViewer && !isExternal && !isCurrentPreview
            ? `0 0 0 2px ${alpha(ASSIGNED_FOCUS_COLOR, isDark ? 0.9 : 0.75)}, 0 0 20px ${alpha(ASSIGNED_FOCUS_COLOR, isDark ? 0.4 : 0.28)}`
            : null;
    // "Current preview" surface tint. Contrast by *lightness*, not
    // hue: every other card is already some shade of purple against a
    // purple canvas, so blending in MORE purple wouldn't make the
    // focal card stand out. Dark mode → layer a translucent white
    // wash so the card reads brighter than its siblings; light mode →
    // layer a translucent black wash so it reads darker. Using a
    // gradient overlay (vs flat color-mix) renders more reliably
    // across browsers AND produces a visible step against the already-
    // elevated surface — a flat mix at the same alpha tends to look
    // identical to the base. Border + ring still carry the brand
    // accent so the card stays tied to the diagram's palette.
    const cardBackground = isCurrentPreview
        ? isDark
            ? `linear-gradient(rgba(255,255,255,0.18), rgba(255,255,255,0.18)), ${P.surfaceElevated}`
            : `linear-gradient(rgba(0,0,0,0.10), rgba(0,0,0,0.10)), ${P.surfaceElevated}`
        : P.surfaceElevated;
    const stripeColor = isExternal
        ? null
        : schedule.tone === "neutral" || schedule.tone === "success"
          ? null
          : toneColor;

    return (
        <Box
            sx={{
                width: 260,
                p: 1.25,
                pl: stripeColor ? 1.5 : 1.25,
                borderRadius: "12px",
                background: cardBackground,
                border: "1px solid",
                borderStyle,
                borderColor,
                opacity: isExternal ? 0.92 : 1,
                cursor: isExternal ? "pointer" : "default",
                boxShadow: isExternal
                    ? "none"
                    : [
                          // Order matters: outer ring first so it sits
                          // outside any internal glow layers. `filter()`
                          // out nulls so a card with only one applicable
                          // shadow doesn't end up with stray commas.
                          // `assignedRing` and `currentRing` are mutually
                          // exclusive (see assignedRing), so at most one fires.
                          assignedRing,
                          currentRing,
                          isRoot ? `0 6px 22px ${P.glow}` : null,
                          statusGlow,
                          !isRoot && !statusGlow ? P.shadowSoft : null,
                      ]
                          .filter(Boolean)
                          .join(", ") || "none",
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
            onClick={isExternal ? () => onOpenPreview() : undefined}
        >
            {/* Handles — fully inert for ghosts. External tasks are
                a read-only window; editing relations from this diagram
                would surprise the user (they'd need to manage them
                from the other task's own preview/diagram). Structure
                AND dependency handles both disable on ghosts. */}
            <Handle
                id={HANDLE.structureTop}
                isConnectable={!isExternal}
                position={Position.Top}
                type="target"
                style={{
                    ...HANDLE_BASE,
                    background: P.accent,
                    borderColor: P.accentSoft,
                    opacity: isExternal ? 0.35 : 1,
                }}
            />
            <Handle
                id={HANDLE.structureBottom}
                isConnectable={!isExternal}
                position={Position.Bottom}
                type="source"
                style={{
                    ...HANDLE_BASE,
                    background: P.accent,
                    borderColor: P.accentSoft,
                    opacity: isExternal ? 0.35 : 1,
                }}
            />
            <Handle
                id={HANDLE.dependencyLeft}
                isConnectable={!isExternal}
                position={Position.Left}
                type="target"
                style={{
                    ...HANDLE_BASE,
                    background: "#ff8c00",
                    borderColor: "#fbbf24",
                    opacity: isExternal ? 0.35 : 1,
                }}
            />
            <Handle
                id={HANDLE.dependencyRight}
                isConnectable={!isExternal}
                position={Position.Right}
                type="source"
                style={{
                    ...HANDLE_BASE,
                    background: "#ff8c00",
                    borderColor: "#fbbf24",
                    opacity: isExternal ? 0.35 : 1,
                }}
            />

            {/* Header row */}
            <Stack alignItems="center" direction="row" spacing={0.75} sx={{ mb: 0.75 }}>
                <CopyableTaskIdChip
                    size="sm"
                    sx={{ fontWeight: 600, fontFamily: "monospace", borderRadius: "5px" }}
                    task={task}
                    variant="outlined"
                />
                {/* Status picker — ghosts stay read-only (their status
                    lives in another tree). For everyone else the chip
                    is a dropdown trigger so users can move a task
                    Open → WIP → Closed without opening the preview. */}
                {isExternal ? (
                    <StatusChip isDark={isDark} meta={meta} />
                ) : (
                    <Dropdown>
                        <MenuButton
                            slots={{ root: "button" }}
                            slotProps={{
                                root: {
                                    // `nodrag nopan nowheel` stops React
                                    // Flow grabbing the gesture before
                                    // Joy's MenuButton can handle it.
                                    // Stopping pointerdown/mousedown is
                                    // belt-and-suspenders because RF
                                    // listens to pointer events too.
                                    className: "nodrag nopan nowheel",
                                    onPointerDown: (e) => e.stopPropagation(),
                                    onMouseDown: (e) => e.stopPropagation(),
                                    style: {
                                        background: "transparent",
                                        border: "none",
                                        padding: 0,
                                        cursor: "pointer",
                                        borderRadius: "5px",
                                        display: "inline-flex",
                                        alignItems: "center",
                                    },
                                },
                            }}
                        >
                            <StatusChip isDark={isDark} meta={meta} />
                        </MenuButton>
                        <Menu
                            placement="bottom-start"
                            size="sm"
                            sx={{ minWidth: 140 }}
                            slotProps={{
                                // `slotProps.root` here spreads onto the
                                // Popper `<ul>` directly. Joy's `sx` is
                                // not processed on that slot (we saw it
                                // serialise as `sx="[object Object]"` in
                                // the DOM) — use plain `style` so the
                                // z-index lands on the inline style and
                                // out-ranks the diagram modal's stacking
                                // context.
                                root: { style: { zIndex: popupZIndex } },
                            }}
                        >
                            {statuses.map((s) => {
                                const isActive = s.status === task.status;
                                return (
                                    <MenuItem
                                        key={s.status}
                                        selected={isActive}
                                        sx={{ fontWeight: isActive ? 700 : 500 }}
                                        onClick={() => {
                                            if (isActive || s.status == null) return;
                                            void onChange({
                                                status: s.status,
                                                statusCode: s.code,
                                            });
                                        }}
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
                    <AppTooltip
                        title={fmt(
                            openBlockerCount === 1
                                ? t.tasks.diagram.tooltips.openBlockerOne
                                : t.tasks.diagram.tooltips.openBlockerOther,
                            { count: openBlockerCount }
                        )}
                    >
                        <Chip
                            color="warning"
                            size="sm"
                            startDecorator={<BlockRoundedIcon sx={{ fontSize: 12 }} />}
                            variant="soft"
                            sx={{
                                fontSize: "0.65rem",
                                fontWeight: 700,
                                borderRadius: "5px",
                                "--Chip-paddingInline": "6px",
                            }}
                        >
                            {openBlockerCount}
                        </Chip>
                    </AppTooltip>
                )}
                <Box sx={{ flex: 1 }} />
                {isExternal ? (
                    // Ghost cards don't get the "…" menu — instead, a
                    // small "open in preview" hint so the click target
                    // is obvious.
                    <AppTooltip title={t.tasks.diagram.tooltips.openTaskInPreview}>
                        <OpenInNewRoundedIcon
                            sx={{ fontSize: 14, color: P.textMuted, opacity: 0.7 }}
                        />
                    </AppTooltip>
                ) : (
                    // Direct "open task" affordance. Clicking opens the
                    // task as an overlay modal ABOVE the diagram — the
                    // graph stays open behind it (the canvas wires both
                    // this and the ghost-card click into `onOpenPreview`).
                    <AppTooltip title={t.tasks.diagram.tooltips.openTask}>
                        <IconButton
                            size="sm"
                            variant="plain"
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
                            onClick={onOpenPreview}
                        >
                            <LaunchRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                    </AppTooltip>
                )}
            </Stack>

            {/* Title — double-click to edit (disabled for ghosts) */}
            {editing && !isExternal ? (
                <Input
                    size="sm"
                    sx={{ mb: 0.75, fontWeight: 600 }}
                    value={draftTitle}
                    autoFocus
                    onBlur={commitTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") commitTitle();
                        if (e.key === "Escape") {
                            setEditing(false);
                            setDraftTitle(task.title ?? "");
                        }
                    }}
                />
            ) : (
                <AppTooltip
                    disableHoverListener={isExternal}
                    enterDelay={500}
                    title={isExternal ? "" : t.tasks.diagram.tooltips.doubleClickToRename}
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
                </AppTooltip>
            )}

            {/* Schedule row — dates + duration + relative status. The
                triple-pill row is the diagram's key scheduling cue and
                deliberately reads compact-but-complete. */}
            <Stack
                alignItems="center"
                direction="row"
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
                        <AppTooltip
                            disableHoverListener={!editable}
                            enterDelay={500}
                            title={editable ? t.tasks.diagram.tooltips.clickToEditDates : ""}
                        >
                            <Typography
                                level="body-xs"
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
                                onClick={editable ? openDateEditor : undefined}
                            >
                                {labelText}
                            </Typography>
                        </AppTooltip>
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
                        startDecorator={<ScheduleRoundedIcon sx={{ fontSize: 11 }} />}
                        variant="soft"
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
            <Stack alignItems="center" direction="row" spacing={0.75}>
                {!isExternal && task.assigneeId && (
                    // Avatar instead of name text — packs more identity
                    // into the same horizontal space and matches the
                    // affordance used everywhere else in the app
                    // (comments, table cells, modals). Tooltip with the
                    // name covers the "who is this?" case.
                    <AppTooltip enterDelay={400} title={task.assigneeName ?? ""}>
                        <Box sx={{ display: "inline-flex" }}>
                            <UserAvatar
                                showNameAndEmail={false}
                                showPulseDot={false}
                                size={22}
                                userId={task.assigneeId}
                            />
                        </Box>
                    </AppTooltip>
                )}
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
                            // `flex: 1` claims the remaining row width
                            // so the project name can use it all before
                            // ellipsising. Previously a sibling
                            // `<Box flex:1>` spacer existed alongside
                            // this one — two flex:1 elements split the
                            // space and truncated the name long before
                            // it had to.
                            flex: 1,
                            minWidth: 0,
                            textAlign: "right",
                            pr: 0.5,
                        }}
                    >
                        {projectName}
                    </Typography>
                )}
                {!projectName && <Box sx={{ flex: 1 }} />}
                {!isExternal && (
                    <AppTooltip title={t.tasks.diagram.tooltips.addSubTask}>
                        <IconButton
                            size="sm"
                            variant="plain"
                            sx={{
                                "--IconButton-size": "24px",
                                color: P.accentSoft,
                                opacity: 0.8,
                                borderRadius: "6px",
                                "&:hover": { opacity: 1, background: P.hoverBg },
                            }}
                            onClick={() => void onAddSubtask()}
                        >
                            <AddRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </AppTooltip>
                )}
            </Stack>

            {/* Inline date editor modal — opens above the diagram so
                the user can adjust start/due without leaving the
                canvas. Empty inputs flow as `null`, so the user can
                clear a date by blanking the field. Plain Stack layout
                instead of Joy's DialogTitle/DialogContent: those
                wrappers ship their own padding/typography that fought
                with the compact look we want here.
                zIndex: Joy's default modal z (~1300) would put this
                BEHIND the enclosing diagram dialog — the editor
                "opened" but was invisible. Diagram z + 1 matches the
                status Menu above, which solved the same stacking
                problem the same way. */}
            <Modal
                open={dateEditorOpen}
                sx={{ zIndex: popupZIndex }}
                onClose={() => setDateEditorOpen(false)}
            >
                <ModalDialog
                    className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
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
                        alignItems="center"
                        direction="row"
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
                                sx={{
                                    "& input::-webkit-calendar-picker-indicator": {
                                        filter: isDark ? "invert()" : "none",
                                        cursor: "pointer",
                                    },
                                }}
                                onChange={(e) => setDraftStart(e.target.value)}
                            />
                        </FormControl>
                        <FormControl size="sm">
                            <FormLabel sx={{ color: P.textMuted, fontWeight: 600 }}>
                                Due date
                            </FormLabel>
                            <Input
                                type="date"
                                value={draftDue}
                                sx={{
                                    "& input::-webkit-calendar-picker-indicator": {
                                        filter: isDark ? "invert()" : "none",
                                        cursor: "pointer",
                                    },
                                }}
                                onChange={(e) => setDraftDue(e.target.value)}
                            />
                        </FormControl>
                    </Stack>
                    <Stack
                        direction="row"
                        justifyContent="flex-end"
                        spacing={1}
                        sx={{
                            px: 2,
                            py: 1.25,
                            borderTop: `1px solid ${P.border}`,
                            background: P.surface,
                        }}
                    >
                        <Button
                            color="neutral"
                            size="sm"
                            variant="plain"
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
