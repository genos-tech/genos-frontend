import axios from "axios";

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
        if (axios.isAxiosError(error)) {
            if (!error.response) {
                console.error("Network error:", error.message);
                setErrorMessage?.("Network error. Please check your connection and try again.");
            } else if (error.response.status === 429) {
                console.error("Demo signin rate-limited:", error.response.data);
                setErrorMessage?.(
                    "Too many demo sign-ins from this network. Please try again later."
                );
            } else {
                console.error("API error:", error.response.status, error.response.data);
                setErrorMessage?.("Could not create demo session. Please try again later.");
            }
        } else {
            console.error("Unexpected error:", error);
            setErrorMessage?.("An unexpected error occurred. Please try again.");
        }
    }
};
