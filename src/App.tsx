// Import css
import "./App.css";

import { useEffect } from "react";
import CssBaseline from "@mui/joy/CssBaseline";
import { CssVarsProvider } from "@mui/joy/styles";

// Import worker
import PopTeamUsersWorker from "./workers/popTeamUsersWorker.ts?worker";
// Import db
import { initDB } from "./db/schema";
// Import context
import { useAuth } from "./context/AuthContext";
// Import components
import { InitialLoad } from "./components/utils/InitialLoad";
// Import features
import { ChatHome } from "./features/chat/chatHome";
import { InboxHome } from "./features/inbox/inboxHome";
import { NoteHome } from "./features/notes/NoteHome";
import { TaskHome } from "./features/tasks/taskHome";
import { useChatManagement } from "./hooks/chats/useChatManagement";
import { useMyself } from "./hooks/common/useAuth";
import { useProjectManagement } from "./hooks/common/useProjectManagement";
import { webSocketSync } from "./hooks/common/useSyncManagement";
import { useTeamManagement } from "./hooks/common/useTeamManagement";
import { useUIStateManagement } from "./hooks/common/useUIStateManagement";
// Import hooks
import { useWebSocket } from "./hooks/common/useWebSocket";
import { useInboxManagement } from "./hooks/inbox/useInboxManagement";
import { useNoteManagement } from "./hooks/notes/useNoteManagement";
import { useTaskManagement } from "./hooks/tasks/useTaskManagement";

