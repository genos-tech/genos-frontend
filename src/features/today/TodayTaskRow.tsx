import { ReactNode } from "react";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import { Box } from "@mui/joy";

import { AppTooltip } from "../../components/ui/AppTooltip";
import { fmt, useTranslation } from "../../i18n";
import { focusRing, g, type } from "../../theme/tokens";
import {
    AssigneeAvatar,
    DueText,
    MilestoneFlag,
    TagStrip,
    TaskIdText,
    TaskTitle,
} from "../tasks/components/card/parts";
import { PriorityIcon } from "../tasks/components/meta/PriorityIcon";
import { StatusLabel } from "../tasks/components/meta/StatusLabel";
import { ToneLabel } from "../tasks/components/meta/ToneLabel";
import { ProjectAvatar } from "../tasks/components/ProjectIdentityRow";
import { TaskMentionHoverCard } from "../tasks/components/TaskMentionHoverCard";
import type { BriefingBlocked, BriefingTask } from "./briefingToday";
import type { TodayCopy } from "./briefingWords";
import { dueOf } from "./todaySummary";

/**
 * One task or milestone of the Today view (MIP-1992), built only from the pieces every task
 * surface already uses: status, the milestone flag, id, title, priority, due text, assignee
 * avatar, tags, the project avatar. Line 1 says what it is and how urgent; line 2 says where it
 * lives and why it is here.
 *
 * The whole row is ONE button that opens the task (a row with no path is plain text, never a
 * dead link). Hovering it for 250 ms shows the same preview card a `#task` chip shows; the card
 * fetches only then, so a page of rows costs no extra request. Hover does not exist on a phone,
 * so everything that matters is on the row itself.
 */

const visuallyHidden = {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
} as const;

export type TodayTaskRowProps = {
    task: BriefingTask;
    href: string | null;
    /** The project's picture (from the chat list); the generic icon when it has none. */
    projectAvatarSrc?: string;
    /** What this task waits on, when it is one of the blocked ones. */
    blockedBy?: BriefingBlocked["waitingFor"];
    /** Why it is here (a reason, a change): the end of line 2. */
    context?: ReactNode;
    /** One line for the Genos-page card. */
    compact?: boolean;
    copy: TodayCopy;
    onOpen: (href: string) => void;
};

export const TodayTaskRow = ({
    task,
    href,
    projectAvatarSrc,
    blockedBy,
    context,
    compact = false,
    copy: a,
    onOpen,
}: TodayTaskRowProps) => {
    const { locale } = useTranslation();
    const due = dueOf(task, a, locale);
    const blocked = blockedBy != null;

    const kind = task.isMilestone ? a.row.milestone : a.row.task;
    const line1 = (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            <Box component="span" sx={visuallyHidden}>
                {kind}
            </Box>
            <StatusLabel status={task.status} iconOnly />
            {task.isMilestone ? (
                <AppTooltip title={a.row.milestone}>
                    <Box component="span" sx={{ display: "inline-flex" }}>
                        <MilestoneFlag />
                    </Box>
                </AppTooltip>
            ) : null}
            <Box sx={{ display: { xs: "none", sm: "inline-flex" } }}>
                <TaskIdText copyable={false} text={task.displayId} />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1, display: "flex" }}>
                <TaskTitle>{task.title}</TaskTitle>
            </Box>
            {!compact && task.priority ? (
                <Box sx={{ display: { xs: "none", sm: "inline-flex" }, flexShrink: 0 }}>
                    <PriorityIcon priority={task.priority} />
                </Box>
            ) : null}
            {due ? (
                <Box sx={{ flexShrink: 0 }}>
                    <DueText text={due.text} tone={due.tone} />
                </Box>
            ) : null}
            {!compact && task.assigneeId ? (
                <Box sx={{ flexShrink: 0, display: "inline-flex" }}>
                    <AssigneeAvatar name={task.assigneeName} size="xs" userId={task.assigneeId} />
                </Box>
            ) : null}
        </Box>
    );

    const waitText =
        blocked && blockedBy.length > 0
            ? fmt(a.row.waitingOn, { ids: blockedBy.map((w) => w.displayId).join(", ") })
            : null;

    const line2 = compact ? null : (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                minWidth: 0,
                ...type("body-xs"),
                color: g.text.secondary,
            }}
        >
            {task.projectName || task.projectId != null ? (
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                    <ProjectAvatar avatarSrc={projectAvatarSrc} />
                    {task.projectName ? (
                        <Box
                            component="span"
                            sx={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {task.projectName}
                        </Box>
                    ) : null}
                </Box>
            ) : null}
            {task.tags && task.tags.length > 0 ? (
                <Box sx={{ display: { xs: "none", sm: "block" }, minWidth: 0, flexShrink: 1 }}>
                    <TagStrip max={2} tags={task.tags} />
                </Box>
            ) : null}
            {blocked ? (
                <ToneLabel icon={<BlockRoundedIcon sx={{ fontSize: 12 }} />} tone="danger">
                    {waitText ?? a.row.blocked}
                </ToneLabel>
            ) : null}
            {context ? (
                <Box
                    component="span"
                    sx={{
                        minWidth: 0,
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textAlign: "end",
                    }}
                >
                    {context}
                </Box>
            ) : null}
        </Box>
    );

    const body = (
        <Box
            sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 0, width: "100%" }}
        >
            {line1}
            {line2}
        </Box>
    );

    const sx = {
        display: "flex",
        alignItems: "center",
        width: "100%",
        minWidth: 0,
        minHeight: 44,
        px: 1.25,
        py: 0.75,
        border: 0,
        background: "transparent",
        borderRadius: g.radius.sm,
        font: "inherit",
        textAlign: "start",
    } as const;

    if (!href) {
        return (
            <Box component="li" data-kind={kind} sx={{ listStyle: "none" }}>
                <Box sx={sx} title={a.noLink}>
                    {body}
                </Box>
            </Box>
        );
    }
    const button = (
        <Box
            component="button"
            type="button"
            sx={{
                ...sx,
                cursor: "pointer",
                transition: `background ${g.motion.fast}`,
                "&:hover": { background: g.hover },
                "&:focus-visible": focusRing,
            }}
            onClick={() => onOpen(href)}
        >
            {body}
        </Box>
    );
    const card =
        task.projectId != null ? (
            <AppTooltip
                enterDelay={250}
                placement="top-start"
                surface="none"
                title={
                    <TaskMentionHoverCard
                        displayId={task.displayId}
                        projectId={String(task.projectId)}
                        taskId={String(task.taskId)}
                        title={task.title}
                    />
                }
            >
                {/* A bare span anchors the tooltip: it injects props into its child. */}
                <span style={{ display: "block" }}>{button}</span>
            </AppTooltip>
        ) : (
            button
        );
    return (
        <Box component="li" data-kind={kind} sx={{ listStyle: "none" }}>
            {card}
        </Box>
    );
};
