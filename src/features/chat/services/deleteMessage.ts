import axios from "axios";

import { authApi } from "../../../services/api";
import { isLegacyNumericId } from "../../../utils/legacyId";

export const deleteMessage = async (
    accessToken: string | null,
    chatType: number,
    chatId: number,
    messageId: number,
    setErrorMessage?: (value: string) => void
) => {
    // PUNCH LIST (v3 chatId migration): the per-type message endpoints
    // bind `{dm,gm,project,mdm}_id` and `message_id` to integer fields.
    // v3 deletes go through `channelService.delete`.
    if (!isLegacyNumericId(chatId) || !isLegacyNumericId(messageId)) {
        console.warn("[deleteMessage] skipped: v3 UUID id, delete not persisted");
        setErrorMessage?.("This chat hasn't migrated yet — please retry from the v3 view.");
        return;
    }
    try {
        const api = authApi(accessToken);
        if (api) {
            if (chatType === 1) {
                const res = await api.put("/dm/message/", {
                    dm_id: chatId,
                    message_id: messageId,
                    is_deleted: true,
                });
                return res.data;
            } else if (chatType === 2) {
                const res = await api.put("/gm/message/", {
                    gm_id: chatId,
                    message_id: messageId,
                    is_deleted: true,
                });
                return res.data;
            } else if (chatType === 3) {
                const res = await api.put("/pm/message/", {
                    project_id: chatId,
                    message_id: messageId,
                    is_deleted: true,
                });
                return res.data;
            } else if (chatType === 4) {
                const res = await api.put("/mdm/message/", {
                    mdm_id: chatId,
                    message_id: messageId,
                    is_deleted: true,
                });
                return res.data;
            } else {
                console.error("Unexpected chat type:", chatType);
            }
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
