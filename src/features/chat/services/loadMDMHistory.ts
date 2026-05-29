import axios from "axios";

import { authApi } from "../../../services/api";
import { isLegacyNumericId } from "../../../utils/legacyId";

export const loadMDMHistory = async (
    teamId: string,
    teamName: string,
    userId: string,
    accessToken: string | null,
    mdmId?: number
) => {
    // PUNCH LIST (v3 chatId migration): `/api/v2/mdm/history/` binds
    // `mdm_id` to an integer field; callers may pass a v3 UUID after
    // the chatId flip. Skip when not legacy-numeric — the v3 channel
    // sync path already populates IDB for those channels.
    // `mdmId === undefined` is the "load all MDMs" form and is allowed.
    if (mdmId !== undefined && !isLegacyNumericId(mdmId)) {
        return { chat_history: [], flagged_messages: [] };
    }
    try {
        const api = authApi(accessToken);
        if (api) {
            const params: Record<string, string | number> = {
                team_id: teamId,
                team_name: teamName,
                user_id: userId,
            };
            if (mdmId) {
                params.mdm_id = mdmId;
            }
            const res = await api.get("/mdm/history/", { params });
            return res.data;
        } else {
            console.error("Unauthorized. Auth token is not found.");
            return { chat_history: [], flagged_messages: [] };
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
        return { chat_history: [], flagged_messages: [] };
    }
};
