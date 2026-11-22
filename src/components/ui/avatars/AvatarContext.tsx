import { createContext, Dispatch, ReactNode, SetStateAction, useContext, useMemo } from "react";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../types/admin";
import { resolveDisplayName } from "./avatarContextHelpers";
import { useRememberedPerson } from "./userDirectory";

// Single source of truth for everything an avatar needs to render itself
// without taking a fan-out of props at every callsite. The provider lives
// in the authenticated shell (`App.tsx`) so avatars deep in the tree
// (chat bubbles, task rows, comments) can subscribe directly.
export type AvatarContextValue = {
    myself: UserProps;
    setMyself: Dispatch<SetStateAction<UserProps>>;
    teamMemberProfiles: Record<string, UserProps>;
    setTeamMemberProfiles: Dispatch<SetStateAction<Record<string, UserProps>>>;
    socket: Socket | null;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    /** Whether the signed-in user's notifications are paused RIGHT NOW
     *  (Slack-style DND). Sourced from the reactive pause hook so the user's
     *  OWN avatar badge is instant — it doesn't wait for their heartbeat to
     *  round-trip back through `teamMemberProfiles` (others' badges do, ≤60s,
     *  matching `isOnline` freshness). See `UserAvatar`'s `isPaused`.
     *
     *  Optional: the authenticated shell always supplies it, but the many
     *  isolated test / non-shell providers don't, and a missing value simply
     *  reads as "not paused". */
    selfNotificationsPaused?: boolean;
};

// eslint-disable-next-line react-refresh/only-export-components
export const AvatarContext = createContext<AvatarContextValue | null>(null);

type AvatarContextProviderProps = {
    value: AvatarContextValue;
    children: ReactNode;
};

export const AvatarContextProvider = ({ value, children }: AvatarContextProviderProps) => (
    <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>
);

// eslint-disable-next-line react-refresh/only-export-components
export const useAvatarContext = (): AvatarContextValue => {
    const ctx = useContext(AvatarContext);
    if (!ctx) {
        throw new Error("useAvatarContext must be used within <AvatarContextProvider>.");
    }
    return ctx;
};

// Safe variant for components that may render in environments outside the
// authenticated shell (the sign-in form, isolated test harnesses, etc.).
// Returns null instead of throwing.
// eslint-disable-next-line react-refresh/only-export-components
export const useOptionalAvatarContext = (): AvatarContextValue | null => {
    return useContext(AvatarContext);
};

/**
 * Resolve the user profile for `userId`.
 *
 *   - When `userId` matches the signed-in user, returns `myself` so a
 *     locally-cached avatar update (e.g. immediately after a profile-image
 *     upload) is reflected before `teamMemberProfiles` re-pops.
 *   - Otherwise looks up `teamMemberProfiles[String(userId)]`.
 *   - Failing that, the cross-team directory (`userDirectory`) — people
 *     from another team, who are in no roster we hold and used to resolve
 *     to nothing at all. The roster wins where both have the person: it is
 *     fetched, complete, and carries presence.
 *   - Returns `undefined` when none resolve; callers should render an
 *     initials fallback.
 *
 * All id comparisons are stringified to avoid `"12"` vs `12` misses.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useUserProfile = (
    userId: string | number | null | undefined
): UserProps | undefined => {
    const { myself, teamMemberProfiles } = useAvatarContext();
    const remembered = useRememberedPerson(userId);
    return useMemo(() => {
        if (userId == null || userId === "") return undefined;
        const idStr = String(userId);
        if (idStr === String(myself.userId)) return myself;
        return teamMemberProfiles[idStr] ?? remembered;
    }, [userId, myself, teamMemberProfiles, remembered]);
};

/**
 * Hook variant of `resolveDisplayName` for single-name components. Uses the
 * optional avatar context, so it safely returns the fallback when rendered
 * outside `<AvatarContextProvider>` (isolated test harnesses, sign-in shell).
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useResolvedUserName = (
    userId: string | number | null | undefined,
    fallbackName: string
): string => {
    const ctx = useOptionalAvatarContext();
    // Subscribe to the directory for THIS id, so a chip that rendered before
    // the payload naming the person landed (a deleted sender arriving
    // anonymised) re-renders into "Deleted user". `resolveDisplayName` reads
    // the directory without subscribing.
    useRememberedPerson(userId);
    return resolveDisplayName(userId, fallbackName, ctx?.myself, ctx?.teamMemberProfiles);
};

/**
 * Component form of `useResolvedUserName`, rendering the live name as text.
 * Isolates the AvatarContext subscription to this leaf so heavily-memoized
 * parents (e.g. `DraggableTaskRow`) don't re-render on every
 * `teamMemberProfiles` change — only this node does, mirroring how
 * `<UserAvatar>` already scopes its own subscription.
 *
 * The name sits in a `<bdi>`: a name is its own bidi island. Without it an
 * "(DY) Ken Kamiya" inside an RTL row (Arabic) reorders to "Ken Kamiya (DY)",
 * and a truncated cell clips the FIRST letters ("…n Kamiya (DY)"). `.g-bidi-island`
 * (App.css) makes the island truncate itself, at its own end, in RTL only.
 */
export const ResolvedUserName = ({
    userId,
    fallbackName,
}: {
    userId: string | number | null | undefined;
    fallbackName: string;
}) => <bdi className="g-bidi-island">{useResolvedUserName(userId, fallbackName)}</bdi>;
