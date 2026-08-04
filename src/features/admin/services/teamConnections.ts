/**
 * Cross-team sharing — `/api/v2/team/connection/` and `/api/v2/team/share/`.
 *
 * Two nouns with different rhythms, and the difference is the whole design:
 *
 * - A **connection** and a **share** are each approved ONCE, by the side
 *   being asked. Rare, deliberate, two-sided.
 * - **Participants** are then managed repeatedly and unilaterally by the
 *   guest team's own managers, with no request back to the host.
 *
 * So a UI that puts participant management behind an approval flow has
 * misread the feature. See `origin/services/external_grants.py`.
 *
 * Nothing here is an authorisation check. Roles decide what to render;
 * every operation is re-authorised in the Django service layer, which is
 * also where the "may you" rules are written down.
 */
import axios from "axios";

import { authApi } from "../../../services/api";
import type { ObjectShare, ShareParticipant, ShareStatus } from "../../../types/sharing";

export type { ObjectShare, ShareParticipant, ShareStatus };

export type TeamConnection = {
    connectionId: string;
    /** The OTHER team — the row stores its pair sorted, so this is derived. */
    teamId: string;
    teamName: string;
    status: ShareStatus;
    /** "outgoing" = we asked. "incoming" = the ball is in our court. */
    direction: "outgoing" | "incoming";
    tsCreated: string;
    tsUpdated: string;
};

export type ExternalShareObjectType = "channel" | "project" | "note_folder";

export type ExternalShare = {
    grantId: string;
    objectType: ExternalShareObjectType;
    objectId: string;
    /** The most the guest team may hand its own people. */
    roleCeiling: "viewer" | "editor";
    status: ShareStatus;
    /** "given" = we own the object. "received" = we were let in. */
    side: "given" | "received";
    teamId: string;
    teamName: string;
    tsCreated: string;
    tsUpdated: string;
};

/**
 * GET the shares on one object, readable from either side of the share.
 *
 * Distinct from `fetchExternalShares` (the team-scoped list) because the
 * object view can be read by the guest side, who belong to neither the team
 * named in a team-scoped query nor the host team.
 */
export const fetchObjectShares = async (
    accessToken: string | null,
    objectType: ExternalShareObjectType,
    objectId: string
): Promise<ObjectShare[]> => {
    try {
        const api = authApi(accessToken);
        if (!api) return [];
        const res = await api.get("/team/share/object/", {
            params: { object_id: objectId, object_type: objectType },
        });
        return (res.data as { shares: ObjectShare[] }).shares ?? [];
    } catch {
        // A 404 here means "no relationship with this object", which for
        // a panel is the same as "nothing to show".
        return [];
    }
};

const errorText = (error: unknown, fallback: string): string => {
    if (axios.isAxiosError(error)) {
        return (error.response?.data as { error?: string })?.error || fallback;
    }
    return fallback;
};

/** GET every connection this team is part of, in either direction. */
export const fetchTeamConnections = async (
    accessToken: string | null,
    teamId: string
): Promise<TeamConnection[]> => {
    try {
        const api = authApi(accessToken);
        if (!api) return [];
        const res = await api.get("/team/connection/", { params: { team_id: teamId } });
        return (res.data as { connections: TeamConnection[] }).connections ?? [];
    } catch {
        // The panel renders empty rather than erroring: a team with no
        // connections and a failed fetch look the same to the user, and
        // this section is never the reason they opened the modal.
        return [];
    }
};

/**
 * POST — ask another team to connect. Owner/editor only; server re-checks.
 *
 * Resolves the created row rather than a bare success because the caller
 * needs its `connectionId` to relay the request into the other team's open
 * inbox — see `relayCrossTeamRequest`.
 */
export const requestTeamConnection = async (
    accessToken: string | null,
    teamId: string,
    targetTeamId: string,
    setErrorMessage?: (value: string) => void
): Promise<TeamConnection | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            setErrorMessage?.("Authorization token is missing.");
            return null;
        }
        const res = await api.post("/team/connection/", {
            team_id: teamId,
            target_team_id: targetTeamId,
        });
        return res.data as TeamConnection;
    } catch (error: unknown) {
        setErrorMessage?.(errorText(error, "Couldn't send the request. Please try again."));
        return null;
    }
};

/** POST — approve or decline. Only the team that was ASKED may answer. */
export const respondToTeamConnection = async (
    accessToken: string | null,
    connectionId: string,
    accept: boolean,
    setErrorMessage?: (value: string) => void
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            setErrorMessage?.("Authorization token is missing.");
            return false;
        }
        await api.post("/team/connection/respond/", {
            connection_id: connectionId,
            accept,
        });
        return true;
    } catch (error: unknown) {
        setErrorMessage?.(errorText(error, "Couldn't respond. Please try again."));
        return false;
    }
};

/**
 * POST — end a connection and every share inside it.
 *
 * Either side may revoke, and it deletes real access, so the caller is
 * expected to confirm first. Resolves the number of participation rows
 * withdrawn — worth showing, because "disconnect" quietly removing nine
 * people from three projects is exactly the surprise a confirmation is
 * meant to prevent.
 */
export const revokeTeamConnection = async (
    accessToken: string | null,
    connectionId: string,
    setErrorMessage?: (value: string) => void
): Promise<number | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            setErrorMessage?.("Authorization token is missing.");
            return null;
        }
        const res = await api.post("/team/connection/revoke/", { connection_id: connectionId });
        return (res.data as { withdrawn: number }).withdrawn ?? 0;
    } catch (error: unknown) {
        setErrorMessage?.(errorText(error, "Couldn't disconnect. Please try again."));
        return null;
    }
};

