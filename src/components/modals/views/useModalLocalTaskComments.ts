import { useState } from "react";

import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { TaskCommentProps } from "../../../types/tasks";

/**
 * Modal-local stand-ins for the comment slots that `useTaskManagement`
 * hoists globally (`taskComments` / `taskCommentLines`).
 *
 * Those slots are shared on purpose so the HOST page's task preview and
 * the chat thread's Comments tab stay in sync — they always show the
 * SAME task. A modal view is the exception: it renders a *different*
 * task on top of the host page, and passing the global slots through
 * let the modal's comment-load effect overwrite the host preview's
 * comments (open task-B from task-A's preview → task-A's Comments tab
 * silently shows task-B's comments, and keeps them after the modal
 * closes because the host's load effect has no reason to re-fire).
 *
 * Spread the returned fields into the modal's `useTM` override so the
 * modal-hosted preview/thread reads+writes its own slots. Everything
 * comment-related that must still reach the host stays global:
 * `isTaskCommentUpdated` is only a refetch nudge (each consumer
 * refetches its OWN task's comments, so cross-task corruption can't
 * happen through it) and the `genos:task-touched` events are scoped by
 * task id at the subscriber.
 */
export const useModalLocalTaskComments = (): Pick<
    TaskManagementState,
    "taskComments" | "setTaskComments" | "taskCommentLines" | "setTaskCommentLines"
> => {
    const [taskComments, setTaskComments] = useState<TaskCommentProps[]>([]);
    const [taskCommentLines, setTaskCommentLines] = useState<number>(0);
    return { setTaskCommentLines, setTaskComments, taskCommentLines, taskComments };
};
