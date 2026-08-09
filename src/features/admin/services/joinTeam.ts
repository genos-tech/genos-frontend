import axios from "axios";

import { getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";

export const joinTeam = async (
    accessToken: string | null,
    teamId: string,
    attendeeId: string,
    setErrorMessage?: (value: string) => void
) => {
    const m = getMessages().admin.auth.errors;
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post("/team/join/", {
                team_id: teamId,
                attendee_id: attendeeId,
            });
            return res.data;
        } else {
            console.error("Unauthorized. Authentication token was not found.");
            if (setErrorMessage) {
                setErrorMessage(m.tokenMissing);
            }
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 400) {
                console.error("HTTP 400 error:", error.response?.data);
                if (setErrorMessage) {
                    setErrorMessage(m.teamNotFoundShort);
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
