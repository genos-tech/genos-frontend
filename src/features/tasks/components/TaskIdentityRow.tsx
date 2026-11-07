import { Box } from "@mui/joy";

import { TaskStatusProps } from "../../../types/tasks";
import { MilestoneFlag, TaskIdText, TaskTitle } from "./card";
import { StatusLabel } from "./meta/StatusLabel";

/**
 * How a task identifies itself in a dropdown: a milestone flag, its
 * copyable display ID, its status, then the title.
 *
 * Extracted from the sidebar's task search so every task picker presents
 * the same row. The dependency picker used to draw its own variant, and
 * two dropdowns onto the same objects that look different read as two
 * different products — the same reason `ProjectIdentityRow` next door
 * exists. Built from the task family's pieces (MIP-1124): the id is quiet
 * text, the status the shared `StatusLabel`.
 *
 * Presentational only. The caller supplies the option container (a Joy
 * `AutocompleteOption` wrapping a `ListItemContent`), which is what
 * brings the padding, hover and selected states.
 */

// Sources disagree on the ID field — search results carry `taskId`,
// table rows carry `id` — so accept whatever `formatTaskDisplayId` can
// resolve rather than making callers normalize first.
type TaskLike = {
    displayId?: string | null;
    id?: number | string | null;
    taskId?: number | string | null;
};

type TaskIdentityRowProps = {
    task: TaskLike;
    title: string | null;
    /** Resolved status meta. Callers whose row carries a bare status
     *  string resolve it against `taskMeta.statuses` first. */
    status: TaskStatusProps;
    isMilestone?: boolean | null;
};

export const TaskIdentityRow = ({ task, title, status, isMilestone }: TaskIdentityRowProps) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
        {isMilestone === true && <MilestoneFlag size={16} />}
        <TaskIdText task={task} />
        <StatusLabel status={status.status} />
        <Box sx={{ minWidth: 0, flex: 1, display: "flex" }}>
            <TaskTitle>{title}</TaskTitle>
        </Box>
    </Box>
);
