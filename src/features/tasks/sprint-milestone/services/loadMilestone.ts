import axios from "axios";

import { authApi } from "../../../../services/api";
import { MilestoneResponse } from "../types";
import { ConvertedTaskRef, MILESTONE_CONVERTED_CODE } from "./convertTaskMilestone";

/** What reading a milestone by id can come back with. */
export type MilestoneLookup =
    | { kind: "found"; milestone: MilestoneResponse["milestone"] }
    // The milestone became a task (MIP-1042). An old link follows this to the task.
    | { kind: "converted"; task: ConvertedTaskRef }
    | { kind: "missing" };

export const lookupMilestone = async (
    milestoneId: number,
    accessToken: string | null
): Promise<MilestoneLookup> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.get(`/milestone/${milestoneId}/`, {
                // A converted milestone answers 410 with the task it became. That is
                // an answer, not a failure: it must not raise the "request failed"
                // toast on the way to the redirect.
                validateStatus: (status) => (status >= 200 && status < 300) || status === 410,
            });
            if (res.status === 410) {
                const body = res.data as { code?: unknown; convertedToTask?: ConvertedTaskRef };
                if (body?.code === MILESTONE_CONVERTED_CODE && body.convertedToTask) {
                    return { kind: "converted", task: body.convertedToTask };
                }
                return { kind: "missing" };
            }
            return { kind: "found", milestone: (res.data as MilestoneResponse).milestone };
        }
        console.error("Unauthorized. Auth token is not found.");
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
    return { kind: "missing" };
};

export const loadMilestone = async (
    milestoneId: number,
    accessToken: string | null
): Promise<MilestoneResponse | undefined> => {
    const found = await lookupMilestone(milestoneId, accessToken);
    return found.kind === "found" ? { milestone: found.milestone } : undefined;
};
