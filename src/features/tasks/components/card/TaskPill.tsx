import { forwardRef, HTMLAttributes } from "react";
import { Box } from "@mui/joy";

import { focusRing, g, type } from "../../../../theme/tokens";
import { StatusLabel } from "../meta/StatusLabel";
import { domPropsOf } from "./domProps";
import { TaskIdText, TaskTitle } from "./parts";
import type { TaskCardTask } from "./types";

type TaskPillProps = Omit<
    HTMLAttributes<HTMLButtonElement>,
    "className" | "style" | "color" | "children" | "onClick"
> & {
    task: Pick<TaskCardTask, "id" | "taskId" | "displayId" | "title" | "status">;
    onOpen: () => void;
};

const Divider = () => (
    <Box
        aria-hidden="true"
        sx={{ width: "1px", height: 14, flexShrink: 0, bgcolor: g.border.default }}
    />
);

/**
 * One task as a compact pill (MIP-1124): id | title | status in one control that
 * opens the task. It is the "open task" affordance in the task-note header and
 * the chat thread header. Flat: one border, the hover fill, the shared focus
 * ring; no lift or glow. A button, so a wrapping Tooltip can sit on it.
 */
export const TaskPill = forwardRef<HTMLButtonElement, TaskPillProps>(function TaskPill(
    { task, onOpen, ...rest },
    ref
) {
    return (
        <Box
            {...domPropsOf(rest)}
            // After the spread: a wrapping Tooltip must not be able to change the element.
            ref={ref}
            component="button"
            data-testid="task-pill"
            type="button"
            sx={{
                ...type("body-xs"),
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                minWidth: 0,
                height: g.control.md,
                px: 1.25,
                font: "inherit",
                color: g.text.primary,
                background: g.surface.default,
                border: `1px solid ${g.border.default}`,
                borderRadius: g.radius.md,
                cursor: "pointer",
                transition: `background ${g.motion.fast} ${g.ease}`,
                "&:hover": { background: g.hover },
                "&:focus-visible": focusRing,
            }}
            onClick={onOpen}
        >
            <TaskIdText copyable={false} task={task} />
            {task.title ? (
                <>
                    <Divider />
                    <Box sx={{ maxWidth: 180, minWidth: 0, display: "flex" }}>
                        <TaskTitle>{task.title}</TaskTitle>
                    </Box>
                </>
            ) : null}
            {task.status ? (
                <>
                    <Divider />
                    <StatusLabel status={task.status} />
                </>
            ) : null}
        </Box>
    );
});
