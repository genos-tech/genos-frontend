import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import {
    NoteFolderInviteGroup,
    NoteFolderVisibility,
    TeamNoteFolderProps,
} from "../../../../types/notes";

export type CreateTeamFolderInput = {
    name: string;
    parentFolderId: number | null;
    // Required for a top-level folder. Pass null on a subfolder to
    // INHERIT the parent's access — the default, and what makes a
    // subfolder reachable by everyone who can reach its parent.
    visibility: NoteFolderVisibility | null;
    userIds?: string[];
    groups?: NoteFolderInviteGroup[];
    roleId?: number;
};

export const createTeamNoteFolder = async (
    myself: UserProps,
    input: CreateTeamFolderInput,
    accessToken: string | null
): Promise<TeamNoteFolderProps | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post("/note/team/folder/", {
                team_id: myself.teamId,
                user_id: myself.userId,
                name: input.name,
                parent_folder_id: input.parentFolderId,
                visibility: input.visibility,
                user_ids: input.userIds ?? [],
                groups: input.groups ?? [],
                role_id: input.roleId,
            });
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
