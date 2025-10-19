import { useCallback } from "react";

import { NoteTabActions } from "../../features/notes/shared/types/noteEditor";
import { NoteManagementState } from "./useNoteManagement";

interface UseNoteTabsProps {
    NM: NoteManagementState;
}

interface UseNoteTabsReturn extends NoteTabActions {}

/**
 * Custom hook for managing note tab functionality
 * Handles tab switching and closing operations
 *
 * @param props - Configuration object containing note management state
 * @returns Object containing tab management actions
 */
export const useNoteTabs = ({ NM }: UseNoteTabsProps): UseNoteTabsReturn => {
    const handleCloseTab = useCallback(
        async (tabIndex: number, closingNoteId: number) => {
            const indexOfNextNote = tabIndex === 0 ? 1 : tabIndex - 1;
            const nextTabIndex = Math.max(tabIndex - 1, 0);

            NM.setTabItems(NM.tabItems.filter((t) => t.noteId !== closingNoteId));

            if (NM.tabItems.length > 1) {
                await NM.loadNote(
                    NM.tabItems[indexOfNextNote].noteType,
                    NM.tabItems[indexOfNextNote].noteId,
                    nextTabIndex
                );
            }
        },
        [NM]
    );

    const handleTabChange = useCallback(
        (newValue: number) => {
            if (
                NM.tabItems[Number(newValue)] &&
                NM.tabItems[Number(newValue)].noteId &&
                NM.tabItems[Number(newValue)].noteType
            ) {
                NM.loadNote(
                    NM.tabItems[Number(newValue)].noteType,
                    NM.tabItems[Number(newValue)].noteId,
                    Number(newValue)
                );
            }
        },
        [NM]
    );

    return {
        handleCloseTab,
        handleTabChange,
    };
};
