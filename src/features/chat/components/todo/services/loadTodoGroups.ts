import axios from "axios";

import { authApi } from "../../../../../services/api";
import { UserProps } from "../../../../../types/admin";
import { TodoGroupProps } from "../../../../../types/chat";

export const loadTodoGroups = async (
    myself: UserProps,
    accessToken: string | null,
    from?: string,
    to?: string
): Promise<TodoGroupProps[] | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("Unauthorized. Auth token is not found.");
            return;
        }
        const params: string[] = [`team_id=${myself.teamId}`];
        if (from) params.push(`from=${from}`);
        if (to) params.push(`to=${to}`);
        const res = await api.get(`/todo/groups/?${params.join("&")}`);
        return res.data as TodoGroupProps[];
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
