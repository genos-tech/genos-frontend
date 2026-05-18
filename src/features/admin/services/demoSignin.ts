import axios from "axios";

import { getMessages } from "../../../i18n";
import { nonAuthApi } from "../../../services/api";
import { DemoSignInResponse } from "../../../types/admin";

export const demoSignIn = async (
    setErrorMessage?: (value: string) => void
): Promise<DemoSignInResponse | undefined> => {
    try {
        const api = nonAuthApi();
        const res = await api.post<DemoSignInResponse>("/user/demo/");
        return res.data;
    } catch (error: unknown) {
        const m = getMessages().admin.auth.errors;
        if (axios.isAxiosError(error)) {
            if (!error.response) {
                console.error("Network error:", error.message);
                setErrorMessage?.(m.network);
            } else if (error.response.status === 429) {
                console.error("Demo signin rate-limited:", error.response.data);
                setErrorMessage?.(m.demoRateLimited);
            } else {
                console.error("API error:", error.response.status, error.response.data);
                setErrorMessage?.(m.demoFailed);
            }
        } else {
            console.error("Unexpected error:", error);
            setErrorMessage?.(m.unexpected);
        }
    }
};
