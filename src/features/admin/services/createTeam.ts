import axios from "axios";

import { getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";
import {
    classifyTeamCreateFailure,
    teamCreateCopy,
    type TeamCreateFailure,
} from "./teamCreateFailure";
import { teamEmailFor } from "./teamEmail";

export const createTeam = async (
    accessToken: string | null,
    teamName: string,
    userId: string,
    onFailure?: (failure: TeamCreateFailure) => void,
    withStarter?: boolean,
    departments?: string[]
) => {
    const messages = getMessages();
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
            onFailure?.({ field: "form", message: messages.admin.auth.errors.tokenMissing });
        }
    } catch (error: unknown) {
        // Which field a refusal belongs to, and its words, are decided in one place
        // (`teamCreateFailure.ts`, MIP-1841). An axios error with no response is a network failure;
        // anything else that was not an HTTP answer is unknown, so it gets the generic line.
        if (!axios.isAxiosError(error)) {
            console.error("Unexpected error:", error);
            onFailure?.({ field: "form", message: messages.admin.auth.errors.generic });
            return;
        }
        console.error("Team create failed:", error.response?.status, error.response?.data);
        onFailure?.(
            classifyTeamCreateFailure(
                { status: error.response?.status ?? null, data: error.response?.data },
                teamCreateCopy(messages)
            )
        );
    }
};
