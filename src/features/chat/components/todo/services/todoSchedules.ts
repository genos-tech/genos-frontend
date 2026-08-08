import axios from "axios";

import { authApi } from "../../../../../services/api";
import { UserProps } from "../../../../../types/admin";
import { TodoScheduleProps } from "../../../../../types/chat";

// Mirrors todoItems.ts: thin axios wrappers over /todo/schedules/,
// mapping the client's camelCase to the server's snake_case request body.
// Reads come back already camelCased by ToDoScheduleSerializer.

export const loadTodoSchedules = async (
    accessToken: string | null,
    myself: UserProps
): Promise<TodoScheduleProps[] | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) return;
        const res = await api.get("/todo/schedules/", {
            params: { team_id: myself.teamId },
        });
        return res.data as TodoScheduleProps[];
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(
                "loadTodoSchedules API error:",
                error.response?.status,
                error.response?.data
            );
        } else {
            console.error("loadTodoSchedules unexpected error:", error);
        }
    }
};

export interface CreateTodoScheduleInput {
    title: string;
    rrule: string;
    startDate: string;
    categoryId?: number | null;
    isActive?: boolean;
}

export const createTodoSchedule = async (
    accessToken: string | null,
    myself: UserProps,
    input: CreateTodoScheduleInput
): Promise<TodoScheduleProps | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) return;
        const res = await api.post("/todo/schedules/", {
            team_id: myself.teamId,
            title: input.title,
            rrule: input.rrule,
            start_date: input.startDate,
            category_id: input.categoryId ?? null,
            is_active: input.isActive ?? true,
        });
        return res.data as TodoScheduleProps;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(
                "createTodoSchedule API error:",
                error.response?.status,
                error.response?.data
            );
        } else {
            console.error("createTodoSchedule unexpected error:", error);
        }
    }
};

export interface UpdateTodoSchedulePatch {
    title?: string;
    rrule?: string;
    startDate?: string;
    categoryId?: number | null;
    isActive?: boolean;
    // `null` re-arms the rule (resets the cursor so it can fire again today).
    lastMaterializedDate?: string | null;
}

export const updateTodoSchedule = async (
    accessToken: string | null,
    scheduleId: number,
    patch: UpdateTodoSchedulePatch
): Promise<TodoScheduleProps | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) return;
        const body: Record<string, unknown> = {};
        if (patch.title !== undefined) body.title = patch.title;
        if (patch.rrule !== undefined) body.rrule = patch.rrule;
        if (patch.startDate !== undefined) body.start_date = patch.startDate;
        if (patch.categoryId !== undefined) body.category_id = patch.categoryId;
        if (patch.isActive !== undefined) body.is_active = patch.isActive;
        if (patch.lastMaterializedDate !== undefined)
            body.last_materialized_date = patch.lastMaterializedDate;
        const res = await api.patch(`/todo/schedules/${scheduleId}/`, body);
        return res.data as TodoScheduleProps;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(
                "updateTodoSchedule API error:",
                error.response?.status,
                error.response?.data
            );
        } else {
            console.error("updateTodoSchedule unexpected error:", error);
        }
    }
};

export const deleteTodoSchedule = async (
    accessToken: string | null,
    scheduleId: number
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) return false;
        await api.delete(`/todo/schedules/${scheduleId}/`);
        return true;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(
                "deleteTodoSchedule API error:",
                error.response?.status,
                error.response?.data
            );
        } else {
            console.error("deleteTodoSchedule unexpected error:", error);
        }
        return false;
    }
};
