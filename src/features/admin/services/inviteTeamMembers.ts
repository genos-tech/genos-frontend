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
 * POST /team/invite/ — owner-only (enforced server-side; the UI also
 * gates the button by isTeamOwner). Sends an invite email per address,
 * each link locked to that address. Returns a per-email result array so
 * the modal can show what happened to each one; returns null on a
 * request-level failure (and reports via setErrorMessage).
 */
export const inviteTeamMembers = async (
    accessToken: string | null,
    teamId: string,
    emails: string[],
    setErrorMessage?: (value: string) => void
): Promise<InviteResult[] | null> => {
    const m = getMessages().admin.inviteMembers.errors;
    try {
        const api = authApi(accessToken);
        if (!api) {
            setErrorMessage?.(m.tokenMissing);
            return null;
        }
        const res = await api.post("/team/invite/", { team_id: teamId, emails });
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
