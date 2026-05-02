import axios from "axios";

import { authApi } from "../../../../services/api";
import { MilestoneResponse } from "../types";

export const loadMilestone = async (
    milestoneId: number,
    accessToken: string | null
): Promise<MilestoneResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.get(`/milestone/${milestoneId}/`);
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
