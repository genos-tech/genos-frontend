import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { CssVarsProvider } from "@mui/joy/styles";
import CssBaseline from "@mui/joy/CssBaseline";

import "./App.css";
import { ChatHome } from "./features/chat/chatHome";
import { TaskHome } from "./features/tasks/taskHome";
import { NoteHome } from "./features/notes/NoteHome";
import { InitialLoad } from "./components/utils/InitialLoad";
import { FindTeamResponse, Team, UserProps } from "./types/admin";

import { useAuth } from "./context/AuthContext";
import { wsHook } from "./hooks/common/wsHook";
import { popTeamMembers } from "./features/chat/services/popTeamMembers";
import { initDB } from "./db/schema";
import { InboxHome } from "./features/inbox/inboxHome";
import { getLocalCurrentDate, getLocalCurrentTimestamp } from "./utils/dateUtils";
import { findTeam } from "./features/admin/services/findTeam";
import PopTeamUsersWorker from "./workers/popTeamUsersWorker.ts?worker";
import {
    TaskMetaProps,
    TaskMetaTreeNode,
    TaskProps,
    TaskTableProps,
    TaskTypesProps,
} from "./types/tasks";
import { popSpecificProjectTasks } from "./features/chat/services/popSpecificProjectTasks";
import { loadSpecificTask } from "./features/tasks/services/loadSpecificTask";
import { buildTaskTree } from "./features/tasks/utils/buildTaskTree";
import { initCurrentTaskChain } from "./hooks/tasks/sidebar";
import { loadTaskMeta } from "./features/notes/services/loadTaskMeta";

import { useMyself } from "./hooks/common/useAuth";
import { useChatManagement } from "./hooks/chats/useChatManagement";
import { useInboxManagement } from "./hooks/inbox/useInboxManagement";
import { useProject } from "./hooks/common/useProject";

