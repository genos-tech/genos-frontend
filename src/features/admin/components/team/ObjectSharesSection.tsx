/**
 * The cross-team sharing section for a project or a note folder, wired.
 *
 * Container half of the pair: it owns the data (`useObjectShares`) and the
 * list of teams the object could still be offered to, and hands both to the
 * presentational `ObjectSharesPanel` that the chat modal also renders. Chat
 * keeps its own container because its roster writes go through the socket
 * layer; projects and folders have no such need and share this one.
 *
 * `canOffer` is the caller's answer to "is this person a manager of the host
 * team", which the caller already knows. It gates only the offer control —
 * every operation is re-authorised server-side, and the guest-side controls
 * are gated by the server's `canAdmit` instead, never by anything computed
 * here.
 */
import { useMemo } from "react";
import type { Socket } from "socket.io-client";

import { ObjectSharesPanel } from "../../../../components/ui/sharing/ObjectSharesPanel";
import type { SharedObjectType } from "../../../../types/sharing";
import { useObjectShares } from "./useObjectShares";
import { useTeamConnections } from "./useTeamConnections";

type Props = {
    objectType: SharedObjectType;
    objectId: string | undefined;
    /** The team that owns the object — not necessarily the viewer's team. */
    hostTeamId: string;
    myUserId: string;
    /** Is the viewer a manager of the host team? Shows the offer control. */
    canOffer: boolean;
    /**
     * The app's live socket, used to put a new offer in the other team's
     * open inbox. Optional in the type only so a test can render this
     * without one; every real mount must pass it. It was read from a
     * context here to save callers the thread — but nothing mounted the
     * provider, so it was `null` for the feature's whole life and the
     * other team saw nothing until they reloaded. A prop makes the
     * omission a type error instead of silence.
     */
    socket: Socket | null;
    labelColor: string;
    valueColor: string;
    borderColor: string;
};

export const ObjectSharesSection = ({
    objectType,
    objectId,
    hostTeamId,
    myUserId,
    canOffer,
    socket,
    labelColor,
    valueColor,
    borderColor,
}: Props) => {
    const shares = useObjectShares(objectType, objectId, hostTeamId, socket);
    // Guests have no business listing the host team's connections, and the
    // endpoint would refuse them anyway; skip the request entirely.
    const connections = useTeamConnections(canOffer ? hostTeamId : "");

    const offerableTeams = useMemo(() => {
        if (!canOffer) return [];
        const already = new Set(
            shares.shares
                .filter((s) => s.status === "active" || s.status === "pending")
                .map((s) => s.teamId)
        );
        return connections.active
            .filter((c) => !already.has(c.teamId))
            .map((c) => ({ teamId: c.teamId, teamName: c.teamName }));
    }, [canOffer, connections.active, shares.shares]);

    if (shares.loading) return null;

    return (
        <ObjectSharesPanel
            borderColor={borderColor}
            busy={shares.busy}
            error={shares.error}
            labelColor={labelColor}
            myUserId={myUserId}
            offerableTeams={offerableTeams}
            rosterFor={shares.rosterFor}
            shares={shares.shares}
            valueColor={valueColor}
            onAdmit={(share, userId) => shares.admit(share.grantId, [userId])}
            onRevoke={(share) => shares.revoke(share.grantId)}
            onSetCeiling={(share, roleCeiling) => shares.setCeiling(share.grantId, roleCeiling)}
            onWithdraw={(share, userId) => shares.withdraw(share.grantId, [userId])}
            onOffer={
                canOffer ? (teamId, roleCeiling) => shares.offer(teamId, roleCeiling) : undefined
            }
        />
    );
};
