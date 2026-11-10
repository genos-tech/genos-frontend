import { memo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Box, Dropdown, MenuButton } from "@mui/joy";
import { NodeProps } from "@xyflow/react";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { Clickable } from "../../../../components/ui/Clickable";
import { InlineTitleEdit } from "../../../../components/ui/fields/InlineTitleEdit";
import { MenuRow, MenuSurface } from "../../../../components/ui/MoreMenu";
import { fmt, useTranslation } from "../../../../i18n";
import { g, type } from "../../../../theme/tokens";
import {
    AssigneeAvatar,
    DueText,
    TaskCardFrame,
    TaskIdText,
    TaskTitle,
    type CardEmphasis,
} from "../../components/card";
import { PriorityIcon } from "../../components/meta/PriorityIcon";
import { StatusLabel } from "../../components/meta/StatusLabel";
import { isDeletingStatus } from "../../utils/deletedStatus";
import { statuses } from "../../utils/taskMeta";
import { useDiagramZIndex } from "../diagramZIndex";
import { TaskNodeData } from "../types";
import { NODE_WIDTH } from "../utils/layoutDiagram";
import { getScheduleStatus } from "../utils/scheduleStatus";
import {
    BlockerCount,
    DurationText,
    NodeBadge,
    NodeDateEditor,
    NodeHandles,
    NodeIconButton,
} from "./nodeParts";
import { dueToneOf, NODE_TITLE_MIN_HEIGHT, scheduleDateText, useScheduleLabel } from "./nodeTone";

/**
 * One task as a node of the graph (MIP-1124 3/3): the family's card surface and
 * parts, plus what a node adds (handles, an inline title, a date editor, a status
 * menu). It takes the node's `data` only, so it renders without React Flow
 * (the reference page and the tests); `withHandles` is what `TaskNodeCard` turns
 * on inside the canvas, where the handles have a node to belong to.
 *
 * The graph's highlights are the frame's typed states, resolved here in the
 * order they always had: the card the preview came from, then a card just added,
 * then a card assigned to the viewer; a ghost (or a dimmed card) is plain.
 * Status is the table's icon and word, priority its icon: no tinted border or
 * glow per status.
 */
