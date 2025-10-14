import { useEffect } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import CssBaseline from "@mui/joy/CssBaseline";

import "./App.css";
import { ChatHome } from "./features/chat/chatHome";
import { TaskHome } from "./features/tasks/taskHome";
import { NoteHome } from "./features/notes/NoteHome";
import { InitialLoad } from "./components/utils/InitialLoad";

import { useAuth } from "./context/AuthContext";
import { webSocketSync } from "./hooks/common/useSyncManagement";
import { initDB } from "./db/schema";
import { InboxHome } from "./features/inbox/inboxHome";
import PopTeamUsersWorker from "./workers/popTeamUsersWorker.ts?worker";
import { TaskProps } from "./types/tasks";
import { loadSpecificTask } from "./features/tasks/services/loadSpecificTask";

import { useWebSocket } from "./hooks/common/useWebSocket";
import { useTeamManagement } from "./hooks/common/useTeamManagement";
import { useMyself } from "./hooks/common/useAuth";
import { useUIStateManagement } from "./hooks/common/useUIStateManagement";
import { useChatManagement } from "./hooks/chats/useChatManagement";
import { useInboxManagement } from "./hooks/inbox/useInboxManagement";
import { useProjectManagement } from "./hooks/common/useProjectManagement";

// Import task and note management hooks
// import { useTaskManagement } from "./hooks/useTaskManagement";
import { useNoteManagement } from "./hooks/notes/useNoteManagement";
import { useTaskManagement } from "./hooks/tasks/useTaskManagement";

