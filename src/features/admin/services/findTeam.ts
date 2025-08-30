import axios from "axios";

import { authApi } from "../../../services/api";

export const findTeam = async (
    accessToken: string | null,
    teamId: string,
    setErrorMessage?: (value: string) => void
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query = `team_id=${teamId}`;
            const res = await api.get(`/team/exist/?${query}`);
            return res.data;
        } else {
            console.error("Unauthorized. Auth toke is not found.");
            if (setErrorMessage) {
                setErrorMessage("Unauthorized. Auth toke is not found.");
            }
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
            if (setErrorMessage) {
                setErrorMessage(`API error: ${error.response?.status}`);
            }
        } else {
            console.error("Unexpected error:", error);
            if (setErrorMessage) {
                setErrorMessage("Unexpected error");
            }
        }
    }
};
