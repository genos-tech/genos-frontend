import axios from "axios";

import { authApi } from "../../../services/api";
import { createRequestCache } from "../../../services/requestCache";
import { UserProps } from "../../../types/admin";
import { TaskDeliveryProps } from "../../../types/tasks";

// Rows change from the GitHub webhook, which no local event covers, so
// the TTL is the only staleness bound; the block also refetches on
// window focus (the "merged it on GitHub, alt-tab back" path).
const deliveryCache = createRequestCache<TaskDeliveryProps[]>({ ttlMs: 15_000 });

/**
 * Fetch the branches and PRs delivering a task (MIP-687 `TaskDelivery`),
 * oldest first. Backs the "Delivery" row in TaskMainBlock.
 *
 * Resolves to `[]` on any failure (including the 404 a caller who can't
 * open the task gets) so the row simply doesn't render.
 */
export const loadTaskDeliveries = async (
    myself: UserProps,
    taskId: number,
    accessToken: string | null,
    options?: { forceRefresh?: boolean }
): Promise<TaskDeliveryProps[]> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("loadTaskDeliveries: no auth token");
            return [];
        }
        const params = new URLSearchParams({
            team_id: String(myself.teamId ?? ""),
            task_id: String(taskId),
        });
        return await deliveryCache.get(
            `deliveries:${taskId}:${myself.teamId}`,
            async () => {
                const res = await api.get(`/task/deliveries/?${params.toString()}`);
                return Array.isArray(res.data) ? (res.data as TaskDeliveryProps[]) : [];
            },
            { forceRefresh: options?.forceRefresh }
        );
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(
                "loadTaskDeliveries API error:",
                error.response?.status,
                error.response?.data
            );
        } else {
            console.error("loadTaskDeliveries unexpected error:", error);
        }
        return [];
    }
};
