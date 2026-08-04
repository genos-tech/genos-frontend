/**
 * The cross-team shares on ONE object, from the point of view of the team
 * the user is currently in.
 *
 * Written once and shared by all three surfaces (chat, project, note
 * folder) because the rules are identical and only the object type
 * differs — the same reason the backend has one grant service rather than
 * three. A surface-specific copy of this would be where the surfaces
 * quietly started disagreeing about who may do what.
 *
 * The two `side` values need genuinely different UI, which is the main
 * thing a caller reads off this hook:
 *
 * - `"given"` — we own the object. We see who the other team let in and
 *   may eject an individual, but we may NOT add their people. Adding is
 *   theirs.
 * - `"received"` — we were let in. Our managers add and remove our own
 *   people freely, any time, with no request back to the host.
 *
 * Every mutation refetches instead of patching locally: these rows are
 * written by the other organization too, so local state is a guess.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../../../../context/AuthContext";
import {
    addShareParticipants,
    fetchExternalShares,
    fetchShareParticipants,
    offerExternalShare,
    removeShareParticipants,
    revokeExternalShare,
    type ExternalShare,
    type ExternalShareObjectType,
    type ShareParticipant,
} from "../../services/teamConnections";

export type ObjectShare = ExternalShare & {
    participants: ShareParticipant[];
};

export type ObjectShareControls = {
    /** Active and pending shares on this object, newest first. */
    shares: ObjectShare[];
    loading: boolean;
    busy: boolean;
    error: string | null;
    clearError: () => void;
    refresh: () => Promise<void>;
    /** Offer the object to a connected team. Host managers only. */
    offer: (guestTeamId: string, roleCeiling?: "viewer" | "editor") => Promise<boolean>;
    /** Admit our own people to a share we received. */
    admit: (grantId: string, userIds: string[], role?: "viewer" | "editor") => Promise<boolean>;
    /** Withdraw people. Either side's managers, one person at a time. */
    withdraw: (grantId: string, userIds: string[]) => Promise<boolean>;
    /** End the whole share. Resolves how many people it removed. */
    revoke: (grantId: string) => Promise<number | null>;
};

export const useObjectShares = (
    teamId: string | undefined,
    objectType: ExternalShareObjectType,
    objectId: string | undefined,
    enabled = true
): ObjectShareControls => {
    const { accessToken } = useAuth();
    const [shares, setShares] = useState<ObjectShare[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!enabled || !teamId || !objectId) {
            setShares([]);
            setLoading(false);
            return;
        }
        const rows = await fetchExternalShares(accessToken, teamId, { objectId, objectType });
        // Rosters in parallel: a chat shared with four teams would
        // otherwise be four sequential round trips before anything renders.
        const withRosters = await Promise.all(
            rows.map(async (share) => ({
                ...share,
                participants:
                    share.status === "active"
                        ? await fetchShareParticipants(accessToken, share.grantId)
                        : [],
            }))
        );
        setShares(withRosters);
        setLoading(false);
    }, [accessToken, enabled, objectId, objectType, teamId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const run = useCallback(
        async <T>(action: () => Promise<T>): Promise<T> => {
            setBusy(true);
            setError(null);
            const result = await action();
            setBusy(false);
            await refresh();
            return result;
        },
        [refresh]
    );

    const controls = useMemo(
        () => ({
            offer: (guestTeamId: string, roleCeiling: "viewer" | "editor" = "viewer") =>
                run(async () =>
                    Boolean(
                        teamId &&
                            objectId &&
                            (await offerExternalShare(
                                accessToken,
                                { guestTeamId, objectId, objectType, roleCeiling, teamId },
                                setError
                            ))
                    )
                ),
            admit: (grantId: string, userIds: string[], role?: "viewer" | "editor") =>
                run(() => addShareParticipants(accessToken, grantId, userIds, role, setError)),
            withdraw: (grantId: string, userIds: string[]) =>
                run(() => removeShareParticipants(accessToken, grantId, userIds, setError)),
            revoke: (grantId: string) =>
                run(() => revokeExternalShare(accessToken, grantId, setError)),
        }),
        [accessToken, objectId, objectType, run, teamId]
    );

    return {
        shares,
        loading,
        busy,
        error,
        clearError: useCallback(() => setError(null), []),
        refresh,
        ...controls,
    };
};
