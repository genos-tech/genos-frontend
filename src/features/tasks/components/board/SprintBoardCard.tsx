import React from "react";
import { Draggable } from "@hello-pangea/dnd";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import { useColorScheme } from "@mui/joy/styles";
import Typography from "@mui/joy/Typography";
import MuiChip from "@mui/material/Chip";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useResolvedUserName } from "../../../../components/ui/avatars/AvatarContext";
import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { TagListProps, TaskTableProps } from "../../../../types/tasks";
import { projectTagChipSx } from "../../utils/tagChipStyle";
import { CopyableTaskIdText } from "../CopyableTaskId";

// Priority colors
const priorityColors: Record<string, { bg: string; text: string }> = {
    Critical: { bg: "#dc2626", text: "#fff" },
    High: { bg: "#ea580c", text: "#fff" },
    Medium: { bg: "#ca8a04", text: "#fff" },
    Low: { bg: "#16a34a", text: "#fff" },
};

// Style helpers
const getCardStyles = (
    isDragging: boolean,
    isHovered: boolean,
    isSelected: boolean,
    mode: "light" | "dark" | undefined
): React.CSSProperties => ({
    backgroundColor: isDragging
        ? mode === "dark"
            ? "#2a3a5a"
            : "#f3e8ff"
        : isSelected
          ? mode === "dark"
              ? "#2e1065"
              : "#f3e8ff"
          : mode === "dark"
            ? "#1a1a24"
            : "#ffffff",
    borderRadius: 6,
    padding: "10px 12px",
    marginBottom: 6,
    boxShadow: isDragging
        ? mode === "dark"
            ? "0 12px 28px rgba(0, 0, 0, 0.6)"
            : "0 12px 28px rgba(0, 0, 0, 0.18)"
        : isSelected
          ? mode === "dark"
              ? "0 0 0 2px rgba(167,139,250,0.5), 0 4px 12px rgba(0, 0, 0, 0.3)"
              : "0 0 0 2px rgba(124,58,237,0.4), 0 4px 12px rgba(0, 0, 0, 0.1)"
          : isHovered
            ? mode === "dark"
                ? "0 4px 12px rgba(0, 0, 0, 0.4)"
                : "0 4px 12px rgba(0, 0, 0, 0.1)"
            : mode === "dark"
              ? "0 1px 2px rgba(0, 0, 0, 0.2)"
              : "0 1px 2px rgba(0, 0, 0, 0.05)",
    border: isDragging
        ? mode === "dark"
            ? "1px solid rgba(167,139,250,0.3)"
            : "1px solid rgba(124,58,237,0.3)"
        : isSelected
          ? mode === "dark"
              ? "1px solid rgba(167,139,250,0.4)"
              : "1px solid rgba(124,58,237,0.3)"
          : mode === "dark"
            ? "1px solid rgba(255, 255, 255, 0.05)"
            : "1px solid rgba(0, 0, 0, 0.04)",
    cursor: "pointer",
    transition: isDragging ? "none" : "all 0.15s ease",
    transform: isHovered && !isDragging ? "translateY(-1px)" : "none",
});

type SprintBoardCardProps = {
    task: TaskTableProps;
    index: number;
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
};

