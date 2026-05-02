import axios from "axios";

import { authApi } from "../../../../services/api";
import { SprintResponse } from "../types";

export type CreateSprintInput = {
    projectId: number;
    name: string;
    startDate: string;
    endDate: string;
};

export const createSprint = async (
    input: CreateSprintInput,
    accessToken: string | null
): Promise<SprintResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post("/sprint/", {
                project_id: input.projectId,
                name: input.name,
                start_date: input.startDate,
                end_date: input.endDate,
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
