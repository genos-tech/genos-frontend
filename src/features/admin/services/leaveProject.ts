import axios from "axios";

import { authApi } from "../../../services/api";

/**
 * Hard-delete the requester's ProjectMembers row. Owners are rejected
 * server-side and the Leave button is hidden client-side when the
 * requester is the project owner.
 */
export const leaveProject = async (
    accessToken: string | null,
    teamId: string,
    projectId: number,
    attendeeId: string,
    setErrorMessage?: (value: string) => void
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            setErrorMessage?.("Authorization token is missing.");
            return false;
        }
        await api.post("/project/leave/", {
            team_id: teamId,
            project_id: projectId,
            attendee_id: attendeeId,
        });
        return true;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            const msg = (error.response?.data as { error?: string })?.error;
            setErrorMessage?.(msg || `Failed to leave project (${error.response?.status}).`);
        } else {
            setErrorMessage?.("Unexpected error while leaving the project.");
        }
        return false;
    }
};
