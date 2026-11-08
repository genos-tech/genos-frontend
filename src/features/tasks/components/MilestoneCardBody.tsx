import { ReactNode } from "react";
import { Box, LinearProgress } from "@mui/joy";

import { ResolvedUserName } from "../../../components/ui/avatars/AvatarContext";
import { AvatarGroup } from "../../../components/ui/avatars/BaseAvatar";
import { fmt, useTranslation } from "../../../i18n";
import { g, type } from "../../../theme/tokens";
import { TagListProps } from "../../../types/tasks";
import { Milestone, MilestoneAssignee } from "../sprint-milestone/types";
import {
    AssigneeAvatar,
    DueText,
    MilestoneFlag,
    TagStrip,
    TaskIdText,
    TaskTitle,
    type DueTone,
} from "./card";
import { PriorityIcon } from "./meta/PriorityIcon";
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

const dueTone = (daysLeft: number | null): DueTone =>
    daysLeft === null ? "none" : daysLeft < 0 ? "overdue" : daysLeft <= 3 ? "soon" : "later";

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
    const { t } = useTranslation();

    const tags = asTags(milestone.tags);
    const total = milestone.tasksTotal ?? 0;
    const closed = milestone.tasksClosed ?? 0;
    const pct = total > 0 ? Math.round((closed / total) * 100) : 0;

    const assignees = (milestone.assignees ?? []).filter((a) => a.userId != null);
    const firstAssignee = assignees[0];

    const daysLeft = daysUntil(milestone.dueDate);
    const dueLabel = milestone.dueDate
        ? new Date(milestone.dueDate).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
          })
        : null;
    const small = { ...type("body-xs"), color: g.text.tertiary } as const;

    return (
        <>
            {/* Header: sprint + flag + id (left) · caller's slot (right) */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 0.75,
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                    <SprintChip name={sprintName} />
                    <MilestoneFlag size={14} />
                    <TaskIdText
                        copyable={false}
                        text={milestone.displayId ?? `#${milestone.milestoneId}`}
                    />
                </Box>
                {topRight != null && (
                    <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                        {topRight}
                    </Box>
                )}
            </Box>

            <TaskTitle lines={2}>{milestone.title}</TaskTitle>

            {/* Progress: closed / total sub-tasks */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <LinearProgress
                    color={pct === 100 ? "success" : "primary"}
                    size="sm"
                    sx={{ flex: 1, "--LinearProgress-thickness": "6px" }}
                    value={pct}
                    determinate
                />
                <Box component="span" sx={{ ...small, whiteSpace: "nowrap" }}>
                    {fmt(t.tasks.dashboard.assignedMilestones.progress, { closed, total })}
                </Box>
            </Box>

            {/* Tags — right under the progress bar (MIP-1048). */}
            {tags.length > 0 && (
                <Box data-testid="milestone-card-tags">
                    <TagStrip max={MAX_TAGS} tags={tags} />
                </Box>
            )}

            {/* Footer: [assignees + name] (left) · [priority + due] (right) */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    mt: "auto",
                    pt: 0.75,
                    borderTop: `1px solid ${g.border.subtle}`,
                }}
            >
                {/* Assignees — avatars, then the first one's name (+N for the
                    rest), the same way the board's task card shows its
                    assignee. */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                    {firstAssignee ? (
                        <>
                            <AvatarGroup size="sm" sx={{ "--Avatar-size": "20px" }}>
                                {assignees.slice(0, MAX_AVATARS).map((a) => (
                                    <AssigneeAvatar
                                        key={String(a.userId)}
                                        name={cachedName(a)}
                                        size="xs"
                                        userId={a.userId as string | number}
                                    />
                                ))}
                            </AvatarGroup>
                            <Box
                                component="span"
                                sx={{
                                    ...small,
                                    minWidth: 0,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                <ResolvedUserName
                                    fallbackName={cachedName(firstAssignee)}
                                    userId={firstAssignee.userId}
                                />
                            </Box>
                            {assignees.length > 1 && (
                                <Box component="span" sx={{ ...small, flexShrink: 0 }}>
                                    +{assignees.length - 1}
                                </Box>
                            )}
                        </>
                    ) : (
                        <>
                            <AssigneeAvatar size="xs" userId={null} />
                            <Box component="span" sx={small}>
                                {t.tasks.board.unassigned}
                            </Box>
                        </>
                    )}
                </Box>

                {/* Priority + due. */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>
                    <PriorityIcon priority={milestone.priority} />
                    {/* Always show a due indicator; "No due date" when the
                        milestone has none configured. */}
                    <DueText
                        icon={true}
                        text={dueLabel ?? t.tasks.board.noDueDate}
                        tone={dueTone(daysLeft)}
                    />
                </Box>
            </Box>
        </>
    );
};
