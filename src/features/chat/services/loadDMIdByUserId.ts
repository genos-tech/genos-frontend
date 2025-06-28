import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";

export const loadDMIdByUserId = async (
    myself: UserProps,
    dmPartnerUserId: string,
    accessToken: string | null
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `user_1_id=${myself.userId}&user_2_id=${dmPartnerUserId}`;
            const res = await api.get(`/dm/getDMId/?${query}`);
            return res.data.dm_id;
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
