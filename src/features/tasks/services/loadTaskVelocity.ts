import axios from "axios";

import { authApi } from "../../../services/api";

/** Bucketing granularity of the velocity series. */
export type VelocityGranularity = "day" | "week";

/**
 * One bucket of the task-velocity series. `date` is the bucket start
 * (the day itself, or the ISO-Monday of the week). Each count is the
 * number of DISTINCT tasks that were created / started (→WIP) / closed /
 * updated (touched at all) in that bucket — see the backend
 * `TaskVelocityView`. Series intentionally overlap (a closed task is
 * also `updated`).
 */
export type VelocityPoint = {
    date: string;
    created: number;
    started: number;
    closed: number;
    updated: number;
};

type VelocityResponse = {
    velocity: VelocityPoint[];
    granularity: VelocityGranularity;
};

/**
 * Fetch the per-bucket velocity series for a set of tasks across a
 * window. Powers the dashboard "Velocity" section. Returns `null` on
 * auth failure, network error, or empty input — the caller renders an
 * empty state rather than a partial chart. Mirrors `loadMilestoneBurndown`.
 */
export const loadTaskVelocity = async (
    taskIds: number[],
    start: string,
    end: string,
    granularity: VelocityGranularity,
    teamId: string,
    accessToken: string | null
): Promise<VelocityPoint[] | null> => {
    if (taskIds.length === 0) return null;
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const params = new URLSearchParams();
        params.set("team_id", teamId);
        params.set("task_ids", taskIds.join(","));
        params.set("start", start);
        params.set("end", end);
        params.set("granularity", granularity);
        const res = await api.get<VelocityResponse>(`/task/velocity/?${params.toString()}`);
        return res.data?.velocity ?? null;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("Velocity fetch failed:", error.response?.status, error.response?.data);
        } else {
            console.error("Velocity fetch unexpected error:", error);
        }
        return null;
    }
};
