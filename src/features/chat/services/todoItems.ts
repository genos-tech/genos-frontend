import { PartialBlock } from "@blocknote/core";
import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { TodoItemProps } from "../../../types/chat";

export interface CreateTodoItemInput {
    localDate: string;
    title: string;
    notes?: PartialBlock[] | null;
    categoryId?: number | null;
    sortOrder?: number;
}

export const createTodoItem = async (
    accessToken: string | null,
    myself: UserProps,
    input: CreateTodoItemInput
): Promise<TodoItemProps | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) return;
        const res = await api.post("/todo/items/", {
            team_id: myself.teamId,
            local_date: input.localDate,
            title: input.title,
            notes: input.notes ?? null,
            category_id: input.categoryId ?? null,
            sort_order: input.sortOrder ?? 0,
        });
        return res.data as TodoItemProps;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(
                "createTodoItem API error:",
                error.response?.status,
                error.response?.data
            );
        } else {
            console.error("createTodoItem unexpected error:", error);
        }
    }
};

export interface UpdateTodoItemPatch {
    title?: string;
    notes?: PartialBlock[] | null;
    isCompleted?: boolean;
    categoryId?: number | null;
    sortOrder?: number;
}

export const updateTodoItem = async (
    accessToken: string | null,
    itemId: number,
    patch: UpdateTodoItemPatch
): Promise<TodoItemProps | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) return;
        const body: Record<string, unknown> = {};
        if (patch.title !== undefined) body.title = patch.title;
        if (patch.notes !== undefined) body.notes = patch.notes;
        if (patch.isCompleted !== undefined) body.is_completed = patch.isCompleted;
        if (patch.categoryId !== undefined) body.category_id = patch.categoryId;
        if (patch.sortOrder !== undefined) body.sort_order = patch.sortOrder;
        const res = await api.patch(`/todo/items/${itemId}/`, body);
        return res.data as TodoItemProps;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(
                "updateTodoItem API error:",
                error.response?.status,
                error.response?.data
            );
        } else {
            console.error("updateTodoItem unexpected error:", error);
        }
    }
};

export const deleteTodoItem = async (
    accessToken: string | null,
    itemId: number
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) return false;
        await api.delete(`/todo/items/${itemId}/`);
        return true;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(
                "deleteTodoItem API error:",
                error.response?.status,
                error.response?.data
            );
        } else {
            console.error("deleteTodoItem unexpected error:", error);
        }
        return false;
    }
};
