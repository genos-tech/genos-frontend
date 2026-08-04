import { createContext, Dispatch, ReactNode, SetStateAction, useContext, useMemo } from "react";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../types/admin";
import { rememberedPerson, useRememberedPerson } from "./userDirectory";

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
 * Live display name for a user id, falling back to a cached name.
 *
 * Names are denormalized at write time — `message.sender.userName`,
 * `chat.mdmMembers[].userName`, mention props, `comment.senderName`, task
 * `assigneeName`, etc. — so a profile rename never retroactively rewrites
 * those stored strings. This resolves the *current* name at render instead
 * (self via `myself`, others via `teamMemberProfiles`), falling back to the
 * stored name when the user isn't in either source.
 *
 * Pure (not a hook) so it can run inside `.map()` callbacks: read `myself` /
 * `teamMemberProfiles` once at the component top and pass them in.
 */
export const resolveDisplayName = (
    userId: string | number | null | undefined,
    fallbackName: string,
    myself: UserProps | undefined,
    teamMemberProfiles: Record<string, UserProps> | undefined
): string => {
    if (userId == null || userId === "") return fallbackName;
    const idStr = String(userId);
    if (myself && idStr === String(myself.userId)) return myself.userName || fallbackName;
    return (
        teamMemberProfiles?.[idStr]?.userName ||
        // Somebody from another team, whom no roster here can name. Read
        // without subscribing: this is a pure function so it can run in a
        // `.map()`, and the stored `fallbackName` is already a real name in
        // the cases where this matters.
        rememberedPerson(idStr)?.userName ||
        fallbackName
    );
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
    return resolveDisplayName(userId, fallbackName, ctx?.myself, ctx?.teamMemberProfiles);
};

/**
 * Component form of `useResolvedUserName`, rendering the live name as text.
 * Isolates the AvatarContext subscription to this leaf so heavily-memoized
 * parents (e.g. `DraggableTaskRow`) don't re-render on every
 * `teamMemberProfiles` change — only this node does, mirroring how
 * `<UserAvatar>` already scopes its own subscription.
 */
export const ResolvedUserName = ({
    userId,
    fallbackName,
}: {
    userId: string | number | null | undefined;
    fallbackName: string;
}) => <>{useResolvedUserName(userId, fallbackName)}</>;
