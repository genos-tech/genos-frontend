import { useEffect } from "react";

import { UserProps } from "../../types/admin";

// The logged-in user's OWN avatar renders from `myself.avatarImgPath`
// everywhere (chat sidebar, task table, comments, …) — `useUserProfile`
// returns `myself` for `userId === myself.userId`, and `UserAvatar`'s `isYou`
// branch reads `myself` too. `myself` is sourced from localStorage, which is
// per-browser and only written at sign-in / on a local avatar upload.
//
// So when the avatar changes in ANOTHER session, this session's IndexedDB and
// `teamMemberProfiles` get the new path (the `userStatus` heartbeat broadcast
// calls `addUser`, and `popTeamUsers` refreshes the store), but `myself` stays
// stale — leaving the user's own avatar blank/old here even though the local
// cache is correct. That's the "one browser shows the wrong self-avatar" bug.
//
// Reconcile it: the team-members store is the source of truth for avatars, so
// when its profile for this user carries a non-empty avatar path that differs
// from `myself`, adopt it (and persist to localStorage so the next reload
// starts consistent).
//
// Safe against reverting a fresh LOCAL change: the profile-modal upload path
// updates `teamMemberProfiles` + IndexedDB in the same breath as `myself`
// (see `ModalUserProfile`), so the store is never staler than `myself` for a
// local edit — the only way they diverge is a change that landed from
// elsewhere, which is exactly what we want to pick up.
export const useReconcileMyselfAvatar = (
    myself: UserProps,
    setMyself: (me: UserProps) => void,
    teamMemberProfiles: Record<string, UserProps>
): void => {
    useEffect(() => {
        if (!myself.userId) return;
        const authoritativePath = teamMemberProfiles[myself.userId]?.avatarImgPath;
        if (authoritativePath && authoritativePath !== myself.avatarImgPath) {
            localStorage.setItem("avatarImgPath", authoritativePath);
            setMyself({ ...myself, avatarImgPath: authoritativePath });
        }
    }, [myself, setMyself, teamMemberProfiles]);
};
