import axios from "axios";

import { authApi } from "../../../services/api";

type updateUserProfileProps = {
    accessToken: string | null;
    userId: string;
    customStatus?: string;
    isOfflineForced?: string;
    role?: string;
    baseCountry?: string;
    setErrorMessage?: (value: string) => void;
};
export const updateUserProfile = async (props: updateUserProfileProps) => {
    const {
        accessToken,
        userId,
        customStatus,
        isOfflineForced,
        role,
        baseCountry,
        setErrorMessage,
    } = props;

    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.put("/user/profile/", {
                user_id: userId,
                custom_status: customStatus,
                is_offline_forced: isOfflineForced
                    ? isOfflineForced === "true"
                        ? true
                        : false
                    : false,
                role: role,
                base_country: baseCountry,
            });
            return res.data;
        } else {
            console.error("Unauthorized. Auth toke is not found.");
            if (setErrorMessage) {
                setErrorMessage("Unauthorized. Auth toke is not found.");
            }
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 400) {
                console.error("HTTP 400 error:", error.response?.data);
            } else if (error.response?.status === 401) {
                console.error("HTTP 401 error:", error.response?.data);
                if (setErrorMessage) {
                    setErrorMessage("Unauthorized. Please log in again.");
                }
            } else {
                console.error("API error:", error.response?.status, error.response?.data);
            }
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
