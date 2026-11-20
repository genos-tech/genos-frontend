import { PartialBlock } from "@blocknote/core";

import { ProjectManagementState } from "../../../hooks/common/useProjectManagement";
import { UserProps } from "../../../types/admin";
import { TagListProps, TaskProps } from "../../../types/tasks";
import { isStatusName, statusSolid, toneSolid } from "../meta/taskTone";
import { Milestone } from "../sprint-milestone/types";
import { effortLevels, priorities } from "./taskMeta";

// Build a TaskProps-shaped wrapper around a milestone so we can reuse
// `TaskMainBlock`/`TaskBodyBlock`/`TaskTabBlock` directly. The milestone's
// backing TaskMaster row (`m.taskId`) becomes `id` so all task plumbing
// (comments, notes, attachments, body) routes through the existing task
// endpoints. Fields that don't apply to milestones are filled with safe
// defaults.
export const milestoneToTaskProps = (
    m: Milestone,
    project: ProjectManagementState["currentProject"],
    fallbackUser: UserProps,
    attachments: TaskProps["attachments"] = [],
    assignee?: UserProps,
    reporter?: UserProps | null,
    collaborators: UserProps[] = []
): TaskProps => {
    const backingTaskId = (m.taskId ?? m.milestoneId) as number;
    // Milestones store only the priority / effort label + numeric code,
    // not the chip colors. Look the colors up from the master tables so
    // the chips in TaskMainBlock render with the same styling as the
    // dropdown options (instead of falling back to transparent).
    const priorityMeta = priorities.find((p) => p.priority === m.priority);
    const effortMeta = effortLevels.find((e) => e.level === m.effortLevel);
    return {
        // Backing task id; falls back to the milestone id if the
        // backend hasn't backfilled yet (extremely rare on fresh data).
        id: backingTaskId,
        project: project,
        title: m.title,
        body: (m.description as PartialBlock[]) ?? [],
        assignee: assignee ?? fallbackUser,
        // No reporter stays none (MIP-1730): the viewer in its place was PATCHed in by the
        // first edit. The assignee fallback below is a separate question (see its task).
        reporter: reporter ?? null,
        collaborators,
        // Thread origin off the backing task (serialized on the
        // milestone payload) — v3 UUID strings riding the legacy
        // number-typed slots, same cast as everywhere else.
        chatType: m.chatType ?? null,
        chatId: (m.chatId ?? null) as unknown as number | null,
        threadId: (m.threadId ?? null) as unknown as number | null,
        startDate: m.startDate ?? null,
        dueDate: m.dueDate ?? "",
        status: {
            code: 0,
            status: m.status as string,
            // The status's own fill from the tone source; an unknown one is neutral.
            ...(isStatusName(m.status as string)
                ? statusSolid(m.status as Parameters<typeof statusSolid>[0])
                : { color: toneSolid("neutral").bg, textColor: toneSolid("neutral").fg }),
        },
        priority: {
            code: m.priorityCode ?? -1,
            priority: m.priority ?? "",
            color: priorityMeta?.color ?? "",
            textColor: priorityMeta?.textColor ?? "",
        },
        effortLevel: {
            code: m.effortLevelCode ?? -1,
            level: m.effortLevel ?? "",
            color: effortMeta?.color ?? "",
            textColor: effortMeta?.textColor ?? "",
        },
        tags: (m.tags as TagListProps[]) ?? [],
        // Milestones now persist their own `links` (mirrors
        // `TaskMaster.links`). Reading from `m.links` ensures the
        // URL/Link section in the milestone preview survives a
        // milestone refresh — the previous hard-coded `[]` would
        // wipe a freshly-added link the moment any field on the
        // milestone bumped `tsUpdatedAt`.
        links: (m.links as TaskProps["links"]) ?? [],
        attachments,
        parentTaskId: null,
        // The backing task is itself the root, so children created
        // beneath it inherit `rootTaskId = backingTaskId`. This makes
        // `TaskSubTasksBlock`'s "+ Sub Task" button work out of the
        // box for milestones (it requires `rootTaskId != null`).
        rootTaskId: backingTaskId,
        isMilestone: true,
        // Sprint id is exposed via the SprintMilestonePicker in
        // TaskMainBlock; we attach it as a loose extra field so the
        // picker can read it without TS gymnastics on the official
        // TaskProps shape.
        sprintId: m.sprintId ?? null,
        // Grouping folder (MIP-847), edited by MilestoneFolderPicker in
        // TaskMainBlock the same loose-field way as `sprintId`.
        folderId: m.folderId ?? null,
        milestoneId: m.milestoneId,
        // Custom-field values come off the backing task row via the
        // milestone payload; `?? {}` (not undefined) so the preview's
        // save path knows the map was LOADED — undefined would make
        // persistFromTaskContent skip the diff entirely.
        customFieldValues: m.customFieldValues ?? {},
    } as TaskProps;
};
