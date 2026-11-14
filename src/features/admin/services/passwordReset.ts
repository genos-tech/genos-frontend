import axios from "axios";

import { getMessages } from "../../../i18n";
import { nonAuthApi } from "../../../services/api";

/**
 * Step 1 of the reset flow: ask the backend to email a reset link.
 * Backend deliberately returns 200 regardless of whether the email is
 * registered (no enumeration), so we treat any 2xx as success.
 */
export const requestPasswordReset = async (
    email: string,
    setErrorMessage?: (value: string) => void
): Promise<boolean> => {
    try {
        const api = nonAuthApi();
        await api.post("/user/password-reset/request/", { email });
        return true;
    } catch (error: unknown) {
        const m = getMessages().admin.auth.errors;
        if (axios.isAxiosError(error)) {
            if (!error.response) {
                console.error("Network error:", error.message);
                setErrorMessage?.(m.network);
            } else {
                console.error("API error:", error.response.status, error.response.data);
                setErrorMessage?.(m.generic);
            }
        } else {
            console.error("Unexpected error:", error);
            setErrorMessage?.(m.unexpected);
        }
        return false;
    }
};

/**
 * Did the reset end any connected AI app or API key? A reset now ends all of them and the
 * confirm response carries only the counts: `{connections_ended, api_keys_revoked}`. An older
 * API answers with an empty body, so anything that is not a count (nothing, "", a string, a
 * negative or a non-finite number) counts as zero and the caller shows no notice.
 */
export const credentialsWereEnded = (data: unknown): boolean => {
    if (data === null || typeof data !== "object") return false;
    const { connections_ended, api_keys_revoked } = data as Record<string, unknown>;
    const count = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);
    return count(connections_ended) + count(api_keys_revoked) > 0;
};

export interface PasswordResetOutcome {
    /** The reset ended at least one connected AI app or API key. */
    credentialsEnded: boolean;
}

/**
 * Step 2 of the reset flow: submit the token from the email plus the
 * new password. Returns the outcome on success and `null` on failure. On a 400
 * the backend's `detail` message is surfaced verbatim (covers invalid/expired
 * token and Django password-validator failures).
 */
export const confirmPasswordReset = async (
    token: string,
    newPassword: string,
    setErrorMessage?: (value: string) => void
): Promise<PasswordResetOutcome | null> => {
    try {
        const api = nonAuthApi();
        const res = await api.post("/user/password-reset/confirm/", {
            token,
            new_password: newPassword,
        });
        return { credentialsEnded: credentialsWereEnded(res?.data) };
    } catch (error: unknown) {
        const m = getMessages().admin.auth.errors;
        if (axios.isAxiosError(error)) {
            if (!error.response) {
                console.error("Network error:", error.message);
                setErrorMessage?.(m.network);
            } else if (error.response.status === 400) {
                const detail = error.response.data?.detail;
                setErrorMessage?.(typeof detail === "string" ? detail : m.generic);
            } else {
                console.error("API error:", error.response.status, error.response.data);
                setErrorMessage?.(m.generic);
            }
        } else {
            console.error("Unexpected error:", error);
            setErrorMessage?.(m.unexpected);
        }
        return null;
    }
};
