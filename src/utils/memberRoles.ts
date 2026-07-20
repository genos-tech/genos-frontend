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
} as const;

export type MemberRole = (typeof MEMBER_ROLE)[keyof typeof MEMBER_ROLE];

/** Roles a manager may assign. `owner` is absent: minting an owner is an
 *  ownership transfer, which has its own owner-only flow. */
export const ASSIGNABLE_MEMBER_ROLES: MemberRole[] = [MEMBER_ROLE.editor, MEMBER_ROLE.viewer];

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
    return memberRole === MEMBER_ROLE.editor ? MEMBER_ROLE.editor : MEMBER_ROLE.viewer;
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
