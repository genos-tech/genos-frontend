import React from "react";
import { Draggable } from "@hello-pangea/dnd";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import { IconButton } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { Clickable } from "../../../../components/ui/Clickable";
import { ROVING_GROUP_ATTR, ROVING_ITEM_ATTR } from "../../../../hooks/common/roving";
import { useTranslation } from "../../../../i18n";
import { focusRing, g } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { TaskTableProps } from "../../../../types/tasks";
import { Milestone } from "../../sprint-milestone/types";
import { TaskCard, TaskCardFrame } from "../card";
import { MilestoneCardBody } from "../MilestoneCardBody";

type SprintBoardCardProps = {
    task: TaskTableProps;
    index: number;
    // The column the card is in: with the task id, the card's place in the board's roving
    // tab stops (one Tab stop per column, MIP-1402; see useRovingNav).
    columnId: string;
    myself: UserProps;
    teamMemberProfiles: Record<string, UserProps>;
    // Pass the whole task so the parent can branch on `isMilestone` and
    // route the click to a milestone preview instead of a regular task
    // preview (mirrors DraggableTaskRow's openPreview behaviour).
    onTaskClick?: (task: TaskTableProps) => void;
    // Opens the board-level task-graph modal anchored on this card.
    // Rendered only on ROOT cards (parentTaskId null — root tasks and
    // milestone backing rows); sub-task cards reach their graph from
    // the root. Must be identity-stable in the parent (this component
    // is React.memo with shallow equality).
    onOpenDiagram?: (task: TaskTableProps) => void;
    isSelected?: boolean;
    // A milestone row's milestone (MIP-1048). With it the card draws the same
    // body as the My Tasks "Assigned Milestones" card; without it (not loaded
    // yet) a milestone row falls back to the plain task layout. Both props
    // must be identity-stable in the parent (this component is React.memo).
    milestone?: Milestone;
    sprintName?: string | null;
};

const SprintBoardCardImpl = ({
    task,
    index,
    columnId,
    onTaskClick,
    onOpenDiagram,
    isSelected = false,
    milestone,
    sprintName = null,
}: SprintBoardCardProps) => {
    const { t } = useTranslation();

    // Open the task graph anchored on this card. Root cards only (see the prop
    // doc) — same icon + tooltip as the preview header's trigger. ALWAYS
    // visible (no hover reveal, per request); the card's own onClick opens the
    // preview, hence the stopPropagation.
    const diagramButton: React.ReactNode =
        onOpenDiagram && task.parentTaskId == null ? (
            <AppTooltip title={t.tasks.tooltips.openTaskGraph}>
                <IconButton
                    aria-label={t.tasks.tooltips.openTaskGraph}
                    size="sm"
                    variant="plain"
                    sx={{
                        "--IconButton-size": "20px",
                        minWidth: 20,
                        minHeight: 20,
                        p: 0,
                        borderRadius: g.radius.xs,
                        color: g.text.tertiary,
                        "&:hover": { color: g.accent.text, backgroundColor: g.hover },
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenDiagram(task);
                    }}
                >
                    <AccountTreeRoundedIcon sx={{ fontSize: 14 }} />
                </IconButton>
            </AppTooltip>
        ) : null;

    // Milestone rows draw the shared milestone body (MIP-1048). The graph
    // button takes the corner the My Tasks card gives to the status chip: the
    // board's column already says the status.
    const showMilestoneBody = task.isMilestone === true && milestone != null;

    return (
        <Draggable draggableId={task.id?.toString() || ""} index={index} isDragDisabled={false}>
            {(provided, snapshot) => (
                // The wrapper owns drag, click and keyboard (the drag handle is
                // the focusable element); the card inside is only a surface.
                // Hover is CSS, so a card re-renders for nothing but its data.
                // Space is the drag handle's (it lifts the card), so only Enter opens.
                <Clickable
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    {...(task.id != null && task.id !== ""
                        ? {
                              [ROVING_GROUP_ATTR]: columnId,
                              [ROVING_ITEM_ATTR]: String(task.id),
                          }
                        : {})}
                    keys={["Enter"]}
                    sx={{
                        mb: 0.75,
                        borderRadius: g.radius.md,
                        cursor: "pointer",
                        "&:focus-visible": focusRing,
                    }}
                    onActivate={() => onTaskClick?.(task)}
                >
                    {showMilestoneBody ? (
                        <TaskCardFrame dragging={snapshot.isDragging} selected={isSelected}>
                            <MilestoneCardBody
                                milestone={milestone}
                                sprintName={sprintName}
                                topRight={diagramButton}
                            />
                        </TaskCardFrame>
                    ) : (
                        <TaskCard
                            dragging={snapshot.isDragging}
                            headerEnd={diagramButton}
                            selected={isSelected}
                            showDue={task.status !== "Closed"}
                            task={task}
                        />
                    )}
                </Clickable>
            )}
        </Draggable>
    );
};

// Memoized export. Every prop is either a primitive or a value already
// memoized upstream (`onTaskClick` should be wrapped in `useCallback` in the
// parent — see SprintBoard.handleTaskClick). The card body reads ZERO
// state-manager values, so default shallow equality is safe: there are no
// captured-at-render-time reads that would go stale when memo skips a render.
export const SprintBoardCard = React.memo(SprintBoardCardImpl);
