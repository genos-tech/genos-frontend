/**
 * The cross-team shares on ONE object, from whichever side the caller is on.
 *
 * Written once and used by every surface (project, note folder, and the
 * chat panel's sibling) because the rules are identical and only the object
 * type differs — the same reason the backend has one grant service rather
 * than three. Per-surface copies are where the surfaces would quietly start
 * disagreeing about who may do what.
 *
 * The asymmetry callers render is the whole point, and it arrives from the
 * server rather than being derived here:
 *
 * - `side: "given"` — we own the object. We see who the other team let in
 *   and may eject an individual or end the share, but we may not add their
 *   people.
 * - `canAdmit` — we are a manager of a guest team on an active share, so we
 *   add and remove our OWN colleagues freely, any time, with no request
 *   back to the host.
 *
 * Every mutation refetches rather than patching locally: these rows are
 * written by the other organization too, so local state is a guess.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../../../../context/AuthContext";
import {
    addShareParticipants,
    fetchObjectShares,
    fetchOwnTeamRoster,
    offerExternalShare,
    removeShareParticipants,
    revokeExternalShare,
    type ExternalShareObjectType,
    type ObjectShare,
} from "../../services/teamConnections";

export type ObjectShareControls = {
    /** Every share on this object the caller may see, newest first. */
    shares: ObjectShare[];
    loading: boolean;
    busy: boolean;
    error: string | null;
    clearError: () => void;
    refresh: () => Promise<void>;
    /** Offer the object to a connected team. Host managers only. */
    offer: (guestTeamId: string, roleCeiling?: "viewer" | "editor") => Promise<boolean>;
    /** Admit our own colleagues to a share we received. */
    admit: (grantId: string, userIds: string[], role?: "viewer" | "editor") => Promise<boolean>;
    /** Withdraw people. Either side's managers, one person at a time. */
    withdraw: (grantId: string, userIds: string[]) => Promise<boolean>;
    /** End the whole share. Resolves how many people it removed. */
    revoke: (grantId: string) => Promise<number | null>;
    /** A guest team's own roster, for the admit picker. Empty otherwise. */
    rosterFor: (teamId: string) => Promise<{ userId: string; userName: string }[]>;
};

export const useObjectShares = (
    objectType: ExternalShareObjectType,
    objectId: string | undefined,
    /** The team the object belongs to. Only needed to OFFER a new share. */
    hostTeamId?: string
): ObjectShareControls => {
    const { accessToken } = useAuth();
    const [shares, setShares] = useState<ObjectShare[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!objectId) {
            setShares([]);
            setLoading(false);
            return;
        }
        setShares(await fetchObjectShares(accessToken, objectType, String(objectId)));
        setLoading(false);
    }, [accessToken, objectId, objectType]);

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
                        hostTeamId &&
                            objectId &&
                            (await offerExternalShare(
                                accessToken,
                                {
                                    guestTeamId,
                                    objectId: String(objectId),
                                    objectType,
                                    roleCeiling,
                                    teamId: hostTeamId,
                                },
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
            rosterFor: (teamId: string) => fetchOwnTeamRoster(accessToken, teamId),
        }),
        [accessToken, hostTeamId, objectId, objectType, run]
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
