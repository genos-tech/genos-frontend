import axios from "axios";

import { getMessages } from "../../../i18n";
import { nonAuthApi } from "../../../services/api";

/**
 * Consume a verification token from the URL the user clicked in their
 * inbox. Returns true on success; on failure surfaces the backend's
 * `detail` (currently always `"invalid_or_expired"`).
 */
export const verifyEmail = async (
    token: string,
    setErrorMessage?: (value: string) => void
): Promise<boolean> => {
    try {
        const api = nonAuthApi();
        await api.get("/user/verify-email/", { params: { token } });
        return true;
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
        return false;
    }
};

/**
 * Request a fresh verification email. Backend always returns 200 (no
 * enumeration), so any 2xx is treated as success.
 */
export const resendVerificationEmail = async (
    email: string,
    setErrorMessage?: (value: string) => void
): Promise<boolean> => {
    try {
        const api = nonAuthApi();
        await api.post("/user/verify-email/resend/", { email });
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
