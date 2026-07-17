import { useCallback, useEffect, useMemo, useState } from "react";

import {
    createTeamEmoji,
    deleteTeamEmoji,
    listTeamEmoji,
    TeamEmoji,
} from "../../services/teamEmojiApi";
import { setTeamEmojiList } from "../../services/teamEmojiStore";
import { UserProps } from "../../types/admin";

export interface TeamEmojiApi {
    teamEmoji: TeamEmoji[];
    loading: boolean;
    refresh: () => Promise<void>;
    create: (name: string, file: File) => Promise<TeamEmoji | null>;
    remove: (emojiId: number) => Promise<boolean>;
}

/**
 * Team custom-emoji cache + CRUD shim, following `useMentionGroups`:
 * mounted once at the App root, refreshed on mount and team change,
 * writes trigger their own refresh. Every fetch also mirrors the list
 * into the module-level `teamEmojiStore` so non-React consumers (the
 * `:` suggestion resolver, insert helpers) get synchronous lookups.
 */
export const useTeamEmoji = (myself: UserProps, accessToken: string | null): TeamEmojiApi => {
    const [teamEmoji, setTeamEmoji] = useState<TeamEmoji[]>([]);
    const [loading, setLoading] = useState(false);
    const teamId = myself?.teamId ?? "";

    const refresh = useCallback(async () => {
        if (!teamId || !accessToken) {
            setTeamEmoji([]);
            setTeamEmojiList([]);
            return;
        }
        setLoading(true);
        const emoji = await listTeamEmoji(accessToken, teamId);
        setTeamEmoji(emoji);
        setTeamEmojiList(emoji);
        setLoading(false);
    }, [teamId, accessToken]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const create = useCallback(
        async (name: string, file: File) => {
            if (!teamId || !accessToken) return null;
            const trimmed = name.trim().toLowerCase();
            if (!trimmed) return null;
            const created = await createTeamEmoji(accessToken, {
                teamId,
                name: trimmed,
                file,
            });
            if (created) await refresh();
            return created;
        },
        [teamId, accessToken, refresh]
    );

    const remove = useCallback(
        async (emojiId: number) => {
            if (!accessToken) return false;
            const ok = await deleteTeamEmoji(accessToken, emojiId);
            if (ok) await refresh();
            return ok;
        },
        [accessToken, refresh]
    );

    return useMemo(
        () => ({ teamEmoji, loading, refresh, create, remove }),
        [teamEmoji, loading, refresh, create, remove]
    );
};
