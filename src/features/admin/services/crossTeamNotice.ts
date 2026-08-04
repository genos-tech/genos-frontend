/**
 * Put a cross-team request in the other team's inbox while they are looking.
 *
 * Connection requests and share offers are filed straight to Django, unlike
 * inbox request types 1-4 which the sockets service files and delivers in
 * one step. Nothing pushed them, so the team being asked saw an empty inbox
 * until they happened to reload — which, for a feature that begins by
 * waiting for approval, is indistinguishable from the feature being broken.
 *
 * Fire-and-forget, and deliberately AFTER the HTTP call rather than instead
 * of it: the request is already committed, so a socket that is down or
 * behind costs a live update, not the request itself. The sockets handler
 * re-reads the card from Django with the caller's token, so nothing passed
 * from here is trusted as content — only the id of what to look up.
 */
import type { Socket } from "socket.io-client";

import type { SharedObjectType } from "../../../types/sharing";

/**
 * What to relay, named the way the caller happens to know it.
 *
 * The object form exists for creating an external chat: the offers are
 * written inside the create call, so the creator holds a channel id and no
 * grant ids — and there may be several, one per invited team.
 */
type CrossTeamRequestRef =
    | { connectionId: string }
    | { grantId: string }
    | { objectType: SharedObjectType; objectId: string };

export const relayCrossTeamRequest = (
    socket: Socket | null | undefined,
    ref: CrossTeamRequestRef
): void => {
    if (!socket) return;
    socket.emit("cross_team_request_notice", ref);
};
