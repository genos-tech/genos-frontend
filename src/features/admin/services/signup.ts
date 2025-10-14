import axios from "axios";
import { nonAuthApi } from "../../../services/api";

export const signUp = async (
    username: string,
    email: string,
    password: string,
    isSystemUser: boolean,
    setErrorMessage?: (value: string) => void
) => {
    const is_system_user: boolean = isSystemUser;
    try {
        const api = nonAuthApi();
        const res = await api.post("/user/signup/", {
            username,
            email,
            password,
            is_system_user,
        });
        return res.data;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 400) {
                console.error("HTTP 400 error:", error.response?.data);
                if (setErrorMessage) {
                    if (isSystemUser) {
                        setErrorMessage("Please try with a different name.");
                    } else {
                        setErrorMessage("Please try with a different email.");
                    }
                }
            } else {
                console.error("API error:", error.response?.status, error.response?.data);
            }
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