export const TaskNodeView = ({
    data,
    withHandles = false,
}: {
    data: TaskNodeData;
    withHandles?: boolean;
}) => {
    const { t } = useTranslation();
    // Popups (status menu, date editor) must stack ABOVE the enclosing diagram
    // dialog, whose z varies by host surface (diagramZIndex.ts). The default
    // context (9999) keeps the historical 10000 for page-hosted diagrams.
    const popupZIndex = useDiagramZIndex() + 1;

    const {
        task,
        isRoot,
        isCurrentPreview,
        isNewlyCreated,
        isInLineage,
        isAssignedToViewer,
        isExternal: isGhost,
        isDimmed,
        openBlockerCount,
        projectName,
        onChange,
        onAddSubtask,
        onDelete,
        onOpenPreview,
    } = data;

    // Everything below reads `isExternal` to mean "render as a read-only,
    // dimmed card". That's a true ghost (a task outside this tree) OR, only in
    // the dashboard's highlight mode, another member's task (`isDimmed`), which
    // gets the exact ghost treatment so the viewer's own tasks stand out and
    // others' work can't be edited from this view. The two ghost-ONLY bits (the
    // "External" label and hiding the assignee) stay keyed to `isGhost`, so a
    // dimmed card still shows whose task it is and never mislabels itself.
    const isExternal = isGhost || !!isDimmed;

    const [editing, setEditing] = useState(false);
    const [dateEditorOpen, setDateEditorOpen] = useState(false);
    const [statusMenuOpen, setStatusMenuOpen] = useState(false);

    const schedule = getScheduleStatus(task.startDate, task.dueDate, task.status);
    const scheduleLabel = useScheduleLabel(schedule, task.status);

    const emphasis: CardEmphasis | undefined = isInLineage
        ? "lineage"
        : isCurrentPreview
          ? "current"
          : isNewlyCreated
            ? "new"
            : isAssignedToViewer
              ? "assigned"
              : undefined;
    // The schedule tone owns the leading edge (red on overdue) so urgency still
    // pops; a closed or unscheduled task has none.
    const stripe =
        schedule.tone === "red" ? "danger" : schedule.tone === "amber" ? "warning" : undefined;

    const dateText = scheduleDateText(schedule);
    const dateEmpty = dateText == null;
    const dateEditable = !isExternal;

    return (
        <TaskCardFrame
            clickable={false}
            emphasis={emphasis}
            ghost={isExternal}
            prominent={isRoot}
            stripe={stripe}
            width={NODE_WIDTH}
            onClick={isExternal ? () => onOpenPreview() : undefined}
        >
            {withHandles && (
                <NodeHandles
                    dependencyConnectable={!isExternal}
                    dim={isExternal}
                    structureConnectable={!isExternal}
                />
            )}

            {/* Header row */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    minHeight: 22,
                    minWidth: 0,
                }}
            >
                <TaskIdText task={task} />
                {/* Status picker — ghosts stay read-only (their status lives in
                    another tree). For everyone else the status is a dropdown
                    trigger so users can move a task Open → WIP → Closed
                    without opening the preview. */}
                {isExternal ? (
                    <StatusLabel status={task.status} />
                ) : (
                    <Dropdown
                        open={statusMenuOpen}
                        onOpenChange={(_, open) => setStatusMenuOpen(open)}
                    >
                        <MenuButton
                            slots={{ root: "button" }}
                            slotProps={{
                                root: {
                                    // `nodrag nopan nowheel` stops React Flow
                                    // grabbing the gesture before Joy's
                                    // MenuButton can handle it. Stopping
                                    // pointerdown/mousedown is belt-and-
                                    // suspenders because RF listens to pointer
                                    // events too.
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
                                        minWidth: 0,
                                    },
                                },
                            }}
                        >
                            <StatusLabel status={task.status} />
                        </MenuButton>
                        {/* Escape closes the menu and stops there (MenuSurface keeps
                            keys from reaching the graph dialog it is rendered in). */}
                        <MenuSurface placement="bottom-start" zIndex={popupZIndex}>
                            {statuses.map((s) => (
                                <MenuRow
                                    key={s.status}
                                    selected={s.status === task.status}
                                    onClick={() => {
                                        if (s.status === task.status || s.status == null) return;
                                        // "Deleted" is an Undo toast, not a status write
                                        // (MIP-1303): the canvas hides the card and sends
                                        // the delete when the toast is gone.
                                        if (isDeletingStatus(s.status, task.status)) {
                                            void onDelete();
                                            return;
                                        }
                                        void onChange({ status: s.status, statusCode: s.code });
                                    }}
                                >
                                    <StatusLabel status={s.status} />
                                </MenuRow>
                            ))}
                        </MenuSurface>
                    </Dropdown>
                )}
                {openBlockerCount > 0 && !isExternal && (
                    <BlockerCount
                        count={openBlockerCount}
                        tooltip={fmt(
                            openBlockerCount === 1
                                ? t.tasks.diagram.tooltips.openBlockerOne
                                : t.tasks.diagram.tooltips.openBlockerOther,
                            { count: openBlockerCount }
                        )}
                    />
                )}
                <Box sx={{ flex: 1 }} />
                {isExternal ? (
                    // Ghost cards don't get the "…" menu — a small "open in
                    // preview" hint makes the click target obvious.
                    <AppTooltip title={t.tasks.diagram.tooltips.openTaskInPreview}>
                        <OpenInNewRoundedIcon
                            sx={{
                                fontSize: 14,
                                color: g.text.tertiary,
                                "--Icon-color": g.text.tertiary,
                            }}
                        />
                    </AppTooltip>
                ) : (
                    // Direct "open task" affordance: the task opens as an
                    // overlay ABOVE the diagram, the graph stays open behind it
                    // (the canvas wires this and the ghost-card click into
                    // `onOpenPreview`).
                    <AppTooltip title={t.tasks.diagram.tooltips.openTask}>
                        <Box component="span" sx={{ display: "inline-flex" }}>
                            <NodeIconButton onClick={onOpenPreview}>
                                <LaunchRoundedIcon sx={{ fontSize: 14 }} />
                            </NodeIconButton>
                        </Box>
                    </AppTooltip>
                )}
            </Box>

            {/* Title: double-click or Enter to rename (not for another team's ghost,
                which is plain text). `nodrag nopan` keeps a drag or a pan from starting
                inside the field; InlineTitleEdit keeps Escape from closing the graph. */}
            {isExternal ? (
                <Box sx={{ display: "flex", minHeight: NODE_TITLE_MIN_HEIGHT, cursor: "pointer" }}>
                    <TaskTitle lines={2}>{task.title || t.tasks.diagram.untitled}</TaskTitle>
                </Box>
            ) : (
                <AppTooltip
                    disableHoverListener={editing}
                    enterDelay={500}
                    title={t.tasks.diagram.tooltips.doubleClickToRename}
                >
                    <Box sx={{ display: "flex", minWidth: 0 }}>
                        <InlineTitleEdit
                            activate="doubleClick"
                            ariaLabel={t.tasks.diagram.tooltips.doubleClickToRename}
                            className="nodrag nopan"
                            editing={editing}
                            inputSx={{ fontWeight: 500 }}
                            level="body-sm"
                            value={task.title ?? ""}
                            renderValue={(value) => (
                                <TaskTitle lines={2}>
                                    {value || t.tasks.diagram.untitled}
                                </TaskTitle>
                            )}
                            sx={{
                                display: "flex",
                                flex: 1,
                                minHeight: NODE_TITLE_MIN_HEIGHT,
                                alignItems: "flex-start",
                                whiteSpace: "normal",
                            }}
                            onCommit={(next) => void onChange({ title: next })}
                            onEditingChange={setEditing}
                        />
                    </Box>
                </AppTooltip>
            )}

            {/* Schedule row — dates, duration and the relative due words. It is
                the diagram's key scheduling cue, so it stays on the card. */}
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
                {/* Date label — clickable on non-external nodes so the user can
                    edit start/due directly. Hover/focus give a subtle hint
                    without a separate icon button. */}
                <AppTooltip
                    disableHoverListener={!dateEditable}
                    enterDelay={500}
                    title={dateEditable ? t.tasks.diagram.tooltips.clickToEditDates : ""}
                >
                    <Clickable
                        as="span"
                        data-testid="node-dates"
                        sx={{
                            ...type("body-xs"),
                            fontWeight: 500,
                            color: dateEmpty ? g.text.tertiary : g.text.primary,
                            cursor: dateEditable ? "pointer" : "default",
                            borderRadius: g.radius.xs,
                            px: 0.5,
                            mx: -0.5,
                            transition: `background ${g.motion.fast}, color ${g.motion.fast}`,
                            "&:hover": dateEditable
                                ? { background: g.hover, color: g.accent.text }
                                : undefined,
                        }}
                        onActivate={dateEditable ? () => setDateEditorOpen(true) : undefined}
                    >
                        {dateEmpty ? t.tasks.diagram.setDates : dateText}
                    </Clickable>
                </AppTooltip>
                {schedule.durationDays != null && (
                    <DurationText>
                        {fmt(t.tasks.diagram.durationDays, { count: schedule.durationDays })}
                    </DurationText>
                )}
                {scheduleLabel && (
                    <DueText text={scheduleLabel} tone={dueToneOf(schedule.tone)} icon />
                )}
            </Box>

            {/* Footer row */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                {/* Show the assignee on internal cards, including dimmed
                    other-member cards, so the viewer can see WHOSE task it is.
                    Only true ghosts (isGhost) hide it (they carry the
                    "External" label instead). The name is in the tooltip. */}
                {!isGhost && task.assigneeId && (
                    <AppTooltip enterDelay={400} title={task.assigneeName ?? ""}>
                        <Box sx={{ display: "inline-flex" }}>
                            <AssigneeAvatar
                                name={task.assigneeName}
                                size="xs"
                                userId={task.assigneeId}
                            />
                        </Box>
                    </AppTooltip>
                )}
                {/* "External" only for TRUE ghosts. Dimmed other-member cards
                    fall through to the priority like any internal card:
                    they're not external, just not the viewer's. */}
                {isGhost ? (
                    <NodeBadge>{t.tasks.diagram.external}</NodeBadge>
                ) : (
                    <PriorityIcon priority={task.priority} />
                )}
                {projectName ? (
                    <Box
                        component="span"
                        sx={{
                            ...type("body-xs"),
                            color: g.text.tertiary,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            // `flex: 1` claims the remaining row width so the
                            // project name can use it all before ellipsising.
                            flex: 1,
                            minWidth: 0,
                            textAlign: "end",
                            paddingInlineEnd: "2px",
                        }}
                    >
                        {projectName}
                    </Box>
                ) : (
                    <Box sx={{ flex: 1 }} />
                )}
                {!isExternal && (
                    <AppTooltip title={t.tasks.diagram.tooltips.addSubTask}>
                        <Box component="span" sx={{ display: "inline-flex" }}>
                            <NodeIconButton size={24} onClick={() => void onAddSubtask()}>
                                <AddRoundedIcon sx={{ fontSize: 16 }} />
                            </NodeIconButton>
                        </Box>
                    </AppTooltip>
                )}
            </Box>

            {dateEditorOpen && (
                <NodeDateEditor
                    dueDate={task.dueDate}
                    startDate={task.startDate}
                    zIndex={popupZIndex}
                    onClose={() => setDateEditorOpen(false)}
                    onSave={(patch) => {
                        void onChange(patch);
                        setDateEditorOpen(false);
                    }}
                />
            )}
        </TaskCardFrame>
    );
};

export const TaskNodeCard = memo((props: NodeProps) => (
    <TaskNodeView data={props.data as unknown as TaskNodeData} withHandles />
));

TaskNodeCard.displayName = "TaskNodeCard";
