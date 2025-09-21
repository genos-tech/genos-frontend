import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";

export const createEmptyNote = async (
    myself: UserProps,
    parentNoteId: number | null,
    title: string,
    accessToken: string | null
) => {
    const initBody = [
        {
            type: "paragraph",
            props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
            content: [],
            children: [],
        },
    ];
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post("/note/personal/", {
                team_id: myself.teamId,
                user_id: myself.userId,
                parent_note_id: parentNoteId,
                title: title,
                body: initBody,
            });
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
