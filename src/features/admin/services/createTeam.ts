import axios from "axios";

import { getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";
import { teamEmailFor } from "./teamEmail";

export const createTeam = async (
    accessToken: string | null,
    teamName: string,
    userId: string,
    setErrorMessage?: (value: string) => void,
    withStarter?: boolean,
    departments?: string[]
) => {
    const m = getMessages().admin.auth.errors;
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post("/team/create/", {
                team_name: teamName,
                team_email: teamEmailFor(teamName),
                owner_id: userId,
                // Backend requires the literal boolean true to seed —
                // omitted entirely when off.
                ...(withStarter === true ? { with_starter: true } : {}),
                // Omitted when none are named; the server makes the departments (a tag, an
                // @group, a team folder and an open chat each) and an open "general" chat.
                ...(departments && departments.length > 0 ? { departments } : {}),
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
                    // The department list was refused (the form checks first, so this is a
                    // backstop); every other 400 here is a taken team name.
                    setErrorMessage(
                        error.response?.data?.code === "invalid_departments"
                            ? m.invalidDepartments
                            : m.duplicateTeamName
                    );
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
