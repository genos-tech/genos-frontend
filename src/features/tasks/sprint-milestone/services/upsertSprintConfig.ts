import axios from "axios";

import { authApi } from "../../../../services/api";
import { SprintConfigResponse } from "../types";

export type SprintConfigInput = {
    projectId: number;
    durationDays: number;
    anchorDate: string;
    autoRoll?: boolean;
    upcomingHorizon?: number;
};

export const upsertSprintConfig = async (
    input: SprintConfigInput,
    accessToken: string | null
): Promise<SprintConfigResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post("/sprint/config/", {
                project_id: input.projectId,
                duration_days: input.durationDays,
                anchor_date: input.anchorDate,
                auto_roll: input.autoRoll ?? true,
                upcoming_horizon: input.upcomingHorizon ?? 6,
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
