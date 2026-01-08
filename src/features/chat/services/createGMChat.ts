import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { replaceSpacesWithUnderscore } from "../../../utils/stringHelper";

export const createGMChat = async (
    accessToken: string | null,
    myself: UserProps,
    chatName: string,
    isPrivate: boolean,
    setErrorMessage?: (value: string) => void
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post("/gm/create/", {
                group_email: `${myself.teamId}-${replaceSpacesWithUnderscore(
                    chatName
                )}@genos.tech`,
                group_name: chatName,
                owner_user: myself.userId,
                owner_team: myself.teamId,
                is_private: isPrivate,
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
                if (setErrorMessage) {
                    setErrorMessage("GM already exists.");
                }
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
