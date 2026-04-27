import axios from "axios";

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
        if (axios.isAxiosError(error)) {
            if (!error.response) {
                console.error("Network error:", error.message);
                setErrorMessage?.("Network error. Please check your connection and try again.");
            } else if (error.response.status === 401) {
                console.error("Unauthorized. Please log in again.");
                setErrorMessage?.("Unauthorized. Please log in again.");
            } else {
                console.error("API error:", error.response.status, error.response.data);
                setErrorMessage?.("Something went wrong. Please try again later.");
            }
        } else {
            console.error("Unexpected error:", error);
            setErrorMessage?.("An unexpected error occurred. Please try again.");
        }
    }
};
