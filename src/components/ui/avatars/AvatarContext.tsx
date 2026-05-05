import { createContext, Dispatch, ReactNode, SetStateAction, useContext, useMemo } from "react";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../types/admin";

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
 *   - Returns `undefined` when neither resolves; callers should render an
 *     initials fallback.
 *
 * All id comparisons are stringified to avoid `"12"` vs `12` misses.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useUserProfile = (
    userId: string | number | null | undefined
): UserProps | undefined => {
    const { myself, teamMemberProfiles } = useAvatarContext();
    return useMemo(() => {
        if (userId == null || userId === "") return undefined;
        const idStr = String(userId);
        if (idStr === String(myself.userId)) return myself;
        return teamMemberProfiles[idStr];
    }, [userId, myself, teamMemberProfiles]);
};
