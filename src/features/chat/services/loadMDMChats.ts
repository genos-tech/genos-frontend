import axios from "axios";

import { authApi } from "../../../services/api";
import { ChatProps, FlaggedMessageProps } from "../../../types/chat";

export interface MDMChatsListResponse {
    chats: ChatProps[];
    flagged_messages: FlaggedMessageProps[];
}

export const loadMDMChats = async (
    teamId: string,
    teamName: string,
    userId: string,
    accessToken: string | null
): Promise<MDMChatsListResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("Unauthorized. Auth toke is not found.");
            return;
        }
        const query = `team_id=${teamId}&team_name=${encodeURIComponent(teamName)}&user_id=${userId}`;
        const res = await api.get(`/mdm/chats/?${query}`);
        return res.data;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
