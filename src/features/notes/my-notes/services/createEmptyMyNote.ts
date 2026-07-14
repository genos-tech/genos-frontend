import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";

export const createEmptyMyNote = async (
    myself: UserProps,
    parentNoteId: number | null,
    title: string,
    accessToken: string | null,
    // Sidebar folder to file the new note into ("New note here" on a
    // folder row). Null/omitted = My Notes root.
    folderId: number | null = null,
    // Initial body blocks (markdown import). Omitted = the usual
    // one-empty-paragraph placeholder. A brand-new note's Yjs doc is
    // empty, so the editor seeds from this REST body on first open.
    body?: unknown[]
) => {
    const initBody = body ?? [
        {
            type: "paragraph",
            props: {
                textColor: "default",
                textAlignment: "left",
                backgroundColor: "default",
            },
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
                folder_id: folderId,
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
