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
            if (!error.response) {
                setErrorMessage?.("Network error. Please check your connection and try again.");
            } else if (error.response.status === 404 || error.response.status === 500) {
                setErrorMessage?.("Team not found. Please check the Team ID and try again.");
            } else {
                setErrorMessage?.("Something went wrong. Please try again later.");
            }
        } else {
            console.error("Unexpected error:", error);
            setErrorMessage?.("An unexpected error occurred. Please try again.");
        }
    }
};
