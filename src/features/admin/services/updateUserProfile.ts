import axios from "axios";

import { getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";

type updateUserProfileProps = {
    accessToken: string | null;
    userId: string;
    userName?: string;
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
        userName,
        customStatus,
        isOfflineForced,
        role,
        baseCountry,
        setErrorMessage,
    } = props;

    try {
        const api = authApi(accessToken);
        if (api) {
            // Build the payload from only the fields the caller actually
            // supplied. Previously every key was sent on every call, so a
            // status / role / country edit also pushed `is_offline_forced:
            // false` and silently cleared the user's "appear offline" flag.
            // Each editor passes exactly one field, so an `undefined` check
            // is enough to scope the write to that field.
            const payload: Record<string, unknown> = { user_id: userId };
            if (userName !== undefined) payload.username = userName;
            if (customStatus !== undefined) payload.custom_status = customStatus;
            if (isOfflineForced !== undefined) {
                payload.is_offline_forced = isOfflineForced === "true";
            }
            if (role !== undefined) payload.role = role;
            if (baseCountry !== undefined) payload.base_country = baseCountry;

            const res = await api.put("/user/profile/", payload);
            return res.data;
        } else {
            console.error("Unauthorized. Auth toke is not found.");
            if (setErrorMessage) {
                setErrorMessage(getMessages().admin.auth.errors.tokenMissing);
            }
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 400) {
                console.error("HTTP 400 error:", error.response?.data);
            } else if (error.response?.status === 401) {
                console.error("HTTP 401 error:", error.response?.data);
                if (setErrorMessage) {
                    setErrorMessage(getMessages().admin.auth.errors.unauthorized);
                }
            } else {
                console.error("API error:", error.response?.status, error.response?.data);
            }
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
