import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { CssVarsProvider } from "@mui/joy/styles";
import CssBaseline from "@mui/joy/CssBaseline";

import "./App.css";
import { ChatHome } from "./features/chat/chatHome";
import { TaskHome } from "./features/tasks/taskHome";
import { NoteHome } from "./features/notes/NoteHome";
import { InitialLoad } from "./components/utils/InitialLoad";

import { useAuth } from "./context/AuthContext";
import { wsHook } from "./hooks/common/wsHook";
import { initDB } from "./db/schema";
import { InboxHome } from "./features/inbox/inboxHome";
import { getLocalCurrentTimestamp } from "./utils/dateUtils";
import PopTeamUsersWorker from "./workers/popTeamUsersWorker.ts?worker";
import { TaskProps } from "./types/tasks";
import { loadSpecificTask } from "./features/tasks/services/loadSpecificTask";

import { useTeamManagement } from "./hooks/common/useTeamManagement";
import { useMyself } from "./hooks/common/useAuth";
import { useChatManagement } from "./hooks/chats/useChatManagement";
import { useInboxManagement } from "./hooks/inbox/useInboxManagement";
import { useProjectManagement } from "./hooks/common/useProjectManagement";

// Import task and note management hooks
// import { useTaskManagement } from "./hooks/useTaskManagement";
import { useNoteManagement } from "./hooks/notes/useNoteManagement";
import { useTaskManagement } from "./hooks/tasks/useTaskManagement";

const ws_url = import.meta.env.VITE_WS_BASE_URL;
const socket = (accessToken: string | null): Socket => {
    return io(ws_url, {
        reconnection: true, // Enable reconnection
        reconnectionAttempts: 100, // Try to reconnect 5 times
        reconnectionDelay: 5000, // Wait 1 second before reconnecting
        reconnectionDelayMax: 60000, // Max delay between reconnection attempts
        timeout: 100000, // Timeout for the connection attempt
        withCredentials: true,
        query: {
            teamId: localStorage.getItem("teamId"),
            teamName: localStorage.getItem("teamName"),
            userId: localStorage.getItem("userId"),
            userName: localStorage.getItem("userName"),
            userEmail: localStorage.getItem("userEmail"),
        },
        extraHeaders: {
            Authorization: accessToken || "",
        },
    });
};

