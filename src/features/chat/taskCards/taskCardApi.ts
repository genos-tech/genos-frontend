import axios from "axios";

import { v3ApiBaseURL } from "../../../services/v3Api";
import type { LiveCard } from "./taskCardTypes";

export const fetchTaskCards = async (accessToken: string, ids: number[]): Promise<LiveCard[]> => {
    const res = await axios.get<{ cards: LiveCard[] }>(`${v3ApiBaseURL()}/api/v3/tasks/cards/`, {
        params: { ids: ids.join(",") },
        headers: { Authorization: `Bearer ${accessToken}` },
        withCredentials: true,
        // A card that cannot be read falls back to the stored message; nothing to say.
        suppressErrorToast: true,
    });
    return res.data.cards;
};
