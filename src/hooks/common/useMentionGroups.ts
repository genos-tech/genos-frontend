import { useCallback, useEffect, useMemo, useState } from "react";

import {
    addMentionGroupMembers,
    createMentionGroup,
    deleteMentionGroup,
    listMentionGroups,
    MentionGroup,
    removeMentionGroupMember,
    updateMentionGroup,
} from "../../services/mentionGroupsApi";
import { UserProps } from "../../types/admin";

export interface MentionGroupsApi {
    mentionGroups: MentionGroup[];
    loading: boolean;
    refresh: () => Promise<void>;
    createGroup: (name: string, description?: string) => Promise<MentionGroup | null>;
    updateGroup: (
        groupId: number,
        patch: { groupName?: string; description?: string }
    ) => Promise<MentionGroup | null>;
    deleteGroup: (groupId: number) => Promise<boolean>;
    addMembers: (groupId: number, userIds: string[]) => Promise<boolean>;
    removeMember: (groupId: number, userId: string) => Promise<boolean>;
}

/**
 * Team-scoped mention-group cache + CRUD shim. Mounted once at the App
 * level alongside `useTeamManagement` and shared via context. Refresh
 * runs on mount and any time `myself.teamId` changes; no polling because
 * group memberships rarely change and writes through this hook trigger
 * their own refresh.
 */
export const useMentionGroups = (
    myself: UserProps,
    accessToken: string | null
): MentionGroupsApi => {
    const [mentionGroups, setMentionGroups] = useState<MentionGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const teamId = myself?.teamId ?? "";

    const refresh = useCallback(async () => {
        if (!teamId || !accessToken) {
            setMentionGroups([]);
            return;
        }
        setLoading(true);
        const groups = await listMentionGroups(accessToken, teamId);
        setMentionGroups(groups);
        setLoading(false);
    }, [teamId, accessToken]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const createGroup = useCallback(
        async (name: string, description?: string) => {
            if (!teamId || !accessToken) return null;
            const trimmed = name.trim().toLowerCase();
            if (!trimmed) return null;
            const created = await createMentionGroup(accessToken, {
                team_id: teamId,
                group_name: trimmed,
                description,
                created_by: myself.userId,
            });
            if (created) await refresh();
            return created;
        },
        [teamId, accessToken, myself.userId, refresh]
    );

    const updateGroup = useCallback(
        async (groupId: number, patch: { groupName?: string; description?: string }) => {
            if (!accessToken) return null;
            const updated = await updateMentionGroup(accessToken, {
                group_id: groupId,
                group_name: patch.groupName?.trim().toLowerCase(),
                description: patch.description,
            });
            if (updated) await refresh();
            return updated;
        },
        [accessToken, refresh]
    );

    const deleteGroup = useCallback(
        async (groupId: number) => {
            if (!accessToken) return false;
            const ok = await deleteMentionGroup(accessToken, groupId);
            if (ok) await refresh();
            return ok;
        },
        [accessToken, refresh]
    );

    const addMembers = useCallback(
        async (groupId: number, userIds: string[]) => {
            if (!accessToken || userIds.length === 0) return false;
            const res = await addMentionGroupMembers(accessToken, {
                group_id: groupId,
                user_ids: userIds,
                added_by: myself.userId,
            });
            if (res) await refresh();
            return !!res;
        },
        [accessToken, myself.userId, refresh]
    );

    const removeMember = useCallback(
        async (groupId: number, userId: string) => {
            if (!accessToken) return false;
            const res = await removeMentionGroupMember(accessToken, {
                group_id: groupId,
                user_id: userId,
            });
            if (res) await refresh();
            return !!res;
        },
        [accessToken, refresh]
    );

    return useMemo(
        () => ({
            mentionGroups,
            loading,
            refresh,
            createGroup,
            updateGroup,
            deleteGroup,
            addMembers,
            removeMember,
        }),
        [
            mentionGroups,
            loading,
            refresh,
            createGroup,
            updateGroup,
            deleteGroup,
            addMembers,
            removeMember,
        ]
    );
};
