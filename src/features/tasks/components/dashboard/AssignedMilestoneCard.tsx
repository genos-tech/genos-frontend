import AccessTimeIcon from "@mui/icons-material/AccessTime";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import { AvatarGroup, Box, LinearProgress, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { fmt, useTranslation } from "../../../../i18n";
import { TagListProps } from "../../../../types/tasks";
import { Milestone } from "../../sprint-milestone/types";
import { taskMetaLabel } from "../../utils/taskMeta";
import { ProjectTagChip } from "../ProjectTagChip";
import { SprintChip } from "../SprintChip";
import { TaskStatusChip } from "../TaskStatusChip";

// Same priority swatch the board card uses (SprintBoardCard.tsx) so a
// milestone's priority chip reads identically across the two surfaces.
const priorityColors: Record<string, { bg: string; text: string }> = {
    Critical: { bg: "#dc2626", text: "#fff" },
    High: { bg: "#ea580c", text: "#fff" },
    Medium: { bg: "#ca8a04", text: "#fff" },
    Low: { bg: "#16a34a", text: "#fff" },
};

// Milestone.tags is a JSONField (`unknown`); narrow it to the shared tag
// shape at the edge, exactly like the task table does.
const asTags = (tags: unknown): TagListProps[] =>
    Array.isArray(tags) ? (tags as TagListProps[]) : [];

// Whole-number days between today and the due date (negative = overdue).
const daysUntil = (due: string | null): number | null => {
    if (!due) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(due);
    d.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - today.getTime()) / 86400000);
};

type Props = {
    milestone: Milestone;
    // Resolved sprint name for this milestone (null → "No Sprint"). Resolved
    // by the parent from the current project's sprints.
    sprintName: string | null;
    // Opens the task graph for this milestone (the parent renders the
    // LazyTaskDiagram and passes the viewer's id as highlightAssigneeId).
    onOpen: (milestone: Milestone) => void;
};

