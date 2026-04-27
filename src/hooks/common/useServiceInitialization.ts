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
    const useNM = useNoteManagement(myself, accessToken);
    const useTM = useTaskManagement(myself, accessToken);
    const useCM = useChatManagement(myself, accessToken);
    const useIM = useInboxManagement();
    const useTEM = useTeamManagement(myself, accessToken);

    // Reset states when team changes
    useEffect(() => {
        useNM.initializeNoteStates();
        useNM.setIsTaskNoteVisible(false);

        useTM.setAllTasks([]);
        useTM.setIsTaskPreviewVisible(false);

        useCM.setIsThreadTaskVisible(false);
        useCM.setIsChatNoteVisibleInChat(false);
        useCM.setIsSubChatVisible(false);
        useCM.setIsThreadVisible(false);
    }, [currentTeamId]);

    // Handle service-specific initialization
    useEffect(() => {
        if (openingService === 0) {
            // Init all notes
            useNM.setCurrentMyNote(null);
            useNM.setCurrentTaskNote(null);
            useNM.setCurrentChatNote(null);
        } else if (openingService === 1) {
            // Initialize the task visibility.
            useTM.setIsTaskPreviewVisible(false);

            // Keep the tabItems when an user changes the page from Notes to other pages.
            useNM.setTmpTabItems(useNM.tabItems);
            const chatNoteItems = useNM.tabItems.filter((item) => item.noteType === 3);
            useNM.setTabItems(chatNoteItems);

            if (chatNoteItems.length === 0) {
                useCM.setIsChatNoteVisibleInChat(false);
            }
            // Init all notes
            useNM.setCurrentMyNote(null);
            useNM.setCurrentTaskNote(null);
        } else if (openingService === 2) {
            // Keep the tabItems when an user changes the page from Notes to other pages.
            useNM.setTmpTabItems(useNM.tabItems);
            useNM.setTabItems(useNM.tabItems.filter((item) => item.noteType === 2));

            // Initialize the chat note visibility.
            useNM.setIsTaskNoteVisible(false);

            // Init all notes
            useNM.setCurrentMyNote(null);
            useNM.setCurrentTaskNote(null);
            useNM.setCurrentChatNote(null);
        } else if (openingService === 3) {
            // Keep the tabItems when an user changes the page from Notes to other pages.
            useNM.setTabItems(useNM.tmpTabItems);
            useNM.setTmpTabItems([]);

            if (socketInstance) {
                useNM.popInitialNote();
            }
        }
    }, [openingService]);

    // Initialize data when loading completes
    useEffect(() => {
        if (isLoading === false) {
            useIM.funcSetInboxItems();

            useCM.funcSetAllChats();
            useCM.funcSetFlaggedMessages();
            useCM.funcSetActivityMessages();

            // Load all team users
            useTEM.funcSetTeamMembers();

            // Load task metadata
            useTM.getTaskMeta();

            // Load note metadata
            useNM.getMyNoteMeta();
            useNM.getTaskNoteMeta();
            useNM.getChatNoteMeta();
        }
    }, [isLoading]);

    return {
        useNM,
        useTM,
        useCM,
        useIM,
        useTEM,
    };
};
