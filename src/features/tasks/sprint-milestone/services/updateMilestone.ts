import axios from "axios";
import { Socket } from "socket.io-client";

import { authApi } from "../../../../services/api";
import { MilestoneResponse } from "../types";

export type UpdateMilestoneInput = {
    milestoneId: number;
    title?: string;
    sprintId?: number | null;
    description?: unknown;
    status?: string;
    statusCode?: number | null;
    priority?: string | null;
    priorityCode?: number | null;
    effortLevel?: string | null;
    effortLevelCode?: number | null;
    startDate?: string | null;
    dueDate?: string | null;
    tags?: unknown;
    // External links list (`{ id, url, title, isGitHub }[]`). Mirrors
    // the `TaskProps.links` shape; persisted on `MilestoneMaster.links`
    // and mirrored onto the backing task by `_sync_backing_task`.
    links?: unknown;
    assigneeIds?: Array<number | string>;
    reporterId?: number | string | null;
    // Custom-field value map (see TaskProps.customFieldValues). Stored
    // on the milestone's BACKING TASK row server-side; omit the key to
    // leave stored values untouched.
    customFieldValues?: Record<string, string | string[]>;
    // Collaborator user ids. Stored on the milestone's BACKING TASK M2M
    // server-side; omit to leave untouched, `[]` clears.
    collaborators?: Array<number | string>;
};

export type MilestoneMentionContext = {
    socket: Socket;
    taskId: number;
    projectId: number;
    projectName: string;
    displayId?: string | null;
    tsUpdatedAt: string;
};

export const updateMilestone = async (
    input: UpdateMilestoneInput,
    accessToken: string | null,
    mentionCtx?: MilestoneMentionContext
): Promise<MilestoneResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const body: Record<string, unknown> = {};
            if (input.title !== undefined) body.title = input.title;
            // Sprint reassignment is intentionally explicit: callers
            // pass `sprintId: null` to clear the sprint, omit the key
            // entirely to leave it untouched.
            if ("sprintId" in input) body.sprint_id = input.sprintId;
            if (input.description !== undefined) body.description = input.description;
            if (input.status !== undefined) body.status = input.status;
            if (input.statusCode !== undefined) body.status_code = input.statusCode;
            if (input.priority !== undefined) body.priority = input.priority;
            if (input.priorityCode !== undefined) body.priority_code = input.priorityCode;
            if (input.effortLevel !== undefined) body.effort_level = input.effortLevel;
            if (input.effortLevelCode !== undefined)
                body.effort_level_code = input.effortLevelCode;
            if (input.startDate !== undefined) body.start_date = input.startDate;
            if (input.dueDate !== undefined) body.due_date = input.dueDate;
            if (input.tags !== undefined) body.tags = input.tags;
            if (input.links !== undefined) body.links = input.links;
            if (input.assigneeIds !== undefined) body.assignee_ids = input.assigneeIds;
            if ("reporterId" in input) body.reporter_id = input.reporterId;
            if (input.customFieldValues !== undefined)
                body.custom_field_values = input.customFieldValues;
            if (input.collaborators !== undefined) body.collaborators = input.collaborators;
            const res = await api.patch(`/milestone/${input.milestoneId}/`, body);

            // If the description changed and the backend returned mention
            // deltas, fan them out via the Flask task_body_mention socket path
            // (same mechanism as sendUpdatedSpecificTask).
            if (mentionCtx && res.data) {
                const newlyMentioned: string[] = res.data.newly_mentioned_user_ids ?? [];
                const allMentioned: string[] = res.data.all_mentioned_user_ids ?? newlyMentioned;
                const removedMentioned: string[] = res.data.removed_user_ids ?? [];
                if (newlyMentioned.length > 0 || removedMentioned.length > 0) {
                    mentionCtx.socket.emit("task_body_mention", {
                        task_id: mentionCtx.taskId,
                        task_title: res.data.milestone?.title ?? "",
                        project_id: mentionCtx.projectId,
                        project_name: mentionCtx.projectName,
                        display_id: mentionCtx.displayId ?? null,
                        // Use the real server timestamp from the response.
                        ts_mentioned_at: res.data.milestone?.tsUpdatedAt ?? mentionCtx.tsUpdatedAt,
                        newly_mentioned_user_ids: newlyMentioned,
                        all_mentioned_user_ids: allMentioned,
                        removed_user_ids: removedMentioned,
                    });
                }
            }

            return res.data;
        }
        console.error("Unauthorized. Auth token is not found.");
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
};

export const moveMilestoneToSprint = async (
    milestoneId: number,
    sprintId: number | null,
    accessToken: string | null
): Promise<MilestoneResponse | undefined> => {
    return updateMilestone({ milestoneId, sprintId }, accessToken);
};
