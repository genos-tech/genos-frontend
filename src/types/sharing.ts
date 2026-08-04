/**
 * Cross-team sharing shapes, shared by every surface that can be shared.
 *
 * One shape for chats, projects and note folders because the server has one
 * grant model behind all three (`origin/models/common/team_models.py`
 * `ExternalGrant`). A per-surface copy would let the surfaces drift apart on
 * a question that is deliberately identical everywhere: who may admit whom.
 */

/** Someone the guest team put on a share. */
export interface ShareParticipant {
    userId: string;
    userName: string;
    email: string;
    avatarUrl: string | null;
}

export type ShareStatus = "pending" | "active" | "declined" | "revoked";

/** The type of thing being shared, as the API names it. */
export type SharedObjectType = "channel" | "project" | "note_folder";

/**
 * One guest team's share of one object.
 *
 * `side` and `canAdmit` encode the asymmetry that makes cross-team sharing
 * work, and both come from the server rather than being derived here: the
 * host sees every team and may eject a person, while the guest team's own
 * managers add and remove their own people any time. A client that lets the
 * host add the guest's people has misread the feature — `canAdmit` is never
 * true for the host.
 */
export interface ObjectShare {
    grantId: string;
    /** The GUEST team on this share — never the owner. */
    teamId: string;
    teamName: string;
    /**
     * The team the object belongs to, named rather than implied.
     *
     * `side` says which side the READER is on, which is a fact about the
     * reader: somebody who belongs to both teams gets a different answer
     * from the same row than their colleague does. Naming both teams is
     * true for everybody, so the copy uses these and `side` is left for
     * deciding what to render.
     */
    ownerTeamId: string | null;
    ownerTeamName: string;
    roleCeiling: "viewer" | "editor";
    status: ShareStatus;
    side: "given" | "received";
    canAdmit: boolean;
    /** The host's managers, who alone decide how much the guests may do. */
    canSetCeiling: boolean;
    participants: ShareParticipant[];
}
