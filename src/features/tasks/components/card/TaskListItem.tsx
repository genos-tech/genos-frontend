import { KeyboardEvent, ReactNode } from "react";
import { Box } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useTranslation } from "../../../../i18n";
import { focusRing, g } from "../../../../theme/tokens";
import { PriorityIcon } from "../meta/PriorityIcon";
import { StatusLabel } from "../meta/StatusLabel";
import { SprintChip } from "../SprintChip";
import { dueDisplay } from "./due";
import { AssigneeAvatar, DueText, MilestoneFlag, TaskIdText, TaskTitle } from "./parts";
import type { TaskCardTask } from "./types";

/** Column widths: tight to the widest content, so a leftover never reads as a
 *  gap between two chips. Fixed (not a grid) because every row is its own box. */
const SLOT = { status: 96, priority: 16, due: 96, sprint: 120, assignee: 24 } as const;

const Slot = ({
    width,
    hideOnXs = false,
    children,
}: {
    width: number | { xs: number; sm: number };
    hideOnXs?: boolean;
    children?: ReactNode;
}) => (
    <Box
        sx={{
            width,
            flexShrink: 0,
            alignItems: "center",
            overflow: "hidden",
            display: hideOnXs ? { xs: "none", sm: "flex" } : "flex",
        }}
    >
        {children}
    </Box>
);

type TaskListItemProps = {
    task: TaskCardTask;
    /** A status to show instead of `task.status` (the dashboard's effective status). */
    status?: string | null;
    /** `row`: status, id, title, then priority, due, sprint and assignee in
     *  fixed columns. `compact`: status icon, title and due only, for short
     *  lists inside a card. */
    variant?: "row" | "compact";
    /** Sprint name for the sprint column; `undefined` hides the column. `null`
     *  shows the muted "No Sprint". */
    sprintName?: string | null;
    /** Before the status: the dashboard's weight badge. */
    leading?: ReactNode;
    /** Tooltip on the assignee avatar. */
    assigneeLabel?: string;
    /** Shown for an empty title. */
    untitled?: string;
    onOpen: () => void;
};

/**
 * One task as a row (MIP-1124): the same pieces as the table row, for lists
 * that are not the table. Height is the density token (`g.row.current`), so
 * Compact / Default / Comfortable apply to it like to the table.
 */
export const TaskListItem = ({
    task,
    status,
    variant = "row",
    sprintName,
    leading,
    assigneeLabel,
    untitled,
    onOpen,
}: TaskListItemProps) => {
    const { t } = useTranslation();
    const compact = variant === "compact";
    const shownStatus = status ?? task.status;
    const due = dueDisplay(task.dueDate, "row");
    return (
        <Box
            data-testid="task-list-item"
            data-variant={variant}
            role="button"
            tabIndex={0}
            sx={{
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                gap: 1,
                minWidth: 0,
                height: g.row.current,
                px: 1.5,
                borderBottom: `1px solid ${g.border.subtle}`,
                cursor: "pointer",
                transition: `background ${g.motion.fast} ${g.ease}`,
                "&:last-of-type": { borderBottom: 0 },
                "&:hover": { background: g.hover },
                "&:focus-visible": { ...focusRing, outlineOffset: "-2px" },
            }}
            onClick={onOpen}
            onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen();
                }
            }}
        >
            {leading}
            {compact ? (
                <StatusLabel status={shownStatus} iconOnly />
            ) : (
                // On a phone the status is its icon: the word would take the title's room.
                <Slot width={{ xs: 16, sm: SLOT.status }}>
                    <Box
                        sx={{
                            display: "flex",
                            // Visually hidden, not display:none, so the status keeps its name.
                            "& [data-status-word]": {
                                position: { xs: "absolute", sm: "static" },
                                width: { xs: 1, sm: "auto" },
                                height: { xs: 1, sm: "auto" },
                                clipPath: { xs: "inset(50%)", sm: "none" },
                            },
                        }}
                    >
                        <StatusLabel status={shownStatus} />
                    </Box>
                </Slot>
            )}
            {!compact && <TaskIdText task={task} />}
            {task.isMilestone === true && <MilestoneFlag size={14} />}
            <Box sx={{ flex: 1, minWidth: 0, display: "flex" }}>
                <TaskTitle>{task.title || untitled || t.tasks.dashboard.untitledTask}</TaskTitle>
            </Box>
            {!compact && (
                <Slot width={SLOT.priority} hideOnXs>
                    <PriorityIcon priority={task.priority} />
                </Slot>
            )}
            {compact ? (
                task.dueDate && <DueText text={task.dueDate} tone={due.tone} />
            ) : (
                <Slot width={SLOT.due}>
                    <DueText text={due.text} tone={due.tone} />
                </Slot>
            )}
            {!compact && sprintName !== undefined && (
                <Slot width={SLOT.sprint} hideOnXs>
                    <SprintChip name={sprintName} />
                </Slot>
            )}
            {!compact && (
                <Slot width={SLOT.assignee} hideOnXs>
                    {task.assigneeId ? (
                        <AppTooltip title={assigneeLabel ?? task.assigneeName ?? ""}>
                            <Box sx={{ display: "flex" }}>
                                <AssigneeAvatar
                                    name={task.assigneeName}
                                    userId={task.assigneeId}
                                />
                            </Box>
                        </AppTooltip>
                    ) : null}
                </Slot>
            )}
        </Box>
    );
};

/** The flat bordered box a run of `TaskListItem`s sits in. */
export const TaskListPanel = ({ children }: { children: ReactNode }) => (
    <Box
        sx={{
            border: `1px solid ${g.border.default}`,
            borderRadius: g.radius.md,
            background: g.surface.default,
            overflow: "hidden",
        }}
    >
        {children}
    </Box>
);
