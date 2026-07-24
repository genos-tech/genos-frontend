import axios from "axios";

import { authApi } from "../../../../services/api";
import { MilestoneResponse } from "../types";

export type CreateMilestoneInput = {
    projectId: number;
    title: string;
    // Chat-thread origin when the milestone is created from a DM/GM/MDM
    // thread — stored on the backing task row server-side (same columns
    // as task creation). Omit / null for every other entry point.
    chatType?: number | null;
    chatId?: string | null;
    threadId?: string | null;
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
    // Initial external links to seed the milestone with. Same shape as
    // `UpdateMilestoneInput.links`; usually empty on creation.
    links?: unknown;
    reporterId?: number | string | null;
    assigneeIds?: Array<number | string>;
    // Custom-field values picked in the create form — seeded onto the
    // milestone's backing task row server-side.
    customFieldValues?: Record<string, string | string[]>;
};

export const createMilestone = async (
    input: CreateMilestoneInput,
    accessToken: string | null
): Promise<MilestoneResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post("/milestone/", {
                project_id: input.projectId,
                title: input.title,
                chat_type: input.chatType ?? null,
                chat_id: input.chatId ?? null,
                thread_id: input.threadId ?? null,
                sprint_id: input.sprintId ?? null,
                description: input.description ?? null,
                status: input.status ?? "Open",
                status_code: input.statusCode ?? null,
                priority: input.priority ?? null,
                priority_code: input.priorityCode ?? null,
                effort_level: input.effortLevel ?? null,
                effort_level_code: input.effortLevelCode ?? null,
                due_date: input.dueDate ?? null,
                links: input.links ?? null,
                tags: input.tags ?? null,
                reporter_id: input.reporterId ?? null,
                assignee_ids: input.assigneeIds ?? [],
                ...(input.customFieldValues != null
                    ? { custom_field_values: input.customFieldValues }
                    : {}),
            });
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
