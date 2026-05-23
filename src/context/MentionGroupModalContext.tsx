import { createContext, ReactNode, useCallback, useContext, useState } from "react";

// Coordinates the single global "open this mention group" modal mounted
// at the App root. The BlockNote inline content spec for `mentionGroup`
// (in Mention.tsx) cannot mount its own modal with full access to team
// state — it lives inside an editor's render scope and isn't wrapped by
// `MentionGroupsProvider` via the editor's own tree. Instead the chip
// just calls `openGroupModal(groupId)`, and the App root renders the
// modal with all the providers it needs.
interface MentionGroupModalContextValue {
    openGroupId: number | null;
    openGroupModal: (groupId: number) => void;
    closeGroupModal: () => void;
}

const MentionGroupModalContext = createContext<MentionGroupModalContextValue | null>(null);

// State owner — call at the App root. Pass the returned object into
// the provider AND into the corresponding `<MentionGroupModal>` mount.
// eslint-disable-next-line react-refresh/only-export-components
export const useMentionGroupModalState = (): MentionGroupModalContextValue => {
    const [openGroupId, setOpenGroupId] = useState<number | null>(null);
    const openGroupModal = useCallback((groupId: number) => setOpenGroupId(groupId), []);
    const closeGroupModal = useCallback(() => setOpenGroupId(null), []);
    return { openGroupId, openGroupModal, closeGroupModal };
};

export const MentionGroupModalProvider = ({
    value,
    children,
}: {
    value: MentionGroupModalContextValue;
    children: ReactNode;
}) => (
    <MentionGroupModalContext.Provider value={value}>{children}</MentionGroupModalContext.Provider>
);

// Returns a no-op shim when used outside the provider so editors
// rendered in pre-auth contexts don't crash.
// eslint-disable-next-line react-refresh/only-export-components
export const useMentionGroupModal = (): MentionGroupModalContextValue => {
    const ctx = useContext(MentionGroupModalContext);
    if (ctx) return ctx;
    return {
        openGroupId: null,
        openGroupModal: () => {},
        closeGroupModal: () => {},
    };
};
