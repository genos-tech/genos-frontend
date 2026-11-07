import { TaskIdText } from "./card";

type PreviewTaskIdChipProps = {
    // Anything `formatTaskDisplayId` can resolve: a task, or a milestone's
    // `{ displayId, id: backing taskId }`.
    task: { displayId?: string | null; id?: number | string | null } | null | undefined;
};

// The id in the preview header, between the status button and the status
// label. One component so the task and the milestone preview can't drift apart
// in look or position. It is the same quiet id as every other task surface
// (`TaskIdText`); copying is a keyboard control here, as the chip it replaces
// was a button.
export const PreviewTaskIdChip = ({ task }: PreviewTaskIdChipProps) => (
    <TaskIdText fallback="N/A" task={task} focusable />
);
