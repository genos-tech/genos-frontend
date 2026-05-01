import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { ChatNoteMetaProps, MyNoteMetaProps, TaskNoteMetaProps } from "../../../../types/notes";

// Each recent-note meta row carries a `tsOpenedAt` (set by the backend
// from `NoteRecentMaster.ts_opened_at`) so the frontend can sort the
// three arrays into one flat list ordered by most-recently-opened.
export type RecentMyNoteMeta = MyNoteMetaProps & { tsOpenedAt: string };
export type RecentTaskNoteMeta = TaskNoteMetaProps & { tsOpenedAt: string };
export type RecentChatNoteMeta = ChatNoteMetaProps & { tsOpenedAt: string };

export interface RecentNotesMetaResponse {
    personalNotes: RecentMyNoteMeta[];
    taskNotes: RecentTaskNoteMeta[];
    chatNotes: RecentChatNoteMeta[];
}

export const loadRecentNotesMeta = async (
    myself: UserProps,
    accessToken: string | null
): Promise<RecentNotesMetaResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `team_id=${myself.teamId}&user_id=${myself.userId}`;
            const res = await api.get(`/note/recent/meta/?${query}`);
            return res.data;
        } else {
            console.error("Unauthorized. Auth token is not found.");
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
