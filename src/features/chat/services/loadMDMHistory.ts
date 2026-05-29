import axios from "axios";

import { authApi } from "../../../services/api";

// PUNCH LIST (v3 chatId migration): the legacy `/api/v2/mdm/history/`
// endpoint expects an integer `mdm_id`. Post-flip, MDM `chatId` is the
// v3 Channel UUID at the type level; callers cast `string → number` to
// satisfy TS but the value still rides through as a UUID at runtime.
// Skip the call when the id isn't a legacy numeric string — the v3
// channel sync path already populates the IDB for those channels.
const isLegacyNumericId = (value: number | undefined): boolean => {
    if (value === undefined) return true;
    return /^\d+$/.test(String(value));
};

export const loadMDMHistory = async (
    teamId: string,
    teamName: string,
    userId: string,
    accessToken: string | null,
    mdmId?: number
) => {
    if (!isLegacyNumericId(mdmId)) {
        // v3 UUID-shaped id; legacy endpoint can't serve it.
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
