import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { isLegacyNumericId } from "../../../utils/legacyId";

export const updateReadStatus = async (
    accessToken: string | null,
    myself: UserProps,
    chatType: number,
    chatId: number,
    isThread: boolean,
    threadId: number,
    lastReadMessageId: number,
    setErrorMessage?: (value: string) => void
) => {
    // PUNCH LIST (v3 chatId migration): `/chat/read/` binds `chat_id`
    // / `last_read_message_id` to integer fields. v3 channels persist
    // the read cursor via `channelService.markRead` (UUID-keyed) so
    // skip the legacy call rather than 500 the request.
    if (!isLegacyNumericId(chatId) || !isLegacyNumericId(lastReadMessageId)) {
        return;
    }
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.put("/chat/read/", {
                chat_id: chatId,
                chat_type: chatType,
                is_thread: isThread,
                last_read_message_id: lastReadMessageId,
                team_id: myself.teamId,
                thread_id: threadId,
                user_id: myself.userId,
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
