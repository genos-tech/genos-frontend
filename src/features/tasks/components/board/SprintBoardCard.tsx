import React from "react";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import { useColorScheme } from "@mui/joy/styles";
import Typography from "@mui/joy/Typography";
import { Draggable } from "react-beautiful-dnd";

import { UserProps } from "../../../../types/admin";
import { TagListProps, TaskTableProps } from "../../../../types/tasks";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

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
            : "#e3f2fd"
        : isSelected
          ? mode === "dark"
              ? "#1e3a5f"
              : "#e3f2fd"
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
              ? "0 0 0 2px rgba(144, 202, 249, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3)"
              : "0 0 0 2px rgba(25, 118, 210, 0.4), 0 4px 12px rgba(0, 0, 0, 0.1)"
          : isHovered
            ? mode === "dark"
                ? "0 4px 12px rgba(0, 0, 0, 0.4)"
                : "0 4px 12px rgba(0, 0, 0, 0.1)"
            : mode === "dark"
              ? "0 1px 2px rgba(0, 0, 0, 0.2)"
              : "0 1px 2px rgba(0, 0, 0, 0.05)",
    border: isDragging
        ? mode === "dark"
            ? "1px solid rgba(144, 202, 249, 0.3)"
            : "1px solid rgba(25, 118, 210, 0.3)"
        : isSelected
          ? mode === "dark"
              ? "1px solid rgba(144, 202, 249, 0.4)"
              : "1px solid rgba(25, 118, 210, 0.3)"
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
    onTaskClick?: (taskId: string) => void;
    isSelected?: boolean;
};

export const SprintBoardCard = ({
    task,
    index,
    myself,
    teamMemberProfiles,
    onTaskClick,
    isSelected = false,
}: SprintBoardCardProps) => {
    const { mode: colorMode } = useColorScheme();
    const mode: "light" | "dark" | undefined =
        colorMode === "light" || colorMode === "dark" ? colorMode : undefined;

    const [isHovered, setIsHovered] = React.useState(false);

    const getDaysLeftColor = (daysLeft: number | null) => {
        if (daysLeft === null) return mode === "dark" ? "#888" : "#666";
        if (daysLeft < 0) return "#ef4444";
        if (daysLeft === 0) return "#f59e0b";
        if (daysLeft <= 3) return "#eab308";
        return mode === "dark" ? "#888" : "#666";
    };

    const formatDaysLeft = (daysLeft: number | null) => {
        if (daysLeft === null) return "No due date";
        if (daysLeft < 0) return "Expired";
        if (daysLeft === 0) return "Due today";
        return `${daysLeft}d left`;
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
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={() => onTaskClick?.(task.id || "")}
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
                        <Typography
                            level="body-xs"
                            sx={{
                                color: mode === "dark" ? "#6b9fd4" : "#5a8ac7",
                                fontWeight: 600,
                                fontFamily: "'SF Mono', 'Monaco', 'Consolas', monospace",
                                fontSize: "0.65rem",
                            }}
                        >
                            #{task.id}
                        </Typography>
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
                                <span
                                    key={idx}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        padding: "0 6px",
                                        borderRadius: 8,
                                        backgroundColor: tag.tagColor,
                                        color: tag.tagTextColor,
                                        fontSize: "0.6rem",
                                        height: 16,
                                    }}
                                >
                                    {tag.tagName}
                                </span>
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
                        {/* Assignee */}
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Avatar
                                size="sm"
                                src={
                                    task.assigneeId === myself.userId
                                        ? `${media_url}/${myself.avatarImgPath}`
                                        : task.assigneeImgPath
                                          ? `${media_url}/${task.assigneeImgPath}`
                                          : undefined
                                }
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
                                {task.assigneeName?.[0]?.toUpperCase() || "?"}
                            </Avatar>
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
                                {task.assigneeName || "Unassigned"}
                            </Typography>
                        </Box>

                        {/* Due date */}
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
                    </Box>
                </div>
            )}
        </Draggable>
    );
};
