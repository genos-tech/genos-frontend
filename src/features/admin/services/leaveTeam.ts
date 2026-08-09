import axios from "axios";

import { fmt, getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";

/**
 * Soft-delete the requester's TeamMembers row. Owners are rejected
 * server-side and the Leave button is hidden client-side when the
 * requester is the team owner. Returns true on success so the caller
 * can run cleanup (clear team-scoped localStorage, navigate to the
 * team-picker, etc.).
 */
export const leaveTeam = async (
    accessToken: string | null,
    teamId: string,
    attendeeId: string,
    setErrorMessage?: (value: string) => void
): Promise<boolean> => {
    const messages = getMessages();
    try {
        const api = authApi(accessToken);
        if (!api) {
            setErrorMessage?.(messages.admin.auth.errors.tokenMissing);
            return false;
        }
        await api.post("/team/leave/", {
            team_id: teamId,
            attendee_id: attendeeId,
        });
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
