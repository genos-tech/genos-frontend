import axios from "axios";

import { authApi } from "../../../../services/api";
import { SprintResponse, SprintStatus } from "../types";

export type UpdateSprintInput = {
    sprintId: number;
    name?: string;
    startDate?: string;
    endDate?: string;
    status?: SprintStatus;
};

export const updateSprint = async (
    input: UpdateSprintInput,
    accessToken: string | null
): Promise<SprintResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const body: Record<string, unknown> = {};
            if (input.name !== undefined) body.name = input.name;
            if (input.startDate !== undefined) body.start_date = input.startDate;
            if (input.endDate !== undefined) body.end_date = input.endDate;
            if (input.status !== undefined) body.status = input.status;
            const res = await api.patch(`/sprint/${input.sprintId}/`, body);
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
