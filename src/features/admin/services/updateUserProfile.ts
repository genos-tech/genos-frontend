import axios from "axios";

import { getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";

type updateUserProfileProps = {
    accessToken: string | null;
    userId: string;
    userName?: string;
    customStatus?: string;
    /** Absolute ISO instant the custom status auto-clears, or `null` to clear
     *  the expiry (Slack "Don't clear" / auto-clear). `null` is meaningful and
     *  distinct from omitting the key — the server exempts this field from its
     *  None-strip so an explicit null actually wipes a stale expiry. */
    customStatusExpiry?: string | null;
    isOfflineForced?: string;
    role?: string;
    baseCountry?: string;
    phoneNumber?: string;
    /** An IANA zone name, or `""` to clear it. The server rejects
     *  anything `zoneinfo` doesn't recognise. */
    currentLocation?: string;
    aboutMe?: string;
    setErrorMessage?: (value: string) => void;
};
export const updateUserProfile = async (props: updateUserProfileProps) => {
    const {
        accessToken,
        userId,
        userName,
        customStatus,
        customStatusExpiry,
        isOfflineForced,
        role,
        baseCountry,
        phoneNumber,
        currentLocation,
        aboutMe,
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
            // Present-and-null is the "clear the expiry" signal, so gate on
            // `!== undefined` (not truthiness) — a null must reach the wire.
            if (customStatusExpiry !== undefined) {
                payload.custom_status_expiry = customStatusExpiry;
            }
            if (isOfflineForced !== undefined) {
                payload.is_offline_forced = isOfflineForced === "true";
            }
            if (role !== undefined) payload.role = role;
            if (baseCountry !== undefined) payload.base_country = baseCountry;
            if (phoneNumber !== undefined) payload.phone_number = phoneNumber;
            if (currentLocation !== undefined) payload.current_location = currentLocation;
            if (aboutMe !== undefined) payload.about_me = aboutMe;

            const res = await api.put("/user/profile/", payload);
            return res.data;
        } else {
            console.error("Unauthorized. Authentication token was not found.");
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
