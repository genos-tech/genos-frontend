import { ReactNode } from "react";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import { AvatarGroup, Box, Chip, LinearProgress, Typography } from "@mui/joy";
import Avatar from "@mui/joy/Avatar";
import { useColorScheme } from "@mui/joy/styles";

import { ResolvedUserName } from "../../../components/ui/avatars/AvatarContext";
import { UserAvatar } from "../../../components/ui/avatars/UserAvatar";
import { fmt, useTranslation } from "../../../i18n";
import { TagListProps } from "../../../types/tasks";
import { Milestone, MilestoneAssignee } from "../sprint-milestone/types";
import { priorityChipColors, taskMetaLabel } from "../utils/taskMeta";
import { milestoneHasGoal } from "../utils/taskTemplates";
import { ProjectTagChip } from "./ProjectTagChip";
import { SprintChip } from "./SprintChip";

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

// The name stored on the milestone's assignee, used until the live profile
// (rename-safe, from AvatarContext) resolves.
const cachedName = (a: MilestoneAssignee): string => {
    const full = [a.firstName, a.lastName].filter(Boolean).join(" ").trim();
    return full || a.username || "";
};

const MAX_AVATARS = 3;
const MAX_TAGS = 3;

type Props = {
    milestone: Milestone;
    // Resolved sprint name (null → "No Sprint"). Resolved by the parent from
    // the current project's sprints.
    sprintName: string | null;
    // What sits in the header's top-right corner. The dashboard puts the
    // milestone's status chip there; the sprint board puts the "Open task
    // graph" button there, because its column already says the status.
    topRight?: ReactNode;
};

// The inside of a milestone card — the single layout behind both the
// dashboard's "Assigned Milestones" card and the sprint board's milestone
// card (MIP-1048). The OUTER shell is not here on purpose: the dashboard card
// is a plain button, the board card is a @hello-pangea/dnd <Draggable> with
// its own selected / dragging chrome, and each keeps its own click behaviour.
export const MilestoneCardBody = ({ milestone, sprintName, topRight }: Props) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

    const tags = asTags(milestone.tags);
    // Same colours as the task table (see priorityChipColors).
    const priorityStyle = priorityChipColors(milestone.priority, isDark);
    const total = milestone.tasksTotal ?? 0;
    const closed = milestone.tasksClosed ?? 0;
    const pct = total > 0 ? Math.round((closed / total) * 100) : 0;

    const assignees = (milestone.assignees ?? []).filter((a) => a.userId != null);
    const firstAssignee = assignees[0];

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
        <>
            {/* Header: sprint + flag + id (left) · caller's slot (right) */}
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
                    <SprintChip name={sprintName} />
                    <FlagRoundedIcon sx={{ fontSize: 13, color: "#f97316", flexShrink: 0 }} />
                    <Typography
                        level="body-xs"
                        sx={{
                            color: isDark ? "#6b9fd4" : "#5a8ac7",
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
                {topRight != null && (
                    <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                        {topRight}
                    </Box>
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
                    color: isDark ? "#e8e8e8" : "#1a1a1a",
                }}
            >
                {milestone.title}
            </Typography>

            {/* Nobody has written what this milestone is for (MIP-799). */}
            {!milestoneHasGoal(milestone.description) && (
                <Box sx={{ mb: 0.75 }}>
                    <Chip
                        color="warning"
                        size="sm"
                        title={t.tasks.sidebar.noGoalHint}
                        variant="outlined"
                    >
                        {t.tasks.sidebar.noGoal}
                    </Chip>
                </Box>
            )}

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
                        color: isDark ? "#999" : "#777",
                        fontSize: "0.6rem",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                    }}
                >
                    {fmt(t.tasks.dashboard.assignedMilestones.progress, { closed, total })}
                </Typography>
            </Box>

            {/* Tags — right under the progress bar (MIP-1048). */}
            {tags.length > 0 && (
                <Box
                    data-testid="milestone-card-tags"
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 0.5,
                        mb: 0.75,
                    }}
                >
                    {tags.slice(0, MAX_TAGS).map((tag, idx) => (
                        <ProjectTagChip
                            key={idx}
                            isDark={isDark}
                            label={tag.tagName}
                            tagColor={tag.tagColor}
                        />
                    ))}
                    {tags.length > MAX_TAGS && (
                        <Typography level="body-xs" sx={{ color: isDark ? "#888" : "#666" }}>
                            +{tags.length - MAX_TAGS}
                        </Typography>
                    )}
                </Box>
            )}

            {/* Footer: [assignees + name] (left) · [priority + due] (right) */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 0.5,
                    mt: "auto",
                    pt: 0.75,
                    borderTop: isDark
                        ? "1px solid rgba(255, 255, 255, 0.04)"
                        : "1px solid rgba(0, 0, 0, 0.04)",
                }}
            >
                {/* Assignees — avatars, then the first one's name (+N for the
                    rest), the same way the board's task card shows its
                    assignee. */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                    {firstAssignee ? (
                        <>
                            <AvatarGroup size="sm" sx={{ "--Avatar-size": "20px" }}>
                                {assignees.slice(0, MAX_AVATARS).map((a) => (
                                    <UserAvatar
                                        key={String(a.userId)}
                                        clickable={false}
                                        showPulseDot={false}
                                        size={20}
                                        userId={a.userId as string | number}
                                    />
                                ))}
                            </AvatarGroup>
                            <Typography
                                level="body-xs"
                                sx={{
                                    color: isDark ? "#999" : "#777",
                                    minWidth: 0,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    fontSize: "0.65rem",
                                }}
                            >
                                <ResolvedUserName
                                    fallbackName={cachedName(firstAssignee)}
                                    userId={firstAssignee.userId}
                                />
                            </Typography>
                            {assignees.length > 1 && (
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        color: isDark ? "#999" : "#777",
                                        fontSize: "0.65rem",
                                        flexShrink: 0,
                                    }}
                                >
                                    +{assignees.length - 1}
                                </Typography>
                            )}
                        </>
                    ) : (
                        <>
                            <Avatar
                                size="sm"
                                sx={{
                                    width: 20,
                                    height: 20,
                                    fontSize: "0.6rem",
                                    border: isDark
                                        ? "1.5px solid rgba(255, 255, 255, 0.1)"
                                        : "1.5px solid rgba(0, 0, 0, 0.08)",
                                }}
                            >
                                ?
                            </Avatar>
                            <Typography
                                level="body-xs"
                                sx={{ color: isDark ? "#999" : "#777", fontSize: "0.65rem" }}
                            >
                                {t.tasks.board.unassigned}
                            </Typography>
                        </>
                    )}
                </Box>

                {/* Priority + due. */}
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
        </>
    );
};
