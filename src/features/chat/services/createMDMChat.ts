import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";

export const createMDMChat = async (
    accessToken: string | null,
    myself: UserProps,
    memberIds: string[],
    displayName?: string,
    setErrorMessage?: (value: string) => void
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post("/mdm/create/", {
                owner_user: myself.userId,
                owner_team: myself.teamId,
                member_ids: memberIds,
                display_name: displayName || null,
            });
            return res.data;
        } else {
            console.error("Unauthorized. Auth token is not found.");
            if (setErrorMessage) {
                setErrorMessage("Unauthorized. Auth token is not found.");
            }
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 400) {
                console.error("HTTP 400 error:", error.response?.data);
                if (setErrorMessage) {
                    setErrorMessage(error.response?.data?.message || "Failed to create multi-user DM.");
                }
            } else if (error.response?.status === 401) {
                console.error("HTTP 401 error:", error.response?.data);
                if (setErrorMessage) {
                    setErrorMessage("Unauthorized. Please log in again.");
                }
            } else {
                console.error("API error:", error.response?.status, error.response?.data);
            }
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
