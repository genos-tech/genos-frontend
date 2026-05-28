import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { TodoCategoryProps } from "../../../types/chat";

export const loadTodoCategories = async (
    accessToken: string | null,
    myself: UserProps
): Promise<TodoCategoryProps[] | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) return;
        const res = await api.get(`/todo/categories/?team_id=${myself.teamId}`);
        return res.data as TodoCategoryProps[];
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(
                "loadTodoCategories error:",
                error.response?.status,
                error.response?.data
            );
        } else {
            console.error("loadTodoCategories unexpected error:", error);
        }
    }
};

export const createTodoCategory = async (
    accessToken: string | null,
    myself: UserProps,
    name: string,
    sortOrder = 0
): Promise<TodoCategoryProps | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) return;
        const res = await api.post("/todo/categories/", {
            team_id: myself.teamId,
            name,
            sort_order: sortOrder,
        });
        return res.data as TodoCategoryProps;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(
                "createTodoCategory error:",
                error.response?.status,
                error.response?.data
            );
        } else {
            console.error("createTodoCategory unexpected error:", error);
        }
    }
};

export const updateTodoCategory = async (
    accessToken: string | null,
    categoryId: number,
    patch: { name?: string; sortOrder?: number }
): Promise<TodoCategoryProps | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) return;
        const body: Record<string, unknown> = {};
        if (patch.name !== undefined) body.name = patch.name;
        if (patch.sortOrder !== undefined) body.sort_order = patch.sortOrder;
        const res = await api.patch(`/todo/categories/${categoryId}/`, body);
        return res.data as TodoCategoryProps;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(
                "updateTodoCategory error:",
                error.response?.status,
                error.response?.data
            );
        } else {
            console.error("updateTodoCategory unexpected error:", error);
        }
    }
};

export const deleteTodoCategory = async (
    accessToken: string | null,
    categoryId: number
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) return false;
        await api.delete(`/todo/categories/${categoryId}/`);
        return true;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(
                "deleteTodoCategory error:",
                error.response?.status,
                error.response?.data
            );
        } else {
            console.error("deleteTodoCategory unexpected error:", error);
        }
        return false;
    }
};
