import axios from "axios";

import { authApi } from "../../../../services/api";
import { SprintConfigResponse } from "../types";

export const loadSprintConfig = async (
    projectId: number,
    accessToken: string | null
): Promise<SprintConfigResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.get(`/sprint/config/?project_id=${projectId}`);
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
