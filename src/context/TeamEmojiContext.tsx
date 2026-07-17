import { createContext, ReactNode, useContext } from "react";

import { TeamEmojiApi } from "../hooks/common/useTeamEmoji";

// Same shape/rationale as MentionGroupsContext: one App-root fetch
// shared by every consumer (Settings panel, pickers) instead of each
// mounting its own copy of the hook. Synchronous readers (the `:`
// suggestion resolver) go through `teamEmojiStore` instead — this
// context is only for components that also need the CRUD surface.
const TeamEmojiContext = createContext<TeamEmojiApi | null>(null);

export const TeamEmojiProvider = ({
    value,
    children,
}: {
    value: TeamEmojiApi;
    children: ReactNode;
}) => <TeamEmojiContext.Provider value={value}>{children}</TeamEmojiContext.Provider>;

// No-op shim outside the provider so pre-auth surfaces don't crash.
// eslint-disable-next-line react-refresh/only-export-components
export const useTeamEmojiContext = (): TeamEmojiApi => {
    const ctx = useContext(TeamEmojiContext);
    if (ctx) return ctx;
    return {
        teamEmoji: [],
        loading: false,
        refresh: async () => {},
        create: async () => null,
        remove: async () => false,
    };
};
