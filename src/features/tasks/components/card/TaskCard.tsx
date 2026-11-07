import { forwardRef, HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { Box } from "@mui/joy";

import { useResolvedUserName } from "../../../../components/ui/avatars/AvatarContext";
import { useTranslation } from "../../../../i18n";
import { focusRing, g, type } from "../../../../theme/tokens";
import { PriorityIcon } from "../meta/PriorityIcon";
import { StatusLabel } from "../meta/StatusLabel";
import { dueDisplay } from "./due";
import { AssigneeAvatar, DueText, MilestoneFlag, TagStrip, TaskIdText, TaskTitle } from "./parts";
import type { TaskCardTask } from "./types";

// DOM props are accepted only so a wrapping Tooltip can attach its hover and
// focus handlers; there is no `sx`, `style` or `className`: a caller cannot
// re-style the surface.
type FrameProps = Omit<
    HTMLAttributes<HTMLDivElement>,
    "className" | "style" | "color" | "children"
> & {
    children: ReactNode;
    /** The selected card: accent border and a quiet accent fill. */
    selected?: boolean;
    /** Lifted while it is being dragged. */
    dragging?: boolean;
    /** Makes the whole card the "open" control (a button with Enter/Space).
     *  Leave it off when a wrapper already owns click and keyboard (the board's
     *  drag handle does). */
    onOpen?: () => void;
    /** Accessible name when `onOpen` makes the card a button. */
    label?: string;
};

/**
 * The card surface, and nothing else: flat, one border, `radius.md`, the
 * surface role. Hover only strengthens the border (no lift, no shadow); a
 * dragged card takes the medium shadow. Task cards, milestone cards and the
 * dashboard's milestone card all sit on this, so they cannot drift.
 */
export const TaskCardFrame = forwardRef<HTMLDivElement, FrameProps>(function TaskCardFrame(
    { children, selected = false, dragging = false, onOpen, label, ...rest },
    ref
) {
    // A wrapping Tooltip also hands down its own className, style and `sx`
    // (the tooltip chip's border and background); they would replace the
    // surface's own, so they are dropped here.
    const domProps: Record<string, unknown> = { ...rest };
    delete domProps.className;
    delete domProps.style;
    delete domProps.sx;
    const interactive = onOpen
        ? {
              role: "button",
              tabIndex: 0,
              "aria-label": label,
              onClick: onOpen,
              onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpen();
                  }
              },
          }
        : null;
    return (
        <Box
            ref={ref}
            data-dragging={dragging || undefined}
            data-selected={selected || undefined}
            data-testid="task-card"
            sx={{
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: 0.75,
                minWidth: 0,
                p: 1.5,
                borderRadius: g.radius.md,
                border: `1px solid ${selected ? g.accent.border : g.border.default}`,
                background: selected
                    ? g.accent.subtle
                    : dragging
                      ? g.surface.raised
                      : g.surface.default,
                boxShadow: dragging ? g.shadow.md : "none",
                cursor: "pointer",
                transition: dragging
                    ? "none"
                    : `border-color ${g.motion.fast} ${g.ease}, background ${g.motion.fast} ${g.ease}`,
                "&:hover": { borderColor: selected ? g.accent.border : g.border.strong },
                "&:active": { background: selected ? g.accent.subtle : g.hover },
                "&:focus-visible": focusRing,
            }}
            {...domProps}
            {...interactive}
        >
            {children}
        </Box>
    );
});

type TaskCardProps = {
    task: TaskCardTask;
    /** A status to show instead of `task.status` (the dashboard resolves an
     *  effective status from the task's branch). */
    status?: string | null;
    /** Draw the status in the header. The board leaves it off: its column says it. */
    showStatus?: boolean;
    /** Draw the assignee (avatar and name) in the footer. Default on. */
    showAssignee?: boolean;
    /** Draw the tags. Default on. */
    showTags?: boolean;
    /** Draw the due date in the footer. Default on. */
    showDue?: boolean;
    /** Show "No due date" when there is none. Default on. */
    dueWhenEmpty?: boolean;
    /** Right side of the header, after the priority (the board's graph button). */
    headerEnd?: ReactNode;
    /** Right side of the footer, instead of the due date (a "last updated" time). */
    footerEnd?: ReactNode;
    /** Shown for an empty title. Defaults to the mobile list's wording. */
    untitled?: string;
    selected?: boolean;
    dragging?: boolean;
    onOpen?: () => void;
};

const AssigneeName = ({ id, fallback }: { id: string; fallback: string }) => {
    // Live-resolve the name so a rename shows here instead of the `assigneeName`
    // cached on the task row.
    const name = useResolvedUserName(id, fallback);
    return <>{name}</>;
};

/**
 * One task as a card (MIP-1124): id, priority, title, tags, assignee, due.
 * Status, priority, tags, avatar and due are the shared pieces, so the board,
 * the mobile list and the dashboard grid read as one component. Presentational
 * and memo-friendly: it takes plain data and callbacks.
 */
export const TaskCard = ({
    task,
    status,
    showStatus = false,
    showAssignee = true,
    showTags = true,
    showDue = true,
    dueWhenEmpty = true,
    headerEnd,
    footerEnd,
    untitled,
    selected,
    dragging,
    onOpen,
}: TaskCardProps) => {
    const { t } = useTranslation();
    const shownStatus = status ?? task.status;
    const due =
        showDue && (dueWhenEmpty || task.dueDate) ? dueDisplay(task.dueDate, "card") : null;
    const hasFooter = showAssignee || due != null || footerEnd != null;
    return (
        <TaskCardFrame
            dragging={dragging}
            label={task.title ?? undefined}
            selected={selected}
            onOpen={onOpen}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                {task.isMilestone === true && <MilestoneFlag size={14} />}
                <TaskIdText task={task} />
                <Box sx={{ flex: 1 }} />
                {showStatus && shownStatus && <StatusLabel status={shownStatus} />}
                <PriorityIcon priority={task.priority} />
                {headerEnd}
            </Box>

            <TaskTitle lines={2}>{task.title || untitled || t.tasks.mobile.untitled}</TaskTitle>

            {showTags && <TagStrip tags={task.tags} />}

            {hasFooter && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                        mt: 0.25,
                        pt: 0.75,
                        borderTop: `1px solid ${g.border.subtle}`,
                    }}
                >
                    {showAssignee ? (
                        <Box
                            sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}
                        >
                            <AssigneeAvatar size="xs" userId={task.assigneeId} />
                            <Box
                                component="span"
                                sx={{
                                    ...type("body-xs"),
                                    color: g.text.tertiary,
                                    maxWidth: 96,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {/* The RTL name island (Arabic part 1, #739): the name keeps its
                                    reading order and truncates at its own end. */}
                                <bdi className="g-bidi-island">
                                    {task.assigneeId ? (
                                        <AssigneeName
                                            fallback={task.assigneeName || ""}
                                            id={task.assigneeId}
                                        />
                                    ) : (
                                        t.tasks.board.unassigned
                                    )}
                                </bdi>
                            </Box>
                        </Box>
                    ) : (
                        <span />
                    )}
                    {footerEnd ?? (due && <DueText icon={true} text={due.text} tone={due.tone} />)}
                </Box>
            )}
        </TaskCardFrame>
    );
};
