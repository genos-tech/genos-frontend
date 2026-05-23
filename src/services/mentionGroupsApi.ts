import { authApi } from "./api";

// Wire-shape mirroring `_serialize_group` in the Django view.
// `memberUserIds` is included on list responses so the picker can show a
// member-count badge without a follow-up round trip.
export interface MentionGroup {
    groupId: number;
    groupName: string;
    description: string;
    memberCount: number;
    memberUserIds: string[];
    createdBy: string | null;
    tsCreatedAt: string | null;
    tsUpdatedAt: string | null;
}

const handle = (e: unknown, label: string): null => {
    console.error(`[mentionGroupsApi] ${label} failed:`, e);
    return null;
};

export const listMentionGroups = async (
    accessToken: string,
    teamId: string
): Promise<MentionGroup[]> => {
    const api = authApi(accessToken);
    if (!api) return [];
    try {
        const res = await api.get(`/mention-group/?team_id=${encodeURIComponent(teamId)}`);
        return (res.data?.mentionGroups ?? []) as MentionGroup[];
    } catch (e) {
        handle(e, "list");
        return [];
    }
};

export const createMentionGroup = async (
    accessToken: string,
    payload: {
        team_id: string;
        group_name: string;
        description?: string;
        created_by: string;
    }
): Promise<MentionGroup | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        const res = await api.post(`/mention-group/`, payload);
        return res.data as MentionGroup;
    } catch (e) {
        return handle(e, "create");
    }
};

export const updateMentionGroup = async (
    accessToken: string,
    payload: { group_id: number; group_name?: string; description?: string }
): Promise<MentionGroup | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        const res = await api.put(`/mention-group/`, payload);
        return res.data as MentionGroup;
    } catch (e) {
        return handle(e, "update");
    }
};

export const deleteMentionGroup = async (
    accessToken: string,
    groupId: number
): Promise<boolean> => {
    const api = authApi(accessToken);
    if (!api) return false;
    try {
        await api.delete(`/mention-group/?group_id=${groupId}`);
        return true;
    } catch (e) {
        handle(e, "delete");
        return false;
    }
};

export const addMentionGroupMembers = async (
    accessToken: string,
    payload: { group_id: number; user_ids: string[]; added_by: string }
): Promise<{ groupId: number; memberUserIds: string[]; memberCount: number } | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        const res = await api.post(`/mention-group/members/`, payload);
        return res.data;
    } catch (e) {
        return handle(e, "addMembers");
    }
};

export const removeMentionGroupMember = async (
    accessToken: string,
    payload: { group_id: number; user_id: string }
): Promise<{ groupId: number; memberUserIds: string[]; memberCount: number } | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        const res = await api.delete(
            `/mention-group/members/?group_id=${payload.group_id}&user_id=${encodeURIComponent(
                payload.user_id
            )}`
        );
        return res.data;
    } catch (e) {
        return handle(e, "removeMember");
    }
};