/**
 * GET the shares this team has given out and been let into.
 *
 * Pass `object` to narrow to one object — what a chat's or project's own
 * "shared with" panel wants. Narrowing is a convenience; the team scope is
 * what makes the response safe.
 */
export const fetchExternalShares = async (
    accessToken: string | null,
    teamId: string,
    object?: { objectType: ExternalShareObjectType; objectId: string }
): Promise<ExternalShare[]> => {
    try {
        const api = authApi(accessToken);
        if (!api) return [];
        const res = await api.get("/team/share/", {
            params: {
                team_id: teamId,
                ...(object ? { object_type: object.objectType, object_id: object.objectId } : {}),
            },
        });
        return (res.data as { shares: ExternalShare[] }).shares ?? [];
    } catch {
        return [];
    }
};

/** POST — offer one object to a connected team. Host managers only. */
export const offerExternalShare = async (
    accessToken: string | null,
    params: {
        teamId: string;
        guestTeamId: string;
        objectType: ExternalShareObjectType;
        objectId: string;
        roleCeiling?: "viewer" | "editor";
    },
    setErrorMessage?: (value: string) => void
): Promise<ExternalShare | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            setErrorMessage?.("Authorization token is missing.");
            return null;
        }
        const res = await api.post("/team/share/", {
            team_id: params.teamId,
            guest_team_id: params.guestTeamId,
            object_type: params.objectType,
            object_id: params.objectId,
            role_ceiling: params.roleCeiling ?? "viewer",
        });
        return res.data as ExternalShare;
    } catch (error: unknown) {
        setErrorMessage?.(errorText(error, "Couldn't share that. Please try again."));
        return null;
    }
};

/** POST — the guest team accepts or declines. Accepting admits nobody. */
export const respondToExternalShare = async (
    accessToken: string | null,
    grantId: string,
    accept: boolean,
    setErrorMessage?: (value: string) => void
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            setErrorMessage?.("Authorization token is missing.");
            return false;
        }
        await api.post("/team/share/respond/", { grant_id: grantId, accept });
        return true;
    } catch (error: unknown) {
        setErrorMessage?.(errorText(error, "Couldn't respond. Please try again."));
        return false;
    }
};

/** POST — withdraw one share. Either side's managers. */
export const revokeExternalShare = async (
    accessToken: string | null,
    grantId: string,
    setErrorMessage?: (value: string) => void
): Promise<number | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            setErrorMessage?.("Authorization token is missing.");
            return null;
        }
        const res = await api.post("/team/share/revoke/", { grant_id: grantId });
        return (res.data as { withdrawn: number }).withdrawn ?? 0;
    } catch (error: unknown) {
        setErrorMessage?.(errorText(error, "Couldn't stop sharing. Please try again."));
        return null;
    }
};

/**
 * GET the roster of a team the caller belongs to.
 *
 * For the guest-side "who of ours should join this share" picker. The
 * caller's *current* team is the HOST's shell when they are looking at a
 * shared object, so the roster they need is their own team's and has to be
 * asked for by id. Never the host's roster — that stays withheld.
 */
export const fetchOwnTeamRoster = async (
    accessToken: string | null,
    teamId: string
): Promise<{ userId: string; userName: string; userEmail: string }[]> => {
    try {
        const api = authApi(accessToken);
        if (!api) return [];
        const res = await api.get(`/team/getTeamMembers/?team_id=${teamId}`);
        const members = (res.data as { data?: { members?: unknown[] } }).data?.members ?? [];
        return members as { userId: string; userName: string; userEmail: string }[];
    } catch {
        return [];
    }
};

/** GET who from the guest team is currently in. Both sides may read it. */
export const fetchShareParticipants = async (
    accessToken: string | null,
    grantId: string
): Promise<ShareParticipant[]> => {
    try {
        const api = authApi(accessToken);
        if (!api) return [];
        const res = await api.get("/team/share/participants/", {
            params: { grant_id: grantId },
        });
        return (res.data as { participants: ShareParticipant[] }).participants ?? [];
    } catch {
        return [];
    }
};

/**
 * POST — admit people. GUEST-team managers only, any time after the share
 * went active. This is the repeatable half of the feature; it needs no
 * host involvement whatsoever.
 */
export const addShareParticipants = async (
    accessToken: string | null,
    grantId: string,
    userIds: string[],
    role?: "viewer" | "editor",
    setErrorMessage?: (value: string) => void
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            setErrorMessage?.("Authorization token is missing.");
            return false;
        }
        await api.post("/team/share/participants/", {
            grant_id: grantId,
            user_ids: userIds,
            ...(role ? { role } : {}),
        });
        return true;
    } catch (error: unknown) {
        setErrorMessage?.(errorText(error, "Couldn't add those people. Please try again."));
        return false;
    }
};

/**
 * DELETE — withdraw people.
 *
 * Deliberately open to BOTH sides' managers, unlike adding: the guest
 * team administers its roster, and the host keeps a veto over one person
 * so that ejecting somebody doesn't mean ending the whole share.
 */
export const removeShareParticipants = async (
    accessToken: string | null,
    grantId: string,
    userIds: string[],
    setErrorMessage?: (value: string) => void
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            setErrorMessage?.("Authorization token is missing.");
            return false;
        }
        await api.delete("/team/share/participants/", {
            data: { grant_id: grantId, user_ids: userIds },
        });
        return true;
    } catch (error: unknown) {
        setErrorMessage?.(errorText(error, "Couldn't remove those people. Please try again."));
        return false;
    }
};