const SprintBoardCardImpl = ({
    task,
    index,
    myself,
    teamMemberProfiles,
    onTaskClick,
    onOpenDiagram,
    isSelected = false,
}: SprintBoardCardProps) => {
    const { mode: colorMode } = useColorScheme();
    const mode: "light" | "dark" | undefined =
        colorMode === "light" || colorMode === "dark" ? colorMode : undefined;
    const { t } = useTranslation();
    // Live-resolve the assignee's name so a rename shows here instead of the
    // `assigneeName` cached on the task row.
    const assigneeName = useResolvedUserName(task.assigneeId, task.assigneeName || "");

    const [isHovered, setIsHovered] = React.useState(false);

    const getDaysLeftColor = (daysLeft: number | null) => {
        if (daysLeft === null) return mode === "dark" ? "#888" : "#666";
        if (daysLeft < 0) return "#ef4444";
        if (daysLeft === 0) return "#f59e0b";
        if (daysLeft <= 3) return "#eab308";
        return mode === "dark" ? "#888" : "#666";
    };

    const formatDaysLeft = (daysLeft: number | null) => {
        // Treat any falsy due date as "no schedule" so a row whose
        // due date was just cleared doesn't briefly claim "Expired"
        // off a stale negative `daysLeft` cached on the task model.
        if (!task.dueDate || daysLeft === null) return t.tasks.board.noDueDate;
        if (daysLeft < 0) return t.tasks.board.expired;
        if (daysLeft === 0) return t.tasks.board.dueToday;
        return fmt(t.tasks.board.daysLeft, { count: daysLeft });
    };

    const priorityStyle = task.priority ? priorityColors[task.priority] : null;

    return (
        <Draggable draggableId={task.id?.toString() || ""} index={index} isDragDisabled={false}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={{
                        ...getCardStyles(snapshot.isDragging, isHovered, isSelected, mode),
                        ...provided.draggableProps.style,
                    }}
                    onClick={() => onTaskClick?.(task)}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    {/* Header: ID + Priority */}
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            mb: 0.75,
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            {task.isMilestone === true && (
                                // Visual marker so milestone backing
                                // cards are distinguishable from regular
                                // task cards. Same icon + color as
                                // MilestonesListItem.tsx:155 for a
                                // consistent milestone vocabulary
                                // across the sidebar and the board.
                                <FlagRoundedIcon
                                    sx={{
                                        fontSize: 12,
                                        color: "#f97316",
                                        flexShrink: 0,
                                    }}
                                />
                            )}
                            <CopyableTaskIdText
                                level="body-xs"
                                task={task}
                                sx={{
                                    color: mode === "dark" ? "#6b9fd4" : "#5a8ac7",
                                    fontWeight: 600,
                                    fontFamily: "'SF Mono', 'Monaco', 'Consolas', monospace",
                                    fontSize: "0.65rem",
                                }}
                            />
                        </Box>
                        {/* Top-right cluster: priority + open-graph trigger. */}
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            {priorityStyle && (
                                <span
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        padding: "0 6px",
                                        borderRadius: 4,
                                        backgroundColor: priorityStyle.bg,
                                        color: priorityStyle.text,
                                        fontSize: "0.55rem",
                                        height: 16,
                                        fontWeight: 700,
                                        letterSpacing: "0.3px",
                                        textTransform: "uppercase",
                                    }}
                                >
                                    {task.priority}
                                </span>
                            )}
                            {/* Open the task graph anchored on this card.
                                Root cards only (see the prop doc) — same
                                icon + tooltip as the preview header's
                                trigger. ALWAYS visible (no hover reveal,
                                per request); the card's own onClick opens
                                the preview, hence the stopPropagation. */}
                            {onOpenDiagram && task.parentTaskId == null && (
                                <AppTooltip title={t.tasks.tooltips.openTaskGraph}>
                                    <IconButton
                                        aria-label={t.tasks.tooltips.openTaskGraph}
                                        size="sm"
                                        variant="plain"
                                        sx={{
                                            "--IconButton-size": "18px",
                                            minWidth: 18,
                                            minHeight: 18,
                                            p: 0,
                                            borderRadius: "4px",
                                            color: mode === "dark" ? "#a78bfa" : "#7c3aed",
                                            opacity: 0.75,
                                            "&:hover": {
                                                opacity: 1,
                                                backgroundColor:
                                                    mode === "dark"
                                                        ? "rgba(167,139,250,0.15)"
                                                        : "rgba(124,58,237,0.1)",
                                            },
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenDiagram(task);
                                        }}
                                    >
                                        <AccountTreeRoundedIcon sx={{ fontSize: 13 }} />
                                    </IconButton>
                                </AppTooltip>
                            )}
                        </Box>
                    </Box>

                    {/* Title */}
                    <Typography
                        level="body-sm"
                        sx={{
                            fontWeight: 500,
                            mb: 0.75,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            lineHeight: 1.35,
                            fontSize: "0.9rem",
                            color: mode === "dark" ? "#e8e8e8" : "#1a1a1a",
                        }}
                    >
                        {task.title}
                    </Typography>

                    {/* Tags */}
                    {task.tags && task.tags.length > 0 && (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
                            {task.tags.slice(0, 3).map((tag: TagListProps, idx: number) => (
                                <MuiChip
                                    key={idx}
                                    label={tag.tagName}
                                    size="small"
                                    variant="outlined"
                                    sx={projectTagChipSx(tag.tagColor, mode === "dark")}
                                />
                            ))}
                            {task.tags.length > 3 && (
                                <Typography
                                    level="body-xs"
                                    sx={{ color: mode === "dark" ? "#888" : "#666" }}
                                >
                                    +{task.tags.length - 3}
                                </Typography>
                            )}
                        </Box>
                    )}

                    {/* Footer: Assignee + Due date */}
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            mt: 0.75,
                            pt: 0.75,
                            borderTop:
                                mode === "dark"
                                    ? "1px solid rgba(255, 255, 255, 0.04)"
                                    : "1px solid rgba(0, 0, 0, 0.04)",
                        }}
                    >
                        {/* Assignee — UserAvatar pulls the freshest avatar
                            URL and online status from AvatarContext for
                            assigned tasks. The Joy <Avatar> fallback below
                            is the unassigned "?" placeholder; we don't
                            want UserAvatar's "?" + missing-profile path
                            for that case because the card-border styling
                            is part of the placeholder's visual identity. */}
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            {task.assigneeId ? (
                                <UserAvatar
                                    clickable={false}
                                    showPulseDot={false}
                                    size={20}
                                    userId={task.assigneeId}
                                />
                            ) : (
                                <Avatar
                                    size="sm"
                                    sx={{
                                        width: 20,
                                        height: 20,
                                        fontSize: "0.6rem",
                                        border:
                                            mode === "dark"
                                                ? "1.5px solid rgba(255, 255, 255, 0.1)"
                                                : "1.5px solid rgba(0, 0, 0, 0.08)",
                                    }}
                                >
                                    ?
                                </Avatar>
                            )}
                            <Typography
                                level="body-xs"
                                sx={{
                                    color: mode === "dark" ? "#999" : "#777",
                                    maxWidth: 70,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    fontSize: "0.65rem",
                                }}
                            >
                                {assigneeName || t.tasks.board.unassigned}
                            </Typography>
                        </Box>

                        {/* Due date — hidden for Closed tasks since
                            the work is done and there's no remaining
                            deadline to signal. Other statuses (Open /
                            WIP / Pending) still show the chip; Pending
                            cards keep it because a paused task can
                            still have a real due date the user wants
                            to see. */}
                        {task.status !== "Closed" && (
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.25,
                                    color: getDaysLeftColor(task.daysLeft),
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    backgroundColor:
                                        task.daysLeft !== null && task.daysLeft <= 0
                                            ? mode === "dark"
                                                ? "rgba(239, 68, 68, 0.15)"
                                                : "rgba(239, 68, 68, 0.1)"
                                            : "transparent",
                                }}
                            >
                                <AccessTimeIcon sx={{ fontSize: 11 }} />
                                <Typography
                                    level="body-xs"
                                    sx={{ fontWeight: 600, fontSize: "0.6rem" }}
                                >
                                    {formatDaysLeft(task.daysLeft)}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </div>
            )}
        </Draggable>
    );
};

// Memoized export. Every prop is either a primitive or a value already
// memoized upstream (`teamMemberProfiles` is a state object whose identity
// only changes when team membership churns; `onTaskClick` should be wrapped
// in `useCallback` in the parent — see SprintBoard.handleTaskClick). The
// card body reads ZERO state-manager values, so default shallow equality
// is safe: there are no captured-at-render-time reads that would go stale
// when memo skips a render.
export const SprintBoardCard = React.memo(SprintBoardCardImpl);
