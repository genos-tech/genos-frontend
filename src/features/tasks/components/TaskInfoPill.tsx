import { AppTooltip } from "../../../components/ui/AppTooltip";
import { fmt, useTranslation } from "../../../i18n";
import { TaskProps } from "../../../types/tasks";
import { formatTaskDisplayId } from "../utils/taskDisplayId";
import { TaskPill } from "./card";

type TaskInfoPillProps = {
    task: TaskProps;
    onOpen: () => void;
};

/**
 * Unified Task pill — id │ Title │ Status, all in one shape that is the single
 * "open task" affordance. Lifted out of `NoteHeaderActions` so the chat thread
 * header renders the exact same control. It is the shared `TaskPill`
 * (MIP-1124); this adds the tooltip and the accessible name. The status is
 * suppressed when status info is missing.
 */
export const TaskInfoPill = ({ task, onOpen }: TaskInfoPillProps) => {
    const { t } = useTranslation();
    const id = formatTaskDisplayId(task);
    return (
        <AppTooltip
            size="sm"
            title={
                task.title
                    ? fmt(t.notes.header.openTaskTooltipWithTitle, { id, title: task.title })
                    : fmt(t.notes.header.openTaskTooltip, { id })
            }
        >
            <TaskPill
                aria-label={
                    task.title
                        ? fmt(t.notes.header.openTaskAriaWithTitle, { id, title: task.title })
                        : fmt(t.notes.header.openTaskAria, { id })
                }
                task={{
                    id: task.id,
                    displayId: task.displayId,
                    title: task.title,
                    status: task.status?.status || null,
                }}
                onOpen={onOpen}
            />
        </AppTooltip>
    );
};
