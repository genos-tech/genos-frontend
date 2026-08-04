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
    teamId: string;
    teamName: string;
    roleCeiling: "viewer" | "editor";
    status: ShareStatus;
    side: "given" | "received";
    canAdmit: boolean;
    participants: ShareParticipant[];
}
