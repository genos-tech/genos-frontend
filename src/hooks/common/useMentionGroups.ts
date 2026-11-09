import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
    addMentionGroupMembers,
    createMentionGroup,
    deleteMentionGroup,
    deleteMentionGroupOnExit,
    listMentionGroups,
    MentionGroup,
    removeMentionGroupMember,
    updateMentionGroup,
} from "../../services/mentionGroupsApi";
import { UserProps } from "../../types/admin";
import { runUndoable, useUndoHidden } from "./useUndoableAction";

const mentionGroupKey = (groupId: number) => `mention-group:${groupId}`;

/** Toast texts for deleting a group. The hook lives above the i18n provider, so
 *  the caller brings the translated strings. */
export type MentionGroupDeleteLabels = { message: ReactNode; errorMessage: ReactNode };

export interface MentionGroupsApi {
    mentionGroups: MentionGroup[];
    loading: boolean;
    refresh: () => Promise<void>;
    createGroup: (name: string, description?: string) => Promise<MentionGroup | null>;
    updateGroup: (
        groupId: number,
        patch: { groupName?: string; description?: string }
    ) => Promise<MentionGroup | null>;
    /** Delete with an Undo window (MIP-1300): the group leaves `mentionGroups` at
     *  once, the DELETE is sent when the window ends, Undo sends nothing. */
    deleteGroup: (groupId: number, labels: MentionGroupDeleteLabels) => void;
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
    const [rawGroups, setMentionGroups] = useState<MentionGroup[]>([]);
    const undoHidden = useUndoHidden();
    const mentionGroups = useMemo(
        () =>
            undoHidden.size === 0
                ? rawGroups
                : rawGroups.filter((g) => !undoHidden.has(mentionGroupKey(g.groupId))),
        [rawGroups, undoHidden]
    );
    const tokenRef = useRef(accessToken);
    tokenRef.current = accessToken;
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
        (groupId: number, labels: MentionGroupDeleteLabels) => {
            runUndoable({
                key: mentionGroupKey(groupId),
                message: labels.message,
                errorMessage: labels.errorMessage,
                commit: async () => {
                    const token = tokenRef.current;
                    if (!token || !(await deleteMentionGroup(token, groupId))) {
                        throw new Error("mention group delete failed");
                    }
                },
                onExit: () => {
                    if (tokenRef.current) deleteMentionGroupOnExit(tokenRef.current, groupId);
                },
                onCommitted: () => void refresh(),
            });
        },
        [refresh]
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
