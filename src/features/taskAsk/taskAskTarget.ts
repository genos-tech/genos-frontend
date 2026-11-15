// What "Ask Genos about this task or milestone" is about (MIP-1057), and the two facts the ask needs
// about it that are easy to get wrong:
//
//   * the id is the task's own numeric id. For a MILESTONE that is its backing task row (the `taskId`
//     of the milestone payload), never the `milestoneId` and never the display id ("MIP-12"): the
//     server reads whether the row is a milestone, so the client cannot declare it.
//   * the ask's `team_id` is the team that OWNS the task. For a task of a project another team shared
//     with this one that is the HOST team, not the team the person is looking at: the server aligns a
//     top-level id to its team but not the `task_id` nested in `task_context`, so the wrong team is a
//     404 ("can't open") on a task the person can open.

import { isTaskId } from "../../services/agentApi";
import type { ProjectProps } from "../../types/tasks";
import { askGenosRefForTask, type AskGenosTaskRef } from "../spotlight/askGenosAbout";

export interface TaskAskTarget {
    /** `TaskMaster.task_id`; for a milestone, its backing task row's id. */
    taskId: number;
    /** The team that owns the task (see `resolveTaskTeamId`). */
    teamId: string;
    /** "MIP-12", or null for a task with none. Shown as the conversation's subject. */
    displayId: string | null;
    title: string;
    isMilestone: boolean;
}

/** The team the ask and its restore are addressed to: the host team of a project shared from another
 *  team, else the team the person is in. `projects` is the current team's project list, which is
 *  where the host of a shared project is known (`hostTeamId`); a task whose project is not in it is
 *  addressed to the current team. */
export const resolveTaskTeamId = (
    projectId: number | null | undefined,
    projects: ReadonlyArray<Pick<ProjectProps, "projectId" | "isExternal" | "hostTeamId">>,
    currentTeamId: string | null | undefined
): string | null => {
    if (projectId != null) {
        const project = projects.find((p) => p.projectId === projectId);
        if (project?.isExternal && project.hostTeamId) return String(project.hostTeamId);
    }
    return currentTeamId ? String(currentTeamId) : null;
};

/** Whether `target` is something an ask can be bound to: a real task id and a team. */
export const isUsableTaskAskTarget = (target: TaskAskTarget | null | undefined): boolean =>
    target != null && isTaskId(target.taskId) && Boolean(target.teamId);

/** The task as the `#` mention every ask about it keeps sending (frontend #694's path). With the
 *  server flag off `task_context` is ignored and this mention is what makes the ask about the task;
 *  with it on the server writes no second bullet for the same task. Null when there is nothing to
 *  call the task by (the mention needs a label); the ask then goes without it. */
export const taskAskMention = (target: TaskAskTarget): AskGenosTaskRef | null =>
    askGenosRefForTask({
        id: target.taskId,
        displayId: target.displayId,
        title: target.title,
        isMilestone: target.isMilestone,
    });
