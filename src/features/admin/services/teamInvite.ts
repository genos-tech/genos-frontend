import axios from "axios";

import { authApi, nonAuthApi } from "../../../services/api";

export type InvitePreviewStatus = "invalid" | "expired" | "account_exists" | "no_account";

export interface InvitePreview {
    valid: boolean;
    status: InvitePreviewStatus;
    team_name: string;
    invited_email: string;
}

const INVALID_PREVIEW: InvitePreview = {
    valid: false,
    status: "invalid",
    team_name: "",
    invited_email: "",
};

/**
 * GET /team/invite/preview/ — PUBLIC. Describes a token so the
 * AcceptInviteHandler can route the visitor (sign up vs sign in vs
 * accept). Any network/HTTP failure collapses to an "invalid" preview so
 * the caller has a single error path.
 */
export const previewInvite = async (token: string): Promise<InvitePreview> => {
    try {
        const api = nonAuthApi();
        const res = await api.get("/team/invite/preview/", { params: { token } });
        const data = res.data ?? {};
        return {
            valid: Boolean(data.valid),
            status: (data.status ?? "invalid") as InvitePreviewStatus,
            team_name: data.team_name ?? "",
            invited_email: data.invited_email ?? "",
        };
    } catch (error: unknown) {
        console.error("Invite preview failed:", error);
        return INVALID_PREVIEW;
    }
};

export type AcceptInviteError = "email_mismatch" | "invalid" | "expired" | "generic";

export interface AcceptInviteResult {
    ok: boolean;
    team_id?: string;
    team_name?: string;
    error?: AcceptInviteError;
}

/**
 * POST /team/invite/accept/ — AUTHENTICATED. Consumes the single-use,
 * email-locked token for the current user. Surfaces `email_mismatch`
 * distinctly so the caller can prompt the "wrong account" recovery.
 */
export const acceptInvite = async (
    accessToken: string | null,
    token: string
): Promise<AcceptInviteResult> => {
    try {
        const api = authApi(accessToken);
        if (!api) return { ok: false, error: "generic" };
        const res = await api.post("/team/invite/accept/", { token });
        return {
            ok: true,
            team_id: res.data?.team_id,
            team_name: res.data?.team_name,
        };
    } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.status === 400) {
            const detail = (error.response.data as { detail?: string })?.detail;
            if (detail === "email_mismatch" || detail === "expired" || detail === "invalid") {
                return { ok: false, error: detail };
            }
        }
        console.error("Invite accept failed:", error);
        return { ok: false, error: "generic" };
    }
};
