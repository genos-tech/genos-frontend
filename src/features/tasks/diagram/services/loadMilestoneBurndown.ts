import axios from "axios";

import { authApi } from "../../../../services/api";
import { BurndownPoint } from "../types";

type BurndownResponse = {
    burndown: BurndownPoint[];
    total: number;
};

/**
 * Fetches the daily remaining-task series for a set of tasks across a
 * window. Used by the modal header's burndown sparkline. Returns
 * `null` on auth failure, network error, or empty input — the caller
 * shows nothing rather than a partial chart.
 */
export const loadMilestoneBurndown = async (
    taskIds: number[],
    start: string,
    end: string,
    accessToken: string | null
): Promise<BurndownPoint[] | null> => {
    if (taskIds.length === 0) return null;
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const params = new URLSearchParams();
        params.set("task_ids", taskIds.join(","));
        params.set("start", start);
        params.set("end", end);
        const res = await api.get<BurndownResponse>(`/task/burndown/?${params.toString()}`);
        return res.data?.burndown ?? null;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("Burndown fetch failed:", error.response?.status, error.response?.data);
        } else {
            console.error("Burndown fetch unexpected error:", error);
        }
        return null;
    }
};
