import axios from "axios";

import { getMessages } from "../../../i18n";
import { nonAuthApi } from "../../../services/api";
import type { SignUpResponse, SignUpVerificationResponse } from "../../../types/admin";

export const signUp = async (
    username: string,
    email: string,
    password: string,
    isSystemUser: boolean,
    setErrorMessage?: (value: string) => void
): Promise<SignUpResponse | SignUpVerificationResponse | undefined> => {
    const is_system_user: boolean = isSystemUser;
    try {
        const api = nonAuthApi();
        const res = await api.post("/user/signup/", {
            username,
            email,
            password,
            is_system_user,
        });
        return res.data as SignUpResponse | SignUpVerificationResponse;
    } catch (error: unknown) {
        const m = getMessages().admin.auth.errors;
        if (axios.isAxiosError(error)) {
            if (!error.response) {
                console.error("Network error:", error.message);
                setErrorMessage?.(m.network);
            } else if (error.response.status === 400) {
                console.error("HTTP 400 error:", error.response.data);
                if (isSystemUser) {
                    setErrorMessage?.(m.duplicateName);
                } else {
                    setErrorMessage?.(m.duplicateEmail);
                }
            } else {
                console.error("API error:", error.response.status, error.response.data);
                setErrorMessage?.(m.generic);
            }
        } else {
            console.error("Unexpected error:", error);
            setErrorMessage?.(m.unexpected);
        }
    }
};
