import axios from "axios";

import { getMessages } from "../../../i18n";
import { nonAuthApi } from "../../../services/api";
import type { SignInResponse, SignInUnverifiedResult } from "../../../types/admin";

export const signIn = async (
    email: string,
    password: string,
    setErrorMessage?: (value: string) => void
): Promise<SignInResponse | SignInUnverifiedResult | undefined> => {
    try {
        const api = nonAuthApi();
        const res = await api.post("/user/signin/", { email, password });
        return res.data as SignInResponse;
    } catch (error: unknown) {
        const m = getMessages().admin.auth.errors;
        if (axios.isAxiosError(error)) {
            if (!error.response) {
                console.error("Network error:", error.message);
                setErrorMessage?.(m.network);
            } else if (
                error.response.status === 403 &&
                error.response.data?.detail === "email_not_verified"
            ) {
                // The backend returns 403 with this discriminator when
                // credentials are valid but the user hasn't clicked the
                // verification link yet. Surface a sentinel so the caller
                // can render the resend UI instead of a generic error.
                return {
                    kind: "unverified",
                    email: error.response.data?.email ?? email,
                };
            } else if (error.response.status === 401) {
                console.error("Unauthorized. Please log in again.");
                setErrorMessage?.(m.unauthorized);
            } else {
                console.error("API error:", error.response.status, error.response.data);
                setErrorMessage?.(m.generic);
            }
        } else {
            console.error("Unexpected error:", error);
            setErrorMessage?.(m.unexpected);
        }
        return undefined;
    }
};