// A standalone milestone summary card for the dashboard's "Assigned
// Milestones" section. It mirrors SprintBoardCard's LOOK but is NOT the
// board card — that one is wrapped in @hello-pangea/dnd's <Draggable> and
// would throw outside a <DragDropContext>. Clicking the card opens the
// milestone's task graph (a hover tooltip signals that).
export const AssignedMilestoneCard = ({ milestone, sprintName, onOpen }: Props) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

    const tags = asTags(milestone.tags);
    const priorityStyle = milestone.priority ? priorityColors[milestone.priority] : null;
    const total = milestone.tasksTotal ?? 0;
    const closed = milestone.tasksClosed ?? 0;
    const pct = total > 0 ? Math.round((closed / total) * 100) : 0;

    const daysLeft = daysUntil(milestone.dueDate);
    const dueColor =
        daysLeft === null
            ? isDark
                ? "#888"
                : "#666"
            : daysLeft < 0
              ? "#ef4444"
              : daysLeft <= 3
                ? "#eab308"
                : isDark
                  ? "#888"
                  : "#666";
    const dueLabel = milestone.dueDate
        ? new Date(milestone.dueDate).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
          })
        : null;

    return (
        <AppTooltip title={t.tasks.dashboard.assignedMilestones.openDiagram}>
            <Box
                role="button"
                tabIndex={0}
                sx={{
                    backgroundColor: isDark ? "#1a1a24" : "#ffffff",
                    borderRadius: "8px",
                    p: 1.25,
                    border:
                        mode === "dark"
                            ? "1px solid rgba(255, 255, 255, 0.06)"
                            : "1px solid rgba(0, 0, 0, 0.06)",
                    boxShadow:
                        mode === "dark"
                            ? "0 1px 2px rgba(0, 0, 0, 0.2)"
                            : "0 1px 2px rgba(0, 0, 0, 0.05)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                    "&:hover": {
                        transform: "translateY(-1px)",
                        boxShadow:
                            mode === "dark"
                                ? "0 4px 12px rgba(0, 0, 0, 0.4)"
                                : "0 4px 12px rgba(0, 0, 0, 0.1)",
                        borderColor: "#f97316",
                    },
                }}
                onClick={() => onOpen(milestone)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpen(milestone);
                    }
                }}
            >
                {/* Header: sprint + flag + id (left) · status (right) */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 0.5,
                        mb: 0.75,
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                        {/* Sprint — left of the milestone id, per request. */}
                        <SprintChip name={sprintName} />
                        <FlagRoundedIcon sx={{ fontSize: 13, color: "#f97316", flexShrink: 0 }} />
                        <Typography
                            level="body-xs"
                            sx={{
                                color: mode === "dark" ? "#6b9fd4" : "#5a8ac7",
                                fontWeight: 600,
                                fontFamily: "'SF Mono', 'Monaco', 'Consolas', monospace",
                                fontSize: "0.65rem",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flexShrink: 0,
                            }}
                        >
                            {milestone.displayId ?? `#${milestone.milestoneId}`}
                        </Typography>
                    </Box>
                    {/* Status — top-right (swapped with priority, per request);
                        same chip as the dashboard's Up Next rows. */}
                    <TaskStatusChip status={milestone.status} />
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
                    {milestone.title}
                </Typography>

                {/* Progress: closed / total sub-tasks */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75 }}>
                    <LinearProgress
                        color={pct === 100 ? "success" : "primary"}
                        size="sm"
                        sx={{ flex: 1, "--LinearProgress-thickness": "6px" }}
                        value={pct}
                        determinate
                    />
                    <Typography
                        level="body-xs"
                        sx={{
                            color: mode === "dark" ? "#999" : "#777",
                            fontSize: "0.6rem",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                        }}
                    >
                        {fmt(t.tasks.dashboard.assignedMilestones.progress, { closed, total })}
                    </Typography>
                </Box>

                {/* Footer: [assignees + tags] (left) · [priority + due] (right) */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 0.5,
                        mt: "auto",
                        pt: 0.75,
                        borderTop:
                            mode === "dark"
                                ? "1px solid rgba(255, 255, 255, 0.04)"
                                : "1px solid rgba(0, 0, 0, 0.04)",
                    }}
                >
                    {/* Assignees + tags — tags sit right next to the avatars,
                        per request. Wraps if the tags are many. */}
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 0.5,
                            minWidth: 0,
                        }}
                    >
                        <AvatarGroup size="sm" sx={{ "--Avatar-size": "20px" }}>
                            {milestone.assignees
                                .slice(0, 4)
                                .map((a, idx) =>
                                    a.userId != null ? (
                                        <UserAvatar
                                            key={String(a.userId)}
                                            clickable={false}
                                            showPulseDot={false}
                                            size={20}
                                            userId={a.userId}
                                        />
                                    ) : (
                                        <Box key={`x-${idx}`} />
                                    )
                                )}
                        </AvatarGroup>
                        {tags.slice(0, 3).map((tag, idx) => (
                            <ProjectTagChip
                                key={idx}
                                isDark={isDark}
                                label={tag.tagName}
                                tagColor={tag.tagColor}
                            />
                        ))}
                        {tags.length > 3 && (
                            <Typography
                                level="body-xs"
                                sx={{ color: mode === "dark" ? "#888" : "#666" }}
                            >
                                +{tags.length - 3}
                            </Typography>
                        )}
                    </Box>

                    {/* Priority (moved to bottom-right, swapped with status) + due. */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
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
                                    flexShrink: 0,
                                }}
                            >
                                {taskMetaLabel(milestone.priority, t.tasks.filters)}
                            </span>
                        )}
                        {/* Always show a due indicator; "No due date" when the
                            milestone has none configured. */}
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.25,
                                color: dueColor,
                            }}
                        >
                            <AccessTimeIcon sx={{ fontSize: 11 }} />
                            <Typography
                                level="body-xs"
                                sx={{ fontWeight: 600, fontSize: "0.6rem", color: dueColor }}
                            >
                                {dueLabel ?? t.tasks.board.noDueDate}
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            </Box>
        </AppTooltip>
    );
};
