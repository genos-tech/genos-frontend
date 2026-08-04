/**
 * Connected-teams state for one team.
 *
 * A hook rather than state in the panel because the same list answers two
 * questions that render differently — "who are we connected to" and "who
 * is waiting on us" — and both need to refresh after any action. Every
 * mutation refetches rather than patching locally: these rows change on
 * the OTHER team's side too, so a local patch is a guess that goes stale
 * the moment the counterparty answers.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { relayCrossTeamRequest } from "../../services/crossTeamNotice";
import {
    fetchTeamConnections,
    requestTeamConnection,
    respondToTeamConnection,
    revokeTeamConnection,
    type TeamConnection,
} from "../../services/teamConnections";

export type TeamConnectionControls = {
    /** Established relationships. */
    active: TeamConnection[];
    /** Requests from another team, waiting on us. */
    incoming: TeamConnection[];
    /** Requests we sent, waiting on them. */
    outgoing: TeamConnection[];
    loading: boolean;
    busy: boolean;
    error: string | null;
    clearError: () => void;
    refresh: () => Promise<void>;
    request: (targetTeamId: string) => Promise<boolean>;
    respond: (connectionId: string, accept: boolean) => Promise<boolean>;
    /** Resolves the number of participation rows the disconnect withdrew. */
    revoke: (connectionId: string) => Promise<number | null>;
};

export const useTeamConnections = (
    teamId: string,
    /**
     * Optional, and only used to deliver a request live. Without it the
     * other team still gets the inbox row and the push — they just don't
     * see it appear until their next load.
     */
    socket?: Socket | null
): TeamConnectionControls => {
    const { accessToken } = useAuth();
    const [rows, setRows] = useState<TeamConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!teamId) return;
        setRows(await fetchTeamConnections(accessToken, teamId));
        setLoading(false);
    }, [accessToken, teamId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const run = useCallback(
        async <T>(action: () => Promise<T>): Promise<T> => {
            setBusy(true);
            setError(null);
            const result = await action();
            setBusy(false);
            // Refetch either way. A failure here is usually a state
            // change on the other team's side, so the UI should catch up
            // rather than keep offering a button that has started
            // refusing.
            await refresh();
            return result;
        },
        [refresh]
    );

    // Revoked and declined rows are noise: the server withholds declined
    // ones entirely, and a revoked connection is simply a team you are no
    // longer connected to. Re-requesting reuses the row, so nothing is
    // lost by not showing it.
    const buckets = useMemo(
        () => ({
            active: rows.filter((r) => r.status === "active"),
            incoming: rows.filter((r) => r.status === "pending" && r.direction === "incoming"),
            outgoing: rows.filter((r) => r.status === "pending" && r.direction === "outgoing"),
        }),
        [rows]
    );

    return {
        ...buckets,
        loading,
        busy,
        error,
        clearError: useCallback(() => setError(null), []),
        refresh,
        request: useCallback(
            (targetTeamId: string) =>
                run(async () => {
                    const created = await requestTeamConnection(
                        accessToken,
                        teamId,
                        targetTeamId,
                        setError
                    );
                    if (created) {
                        relayCrossTeamRequest(socket, { connectionId: created.connectionId });
                    }
                    return Boolean(created);
                }),
            [accessToken, socket, teamId, run]
        ),
        respond: useCallback(
            (connectionId: string, accept: boolean) =>
                run(() => respondToTeamConnection(accessToken, connectionId, accept, setError)),
            [accessToken, run]
        ),
        revoke: useCallback(
            (connectionId: string) =>
                run(() => revokeTeamConnection(accessToken, connectionId, setError)),
            [accessToken, run]
        ),
    };
};