export const App = () => {
    // Need to run if you delete IndexedDB database
    initDB();

    // Common
    const { accessToken } = useAuth();
    const { myself, setMyself } = useMyself(accessToken);
    const UIM = useUIStateManagement();

    // Team management
    const TEM = useTeamManagement(myself, accessToken);

    // WebSocket management
    const { socketInstance } = useWebSocket(accessToken, myself, TEM.currentTeamId);

    // Project management
    const PM = useProjectManagement(myself, accessToken, TEM.currentTeamId);

    // Chat management
    const CM = useChatManagement(myself, accessToken);

    // Task management
    const TM = useTaskManagement(myself, accessToken);

    // Note management
    const NM = useNoteManagement(myself, accessToken);

    // Inbox management
    const IM = useInboxManagement();

    useEffect(() => {
        const intervalMs: number = 1000;
        const now = Date.now();
        if (
            TM.tsLastLoadProjectTasks === undefined ||
            (TM.tsLastLoadProjectTasks && now - TM.tsLastLoadProjectTasks >= intervalMs)
        ) {
            setTimeout(() => {
                (async () => {
                    if (PM.currentProject && PM.currentProject.projectId) {
                        await TM.fetchProjectTasks(PM.currentProject.projectId);
                        localStorage.setItem(
                            "lastProjectId",
                            PM.currentProject.projectId.toString()
                        );
                    }
                })();
            }, 1000); // wait 500ms
        }
    }, [PM.currentProject]);

    useEffect(() => {
        (async () => {
            if (PM.currentProject && PM.isNewProjectCreated === true) {
                TM.fetchProjectTasks(PM.currentProject.projectId);
                localStorage.setItem("lastProjectId", PM.currentProject.projectId.toString());
            }
        })();
    }, [PM.isNewProjectCreated]);

    useEffect(() => {
        if (PM.currentProject) {
            TM.loadUpdatedTask(PM.currentProject.projectId);
        }
    }, [TM.currentPreviewTaskId, TM.isNewTaskCreated, TM.isTaskUpdatedBySomeone]);

    useEffect(() => {
        if (TM.isNewTaskCreated === true) {
            setTimeout(() => {
                (async () => {
                    await PM.loadProjectsAndTasks(
                        localStorage.getItem("lastProjectId")
                            ? Number(localStorage.getItem("lastProjectId"))
                            : -1
                    );
                })();
            }, 500);
        }
    }, [TM.isNewTaskCreated]);

    // Auto-load task when preview ID changes
    useEffect(() => {
        if (PM.currentProject && TM.currentPreviewTaskId !== -1) {
            TM.loadTask(PM.currentProject.projectId, TM.currentPreviewTaskId);
        }
    }, [TM.currentPreviewTaskId, PM.currentProject]);

    // Reset task state when team/project changes
    useEffect(() => {
        if (!PM.currentProject) {
            TM.setIsTaskPreviewVisible(false);
            TM.setCurrentPreviewTaskId(-1);
            TM.setCurrentPreviewTask(undefined);
            TM.setIsCreatingTask({
                flag: false,
                parentTaskId: null,
                rootTaskId: null,
            });
        }
    }, [PM.currentProject]);

    // Common Hooks
    webSocketSync({
        accessToken: accessToken,
        socket: socketInstance,
        myself: myself,
        isLoading: UIM.isLoading,
        funcSetInboxItems: IM.funcSetInboxItems,
        currentProject: PM.currentProject,
        currentPreviewTaskId: TM.currentPreviewTaskId,
        setIsTaskUpdatedBySomeone: TM.setIsTaskUpdatedBySomeone,
        setIsTaskCommentUpdated: TM.setIsTaskCommentUpdated,
        CM: CM,
    });

    useEffect(() => {
        NM.initializeNoteStates();
        NM.setIsTaskNoteVisible(false);

        TM.setOngoingTasks([]);
        TM.setClosedTasks([]);
        TM.setDeletedTasks([]);
        TM.setIsTaskPreviewVisible(false);

        CM.setIsThreadTaskVisible(false);
        CM.setIsChatNoteVisibleInChat(false);
        CM.setIsSubChatVisible(false);
        CM.setIsThreadVisible(false);
    }, [TEM.currentTeamId]);

    useEffect(() => {
        if (UIM.openingService === 0) {
            // Init all notes
            NM.setCurrentMyNote(null);
            NM.setCurrentTaskNote(null);
            NM.setCurrentChatNote(null);
        } else if (UIM.openingService === 1) {
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
            // setCurrentChatNote(null);
        } else if (UIM.openingService === 2) {
            // Keep the tabItems when an user changes the page from Notes to other pages.
            NM.setTmpTabItems(NM.tabItems);
            NM.setTabItems(NM.tabItems.filter((item) => item.noteType === 2));

            // Initialize the chat note visibility.
            NM.setIsTaskNoteVisible(false);

            // Init all notes
            NM.setCurrentMyNote(null);
            NM.setCurrentTaskNote(null);
            NM.setCurrentChatNote(null);
        } else if (UIM.openingService === 3) {
            // Keep the tabItems when an user changes the page from Notes to other pages.
            NM.setTabItems(NM.tmpTabItems);
            NM.setTmpTabItems([]);

            if (socketInstance) {
                NM.popInitialNote();
            }
        }
    }, [UIM.openingService]);

    useEffect(() => {
        if (UIM.isLoading === false) {
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
    }, [UIM.isLoading]);

    useEffect(() => {
        TEM.initCurrentTeam();
        if (myself.teamId !== TEM.currentTeamId) {
            TEM.setCurrentTeamId(myself.teamId);
            UIM.setIsLoading(true);
        }

        if (myself.userId !== "") {
            const popTeamUsersWorker = new PopTeamUsersWorker();

            // Only for the initialization
            popTeamUsersWorker.postMessage({ myself });
            popTeamUsersWorker.onmessage = (event) => {
                const data = event.data;
                if (data.error) {
                    console.error("Worker failed:", data.error);
                } else {
                    TEM.setTeamMemberProfiles(data);
                }
            };

            // Run every minute
            const interval = setInterval(() => {
                popTeamUsersWorker.postMessage({ myself });
                popTeamUsersWorker.onmessage = (event) => {
                    const data = event.data;
                    if (data.error) {
                        console.error("Worker failed:", data.error);
                    } else {
                        TEM.setTeamMemberProfiles(data);
                    }
                };
            }, 60_000);

            return () => {
                popTeamUsersWorker.terminate();
                clearInterval(interval);
            };
        }
    }, [myself]);

    // Task Related Hooks
    useEffect(() => {
        // If the thread chat is visible and has a task id, set the current preview task id.
        // This happens when someone created a task in the thread chat.
        if (
            CM.currentThreadChat &&
            CM.currentThreadChat.taskId !== null &&
            CM.isThreadVisible === true
        ) {
            TM.setCurrentPreviewTaskId(CM.currentThreadChat.taskId);
        }
    }, [CM.currentThreadChat]);

    return UIM.isLoading || CM.currentMainChat === undefined ? (
        <InitialLoad
            myself={myself}
            setCurrentMainChat={CM.setCurrentMainChat}
            setIsLoading={UIM.setIsLoading}
        />
    ) : (
        <div className="main-container">
            <CssVarsProvider disableTransitionOnChange>
                <CssBaseline />

                {UIM.openingService === 0 ? (
                    <InboxHome
                        currentTeam={TEM.currentTeam}
                        inboxItems={IM.inboxItems}
                        myself={myself}
                        openingService={UIM.openingService}
                        setCurrentMainChat={CM.setCurrentMainChat}
                        setCurrentTeam={TEM.setCurrentTeam}
                        setMyself={setMyself}
                        setOpeningService={UIM.setOpeningService}
                        socket={socketInstance}
                        teamMemberProfiles={TEM.teamMemberProfiles}
                        unReadChatAndActivityCounts={CM.unReadChatAndActivityCounts}
                        unReadInboxItemCount={IM.unReadInboxItemCount}
                    />
                ) : null}

                {UIM.openingService === 1 ? (
                    <ChatHome
                        CM={CM}
                        myself={myself}
                        NM={NM}
                        openingService={UIM.openingService}
                        PM={PM}
                        setMyself={setMyself}
                        setOpeningService={UIM.setOpeningService}
                        socket={socketInstance}
                        TEM={TEM}
                        TM={TM}
                        unReadInboxItemCount={IM.unReadInboxItemCount}
                    />
                ) : null}

                {UIM.openingService === 2 ? (
                    <TaskHome
                        allChats={CM.allChats}
                        funcSetAllChats={CM.funcSetAllChats}
                        moveToSpecificChat={CM.moveToSpecificChat}
                        myself={myself}
                        NM={NM}
                        openingService={UIM.openingService}
                        PM={PM}
                        setAllChats={CM.setAllChats}
                        setCurrentMainChat={CM.setCurrentMainChat}
                        setMyself={setMyself}
                        setOpeningService={UIM.setOpeningService}
                        socket={socketInstance}
                        TEM={TEM}
                        TM={TM}
                        unReadChatAndActivityCounts={CM.unReadChatAndActivityCounts}
                        unReadInboxItemCount={IM.unReadInboxItemCount}
                    />
                ) : null}

                {UIM.openingService === 3 ? (
                    <NoteHome
                        CM={CM}
                        myself={myself}
                        NM={NM}
                        openingService={UIM.openingService}
                        PM={PM}
                        setMyself={setMyself}
                        setOpeningService={UIM.setOpeningService}
                        socket={socketInstance}
                        TEM={TEM}
                        TM={TM}
                        unReadInboxItemCount={IM.unReadInboxItemCount}
                    />
                ) : null}
            </CssVarsProvider>
        </div>
    );
};
