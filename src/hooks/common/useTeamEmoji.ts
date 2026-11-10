import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
    createTeamEmoji,
    deleteTeamEmoji,
    deleteTeamEmojiOnExit,
    listTeamEmoji,
    TeamEmoji,
} from "../../services/teamEmojiApi";
import { setTeamEmojiList } from "../../services/teamEmojiStore";
import { UserProps } from "../../types/admin";
import { runUndoable, useUndoHidden } from "./useUndoableAction";

const emojiKey = (emojiId: number) => `team-emoji:${emojiId}`;

/** Toast texts for deleting an emoji. The hook lives above the i18n provider, so
 *  the caller (the settings panel) brings the translated strings. */
export type TeamEmojiDeleteLabels = { message: ReactNode; errorMessage: ReactNode };

export interface TeamEmojiApi {
    teamEmoji: TeamEmoji[];
    loading: boolean;
    /** The latest list request failed; `teamEmoji` is then the last good catalog. */
    error: boolean;
    refresh: () => Promise<void>;
    create: (name: string, file: File) => Promise<TeamEmoji | null>;
    /** Delete with an Undo window (MIP-1300): the emoji leaves `teamEmoji` at once,
     *  the DELETE is sent when the window ends. The catalog every picker and chip
     *  reads (`teamEmojiStore`) keeps it until then, because the server does too. */
    remove: (emojiId: number, labels: TeamEmojiDeleteLabels) => void;
}

/**
 * Team custom-emoji cache + CRUD shim, following `useMentionGroups`:
 * mounted once at the App root, refreshed on mount and team change,
 * writes trigger their own refresh. Every fetch also mirrors the list
 * into the module-level `teamEmojiStore` so non-React consumers (the
 * `:` suggestion resolver, insert helpers) get synchronous lookups.
 */
export const useTeamEmoji = (myself: UserProps, accessToken: string | null): TeamEmojiApi => {
    const [rawEmoji, setTeamEmoji] = useState<TeamEmoji[]>([]);
    const undoHidden = useUndoHidden();
    const teamEmoji = useMemo(
        () =>
            undoHidden.size === 0
                ? rawEmoji
                : rawEmoji.filter((e) => !undoHidden.has(emojiKey(e.emojiId))),
        [rawEmoji, undoHidden]
    );
    const tokenRef = useRef(accessToken);
    tokenRef.current = accessToken;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    // Which team `rawEmoji` belongs to, so a failed refresh never keeps another team's catalog.
    const listTeamRef = useRef<string | null>(null);
    const teamId = myself?.teamId ?? "";

    const refresh = useCallback(async () => {
        if (!teamId || !accessToken) {
            setTeamEmoji([]);
            setTeamEmojiList([]);
            return;
        }
        setLoading(true);
        const emoji = await listTeamEmoji(accessToken, teamId);
        if (emoji) {
            listTeamRef.current = teamId;
            setTeamEmoji(emoji);
            setTeamEmojiList(emoji);
        } else if (listTeamRef.current !== teamId) {
            // Nothing of this team's to keep. A failure for the same team keeps the
            // catalog: pickers and reaction chips must not lose every emoji to one
            // dropped request.
            setTeamEmoji([]);
            setTeamEmojiList([]);
        }
        setError(emoji === null);
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
        (emojiId: number, labels: TeamEmojiDeleteLabels) => {
            runUndoable({
                key: emojiKey(emojiId),
                message: labels.message,
                errorMessage: labels.errorMessage,
                commit: async () => {
                    const token = tokenRef.current;
                    // Rejects on a refusal (the server lets only the uploader delete).
                    if (!token || !(await deleteTeamEmoji(token, emojiId))) {
                        throw new Error("team emoji delete failed");
                    }
                },
                onExit: () => {
                    if (tokenRef.current) deleteTeamEmojiOnExit(tokenRef.current, emojiId);
                },
                onCommitted: () => void refresh(),
            });
        },
        [refresh]
    );

    return useMemo(
        () => ({ teamEmoji, loading, error, refresh, create, remove }),
        [teamEmoji, loading, error, refresh, create, remove]
    );
};
