import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";

export type DeleteTeamFolderResult =
    | { ok: true; deletedFolderIds: number[]; deletedNoteIds: number[] }
    // The server REFUSES to destroy a colleague's work: a subtree
    // holding anyone else's notes or subfolders comes back 409 with the
    // counts, so the UI can say what has to be cleared first.
    | { ok: false; blocked: true; foreignNoteCount: number; foreignFolderCount: number }
    | { ok: false; blocked: false };

export const deleteTeamNoteFolder = async (
    myself: UserProps,
    folderId: number,
    accessToken: string | null
): Promise<DeleteTeamFolderResult> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query = `team_id=${myself.teamId}&user_id=${myself.userId}&folder_id=${folderId}`;
            const res = await api.delete(`/note/team/folder/?${query}`);
            return {
                ok: true,
                deletedFolderIds: res.data?.deletedFolderIds ?? [],
                deletedNoteIds: res.data?.deletedNoteIds ?? [],
            };
        }
        console.error("Unauthorized. Auth token is not found.");
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 409) {
                return {
                    ok: false,
                    blocked: true,
                    foreignNoteCount: error.response.data?.foreignNoteCount ?? 0,
                    foreignFolderCount: error.response.data?.foreignFolderCount ?? 0,
                };
            }
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
    return { ok: false, blocked: false };
};
