import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { isLegacyNumericId } from "../../../utils/legacyId";

export const updatePinnedChats = async (
    accessToken: string | null,
    myself: UserProps,
    pinned_chat: {
        chat_type: number;
        chat_id: number;
    },
    setErrorMessage?: (value: string) => void
) => {
    // PUNCH LIST (v3 chatId migration): `/chat/master/` binds the
    // nested `pinned_chat.chat_id` to an integer field. Short-circuit
    // when the id is a v3 UUID — pin state for v3 channels lives on
    // the unified `Channel` row (Track D will route this via
    // `channelService`).
    if (!isLegacyNumericId(pinned_chat.chat_id)) {
        console.warn("[updatePinnedChats] skipped: v3 UUID chatId, pin state not persisted");
        return;
    }
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.put("/chat/master/", {
                pinned_chat: pinned_chat,
                team: myself.teamId,
                user: myself.userId,
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
                    setErrorMessage("Failed to update pinned chats.");
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
