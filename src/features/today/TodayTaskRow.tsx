import { ReactNode } from "react";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import { Box, IconButton } from "@mui/joy";

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
import type { BriefingBlocked, BriefingTask } from "./briefingToday";
import type { TodayCopy } from "./briefingWords";
import { rowDivider } from "./rowDivider";
import { TodayAction } from "./todayActions";
import { dueOf } from "./todaySummary";

/**
 * One task or milestone of the Today view (MIP-1992), built only from the pieces every task
 * surface already uses: status, the milestone flag, id, title, priority, due text, assignee
 * avatar, tags, the project avatar. Line 1 says what it is and how urgent; line 2 says where it
 * lives and why it is here.
 *
 * The whole row is ONE button that opens the task (a row with no path is plain text, never a
 * dead link). There is no hover preview (the maintainer found it too much): everything that
 * matters is on the row itself. Rows are separated by a hairline divider, visible at rest.
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
    /** Quick actions (MIP-1992): set on the rows that are the member's own; none on the card. */
    onAction?: (action: TodayAction) => void;
    /** "Move to tomorrow" leaves this row on screen (it still shows, with its new day). */
    keepsOnTomorrow?: boolean;
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
    onAction,
    keepsOnTomorrow = false,
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
            <Box component="li" data-kind={kind} sx={{ listStyle: "none", ...rowDivider }}>
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
    // A milestone, a row of someone else's and the card variant get no actions: closing a
    // milestone goes through its own record (sprint, sub-tasks), which this row cannot name.
    const canAct = onAction != null && !task.isMilestone && task.projectId != null;
    // "Tomorrow" is for what is due today or already late: it must never pull a deadline earlier.
    const canTomorrow = task.daysUntilDue != null && task.daysUntilDue <= 0;
    return (
        <Box
            component="li"
            data-kind={kind}
            sx={{
                listStyle: "none",
                ...rowDivider,
                display: "flex",
                alignItems: "center",
                gap: 0.25,
                minWidth: 0,
                // Hover-capable devices show the actions on hover and keyboard focus; they stay
                // in the tab order either way (opacity, not display). A phone has no hover: they
                // are always there.
                "& [data-today-actions]": {
                    "@media (hover: hover)": {
                        opacity: 0,
                        transition: `opacity ${g.motion.fast}`,
                    },
                },
                "&:hover [data-today-actions], &:focus-within [data-today-actions]": {
                    opacity: 1,
                },
            }}
        >
            <Box sx={{ minWidth: 0, flex: 1 }}>{button}</Box>
            {canAct ? (
                <Box
                    aria-label={fmt(a.actions.group, { task: `${task.displayId} ${task.title}` })}
                    data-today-actions=""
                    role="group"
                    sx={{ display: "flex", flexShrink: 0, pr: 0.5 }}
                >
                    <AppTooltip title={a.actions.done}>
                        <IconButton
                            aria-label={`${a.actions.done}: ${task.displayId}`}
                            size="sm"
                            variant="plain"
                            sx={{
                                minWidth: { xs: 36, sm: 44 },
                                minHeight: 44,
                                "&:focus-visible": focusRing,
                            }}
                            onClick={(e) => {
                                focusNeighbour(e.currentTarget);
                                onAction("done");
                            }}
                        >
                            <CheckRoundedIcon />
                        </IconButton>
                    </AppTooltip>
                    {canTomorrow ? (
                        <AppTooltip title={a.actions.tomorrow}>
                            <IconButton
                                aria-label={`${a.actions.tomorrow}: ${task.displayId}`}
                                size="sm"
                                variant="plain"
                                sx={{
                                    minWidth: { xs: 36, sm: 44 },
                                    minHeight: 44,
                                    "&:focus-visible": focusRing,
                                }}
                                onClick={(e) => {
                                    if (!keepsOnTomorrow) focusNeighbour(e.currentTarget);
                                    onAction("tomorrow");
                                }}
                            >
                                <EventRepeatRoundedIcon />
                            </IconButton>
                        </AppTooltip>
                    ) : null}
                </Box>
            ) : null}
        </Box>
    );
};

/**
 * The row is about to leave the list: put focus on the nearest row that stays (the next, else the
 * previous), so a keyboard user is not dropped on the page. Falls back to the Today page itself.
 */
const focusNeighbour = (from: HTMLElement): void => {
    const li = from.closest("li");
    if (!li) return;
    const main = (el: Element): HTMLElement | null =>
        Array.from(el.querySelectorAll("button")).find(
            (b) => !b.closest("[data-today-actions]")
        ) ?? null;
    let target: HTMLElement | null = null;
    for (let n = li.nextElementSibling; n && !target; n = n.nextElementSibling) target = main(n);
    for (let p = li.previousElementSibling; p && !target; p = p.previousElementSibling) {
        target = main(p);
    }
    if (!target) {
        // The page, not the section: the section itself may be gone once its last row left.
        const page = li.closest<HTMLElement>('[data-testid="today-page"]');
        if (page) {
            page.setAttribute("tabindex", "-1");
            target = page;
        }
    }
    target?.focus({ preventScroll: true });
};