export const App = () => {
    // Need to run if you delete IndexedDB database
    initDB();

    ///////////////////////
    // Common
    ///////////////////////
    const { accessToken } = useAuth();
    const { myself, setMyself } = useMyself(accessToken);
    const [isLoading, setIsLoading] = useState(true);
    const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

    // openingService = {0: Inbox, 1: Chat, 2: Tasks, 3: Notes}
    const [openingService, setOpeningService] = useState<number>(
        Number(localStorage.getItem("openingService") || "1")
    );
    useEffect(() => {
        localStorage.setItem("openingService", openingService.toString());
    }, [openingService]);

    // noteType = {0: Home, 1: personal note, 2: task note, 3: chat note, 4: shared note}
    const [currentNoteType, setCurrentNoteType] = useState<number>(
        Number(localStorage.getItem("currentNoteType") || "1")
    );

    const sendHeartBeat = () => {
        if (socketInstance) {
            const isOfflineForced: string = localStorage.getItem("isOfflineForced") || "false";
            const role: string = localStorage.getItem("role") || "";
            const baseCountry: string = localStorage.getItem("baseCountry") || "";
            const customStatus: string = localStorage.getItem("customStatus") || "";
            const avatarImgPath: string = localStorage.getItem("avatarImgPath") || "";

            socketInstance.emit("heartbeat", {
                message: "alive",
                is_online: true,
                user: {
                    ...myself,
                    avatarImgPath: avatarImgPath,
                    isOfflineForced: isOfflineForced,
                    role: role,
                    baseCountry: baseCountry,
                    customStatus: customStatus,
                    tsLastSeen: getLocalCurrentTimestamp(),
                },
            });
        }
    };

    ///////////////////////
    // Team Related
    ///////////////////////
    const TEM = useTeamManagement(myself, accessToken);

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
    // Note management
    const NM = useNoteManagement(myself, accessToken);

    ///////////////////////
    // Inbox Related
    ///////////////////////
    const IM = useInboxManagement();

    ///////////////////////
    // Other Hooks
    ///////////////////////
    // Common Hooks
    wsHook({
        accessToken: accessToken,
        socket: socketInstance,
        myself: myself,
        isLoading: isLoading,
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
            // setCurrentChatNote(null);
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

    // Initialization Hooks
    useEffect(() => {
        IM.funcSetInboxItems();
        CM.funcSetAllChats();
        CM.funcSetFlaggedMessages();
        CM.funcSetActivityMessages();
    }, []);

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

    useEffect(() => {
        if (accessToken) {
            console.log("[WS] Start establishing WS connection");
            const _socket = socket(accessToken);
            if (_socket && (socketInstance === null || myself.teamId !== TEM.currentTeamId)) {
                setSocketInstance(_socket);
                console.log("[WS] WS connection established");
            }
        } else {
            console.warn("[WS] No valid access token found");
        }
    }, [myself, accessToken]);

    useEffect(() => {
        TEM.initCurrentTeam();
        if (myself.teamId !== TEM.currentTeamId) {
            TEM.setCurrentTeamId(myself.teamId);
            setIsLoading(true);
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

    useEffect(() => {
        if (socketInstance) {
            // Pop the initial note after the socket is connected.
            NM.popInitialNote();

            socketInstance.emit("join", {
                joiningCGId: -1, // dm_id or gm_id
                joiningCGName: myself.userName, // dm_name or gm_name
                chatType: 1,
                dmPartnerUserId: myself.userId,
            });

            sendHeartBeat();

            const intervalId = setInterval(() => {
                sendHeartBeat();
            }, 60_000);

            return () => {
                clearInterval(intervalId);
            };
        }
    }, [socketInstance]);

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

    return isLoading || CM.currentMainChat === undefined ? (
        <InitialLoad
            myself={myself}
            setIsLoading={setIsLoading}
            setCurrentMainChat={CM.setCurrentMainChat}
        />
    ) : (
        <div className="main-container">
            <CssVarsProvider disableTransitionOnChange>
                <CssBaseline />

                {openingService === 0 ? (
                    <InboxHome
                        currentTeam={TEM.currentTeam}
                        setCurrentTeam={TEM.setCurrentTeam}
                        teamMemberProfiles={TEM.teamMemberProfiles}
                        myself={myself}
                        socket={socketInstance}
                        setMyself={setMyself}
                        openingService={openingService}
                        setOpeningService={setOpeningService}
                        setCurrentMainChat={CM.setCurrentMainChat}
                        inboxItems={IM.inboxItems}
                        unReadInboxItemCount={IM.unReadInboxItemCount}
                        unReadChatAndActivityCounts={CM.unReadChatAndActivityCounts}
                    />
                ) : null}

                {openingService === 1 ? (
                    <ChatHome
                        TEM={TEM}
                        socket={socketInstance}
                        myself={myself}
                        setMyself={setMyself}
                        openingService={openingService}
                        setOpeningService={setOpeningService}
                        unReadInboxItemCount={IM.unReadInboxItemCount}
                        CM={CM}
                        NM={NM}
                        PM={PM}
                        TM={TM}
                    />
                ) : null}

                {openingService === 2 ? (
                    <TaskHome
                        TEM={TEM}
                        socket={socketInstance}
                        myself={myself}
                        setMyself={setMyself}
                        setCurrentMainChat={CM.setCurrentMainChat}
                        openingService={openingService}
                        setOpeningService={setOpeningService}
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

                {openingService === 3 ? (
                    <NoteHome
                        socket={socketInstance}
                        TEM={TEM}
                        myself={myself}
                        setMyself={setMyself}
                        openingService={openingService}
                        setOpeningService={setOpeningService}
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
