import axios from "axios";

import { fmt, getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";

/**
 * PUT /api/v2/team/profile/ — change team name and/or owner. Server
 * enforces that only the current owner can call this; the frontend
 * gates the UI by the same rule. Either field is optional; supply at
 * least one. Resolves to true on success.
 */
export const updateTeamProfile = async (
    accessToken: string | null,
    teamId: string,
    updates: { teamName?: string; ownerId?: string },
    setErrorMessage?: (value: string) => void
): Promise<boolean> => {
    const messages = getMessages();
    try {
        const api = authApi(accessToken);
        if (!api) {
            setErrorMessage?.(messages.admin.auth.errors.tokenMissing);
            return false;
        }
        const body: Record<string, unknown> = { team_id: teamId };
        if (updates.teamName !== undefined) body.team_name = updates.teamName;
        if (updates.ownerId !== undefined) body.owner_id = updates.ownerId;
        await api.put("/team/profile/", body);
        return true;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            const msg = (error.response?.data as { error?: string })?.error;
            setErrorMessage?.(
                msg ||
                    fmt(messages.admin.serviceErrors.requestFailedStatus, {
                        status: error.response?.status ?? "unknown",
                    })
            );
        } else {
            setErrorMessage?.(messages.admin.serviceErrors.unexpected);
        }
        return false;
    }
};
