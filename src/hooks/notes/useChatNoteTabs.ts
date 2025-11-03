import { useCallback } from "react";

import { NoteManagementState } from "./useNoteManagement";

export interface ChatNoteTabActions {
    handleCloseTab: (tabIndex: number, closingNoteId: number) => Promise<void>;
    handleTabChange: (newValue: number) => void;
}

export interface UseChatNoteTabsProps {
    useNM: NoteManagementState;
}

/**
 * Custom hook for managing chat note tabs functionality
 * Handles tab closing, tab switching, and related operations
 *
 * @param props - Configuration object for the chat note tabs
 * @returns Object containing tab management actions
 */
export const useChatNoteTabs = ({ useNM }: UseChatNoteTabsProps): ChatNoteTabActions => {
    const handleCloseTab = useCallback(
        async (tabIndex: number, closingNoteId: number) => {
            const indexOfNextNote = tabIndex === 0 ? 1 : tabIndex - 1;
            const nextTabIndex = Math.max(tabIndex - 1, 0);

            useNM.setTabItems(useNM.tabItems.filter((t) => t.noteId !== closingNoteId));

            await useNM.loadNote(
                useNM.tabItems[indexOfNextNote].noteType,
                useNM.tabItems[indexOfNextNote].noteId,
                nextTabIndex
            );
        },
        [useNM]
    );

    const handleTabChange = useCallback(
        (newValue: number) => {
            useNM.loadNote(
                useNM.tabItems[newValue].noteType,
                useNM.tabItems[newValue].noteId,
                newValue
            );
        },
        [useNM]
    );

    return {
        handleCloseTab,
        handleTabChange,
    };
};