// Import task and note management hooks
// import { useTaskManagement } from "./hooks/useTaskManagement";
import { useNoteManagement } from "./hooks/notes/useNoteManagement";

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
    const [currentTeamId, setCurrentTeamId] = useState("");
    const [teamMembers, setTeamMembers] = useState<UserProps[]>([]);
    const [teamMemberProfiles, setTeamMemberProfiles] = useState<Record<string, UserProps>>({});

    const funcSetTeamMembers = async () => {
        const teamMembers: UserProps[] = await popTeamMembers(myself);
        if (teamMembers) {
            setTeamMembers(teamMembers);
        }
    };

    const [currentTeam, setCurrentTeam] = useState<Team>({
        teamId: myself.teamId,
        teamName: myself.teamName,
        teamEmail: "",
        teamOwnerId: "",
        teamImgPath: localStorage.getItem("teamImgPath") || undefined,
    });

    const initCurrentTeam = async () => {
        const findTeamRes: FindTeamResponse = await findTeam(accessToken, myself.teamId);
        if (findTeamRes && findTeamRes.exist === true) {
            setCurrentTeam(findTeamRes.teamDetails);
        }
    };

    ///////////////////////
    // Project Related
    ///////////////////////
    // Project management
    const {
        teamProjects,
        setTeamProjects,
        openCreateProject,
        setOpenCreateProject,
        isNewProjectCreated,
        setIsNewProjectCreated,
        currentProject,
        setCurrentProject,
        loadProjectsAndTasks,
    } = useProject(myself, accessToken, currentTeamId);

    ///////////////////////
    // Chat Related
    ///////////////////////
    // Chat management
    const CM = useChatManagement(myself, accessToken);

    ///////////////////////
    // Task Related
    ///////////////////////
    const [isTaskPreviewVisible, setIsTaskPreviewVisible] = useState(false);
    const [isCreatingTask, setIsCreatingTask] = useState<{
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    }>({
        flag: false,
        parentTaskId: null,
        rootTaskId: null,
    });
    const [openCreateTag, setOpenCreateTag] = useState(false);
    const [isNewTaskCreated, setIsNewTaskCreated] = useState(false);
    const [isNewTagCreated, setIsNewTagCreated] = useState(false);
    const [isTaskUpdated, setIsTaskUpdated] = useState(false);
    const [isTaskUpdatedBySomeone, setIsTaskUpdatedBySomeone] = useState(false);
    const [currentPreviewTaskId, setCurrentPreviewTaskId] = useState<number>(-1);
    const [currentPreviewTask, setCurrentPreviewTask] = useState<TaskProps>();
    const [isTaskCommentUpdated, setIsTaskCommentUpdated] = useState({
        isUpdate: false,
        scrollToBottom: true,
    });
    const [initialEmptyTaskId, setInitialEmptyTaskId] = useState<number>();

    // Task sidebar related
    const [taskMeta, setTaskMeta] = useState<TaskMetaProps[]>([]);
    const [currentTaskChain, setCurrentTaskChain] = useState<TaskMetaTreeNode[]>();
    const getTaskMeta = async () => {
        const loadedTaskMeta: TaskMetaProps[] = await loadTaskMeta(myself, accessToken);
        if (loadedTaskMeta.length > 0) {
            setTaskMeta(loadedTaskMeta);
        }
    };
    const [taskMetaTree, setTaskMetaTree] = useState<TaskMetaTreeNode[]>(buildTaskTree(taskMeta));
    useEffect(() => {
        setTaskMetaTree(buildTaskTree(taskMeta));
    }, [taskMeta]);
    initCurrentTaskChain({
        taskMeta: taskMeta,
        currentTaskChain: currentTaskChain,
        setCurrentTaskChain: setCurrentTaskChain,
    });

    // Task table related
    const taskTypes: TaskTypesProps = {
        ongoing: { id: 1, statuses: ["Open", "WIP", "Pending"], name: "Ongoing" },
        closed: { id: 2, statuses: ["Closed"], name: "Closed" },
        deleted: { id: 3, statuses: ["Deleted"], name: "Deleted" },
    };
    const [ongoingTasks, setOngoingTasks] = useState<TaskTableProps[]>([]);
    const [closedTasks, setClosedTasks] = useState<TaskTableProps[]>([]);
    const [deletedTasks, setDeletedTasks] = useState<TaskTableProps[]>([]);
    const [expiredTasks, setExpiredTasks] = useState<TaskTableProps[]>([]);
    let tsLastLoadProjectTasks: number | undefined = undefined;
    const getExpiredTasks = async (ongoingTasks: TaskTableProps[]) => {
        return ongoingTasks.filter((task) => {
            if (task.daysLeft && task.daysLeft < 0 && task.parentTaskId === null) {
                return true;
            }
            return false;
        });
    };
    const fetchProjectTasks = async (projectId: number) => {
        tsLastLoadProjectTasks = Date.now();
        const _onGoingTasks: TaskTableProps[] = await popSpecificProjectTasks(
            projectId,
            taskTypes.ongoing.statuses
        );
        const _closedTasks: TaskTableProps[] = await popSpecificProjectTasks(
            projectId,
            taskTypes.closed.statuses
        );
        const _deletedTasks: TaskTableProps[] = await popSpecificProjectTasks(
            projectId,
            taskTypes.deleted.statuses
        );
        const _expiredTasks: TaskTableProps[] = await getExpiredTasks(_onGoingTasks);
        setOngoingTasks(_onGoingTasks);
        setClosedTasks(_closedTasks);
        setDeletedTasks(_deletedTasks);
        setExpiredTasks(_expiredTasks);
    };

    useEffect(() => {
        const intervalMs: number = 1000;
        const now = Date.now();
        if (
            tsLastLoadProjectTasks === undefined ||
            (tsLastLoadProjectTasks && now - tsLastLoadProjectTasks >= intervalMs)
        ) {
            setTimeout(() => {
                (async () => {
                    if (currentProject && currentProject.projectId) {
                        await fetchProjectTasks(currentProject.projectId);
                        localStorage.setItem("lastProjectId", currentProject.projectId.toString());
                    }
                })();
            }, 1000); // wait 500ms
        }
    }, [currentProject]);

    useEffect(() => {
        (async () => {
            if (currentProject && isNewProjectCreated === true) {
                fetchProjectTasks(currentProject.projectId);
                localStorage.setItem("lastProjectId", currentProject.projectId.toString());
            }
        })();
    }, [isNewProjectCreated]);

    useEffect(() => {
        if (currentProject && currentPreviewTaskId !== -1) {
            (async () => {
                const loadedTask: TaskProps[] = await loadSpecificTask(
                    myself,
                    currentProject.projectId,
                    currentPreviewTaskId,
                    accessToken
                );

                // No need to update the current preview task when a new tag is created.
                if (isNewTagCreated === false && loadedTask.length > 0) {
                    setCurrentPreviewTask(loadedTask[0]);
                }

                setIsTaskPreviewVisible(true);

                // Add a new ongoing task
                if (isNewTaskCreated === true || isTaskUpdatedBySomeone === true) {
                    setOngoingTasks((prev) => [
                        ...prev,
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
                setIsNewTaskCreated(false);
                setIsTaskUpdatedBySomeone(false);
            })();
        }
    }, [currentPreviewTaskId, isNewTaskCreated, isTaskUpdatedBySomeone]);

    useEffect(() => {
        // Update an ongoing task
        if (isTaskUpdated && currentPreviewTask) {
            setOngoingTasks((prevTasks) =>
                prevTasks.map((task) =>
                    task.id === String(currentPreviewTask.id)
                        ? {
                              id: String(currentPreviewTask.id) || null,
                              title: currentPreviewTask.title || null,
                              priority: currentPreviewTask.priority.priority || null,
                              effortLevel: currentPreviewTask.effortLevel.level || null,
                              createdDate: currentPreviewTask.createdDate || getLocalCurrentDate(),
                              updatedAt:
                                  currentPreviewTask.updatedAt || getLocalCurrentTimestamp(),
                              dueDate: currentPreviewTask.dueDate || null,
                              daysLeft: currentPreviewTask.daysLeft || null,
                              status: currentPreviewTask.status.status || null,
                              assigneeId: currentPreviewTask.assignee.userId || null,
                              assigneeEmail: currentPreviewTask.assignee.userEmail || null,
                              assigneeName: currentPreviewTask.assignee.userName || null,
                              assigneeImgPath: currentPreviewTask.assignee.avatarImgPath || null,
                              parentTaskId: currentPreviewTask.parentTaskId
                                  ? String(currentPreviewTask.parentTaskId)
                                  : null,
                              rootTaskId: currentPreviewTask.rootTaskId,
                              threadId: currentPreviewTask.threadId || null,
                              tags: currentPreviewTask.tags || [],
                              concatTags: currentPreviewTask.concatTags || "//",
                              teamId: myself.teamId || null,
                              projectId: currentPreviewTask.project?.projectId || null,
                          }
                        : task
                )
            );
            getTaskMeta();
            setIsTaskUpdated(false);
        }
    }, [isTaskUpdated, currentPreviewTask]);

    useEffect(() => {
        if (isNewTaskCreated === true) {
            setTimeout(() => {
                (async () => {
                    await loadProjectsAndTasks(
                        localStorage.getItem("lastProjectId")
                            ? Number(localStorage.getItem("lastProjectId"))
                            : -1
                    );
                })();
            }, 500);
        }
    }, [isNewTaskCreated]);

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
        currentProject: currentProject,
        currentPreviewTaskId: currentPreviewTaskId,
        setIsTaskUpdatedBySomeone: setIsTaskUpdatedBySomeone,
        setIsTaskCommentUpdated: setIsTaskCommentUpdated,
        CM: CM,
    });

    useEffect(() => {
        // Reset note variables when the team changes
        NM.initializeNoteStates();

        setOngoingTasks([]);
        setClosedTasks([]);
        setDeletedTasks([]);
        setIsTaskPreviewVisible(false);
        CM.setIsThreadTaskVisible(false);

        CM.setIsChatNoteVisibleInChat(false);
        NM.setIsTaskNoteVisible(false);
        CM.setIsSubChatVisible(false);
        CM.setIsThreadVisible(false);
    }, [currentTeamId]);

    useEffect(() => {
        if (openingService === 0) {
            // Init all notes
            NM.setCurrentMyNote(null);
            NM.setCurrentTaskNote(null);
            NM.setCurrentChatNote(null);
        } else if (openingService === 1) {
            // Initialize the task visibility.
            setIsTaskPreviewVisible(false);

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
            funcSetTeamMembers();

            // Load task metadata
            getTaskMeta();

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
            if (_socket && (socketInstance === null || myself.teamId !== currentTeamId)) {
                setSocketInstance(_socket);
                console.log("[WS] WS connection established");
            }
        } else {
            console.warn("[WS] No valid access token found");
        }
    }, [myself, accessToken]);

    useEffect(() => {
        initCurrentTeam();
        if (myself.teamId !== currentTeamId) {
            setCurrentTeamId(myself.teamId);
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
                    setTeamMemberProfiles(data);
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
                        setTeamMemberProfiles(data);
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
            setCurrentPreviewTaskId(CM.currentThreadChat.taskId);
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
                        currentTeam={currentTeam}
                        setCurrentTeam={setCurrentTeam}
                        teamMemberProfiles={teamMemberProfiles}
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
                        currentTeam={currentTeam}
                        setCurrentTeam={setCurrentTeam}
                        teamMemberProfiles={teamMemberProfiles}
                        socket={socketInstance}
                        myself={myself}
                        setMyself={setMyself}
                        teamMembers={teamMembers}
                        setTeamMembers={setTeamMembers}
                        currentChatPaneType={CM.currentChatPaneType}
                        setCurrentChatPaneType={CM.setCurrentChatPaneType}
                        activityMessages={CM.activityMessages}
                        setActivityMessages={CM.setActivityMessages}
                        currentMainChat={CM.currentMainChat}
                        setCurrentMainChat={CM.setCurrentMainChat}
                        currentSubChat={CM.currentSubChat}
                        setCurrentSubChat={CM.setCurrentSubChat}
                        currentThreadChat={CM.currentThreadChat}
                        setCurrentThreadChat={CM.setCurrentThreadChat}
                        openingService={openingService}
                        setOpeningService={setOpeningService}
                        allChats={CM.allChats}
                        setAllChats={CM.setAllChats}
                        funcSetAllChats={CM.funcSetAllChats}
                        isCommentUpdated={isTaskCommentUpdated}
                        setIsCommentUpdated={setIsTaskCommentUpdated}
                        unReadInboxItemCount={IM.unReadInboxItemCount}
                        unReadChatCounts={CM.unReadChatCounts}
                        unReadActivityMessageCounts={CM.unReadActivityMessageCounts}
                        unReadChatAndActivityCounts={CM.unReadChatAndActivityCounts}
                        isTaskPreviewVisible={CM.isThreadTaskVisible}
                        setIsTaskPreviewVisible={CM.setIsThreadTaskVisible}
                        isCreatingTask={isCreatingTask}
                        setIsCreatingTask={setIsCreatingTask}
                        currentProject={currentProject}
                        setCurrentProject={setCurrentProject}
                        currentPreviewTaskId={currentPreviewTaskId}
                        setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                        currentPreviewTask={currentPreviewTask}
                        setCurrentPreviewTask={setCurrentPreviewTask}
                        setOpenCreateProject={setOpenCreateProject}
                        setOpenCreateTag={setOpenCreateTag}
                        isNewTagCreated={isNewTagCreated}
                        setIsNewTagCreated={setIsNewTagCreated}
                        openCreateProject={openCreateProject}
                        openCreateTag={openCreateTag}
                        isMainChatVisible={CM.isMainChatVisible}
                        setIsMainChatVisible={CM.setIsMainChatVisible}
                        isSubChatVisible={CM.isSubChatVisible}
                        setIsSubChatVisible={CM.setIsSubChatVisible}
                        isThreadVisible={CM.isThreadVisible}
                        setIsThreadVisible={CM.setIsThreadVisible}
                        teamProjects={teamProjects}
                        setTeamProjects={setTeamProjects}
                        initialEmptyTaskId={initialEmptyTaskId}
                        setInitialEmptyTaskId={setInitialEmptyTaskId}
                        moveToSpecificChat={CM.moveToSpecificChat}
                        flaggedMessages={CM.flaggedMessages}
                        setFlaggedMessages={CM.setFlaggedMessages}
                        NM={NM}
                        loadProjectsAndTasks={loadProjectsAndTasks}
                        isChatNoteVisibleInChat={CM.isChatNoteVisibleInChat}
                        setIsChatNoteVisibleInChat={CM.setIsChatNoteVisibleInChat}
                    />
                ) : null}

                {openingService === 2 ? (
                    <TaskHome
                        teamMembers={teamMembers}
                        setTeamMembers={setTeamMembers}
                        currentTeam={currentTeam}
                        setCurrentTeam={setCurrentTeam}
                        teamMemberProfiles={teamMemberProfiles}
                        socket={socketInstance}
                        myself={myself}
                        setMyself={setMyself}
                        setCurrentMainChat={CM.setCurrentMainChat}
                        openingService={openingService}
                        setOpeningService={setOpeningService}
                        isCommentUpdated={isTaskCommentUpdated}
                        setIsCommentUpdated={setIsTaskCommentUpdated}
                        unReadInboxItemCount={IM.unReadInboxItemCount}
                        unReadChatAndActivityCounts={CM.unReadChatAndActivityCounts}
                        isTaskPreviewVisible={isTaskPreviewVisible}
                        setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                        isCreatingTask={isCreatingTask}
                        setIsCreatingTask={setIsCreatingTask}
                        teamProjects={teamProjects}
                        setTeamProjects={setTeamProjects}
                        loadProjectsAndTasks={loadProjectsAndTasks}
                        currentProject={currentProject}
                        setCurrentProject={setCurrentProject}
                        setIsNewTaskCreated={setIsNewTaskCreated}
                        isTaskUpdated={isTaskUpdated}
                        setIsTaskUpdated={setIsTaskUpdated}
                        ongoingTasks={ongoingTasks}
                        expiredTasks={expiredTasks}
                        setOngoingTasks={setOngoingTasks}
                        closedTasks={closedTasks}
                        setClosedTasks={setClosedTasks}
                        deletedTasks={deletedTasks}
                        setDeletedTasks={setDeletedTasks}
                        setIsNewProjectCreated={setIsNewProjectCreated}
                        currentPreviewTaskId={currentPreviewTaskId}
                        setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                        currentPreviewTask={currentPreviewTask}
                        setCurrentPreviewTask={setCurrentPreviewTask}
                        openCreateProject={openCreateProject}
                        setOpenCreateProject={setOpenCreateProject}
                        openCreateTag={openCreateTag}
                        setOpenCreateTag={setOpenCreateTag}
                        isNewTagCreated={isNewTagCreated}
                        setIsNewTagCreated={setIsNewTagCreated}
                        taskMetaTree={taskMetaTree}
                        currentTaskChain={currentTaskChain}
                        initialEmptyTaskId={initialEmptyTaskId}
                        setInitialEmptyTaskId={setInitialEmptyTaskId}
                        allChats={CM.allChats}
                        setAllChats={CM.setAllChats}
                        funcSetAllChats={CM.funcSetAllChats}
                        moveToSpecificChat={CM.moveToSpecificChat}
                        NM={NM}
                    />
                ) : null}

                {openingService === 3 ? (
                    <NoteHome
                        currentTeam={currentTeam}
                        setCurrentTeam={setCurrentTeam}
                        teamMemberProfiles={teamMemberProfiles}
                        socket={socketInstance}
                        teamMembers={teamMembers}
                        setTeamMembers={setTeamMembers}
                        myself={myself}
                        setMyself={setMyself}
                        openingService={openingService}
                        setOpeningService={setOpeningService}
                        setCurrentMainChat={CM.setCurrentMainChat}
                        currentProject={currentProject}
                        allChats={CM.allChats}
                        unReadInboxItemCount={IM.unReadInboxItemCount}
                        unReadChatAndActivityCounts={CM.unReadChatAndActivityCounts}
                        isCreatingTask={isCreatingTask}
                        setIsMainChatVisible={CM.setIsMainChatVisible}
                        setIsChatNoteVisibleInChat={CM.setIsChatNoteVisibleInChat}
                        setCurrentProject={setCurrentProject}
                        currentPreviewTask={currentPreviewTask}
                        setIsThreadVisible={CM.setIsThreadVisible}
                        isThreadVisible={CM.isThreadVisible}
                        setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                        setIsCreatingTask={setIsCreatingTask}
                        setCurrentPreviewTask={setCurrentPreviewTask}
                        setOpenCreateProject={setOpenCreateProject}
                        setOpenCreateTag={setOpenCreateTag}
                        currentPreviewTaskId={currentPreviewTaskId}
                        setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                        isCommentUpdated={isTaskCommentUpdated}
                        setIsCommentUpdated={setIsTaskCommentUpdated}
                        teamProjects={teamProjects}
                        setTeamProjects={setTeamProjects}
                        moveToSpecificChat={CM.moveToSpecificChat}
                        funcSetAllChats={CM.funcSetAllChats}
                        NM={NM}
                    />
                ) : null}
            </CssVarsProvider>
        </div>
    );
};
