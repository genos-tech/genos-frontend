import axios from "axios";

import { authApi } from "../../../../services/api";
import { MilestoneResponse } from "../types";

export const addMilestoneAssignee = async (
    milestoneId: number,
    userId: number | string,
    accessToken: string | null
): Promise<MilestoneResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post(`/milestone/${milestoneId}/assignees/`, {
                user_id: userId,
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

export const removeMilestoneAssignee = async (
    milestoneId: number,
    userId: number | string,
    accessToken: string | null
): Promise<MilestoneResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.delete(`/milestone/${milestoneId}/assignees/${userId}/`);
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
