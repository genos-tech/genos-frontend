import axios from "axios";

import { getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";

export type InviteResultStatus =
    | "sent"
    | "already_invited_resent"
    | "already_member"
    | "invalid_email"
    | "failed";

export interface InviteResult {
    email: string;
    status: InviteResultStatus;
}

/**
 * POST /team/invite/ — owner/editor (enforced server-side; the UI also
 * gates the button). Sends an invite email per address, each link locked
 * to that address. Returns a per-email result array so the modal can
 * show what happened to each one; returns null on a request-level
 * failure (and reports via setErrorMessage).
 *
 * Pass `projectId` to invite GUESTS instead of members. The server then
 * writes a project membership on acceptance and NO team membership, so
 * the invitee never sees the wider workspace. It is one optional
 * parameter here because it is one optional field there — the whole
 * guest flow reuses this endpoint deliberately, since an external
 * person has no inbox to receive a request in.
 */
export const inviteTeamMembers = async (
    accessToken: string | null,
    teamId: string,
    emails: string[],
    setErrorMessage?: (value: string) => void,
    projectId?: number | null
): Promise<InviteResult[] | null> => {
    const m = getMessages().admin.inviteMembers.errors;
    try {
        const api = authApi(accessToken);
        if (!api) {
            setErrorMessage?.(m.tokenMissing);
            return null;
        }
        const res = await api.post("/team/invite/", {
            team_id: teamId,
            emails,
            // Omitted entirely when absent: the server branches on the
            // key being present, so sending `null` would read as a
            // guest invite to nowhere.
            ...(projectId != null ? { project_id: projectId } : {}),
        });
        return (res.data?.results ?? []) as InviteResult[];
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("Invite API error:", error.response?.status, error.response?.data);
            setErrorMessage?.(m.requestFailed);
        } else {
            console.error("Unexpected invite error:", error);
            setErrorMessage?.(m.unexpected);
        }
        return null;
    }
};
