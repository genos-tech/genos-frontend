import axios from "axios";

import { authApi } from "../../../../services/api";

export const deleteMilestone = async (
    milestoneId: number,
    accessToken: string | null
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            await api.delete(`/milestone/${milestoneId}/`);
            return true;
        }
        console.error("Unauthorized. Auth token is not found.");
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
    return false;
};
