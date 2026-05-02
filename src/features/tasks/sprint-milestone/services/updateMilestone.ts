import axios from "axios";

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
    dueDate?: string | null;
    tags?: unknown;
    assigneeIds?: Array<number | string>;
    reporterId?: number | string | null;
};

export const updateMilestone = async (
    input: UpdateMilestoneInput,
    accessToken: string | null
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
            if (input.dueDate !== undefined) body.due_date = input.dueDate;
            if (input.tags !== undefined) body.tags = input.tags;
            if (input.assigneeIds !== undefined) body.assignee_ids = input.assigneeIds;
            if ("reporterId" in input) body.reporter_id = input.reporterId;
            const res = await api.patch(`/milestone/${input.milestoneId}/`, body);
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
