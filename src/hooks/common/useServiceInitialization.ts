import { useEffect } from "react";

import { useChatManagement } from "../chats/useChatManagement";
import { useInboxManagement } from "../inbox/useInboxManagement";
import { useNoteManagement } from "../notes/useNoteManagement";
import { useTaskManagement } from "../tasks/useTaskManagement";
import { useTeamManagement } from "./useTeamManagement";

interface UseServiceInitializationProps {
    myself: any;
    accessToken: string;
    currentTeamId: string;
    isLoading: boolean;
    openingService: number;
    socketInstance: any;
}

export const useServiceInitialization = ({
    myself,
    accessToken,
    currentTeamId,
    isLoading,
    openingService,
    socketInstance,
}: UseServiceInitializationProps) => {
    const NM = useNoteManagement(myself, accessToken);
    const TM = useTaskManagement(myself, accessToken);
    const CM = useChatManagement(myself, accessToken);
    const IM = useInboxManagement();
    const TEM = useTeamManagement(myself, accessToken);

    // Reset states when team changes
    useEffect(() => {
        NM.initializeNoteStates();
        NM.setIsTaskNoteVisible(false);

        TM.setAllTasks([]);
        TM.setIsTaskPreviewVisible(false);

        CM.setIsThreadTaskVisible(false);
        CM.setIsChatNoteVisibleInChat(false);
        CM.setIsSubChatVisible(false);
        CM.setIsThreadVisible(false);
    }, [currentTeamId]);

    // Handle service-specific initialization
    useEffect(() => {
        if (openingService === 0) {
            // Init all notes
            NM.setCurrentMyNote(null);
            NM.setCurrentTaskNote(null);
            NM.setCurrentChatNote(null);
        } else if (openingService === 1) {
            // Initialize the task visibility.
            TM.setIsTaskPreviewVisible(false);

            // Keep the tabItems when an user changes the page from Notes to other pages.
            NM.setTmpTabItems(NM.tabItems);
            NM.setTabItems(NM.tabItems.filter((item) => item.noteType === 3));

            // Initialize the chat note visibility.
            if (NM.tabItems.filter((item) => item.noteType === 3).length === 0) {
                CM.setIsChatNoteVisibleInChat(false);
            }
            // Init all notes
            NM.setCurrentMyNote(null);
            NM.setCurrentTaskNote(null);
        } else if (openingService === 2) {
            // Keep the tabItems when an user changes the page from Notes to other pages.
            NM.setTmpTabItems(NM.tabItems);
            NM.setTabItems(NM.tabItems.filter((item) => item.noteType === 2));

            // Initialize the chat note visibility.
            NM.setIsTaskNoteVisible(false);

            // Init all notes
            NM.setCurrentMyNote(null);
            NM.setCurrentTaskNote(null);
            NM.setCurrentChatNote(null);
        } else if (openingService === 3) {
            // Keep the tabItems when an user changes the page from Notes to other pages.
            NM.setTabItems(NM.tmpTabItems);
            NM.setTmpTabItems([]);

            if (socketInstance) {
                NM.popInitialNote();
            }
        }
    }, [openingService]);

    // Initialize data when loading completes
    useEffect(() => {
        if (isLoading === false) {
            IM.funcSetInboxItems();

            CM.funcSetAllChats();
            CM.funcSetFlaggedMessages();
            CM.funcSetActivityMessages();

            // Load all team users
            TEM.funcSetTeamMembers();

            // Load task metadata
            TM.getTaskMeta();

            // Load note metadata
            NM.getMyNoteMeta();
            NM.getTaskNoteMeta();
            NM.getChatNoteMeta();
        }
    }, [isLoading]);

    return {
        NM,
        TM,
        CM,
        IM,
        TEM,
    };
};
