import { createContext, ReactNode, useContext } from "react";

import { MentionGroupsApi } from "../hooks/common/useMentionGroups";

// Mention groups are read in lots of places — every BlockNote editor's
// @ suggestion menu — and would otherwise need to be prop-drilled
// through `useTEM`. Lifting them into a single context keeps the
// editors decoupled from the team-management hook and avoids each
// editor instantiating its own copy (which would multiply the
// `/mention-group/` fetch by the number of mounted editors).
const MentionGroupsContext = createContext<MentionGroupsApi | null>(null);

export const MentionGroupsProvider = ({
    value,
    children,
}: {
    value: MentionGroupsApi;
    children: ReactNode;
}) => <MentionGroupsContext.Provider value={value}>{children}</MentionGroupsContext.Provider>;

// Returns a no-op shim when used outside the provider so editors
// rendered in pre-auth contexts (signin / signup) don't crash. Live
// callers always get the real API once the App-root provider mounts.
// eslint-disable-next-line react-refresh/only-export-components
export const useMentionGroupsContext = (): MentionGroupsApi => {
    const ctx = useContext(MentionGroupsContext);
    if (ctx) return ctx;
    return {
        mentionGroups: [],
        loading: false,
        refresh: async () => {},
        createGroup: async () => null,
        updateGroup: async () => null,
        deleteGroup: async () => false,
        addMembers: async () => false,
        removeMember: async () => false,
    };
};
