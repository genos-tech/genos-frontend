import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { NoteFolderVisibility, TeamNoteFolderProps } from "../../../../types/notes";

// Rename / move / re-scope a team folder.
//
// KEY-PRESENCE semantics, same as the personal folder PUT: a key is only
// sent when that change is intended, because an explicit `null` is
// meaningful for BOTH fields — `parent_folder_id: null` moves to the top
// level, and `visibility: null` means "inherit from the parent". A
// rename must therefore omit both rather than send them as null.
export const updateTeamNoteFolder = async (
    myself: UserProps,
    folderId: number,
    changes: {
        name?: string;
        parentFolderId?: number | null;
        visibility?: NoteFolderVisibility | null;
    },
    accessToken: string | null
): Promise<TeamNoteFolderProps | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const payload: Record<string, unknown> = {
                team_id: myself.teamId,
                user_id: myself.userId,
                folder_id: folderId,
            };
            if (changes.name !== undefined) payload.name = changes.name;
            if ("parentFolderId" in changes) payload.parent_folder_id = changes.parentFolderId;
            if ("visibility" in changes) payload.visibility = changes.visibility;

            const res = await api.put("/note/team/folder/", payload);
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
    return undefined;
};
