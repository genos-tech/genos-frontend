import axios from "axios";

import { getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";

export const createTeam = async (
    accessToken: string | null,
    teamName: string,
    userId: string,
    setErrorMessage?: (value: string) => void,
    withStarter?: boolean
) => {
    const m = getMessages().admin.auth.errors;
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post("/team/create/", {
                team_name: teamName,
                team_email: `${teamName}@genos.tech`,
                owner_id: userId,
                // Backend requires the literal boolean true to seed —
                // omitted entirely when off.
                ...(withStarter === true ? { with_starter: true } : {}),
            });
            return res.data;
        } else {
            console.error("Unauthorized. Auth toke is not found.");
            if (setErrorMessage) {
                setErrorMessage(m.tokenMissing);
            }
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 400) {
                console.error("HTTP 400 error:", error.response?.data);
                if (setErrorMessage) {
                    setErrorMessage(m.duplicateTeamName);
                }
            } else if (error.response?.status === 401) {
                console.error("HTTP 401 error:", error.response?.data);
                if (setErrorMessage) {
                    setErrorMessage(m.unauthorized);
                }
            } else {
                console.error("API error:", error.response?.status, error.response?.data);
            }
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
