import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";

const chatTypeNameLookup: { [key: number]: string } = {
    1: "dm",
    2: "gm",
    3: "pm",
};

export const loadSpecificThreadMessages = async (
    myself: UserProps,
    chatType: number,
    chatId: number,
    theadId: number,
    accessToken: string | null
) => {
    try {
        // TODO: this should be done by worker.
        const api = authApi(accessToken);
        if (api) {
            const queryParts = [
                `team_id=${myself.teamId}`,
                `team_name=${myself.teamName}`,
                `user_id=${myself.userId}`,
                `${chatTypeNameLookup[chatType]}_id=${chatId}`,
                `thread_id=${theadId}`,
            ];
            const query = queryParts.join("&");
            const res = await api.get(
                `/${chatTypeNameLookup[chatType]}/threadMessagesById/?${query}`
            );
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
