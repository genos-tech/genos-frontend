import axios from "axios";

import { getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";

export const findTeam = async (
    accessToken: string | null,
    teamId: string,
    setErrorMessage?: (value: string) => void
) => {
    const m = getMessages().admin.auth.errors;
    try {
        const api = authApi(accessToken);
        if (api) {
            const query = `team_id=${teamId}`;
            const res = await api.get(`/team/exist/?${query}`);
            return res.data;
        } else {
            console.error("Unauthorized. Auth toke is not found.");
            if (setErrorMessage) {
                setErrorMessage(m.tokenMissing);
            }
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
            if (!error.response) {
                setErrorMessage?.(m.network);
            } else if (error.response.status === 404 || error.response.status === 500) {
                setErrorMessage?.(m.teamNotFound);
            } else {
                setErrorMessage?.(m.generic);
            }
        } else {
            console.error("Unexpected error:", error);
            setErrorMessage?.(m.unexpected);
        }
    }
};
