import axios from "axios";

import { authApi } from "../../../services/api";
import { isLegacyNumericId } from "../../../utils/legacyId";

export const loadSpecificGM = async (
    teamId: string,
    teamName: string,
    userId: string,
    gmId: number,
    accessToken: string | null
) => {
    // PUNCH LIST (v3 chatId migration): `/gm/history/` binds `gm_id`
    // to an integer field. v3 GM history loads via the channel sync
    // path.
    if (!isLegacyNumericId(gmId)) {
        return undefined;
    }
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `team_id=${teamId}&team_name=${teamName}&user_id=${userId}&gm_id=${gmId}`;
            const res = await api.get(`/gm/history/?${query}`);
            return res.data;
        } else {
            console.error("Unauthorized. Auth toke is not found.");
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
