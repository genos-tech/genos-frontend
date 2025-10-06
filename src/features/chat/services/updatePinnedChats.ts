import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";

export const updatePinnedChats = async (
    accessToken: string | null,
    myself: UserProps,
    pinned_chats: {
        chat_type: number;
        chat_id: number;
    }[],
    setErrorMessage?: (value: string) => void
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.put("/chat/master/", {
                team: myself.teamId,
                user: myself.userId,
                pinned_chats: pinned_chats.length > 0 ? pinned_chats : null,
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
                    setErrorMessage("Failed to update PM message.");
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
