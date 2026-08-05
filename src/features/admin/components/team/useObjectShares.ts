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
import type { Socket } from "socket.io-client";

import { rememberPeople } from "../../../../components/ui/avatars/userDirectory";
import { useAuth } from "../../../../context/AuthContext";
import { relayCrossTeamRequest } from "../../services/crossTeamNotice";
import {
    addShareParticipants,
    fetchObjectShares,
    fetchOwnTeamRoster,
    offerExternalShare,
    removeShareParticipants,
    revokeExternalShare,
    setShareRoleCeiling,
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
    /** Change what an admitted team may do. Host managers only. */
    setCeiling: (grantId: string, roleCeiling: "viewer" | "editor") => Promise<boolean>;
    /** Admit our own colleagues to a share we received. */
    admit: (grantId: string, userIds: string[], role?: "viewer" | "editor") => Promise<boolean>;
    /** Withdraw people. Either side's managers, one person at a time. */
    withdraw: (grantId: string, userIds: string[]) => Promise<boolean>;
    /** End the whole share. Resolves how many people it removed. */
    revoke: (grantId: string) => Promise<number | null>;
    /** A guest team's own roster, for the admit picker. Empty otherwise. */
    rosterFor: (
        teamId: string
    ) => Promise<{ userId: string; userName: string; userEmail?: string }[]>;
};

export const useObjectShares = (
    objectType: ExternalShareObjectType,
    objectId: string | undefined,
    /** The team the object belongs to. Only needed to OFFER a new share. */
    hostTeamId?: string,
    /**
     * Optional, and only used to deliver a new offer live. Without it the
     * guest team still gets the inbox row and the push — it just doesn't
     * appear until their next load.
     */
    socket?: Socket | null
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
        const rows = await fetchObjectShares(accessToken, objectType, String(objectId));
        // The participants are the other team's people by definition, so
        // this payload is the only thing that can name them anywhere else
        // in the app — a task they own, a note they wrote, a message they
        // sent — until some other cross-team payload does.
        rememberPeople(rows.flatMap((row) => row.participants));
        setShares(rows);
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
            offer: (guestTeamId: string, roleCeiling: "viewer" | "editor" = "editor") =>
                run(async () => {
                    if (!hostTeamId || !objectId) return false;
                    const offered = await offerExternalShare(
                        accessToken,
                        {
                            guestTeamId,
                            objectId: String(objectId),
                            objectType,
                            roleCeiling,
                            teamId: hostTeamId,
                        },
                        setError
                    );
                    if (offered) relayCrossTeamRequest(socket, { grantId: offered.grantId });
                    return Boolean(offered);
                }),
            setCeiling: (grantId: string, roleCeiling: "viewer" | "editor") =>
                run(() => setShareRoleCeiling(accessToken, grantId, roleCeiling, setError)),
            admit: (grantId: string, userIds: string[], role?: "viewer" | "editor") =>
                run(() => addShareParticipants(accessToken, grantId, userIds, role, setError)),
            withdraw: (grantId: string, userIds: string[]) =>
                run(() => removeShareParticipants(accessToken, grantId, userIds, setError)),
            revoke: (grantId: string) =>
                run(() => revokeExternalShare(accessToken, grantId, setError)),
            rosterFor: (teamId: string) => fetchOwnTeamRoster(accessToken, teamId),
        }),
        [accessToken, hostTeamId, objectId, objectType, run, socket]
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
