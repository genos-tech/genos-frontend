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
            const remainingTabs = useNM.tabItems.filter((t) => t.noteId !== closingNoteId);
            const nextTabIndex = Math.max(tabIndex - 1, 0);

            useNM.setTabItems(remainingTabs);

            if (remainingTabs.length > 0) {
                const safeIndex = Math.min(nextTabIndex, remainingTabs.length - 1);
                await useNM.loadNote(
                    remainingTabs[safeIndex].noteType,
                    remainingTabs[safeIndex].noteId,
                    safeIndex
                );
            }
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
