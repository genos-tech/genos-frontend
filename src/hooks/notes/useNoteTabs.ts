import { useCallback } from "react";

import { NoteTabActions } from "../../features/notes/shared-notes/types/noteEditor";
import { NoteManagementState } from "./useNoteManagement";

interface UseNoteTabsProps {
    useNM: NoteManagementState;
}

interface UseNoteTabsReturn extends NoteTabActions {}

/**
 * Custom hook for managing note tab functionality
 * Handles tab switching and closing operations
 *
 * @param props - Configuration object containing note management state
 * @returns Object containing tab management actions
 */
export const useNoteTabs = ({ useNM }: UseNoteTabsProps): UseNoteTabsReturn => {
    const handleCloseTab = useCallback(
        async (tabIndex: number, closingNoteId: number) => {
            const indexOfNextNote = tabIndex === 0 ? 1 : tabIndex - 1;
            const nextTabIndex = Math.max(tabIndex - 1, 0);

            useNM.setTabItems(useNM.tabItems.filter((t) => t.noteId !== closingNoteId));

            if (useNM.tabItems.length > 1) {
                await useNM.loadNote(
                    useNM.tabItems[indexOfNextNote].noteType,
                    useNM.tabItems[indexOfNextNote].noteId,
                    nextTabIndex
                );
            }
        },
        [useNM]
    );

    const handleTabChange = useCallback(
        (newValue: number) => {
            if (
                useNM.tabItems[Number(newValue)] &&
                useNM.tabItems[Number(newValue)].noteId &&
                useNM.tabItems[Number(newValue)].noteType
            ) {
                useNM.loadNote(
                    useNM.tabItems[Number(newValue)].noteType,
                    useNM.tabItems[Number(newValue)].noteId,
                    Number(newValue)
                );
            }
        },
        [useNM]
    );

    return {
        handleCloseTab,
        handleTabChange,
    };
};
