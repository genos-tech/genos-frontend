import dayjs from "dayjs";

import { UserProps } from "../../../types/admin";
import { TaskTableProps } from "../../../types/tasks";
import { QuickAddDraft } from "./quickAddDraft";

type OptimisticQuickTaskArgs = {
    taskId: number;
    // Friendly "<code>-<n>" from the create response; null falls back to
    // "#<id>" via `formatTaskDisplayId` until the background reload lands.
    displayId: string | null;
    draft: QuickAddDraft;
    // The row the task was created under; null = a root task.
    parent: TaskTableProps | null;
    projectId: number;
    teamId: string | null | undefined;
    // The assignee's member record, for the name/avatar columns.
    assignee: UserProps | undefined;
};

// The `allTasks` row inserted the moment a quick-add create succeeds.
// `setIsNewTaskCreated(true)` alone is NOT enough to surface the task — the
// refetch only reloads the previewed task and the flag can stay `true` — so
// the table and the board both insert this row optimistically and let the
// background reload reconcile it with the server's.
export const buildOptimisticQuickTask = ({
    taskId,
    displayId,
    draft,
    parent,
    projectId,
    teamId,
    assignee,
}: OptimisticQuickTaskArgs): TaskTableProps => {
    const nowIso = new Date().toISOString();
    return {
        id: String(taskId),
        displayId,
        title: draft.title,
        priority: draft.priority,
        effortLevel: draft.effortLevel,
        createdDate: nowIso,
        updatedAt: nowIso,
        dueDate: draft.dueDate,
        daysLeft: draft.dueDate
            ? dayjs(draft.dueDate).startOf("day").diff(dayjs().startOf("day"), "day")
            : null,
        status: draft.status,
        assigneeId: draft.assigneeId,
        assigneeEmail: assignee?.userEmail ?? null,
        assigneeName: assignee?.userName ?? null,
        assigneeImgPath: assignee?.avatarImgPath ?? null,
        parentTaskId: parent ? String(parent.id) : null,
        // The backend makes a top-level task its own chain root.
        rootTaskId: parent ? (parent.rootTaskId ?? Number(parent.id)) : taskId,
        threadId: null,
        tags: draft.tags,
        // The server's format ("/a/b/"): the tag filters match `/<name>/`
        // against it, so a different separator would hide this row from a
        // matching tag filter until the reload.
        concatTags:
            draft.tags.length > 0
                ? "/" + draft.tags.map((tag) => tag.tagName).join("/") + "/"
                : null,
        teamId: teamId ?? null,
        projectId,
        isMilestone: false,
        milestoneId: parent?.milestoneId ?? null,
        sprintId: parent?.sprintId ?? null,
    };
};
