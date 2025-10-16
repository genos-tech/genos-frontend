import { useCallback } from "react";

import { NoteManagementState } from "./useNoteManagement";

export interface ChatNoteTabActions {
    handleCloseTab: (tabIndex: number, closingNoteId: number) => Promise<void>;
    handleTabChange: (newValue: number) => void;
}

export interface UseChatNoteTabsProps {
    NM: NoteManagementState;
}

/**
 * Custom hook for managing chat note tabs functionality
 * Handles tab closing, tab switching, and related operations
 *
 * @param props - Configuration object for the chat note tabs
 * @returns Object containing tab management actions
 */
export const useChatNoteTabs = ({ NM }: UseChatNoteTabsProps): ChatNoteTabActions => {
    const handleCloseTab = useCallback(
        async (tabIndex: number, closingNoteId: number) => {
            const indexOfNextNote = tabIndex === 0 ? 1 : tabIndex - 1;
            const nextTabIndex = Math.max(tabIndex - 1, 0);

            NM.setTabItems(NM.tabItems.filter((t) => t.noteId !== closingNoteId));

            await NM.loadNote(
                NM.tabItems[indexOfNextNote].noteType,
                NM.tabItems[indexOfNextNote].noteId,
                nextTabIndex
            );
        },
        [NM]
    );

    const handleTabChange = useCallback(
        (newValue: number) => {
            NM.loadNote(NM.tabItems[newValue].noteType, NM.tabItems[newValue].noteId, newValue);
        },
        [NM]
    );

    return {
        handleCloseTab,
        handleTabChange,
    };
};
