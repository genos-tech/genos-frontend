import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";

import { useChatManagement } from "../chats/useChatManagement";
import { useInboxManagement } from "../inbox/useInboxManagement";
import { useNoteManagement } from "../notes/useNoteManagement";
import { useTaskManagement } from "../tasks/useTaskManagement";

interface UseServiceInitializationProps {
    myself: any;
    accessToken: string;
    currentTeamId: string;
    isLoading: boolean;
    socketInstance: any;
}

// Service identifier derived from the current URL. Using a discrete tag
// (instead of `location.pathname` directly) keeps the service-init effect
// firing only when the user crosses a service boundary — re-deriving on
// every intra-service URL change (e.g. moving between two tasks) would
// rerun the init blocks and clobber state.
type ActiveService = "inbox" | "chat" | "tasks" | "notes" | null;

const deriveActiveService = (pathname: string): ActiveService => {
    if (pathname.includes("/home/inbox")) return "inbox";
    if (pathname.includes("/home/chat")) return "chat";
    if (pathname.includes("/home/tasks")) return "tasks";
    if (pathname.includes("/home/notes")) return "notes";
    return null;
};

export const useServiceInitialization = ({
    myself,
    accessToken,
    currentTeamId,
    isLoading,
    socketInstance,
}: UseServiceInitializationProps) => {
    const location = useLocation();
    const activeService = useMemo<ActiveService>(
        () => deriveActiveService(location.pathname),
        [location.pathname]
    );
    const useNM = useNoteManagement(myself, accessToken);
    const useTM = useTaskManagement(myself, accessToken);
    const useCM = useChatManagement(myself, accessToken);
    const useIM = useInboxManagement();
    // Note: a third `useTeamManagement(myself, accessToken)` used to live
    // here and was destructured-but-unused in `App.tsx`. Its worker
    // effects still ran (a third 60 s interval against the same data),
    // churning `teamMemberProfiles` references for no consumer. Removed.
    // The "real" `useTEM` is created in `useAppInitialization` and
    // threaded through `App.tsx` to every feature route that needs it.

    // Reset states when team changes.
    // We MUST clear all team-scoped React state here (in addition to wiping IndexedDB
    // in useAppInitialization). Otherwise:
    //   - funcSetAllChats merges previous-team chats into the new team's list
    //   - currentMainChat / activityMessages / inbox can briefly render stale data
    //   - notes still reference IDs from the previous team
    useEffect(() => {
        // Notes
        useNM.initializeNoteStates();
        useNM.setIsTaskNoteVisible(false);

        // Tasks (also reset in useProjectTaskManagement; this instance is local to
        // useServiceInitialization but we keep the reset for consistency).
        useTM.setAllTasks([]);
        useTM.setIsTaskPreviewVisible(false);

        // Chats: wipe both lists and currently-open chats so the new team starts clean.
        useCM.setAllChats([]);
        useCM.setActivityMessages([]);
        useCM.setFlaggedMessages([]);
        useCM.setUnReadChatCounts({});
        useCM.setUnReadActivityMessageCounts(-1);
        useCM.setUnReadChatAndActivityCounts(0);
        useCM.setCurrentMainChat(undefined);
        useCM.setCurrentSubChat(undefined);
        useCM.setCurrentThreadChat(undefined);
        useCM.setIsThreadTaskVisible(false);
        useCM.setIsChatNoteVisibleInChat(false);
        useCM.setIsSubChatVisible(false);
        useCM.setIsThreadVisible(false);

        // Inbox
        useIM.setInboxItems([]);
        useIM.setUnReadInboxItemCount(0);
    }, [currentTeamId]);

    // Handle service-specific initialization. Fires only when the URL
    // crosses into a different service (see `deriveActiveService`).
    //
    // Tab strip is now managed by `useNoteTabs` and persisted per team.
    // We no longer swap `tabItems`/`tmpTabItems` based on the active
    // service — the notes-home tab strip is independent of chat/task
    // page activity (see `useChatPanelNote` for the isolated chat-page
    // panel state).
    useEffect(() => {
        if (activeService === "inbox") {
            useNM.setCurrentMyNote(null);
            useNM.setCurrentTaskNote(null);
            useNM.setCurrentChatNote(null);
        } else if (activeService === "chat") {
            useTM.setIsTaskPreviewVisible(false);
            useNM.setCurrentMyNote(null);
            useNM.setCurrentTaskNote(null);
        } else if (activeService === "tasks") {
            useNM.setIsTaskNoteVisible(false);
            useNM.setCurrentMyNote(null);
            useNM.setCurrentTaskNote(null);
            useNM.setCurrentChatNote(null);
        } else if (activeService === "notes") {
            // Notes-home tabs are rehydrated by `tabsApi.rehydrate()` on
            // team change; nothing to do here.
            if (socketInstance) {
                useNM.popInitialNote();
            }
        }
    }, [activeService]);

    // Initialize data when loading completes
    useEffect(() => {
        if (isLoading === false) {
            useIM.funcSetInboxItems();

            useCM.funcSetAllChats();
            useCM.funcSetFlaggedMessages();
            useCM.funcSetActivityMessages();

            // Note: team-member hydration is now driven by the
            // `popTeamUsersWorker` effect inside `useTeamManagement`
            // itself, which runs on every `myself` change and on a 60 s
            // interval. Calling `funcSetTeamMembers()` here would only
            // populate the (now-removed) orphan instance's local state.

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
    };
};