export const App = () => {
    // Need to run if you delete IndexedDB database
    initDB();

    ///////////////////////
    // Common
    ///////////////////////
    const { accessToken } = useAuth();
    const { myself, setMyself } = useMyself(accessToken);
    const UIM = useUIStateManagement();

    ///////////////////////
    // Team Related
    ///////////////////////
    const TEM = useTeamManagement(myself, accessToken);

    // WebSocket management
    const { socketInstance } = useWebSocket(accessToken, myself, TEM.currentTeamId);

    ///////////////////////
    // Project Related
    ///////////////////////
    // Project management
    const PM = useProjectManagement(myself, accessToken, TEM.currentTeamId);

    ///////////////////////
    // Chat Related
    ///////////////////////
    // Chat management
    const CM = useChatManagement(myself, accessToken);

    ///////////////////////
    // Task Related
    ///////////////////////
    const TM = useTaskManagement(myself, accessToken);

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
        (async () => {
            if (PM.currentProject && TM.currentPreviewTaskId !== -1) {
                const loadedTask: TaskProps[] = await loadSpecificTask(
                    myself,
                    PM.currentProject.projectId,
                    TM.currentPreviewTaskId,
                    accessToken
                );

                // No need to update the current preview task when a new tag is created.
                if (TM.isNewTagCreated === false && loadedTask.length > 0) {
                    TM.setCurrentPreviewTask(loadedTask[0]);
                }

                TM.setIsTaskPreviewVisible(true);

                // Add a new ongoing task
                if (TM.isNewTaskCreated === true || TM.isTaskUpdatedBySomeone === true) {
                    TM.setOngoingTasks([
                        ...TM.ongoingTasks,
                        {
                            id: String(loadedTask[0].id) || null,
                            title: loadedTask[0].title || "",
                            priority: loadedTask[0].priority.priority || null,
                            effortLevel: loadedTask[0].effortLevel.level || null,
                            createdDate: loadedTask[0].createdDate || null,
                            updatedAt: loadedTask[0].updatedAt || null,
                            dueDate: loadedTask[0].dueDate || null,
                            daysLeft: loadedTask[0].daysLeft || null,
                            status: loadedTask[0].status.status || null,
                            assigneeId: loadedTask[0].assignee.userId || null,
                            assigneeEmail: loadedTask[0].assignee.userEmail || null,
                            assigneeName: loadedTask[0].assignee.userName || null,
                            assigneeImgPath: loadedTask[0].assignee.avatarImgPath || null,
                            parentTaskId: String(loadedTask[0].parentTaskId) || null,
                            threadId: loadedTask[0].threadId || null,
                            tags: loadedTask[0].tags || [],
                            concatTags: loadedTask[0].concatTags || "//",
                            teamId: myself.teamId || null,
                            projectId: loadedTask[0].project?.projectId || null,
                        },
                    ]);
                }
                TM.setIsNewTaskCreated(false);
                TM.setIsTaskUpdatedBySomeone(false);
            }
        })();
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

    ///////////////////////
    // Note Related
    ///////////////////////
    const NM = useNoteManagement(myself, accessToken);

    ///////////////////////
    // Inbox Related
    ///////////////////////
    const IM = useInboxManagement();

    ///////////////////////
    // Other Hooks
    ///////////////////////
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
        // Reset note variables when the team changes
        NM.initializeNoteStates();

        TM.setOngoingTasks([]);
        TM.setClosedTasks([]);
        TM.setDeletedTasks([]);
        TM.setIsTaskPreviewVisible(false);

        NM.setIsTaskNoteVisible(false);

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

    // Initialization Hooks
    useEffect(() => {
        IM.funcSetInboxItems();
        CM.funcSetAllChats();
        CM.funcSetFlaggedMessages();
        CM.funcSetActivityMessages();
    }, []);

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

    // Chat Related Hooks
    useEffect(() => {
        setTimeout(() => {
            CM.funcSetAllChats();
            if (CM.currentMainChat) {
                if (CM.currentMainChat.chatType === 1 && CM.currentMainChat.chatId !== -1) {
                    localStorage.setItem("lastChatType", "1");
                    localStorage.setItem(
                        "lastDMChatId",
                        CM.currentMainChat.chatId.toString() || ""
                    );
                }
                if (CM.currentMainChat.chatType === 2 && CM.currentMainChat.chatId !== -1) {
                    localStorage.setItem("lastChatType", "2");
                    localStorage.setItem(
                        "lastGMChatId",
                        CM.currentMainChat.chatId.toString() || ""
                    );
                }
                if (CM.currentMainChat.chatType === 3 && CM.currentMainChat.chatId !== -1) {
                    localStorage.setItem("lastChatType", "3");
                    localStorage.setItem(
                        "lastPMChatId",
                        CM.currentMainChat.chatId.toString() || ""
                    );
                }
            }
        }, 500); // wait 500ms
    }, [CM.currentMainChat, CM.currentSubChat]);

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
            setIsLoading={UIM.setIsLoading}
            setCurrentMainChat={CM.setCurrentMainChat}
        />
    ) : (
        <div className="main-container">
            <CssVarsProvider disableTransitionOnChange>
                <CssBaseline />

                {UIM.openingService === 0 ? (
                    <InboxHome
                        currentTeam={TEM.currentTeam}
                        setCurrentTeam={TEM.setCurrentTeam}
                        teamMemberProfiles={TEM.teamMemberProfiles}
                        myself={myself}
                        socket={socketInstance}
                        setMyself={setMyself}
                        openingService={UIM.openingService}
                        setOpeningService={UIM.setOpeningService}
                        setCurrentMainChat={CM.setCurrentMainChat}
                        inboxItems={IM.inboxItems}
                        unReadInboxItemCount={IM.unReadInboxItemCount}
                        unReadChatAndActivityCounts={CM.unReadChatAndActivityCounts}
                    />
                ) : null}

                {UIM.openingService === 1 ? (
                    <ChatHome
                        TEM={TEM}
                        socket={socketInstance}
                        myself={myself}
                        setMyself={setMyself}
                        openingService={UIM.openingService}
                        setOpeningService={UIM.setOpeningService}
                        unReadInboxItemCount={IM.unReadInboxItemCount}
                        CM={CM}
                        NM={NM}
                        PM={PM}
                        TM={TM}
                    />
                ) : null}

                {UIM.openingService === 2 ? (
                    <TaskHome
                        TEM={TEM}
                        socket={socketInstance}
                        myself={myself}
                        setMyself={setMyself}
                        setCurrentMainChat={CM.setCurrentMainChat}
                        openingService={UIM.openingService}
                        setOpeningService={UIM.setOpeningService}
                        unReadInboxItemCount={IM.unReadInboxItemCount}
                        unReadChatAndActivityCounts={CM.unReadChatAndActivityCounts}
                        allChats={CM.allChats}
                        setAllChats={CM.setAllChats}
                        funcSetAllChats={CM.funcSetAllChats}
                        moveToSpecificChat={CM.moveToSpecificChat}
                        NM={NM}
                        PM={PM}
                        TM={TM}
                    />
                ) : null}

                {UIM.openingService === 3 ? (
                    <NoteHome
                        socket={socketInstance}
                        TEM={TEM}
                        myself={myself}
                        setMyself={setMyself}
                        openingService={UIM.openingService}
                        setOpeningService={UIM.setOpeningService}
                        unReadInboxItemCount={IM.unReadInboxItemCount}
                        NM={NM}
                        CM={CM}
                        PM={PM}
                        TM={TM}
                    />
                ) : null}
            </CssVarsProvider>
        </div>
    );
};
