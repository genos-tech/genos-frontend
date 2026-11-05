import React from "react";
import { Droppable } from "@hello-pangea/dnd";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import { useColorScheme } from "@mui/joy/styles";
import Typography from "@mui/joy/Typography";
import { alpha } from "@mui/system";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { TaskTableProps } from "../../../../types/tasks";
import { Milestone } from "../../sprint-milestone/types";
import { SprintBoardCard } from "./SprintBoardCard";
import { BOARD_DRAGGING_ATTR } from "./useBoardDragScrollLock";

// Column configuration. `title` is an English fallback for code paths
// that haven't been i18n'd yet; the rendered string is resolved via
// `t.tasks.board[titleKey]`.
export type ColumnConfig = {
    id: string;
    title: string;
    titleKey: keyof (typeof import("../../../../i18n/locales/en/tasks").tasks)["board"];
    status: string;
    color: string;
    bgColor: string;
    icon?: React.ReactNode;
};

// Narrowest a column may get before the BOARD scrolls horizontally
// instead of squeezing the columns (see SprintBoard's grid template).
// Sized so a card keeps its full layout — 2-line title, priority chip,
// tag row, and the assignee + due-date footer all on one line each.
export const COLUMN_MIN_WIDTH = 280;

// Style helpers
//
// NOTE on scrolling (MIP-900): each column scrolls its OWN cards, under a
// header that stays put, and the board scrolls only sideways. That is two
// nested scroll containers, which @hello-pangea/dnd refuses (a Droppable
// gets exactly one scroll parent), so mid-drag it would not scroll the
// board sideways and the columns past the edge could not take a drop (the
// MIP-674 problem). So the board flips `data-sprint-board-dragging` for
// the length of a drag (`useBoardDragScrollLock`) and the card list drops
// to `overflow: hidden` while it is set. dnd reads the scroll parent when
// the drag starts, so during it the board is the only scroller; scroll
// positions survive the flip.
//
// The Droppable itself is the scroller. Wrapping it in a scrolling div (so
// the Droppable is as tall as its cards) looks equivalent, but dnd then
// drops the card with no destination whenever the target column is already
// scrolled (checked in headless Chrome).
const getColumnStyles = (mode: "light" | "dark" | undefined): React.CSSProperties => ({
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    // The column is exactly as tall as the board (one grid row); the card
    // list inside is what scrolls. Clipping here also keeps the rounded
    // corners on the header and the card list.
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: mode === "dark" ? "#16161e" : "#ffffff",
    borderRadius: 10,
    boxShadow: mode === "dark" ? "0 2px 8px rgba(0, 0, 0, 0.3)" : "0 2px 8px rgba(0, 0, 0, 0.06)",
});

const getColumnHeaderStyles = (
    color: string,
    mode: "light" | "dark" | undefined
): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    flexShrink: 0,
    // Opaque: the former rgba overlays pre-composited onto the column
    // background above (#16161e + 2% white, #ffffff + 1% black).
    backgroundColor: mode === "dark" ? "#1b1b22" : "#fcfcfc",
    borderBottom:
        mode === "dark" ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(0, 0, 0, 0.05)",
    // The column's status accent.
    borderTop: `3px solid ${color}`,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
});

type SprintBoardColumnProps = {
    column: ColumnConfig;
    tasks: TaskTableProps[];
    myself: UserProps;
    teamMemberProfiles: Record<string, UserProps>;
    onTaskClick?: (task: TaskTableProps) => void;
    // Opens the board-level task-graph modal anchored on the clicked
    // card. Must be identity-stable in the parent (SprintBoardCard is
    // React.memo with shallow equality).
    onOpenDiagram?: (task: TaskTableProps) => void;
    // Selection state passed in from the parent so milestone backing
    // rows can light up against `currentPreviewMilestoneId` while
    // regular rows light up against `currentPreviewTaskId`.
    selectedTaskId?: number;
    selectedMilestoneId?: number | null;
    isMilestonePreviewActive?: boolean;
    // Shows a "+" in the header (the Open column only) that calls this.
    onQuickAddClick?: () => void;
    // Rendered between the header and the card list, outside the Droppable:
    // the quick-add card, which takes no drag index and stays in view while
    // the list scrolls.
    quickAddSlot?: React.ReactNode;
    // Milestone cards draw the same body as My Tasks' "Assigned Milestones"
    // card (MIP-1048), which needs the Milestone record (progress, tags,
    // assignees) and the sprint's name. Both maps must be identity-stable in
    // the parent: the column and its cards are React.memo.
    milestonesByTaskId?: ReadonlyMap<number, Milestone>;
    sprintNameById?: ReadonlyMap<number, string>;
};

