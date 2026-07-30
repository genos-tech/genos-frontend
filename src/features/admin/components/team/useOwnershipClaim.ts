/**
 * Ownership-recovery state for one team.
 *
 * A hook rather than state inside the panel because the two halves of
 * this feature render in different places: the "Request ownership"
 * BUTTON sits in the team profile's action row beside Invite members,
 * while the status (pending / cooldown / ready to finalize) renders
 * below the owner's details. One fetch feeds both.
 *
 * Policy lives on the server (`origin/services/ownership_claim.py`);
 * `canRequest` / `canFinalize` come from it rather than being re-derived
 * here, and every action is re-authorised server-side.
 */
import { useCallback, useEffect, useState } from "react";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import {
    finalizeOwnershipClaim,
    getOwnershipClaim,
    requestOwnershipClaim,
    type OwnershipClaimStatus,
} from "../../services/ownershipClaim";
import { resolveClaimPanel, type ClaimPanelState } from "./ownershipClaimPanelState";

export type OwnershipClaimControls = {
    panel: ClaimPanelState;
    /** The owner's response window, for the confirm copy. */
    responseDays: number;
    busy: boolean;
    error: string | null;
    /** Resolves true when the claim was filed. */
    request: () => Promise<boolean>;
    /** Resolves true when ownership actually moved. */
    finalize: (itemId: number) => Promise<boolean>;
};

export const useOwnershipClaim = (
    teamId: string,
    isTeamOwner: boolean,
    socket: Socket | null
): OwnershipClaimControls => {
    const { accessToken } = useAuth();
    const [status, setStatus] = useState<OwnershipClaimStatus | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setStatus(await getOwnershipClaim(accessToken, teamId));
    }, [accessToken, teamId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const run = useCallback(
        async (action: () => Promise<boolean>) => {
            setBusy(true);
            setError(null);
            const ok = await action();
            setBusy(false);
            // Refetch either way: a failure is usually a state change
            // (the owner just answered, someone else acted), so the UI
            // should catch up rather than keep offering a button that
            // has started refusing.
            await refresh();
            return ok;
        },
        [refresh]
    );

    return {
        panel: resolveClaimPanel(status, isTeamOwner),
        responseDays: status?.responseDays ?? 30,
        busy,
        error,
        request: useCallback(
            () =>
                run(async () => {
                    const ok = await requestOwnershipClaim(accessToken, teamId, setError);
                    // Hand the claim to the owner's open tab. Request
                    // types 1-4 are FILED by the sockets service, which
                    // pushes the new row as it creates it; this one
                    // files over HTTP, so without this the owner sees
                    // nothing until a full page reload — and their
                    // silence is what lets the claim be finalized.
                    //
                    // Fire-and-forget, and deliberately after the filing
                    // rather than instead of it: the claim is already
                    // committed, so a socket that is down or behind
                    // costs a live update, not the request. The service
                    // re-reads the claim from Django and relays that,
                    // so nothing here is trusted as content.
                    if (ok && socket) socket.emit("ownership_claim_notice", { teamId });
                    return ok;
                }),
            [accessToken, socket, teamId, run]
        ),
        finalize: useCallback(
            (itemId: number) => run(() => finalizeOwnershipClaim(accessToken, itemId, setError)),
            [accessToken, run]
        ),
    };
};
