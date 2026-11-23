import { ReactNode, useEffect, useRef, useState } from "react";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import { Box, IconButton } from "@mui/joy";

import { visuallyHidden } from "../../components/ui/a11y/visuallyHidden";
import { AppTooltip } from "../../components/ui/AppTooltip";
import { useIsTouch } from "../../hooks/common/useIsTouch";
import { useLongPress } from "../../hooks/common/useLongPress";
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
import { ROW_MIN_HEIGHT, rowDivider } from "./rowDivider";
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
 *
 * Every row has the SAME geometry, with or without quick actions (MIP-2213): the actions reserve
 * no space. They sit over the row's end edge, on a fade of the row's own background, and show on
 * hover, on keyboard focus anywhere in the row, or after a long press on a screen with no hover
 * (the chat row's pattern). Hidden, they stay in the tab order and cost the title no width.
 */

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
    // A milestone, a row of someone else's and the card variant get no actions: closing a
    // milestone goes through its own record (sprint, sub-tasks), which this row cannot name.
    const canAct = onAction != null && !task.isMilestone && task.projectId != null;
    // "Tomorrow" is for what is due today or already late: it must never pull a deadline earlier.
    const canTomorrow = task.daysUntilDue != null && task.daysUntilDue <= 0;
    const isTouch = useIsTouch();
    const rowRef = useRef<HTMLLIElement>(null);
    // No hover on a phone: a long press shows the actions, a touch anywhere else hides them.
    const [pressed, setPressed] = useState(false);
    const longPress = useLongPress(() => setPressed(true));
    const open = pressed;
    useEffect(() => {
        if (!open) return undefined;
        const away = (e: Event) => {
            if (!rowRef.current?.contains(e.target as Node)) setPressed(false);
        };
        const escape = (e: KeyboardEvent) => {
            if (e.key === "Escape") setPressed(false);
        };
        document.addEventListener("touchstart", away);
        document.addEventListener("keydown", escape);
        return () => {
            document.removeEventListener("touchstart", away);
            document.removeEventListener("keydown", escape);
        };
    }, [open]);

    const kind = task.isMilestone ? a.row.milestone : a.row.task;
    const line1 = (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, minHeight: 24 }}>
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
                minHeight: 22,
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
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.25,
                minWidth: 0,
                width: "100%",
            }}
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
        minHeight: ROW_MIN_HEIGHT,
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
    const done = () => setPressed(false);
    return (
        <Box
            ref={rowRef}
            component="li"
            data-actions-open={open ? "true" : undefined}
            data-kind={kind}
            sx={{
                listStyle: "none",
                ...rowDivider,
                position: "relative",
                minWidth: 0,
                // The actions' fade is a shadow that reaches into the row: the row clips it, so it
                // never lands on the neighbouring rows.
                overflow: "hidden",
                "@supports selector(:has(*))": {
                    "&:has(> button:focus-visible)::after": {
                        content: '""',
                        position: "absolute",
                        inset: 0,
                        zIndex: 1,
                        pointerEvents: "none",
                        borderRadius: g.radius.sm,
                        outline: focusRing.outline,
                        outlineOffset: "-2px",
                    },
                },
                // One hover fill for the whole row, whichever part the pointer or focus is on.
                "&:has(:focus-visible) > button, &[data-actions-open] > button": {
                    background: ROW_FILL,
                },
                // The actions are over the row's end edge, hidden until hover, focus anywhere in
                // the row or a long press. Opacity, not display: they stay in the tab order.
                "&:has(:focus-visible) > [data-today-actions], &[data-actions-open] > [data-today-actions]":
                    { opacity: 1, pointerEvents: "auto" },
                "@media (hover: hover)": {
                    "&:hover > button": { background: ROW_FILL },
                    "&:hover > [data-today-actions]": { opacity: 1, pointerEvents: "auto" },
                },
            }}
        >
            <Box
                component="button"
                type="button"
                sx={{
                    ...sx,
                    cursor: "pointer",
                    // Inside the row: the row clips what sticks out of it.
                    // Inside the row (the row clips what sticks out). Where `:has` works the ring is
                    // drawn by the row instead (below), above the actions that open with it.
                    "&:focus-visible": { ...focusRing, outlineOffset: "-2px" },
                    "@supports selector(:has(*))": { "&:focus-visible": { outline: "none" } },
                    "@media (hover: none)": { WebkitTouchCallout: "none", userSelect: "none" },
                }}
                onContextMenu={canAct && isTouch ? (e) => e.preventDefault() : undefined}
                onClick={() => {
                    if (canAct && longPress.consumedTap()) return;
                    done();
                    onOpen(href);
                }}
                {...(canAct ? longPress : {})}
            >
                {body}
            </Box>
            {canAct ? (
                <Box
                    aria-label={fmt(a.actions.group, { task: `${task.displayId} ${task.title}` })}
                    data-today-actions=""
                    role="group"
                    sx={{
                        position: "absolute",
                        insetBlock: 0,
                        insetInlineEnd: 0,
                        display: "flex",
                        alignItems: "center",
                        // The row's own hovered fill, solid under the buttons, with a fade of the same
                        // colour into the title so the cut is never hard.
                        paddingInlineEnd: 0.5,
                        borderStartEndRadius: g.radius.sm,
                        borderEndEndRadius: g.radius.sm,
                        background: ROW_FILL,
                        boxShadow: fade(-1),
                        '[dir="rtl"] &': { boxShadow: fade(1) },
                        opacity: 0,
                        pointerEvents: "none",
                        transition: `opacity ${g.motion.fast}`,
                        "@media (prefers-reduced-motion: reduce)": { transition: "none" },
                    }}
                >
                    <AppTooltip title={a.actions.done}>
                        <IconButton
                            aria-label={`${a.actions.done}: ${task.displayId}`}
                            size="sm"
                            sx={actionButtonSx}
                            variant="plain"
                            onClick={(e) => {
                                focusNeighbour(e.currentTarget);
                                done();
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
                                sx={actionButtonSx}
                                variant="plain"
                                onClick={(e) => {
                                    if (!keepsOnTomorrow) focusNeighbour(e.currentTarget);
                                    done();
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
 * The row's fill while it is hovered or focused: the hover tint already composited on the surface,
 * so it is opaque and hides the title under the actions. The row itself uses the same value.
 */
const ROW_FILL = "var(--joy-palette-neutral-softBg)";

/** A fade of ROW_FILL along the row, `-1` toward the left (reading direction), `1` toward the right. */
const fade = (direction: -1 | 1): string => `${direction * 8}px 0 14px 7px ${ROW_FILL}`;

const actionButtonSx = {
    minWidth: { xs: 40, sm: 44 },
    minHeight: 44,
    "&:focus-visible": focusRing,
} as const;

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