const SprintBoardColumnImpl = ({
    column,
    tasks,
    myself,
    teamMemberProfiles,
    onTaskClick,
    onOpenDiagram,
    selectedTaskId,
    selectedMilestoneId,
    isMilestonePreviewActive,
    onQuickAddClick,
    quickAddSlot,
    milestonesByTaskId,
    sprintNameById,
}: SprintBoardColumnProps) => {
    const { mode: colorMode } = useColorScheme();
    const mode: "light" | "dark" | undefined =
        colorMode === "light" || colorMode === "dark" ? colorMode : undefined;
    const isDark = mode === "dark";
    const { t } = useTranslation();
    const columnTitle = t.tasks.board[column.titleKey];

    return (
        <div style={getColumnStyles(mode)}>
            {/* Column Header — outside the scrolling card list, so it stays put. */}
            <div style={getColumnHeaderStyles(column.color, mode)}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Typography
                        level="title-sm"
                        sx={{
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.8px",
                            fontSize: "0.7rem",
                            color: column.color,
                        }}
                    >
                        {columnTitle}
                    </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    {onQuickAddClick && (
                        <AppTooltip title={t.tasks.board.quickAddTooltip}>
                            <IconButton
                                aria-label={t.tasks.board.quickAddTooltip}
                                size="sm"
                                variant="plain"
                                // 20px, the count badge's height, so the Open
                                // column's header isn't taller than the rest.
                                sx={{
                                    "--IconButton-size": "20px",
                                    minHeight: 20,
                                    color: column.color,
                                }}
                                onClick={onQuickAddClick}
                            >
                                <AddRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </AppTooltip>
                    )}
                    <span
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minWidth: 22,
                            height: 20,
                            padding: "0 6px",
                            borderRadius: 10,
                            fontWeight: 700,
                            fontSize: "0.65rem",
                            backgroundColor: column.color,
                            color: "#fff",
                        }}
                    >
                        {tasks.length}
                    </span>
                </Box>
            </div>

            {quickAddSlot}

            {/* Droppable Area — also the column's scrolling card list. */}
            <Droppable
                direction="vertical"
                droppableId={column.id}
                ignoreContainerClipping={false}
                isCombineEnabled={false}
                isDropDisabled={false}
            >
                {(provided, snapshot) => {
                    const isOver = snapshot.isDraggingOver;
                    // Animations derive from `column.color` so each
                    // column glows in its own identity (blue Open,
                    // orange WIP, etc.) instead of a generic purple.
                    // `alpha()` is the same helper used by the task
                    // row pulse for consistency.
                    const accent = column.color;
                    const pulseBgLow = alpha(accent, isDark ? 0.08 : 0.05);
                    const pulseBgHigh = alpha(accent, isDark ? 0.22 : 0.16);
                    const pulseShadowLow = `inset 0 0 0 2px ${alpha(
                        accent,
                        0.55
                    )}, 0 0 8px ${alpha(accent, 0.2)}`;
                    const pulseShadowHigh = `inset 0 0 0 2px ${accent}, 0 0 26px ${alpha(
                        accent,
                        0.55
                    )}, 0 0 12px ${alpha(accent, 0.4)}`;
                    const shimmerGradient = `linear-gradient(90deg, transparent 0%, transparent 35%, ${alpha(
                        accent,
                        isDark ? 0.4 : 0.32
                    )} 50%, transparent 65%, transparent 100%)`;
                    return (
                        <Box
                            ref={provided.innerRef}
                            className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                            {...provided.droppableProps}
                            sx={{
                                position: "relative",
                                // The column's scroller. `flex: 1` keeps the
                                // drop target filling the column when the
                                // cards don't reach the bottom, so dropping
                                // into empty space below the last card still
                                // registers. `scrollbarGutter` keeps the
                                // cards' width the same when scrolling is
                                // switched off during a drag.
                                flex: 1,
                                padding: 1,
                                minHeight: 100,
                                overflowX: "hidden",
                                overflowY: "auto",
                                scrollbarGutter: "stable",
                                [`[${BOARD_DRAGGING_ATTR}="true"] &`]: { overflowY: "hidden" },
                                transition: "background-color 150ms ease",
                                ...(isOver && {
                                    animation: "sprintColumnPulse 1.1s ease-in-out infinite",
                                    "@keyframes sprintColumnPulse": {
                                        "0%, 100%": {
                                            backgroundColor: pulseBgLow,
                                            boxShadow: pulseShadowLow,
                                        },
                                        "50%": {
                                            backgroundColor: pulseBgHigh,
                                            boxShadow: pulseShadowHigh,
                                        },
                                    },
                                    // Shimmer sweep across the column —
                                    // mirrors the task-row "Drop to nest"
                                    // cue so the gesture vocabulary
                                    // stays consistent across surfaces.
                                    "&::after": {
                                        content: '""',
                                        position: "absolute",
                                        inset: 0,
                                        background: shimmerGradient,
                                        backgroundSize: "200% 100%",
                                        pointerEvents: "none",
                                        animation: "sprintColumnSweep 1.6s linear infinite",
                                        zIndex: 1,
                                    },
                                    "@keyframes sprintColumnSweep": {
                                        "0%": { backgroundPosition: "200% 0" },
                                        "100%": { backgroundPosition: "-100% 0" },
                                    },
                                }),
                            }}
                        >
                            {tasks.length === 0 ? (
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flex: 1,
                                        minHeight: 120,
                                        border: isOver
                                            ? `2px dashed ${accent}`
                                            : mode === "dark"
                                              ? "1px dashed rgba(255, 255, 255, 0.08)"
                                              : "1px dashed rgba(0, 0, 0, 0.08)",
                                        borderRadius: 6,
                                        color: isOver ? accent : mode === "dark" ? "#555" : "#aaa",
                                        backgroundColor: isOver
                                            ? alpha(accent, 0.08)
                                            : mode === "dark"
                                              ? "rgba(255, 255, 255, 0.01)"
                                              : "rgba(0, 0, 0, 0.01)",
                                        transform: isOver ? "scale(1.02)" : "scale(1)",
                                        transition:
                                            "border 150ms ease, color 150ms ease, background-color 150ms ease, transform 150ms ease",
                                        position: "relative",
                                        zIndex: 2,
                                    }}
                                >
                                    <Typography
                                        level="body-xs"
                                        sx={{
                                            fontSize: "0.7rem",
                                            fontWeight: isOver ? 700 : 500,
                                            letterSpacing: isOver ? "0.04em" : "normal",
                                            textTransform: isOver ? "uppercase" : "none",
                                            color: "inherit",
                                            transition:
                                                "font-weight 150ms ease, letter-spacing 150ms ease",
                                        }}
                                    >
                                        {isOver
                                            ? fmt(t.tasks.board.dropToColumn, {
                                                  title: columnTitle,
                                              })
                                            : t.tasks.board.dropTasksHere}
                                    </Typography>
                                </Box>
                            ) : (
                                tasks.map((task, index) => {
                                    // For a milestone backing row, the
                                    // matching preview is keyed off the
                                    // milestone id, not the backing task's
                                    // id, since the click handler routes
                                    // through `setCurrentPreviewMilestoneId`.
                                    const isMilestoneRow = task.isMilestone === true;
                                    const isSelected = isMilestoneRow
                                        ? !!isMilestonePreviewActive &&
                                          selectedMilestoneId != null &&
                                          task.milestoneId === selectedMilestoneId
                                        : selectedTaskId === Number(task.id);
                                    // Looked up by the row's own id (the milestone's
                                    // backing task), not by `milestoneId`.
                                    const milestone = isMilestoneRow
                                        ? milestonesByTaskId?.get(Number(task.id))
                                        : undefined;
                                    return (
                                        <SprintBoardCard
                                            key={task.id}
                                            index={index}
                                            isSelected={isSelected}
                                            milestone={milestone}
                                            myself={myself}
                                            task={task}
                                            teamMemberProfiles={teamMemberProfiles}
                                            sprintName={
                                                milestone?.sprintId != null
                                                    ? (sprintNameById?.get(milestone.sprintId) ??
                                                      null)
                                                    : null
                                            }
                                            onOpenDiagram={onOpenDiagram}
                                            onTaskClick={onTaskClick}
                                        />
                                    );
                                })
                            )}
                            {provided.placeholder}
                        </Box>
                    );
                }}
            </Droppable>
        </div>
    );
};

// Memoized export. Column re-renders are dominated by drag/drop activity
// elsewhere on the board; with React.memo + a stable onTaskClick (see
// SprintBoard.handleTaskClick), idle columns no longer commit on every
// parent state churn (`useTM.allTasks`, theme toggles, filter changes).
export const SprintBoardColumn = React.memo(SprintBoardColumnImpl);
