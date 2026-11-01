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

// The endpoint refuses more than this many ids per request
// (`TaskVelocityView.MAX_TASK_IDS`). A larger set is split into requests of
// this size and their series summed.
export const VELOCITY_MAX_TASK_IDS = 500;

/**
 * Sum per-chunk series into one. Every chunk covers the same dense buckets,
 * and each count is of DISTINCT tasks within its own, disjoint, id set, so
 * adding them gives exactly what one request for all the ids would.
 */
const mergeVelocity = (parts: VelocityPoint[][]): VelocityPoint[] => {
    const byDate = new Map<string, VelocityPoint>();
    for (const part of parts) {
        for (const p of part) {
            const acc = byDate.get(p.date);
            if (!acc) {
                byDate.set(p.date, { ...p });
                continue;
            }
            acc.created += p.created;
            acc.started += p.started;
            acc.closed += p.closed;
            acc.updated += p.updated;
        }
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
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
        const fetchChunk = async (ids: number[]): Promise<VelocityPoint[]> => {
            const params = new URLSearchParams();
            params.set("team_id", teamId);
            params.set("task_ids", ids.join(","));
            params.set("start", start);
            params.set("end", end);
            params.set("granularity", granularity);
            const res = await api.get<VelocityResponse>(`/task/velocity/?${params.toString()}`);
            return res.data?.velocity ?? [];
        };
        const chunks: number[][] = [];
        for (let i = 0; i < taskIds.length; i += VELOCITY_MAX_TASK_IDS) {
            chunks.push(taskIds.slice(i, i + VELOCITY_MAX_TASK_IDS));
        }
        // One chunk failing fails the chart: a partial sum would read as a
        // quiet week.
        const parts = await Promise.all(chunks.map(fetchChunk));
        return parts.length === 1 ? parts[0] : mergeVelocity(parts);
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("Velocity fetch failed:", error.response?.status, error.response?.data);
        } else {
            console.error("Velocity fetch unexpected error:", error);
        }
        return null;
    }
};
