// Membership roles shared by Team, Project and GM.
//
// Mirrors `genos-api/origin/services/member_roles.py` — keep the two in
// step. See that module for the full contract.
//
// NOT to be confused with `UserProps.role`, which is the user's
// self-declared JOB TITLE ("Engineer") and has its own picker
// (`UserProfileRole`). This permission axis is `memberRole` everywhere.

export const MEMBER_ROLE = {
    owner: "owner",
    editor: "editor",
    viewer: "viewer",
    /** External collaborator, scoped to individual projects. */
    guest: "guest",
} as const;

export type MemberRole = (typeof MEMBER_ROLE)[keyof typeof MEMBER_ROLE];

/** Roles a manager may assign on a TEAM. `owner` is absent: minting an
 *  owner is an ownership transfer, which has its own owner-only flow.
 *  `guest` is absent for a different reason — a guest holds no team
 *  membership at all, so there is no team row to set it on. */
export const ASSIGNABLE_MEMBER_ROLES: MemberRole[] = [MEMBER_ROLE.editor, MEMBER_ROLE.viewer];

/** Roles assignable on a PROJECT. A guest reaches the product through
 *  project membership, so this is the one place the value is writable. */
export const ASSIGNABLE_PROJECT_ROLES: MemberRole[] = [
    MEMBER_ROLE.editor,
    MEMBER_ROLE.viewer,
    MEMBER_ROLE.guest,
];

/** Is this member an external collaborator? Surfaces mark them so a
 *  teammate can tell at a glance that someone outside the company is in
 *  the thread — the badge is the point, not decoration. */
export const isGuestRole = (role: string | null | undefined): boolean =>
    role === MEMBER_ROLE.guest;

/**
 * The role to DISPLAY for a member.
 *
 * The server stores only the editor/viewer axis — ownership lives in the
 * entity's owner FK, so the owner's stored `memberRole` is just the
 * `viewer` default. Every surface must overlay `owner` from the id it
 * already has, or the owner renders as a viewer.
 */
export const resolveDisplayRole = (
    userId: string | null | undefined,
    ownerUserId: string | null | undefined,
    memberRole: string | null | undefined
): MemberRole => {
    if (userId != null && ownerUserId != null && String(userId) === String(ownerUserId)) {
        return MEMBER_ROLE.owner;
    }
    if (memberRole === MEMBER_ROLE.editor) return MEMBER_ROLE.editor;
    // `guest` must survive this collapse. The old shape was
    // `editor ? editor : viewer`, which quietly rendered an external
    // collaborator as an ordinary viewer — losing the one signal that
    // tells a teammate somebody outside the company is in the room.
    if (memberRole === MEMBER_ROLE.guest) return MEMBER_ROLE.guest;
    return MEMBER_ROLE.viewer;
};

/** May this role invite members, rename, change the avatar, and set
 *  other members' roles? (Everything except delete + transfer.) */
export const canManageMembers = (role: MemberRole): boolean =>
    role === MEMBER_ROLE.owner || role === MEMBER_ROLE.editor;

/**
 * The current user's effective role in an entity, from its member list.
 *
 * Convenience wrapper so each modal computes its `canManage` gate the
 * same way instead of re-deriving the owner overlay by hand.
 */
export const resolveMyRole = (
    myUserId: string,
    ownerUserId: string | null | undefined,
    members: { userId: string; memberRole?: string | null }[] | null | undefined
): MemberRole => {
    const mine = (members ?? []).find((m) => String(m.userId) === String(myUserId));
    return resolveDisplayRole(myUserId, ownerUserId, mine?.memberRole);
};
