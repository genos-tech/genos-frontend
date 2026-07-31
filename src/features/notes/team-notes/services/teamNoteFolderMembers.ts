import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { NoteFolderInviteGroup, TeamNoteFolderMemberProps } from "../../../../types/notes";

export const loadTeamFolderMembers = async (
    myself: UserProps,
    folderId: number,
    accessToken: string | null
): Promise<TeamNoteFolderMemberProps[]> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query = `team_id=${myself.teamId}&folder_id=${folderId}`;
            const res = await api.get(`/note/team/folder/member/?${query}`);
            return Array.isArray(res.data) ? res.data : [];
        }
        console.error("Unauthorized. Auth token is not found.");
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
    return [];
};

// Grant a role to individual users and/or whole groups.
//
// `groups` is sent as-is and re-expanded SERVER-side. The client expands
// it too, but only to preview who is about to be added — the client list
// is never the permission source of truth.
export const grantTeamFolderMembers = async (
    myself: UserProps,
    folderId: number,
    input: { userIds?: string[]; groups?: NoteFolderInviteGroup[]; roleId?: number },
    accessToken: string | null
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            await api.post("/note/team/folder/member/", {
                team_id: myself.teamId,
                folder_id: folderId,
                user_ids: input.userIds ?? [],
                groups: input.groups ?? [],
                role_id: input.roleId,
            });
            return true;
        }
        console.error("Unauthorized. Auth token is not found.");
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
    return false;
};

export const revokeTeamFolderMember = async (
    myself: UserProps,
    folderId: number,
    targetUserId: string,
    accessToken: string | null
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query =
                `team_id=${myself.teamId}&folder_id=${folderId}` +
                `&target_user_id=${targetUserId}`;
            await api.delete(`/note/team/folder/member/?${query}`);
            return true;
        }
        console.error("Unauthorized. Auth token is not found.");
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
    return false;
};
