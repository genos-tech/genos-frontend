import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { isLegacyNumericId } from "../../../utils/legacyId";

export const updateFlagMessage = async (
    accessToken: string | null,
    myself: UserProps,
    flagged_message: {
        chat_type: number;
        chat_id: number;
        thread_id: number;
        message_id: number;
    },
    setErrorMessage?: (value: string) => void
) => {
    // PUNCH LIST (v3 chatId migration): `/chat/master/` binds the
    // nested `flagged_message.chat_id` and `message_id` to integer
    // fields. v3 flags live on the unified `Flag` model.
    if (
        !isLegacyNumericId(flagged_message.chat_id) ||
        !isLegacyNumericId(flagged_message.message_id)
    ) {
        console.warn("[updateFlagMessage] skipped: v3 UUID id, flag state not persisted");
        return;
    }
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.put("/chat/master/", {
                team: myself.teamId,
                user: myself.userId,
                flagged_message: flagged_message,
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
                    setErrorMessage("Failed to update flagged message.");
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
