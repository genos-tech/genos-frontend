import axios from "axios";

import { getMessages } from "../../../i18n";
import { nonAuthApi } from "../../../services/api";

export const signIn = async (
    email: string,
    password: string,
    setErrorMessage?: (value: string) => void
) => {
    try {
        const api = nonAuthApi();
        const res = await api.post("/user/signin/", { email, password });
        return res.data;
    } catch (error: unknown) {
        const m = getMessages().admin.auth.errors;
        if (axios.isAxiosError(error)) {
            if (!error.response) {
                console.error("Network error:", error.message);
                setErrorMessage?.(m.network);
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
    }
};
