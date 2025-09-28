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
import { ActivityMessageProps, AllChatProps, ChatProps, ThreadProps } from "./types/chat";
import { useAuth } from "./context/AuthContext";
import { wsHook } from "./hooks/wsHook";
import { popInboxItems } from "./features/inbox/services/popInboxItems";
import { popAllChats } from "./features/chat/services/popAllChats";
import { popActivityMessages } from "./features/chat/services/popActivityMessages";
import { popTeamMembers } from "./features/chat/services/popTeamMembers";
import { initDB } from "./db/schema";
import { InboxHome } from "./features/inbox/inboxHome";
import { InboxItemProps } from "./types/common";
import { getCurrentTimestamp } from "./utils/dateUtils";
import { findTeam } from "./features/admin/services/findTeam";
import PopTeamUsersWorker from "./workers/popTeamUsersWorker.ts?worker";
import {
    MyNoteMetaProps,
    TaskNoteMetaProps,
    ChatNoteMetaProps,
    ChatNoteMetaTreeNode,
    ChatNoteProps,
    MyNoteMetaTreeNode,
    MyNoteProps,
    TaskNoteMetaTreeNode,
    TaskNoteProps,
} from "./types/notes";
import { createEmptyMyNote } from "./features/notes/services/createEmptyMyNote";
import { addNote } from "./features/notes/services/addNote";
import { createEmptyChatNote } from "./features/notes/services/createEmptyChatNote";
import { createEmptyTaskNote } from "./features/notes/services/createEmptyTaskNote";
import { loadMyNoteMeta } from "./features/notes/services/loadMyNoteMeta";
import { loadTaskNoteMeta } from "./features/notes/services/loadTaskNoteMeta";
import { loadChatNoteMeta } from "./features/notes/services/loadChatNoteMeta";
import { loadChatNotesByChatId } from "./features/notes/services/loadChatNotesByChatId";
import { updataMyNoteChain, initCurrentMyNoteChain } from "./hooks/notes/myNote";
import { updataTaskNoteChain, initCurrentTaskNoteChain } from "./hooks/notes/taskNote";
import { updataChatNoteChain, initCurrentChatNoteChain } from "./hooks/notes/chatNote";
import {
    updateTabFromChatNoteUpdate,
    updateTabFromMyNoteUpdate,
    updateTabFromTaskNoteUpdate,
} from "./hooks/notes/tab";
import { buildChatNoteTree, buildMyNoteTree, buildTaskNoteTree } from "./utils/note";
import { ProjectProps, TaskProps } from "./types/tasks";
import { loadTeamProjects } from "./features/tasks/services/loadTeamProjects";
import { loadProjectTags } from "./features/tasks/services/loadProjectTags";
import { loadProjectTasks } from "./features/tasks/services/loadProjectTasks";

type SetMyselfProps = {
    myself: UserProps;
    setMyself: (me: UserProps) => void;
};

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

const useMyself = (): SetMyselfProps => {
    const [myself, setMyself] = useState<UserProps>({
        teamId: "",
        teamName: "",
        userId: "",
        userName: "",
        userEmail: "",
        tsLastSeen: "",
        tsJoined: "",
        customStatus: "",
        avatarImgPath: "",
    });

    useEffect(() => {
        const fetchUserData = () => {
            setMyself({
                teamId: localStorage.getItem("teamId") || "",
                teamName: localStorage.getItem("teamName") || "",
                userId: localStorage.getItem("userId") || "",
                userName: localStorage.getItem("userName") || "",
                userEmail: localStorage.getItem("userEmail") || "",
                tsLastSeen: getCurrentTimestamp(),
                tsJoined: localStorage.getItem("tsJoined") || "",
                isOfflineForced: localStorage.getItem("isOfflineForced") || "false",
                role: localStorage.getItem("role") || "",
                baseCountry: localStorage.getItem("baseCountry") || "",
                customStatus: localStorage.getItem("customStatus") || "",
                avatarImgPath: localStorage.getItem("avatarImgPath") || "",
            });
        };

        // Add a small delay to ensure localStorage is updated
        setTimeout(fetchUserData, 50);

        // Listen for storage updates in case another tab updates it
        window.addEventListener("storage", fetchUserData);

        return () => {
            window.removeEventListener("storage", fetchUserData);
        };
    }, []);

    return { myself, setMyself };
};

export const App = () => {
    // Need to run if you delete IndexedDB database
    initDB();

    ///////////////////////
    // Common
    ///////////////////////
    const { accessToken } = useAuth();
    const { myself, setMyself } = useMyself();
    const [isLoading, setIsLoading] = useState(true);
    const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

    // openingService = {0: Inbox, 1: Chat, 2: Tasks, 3: Notes}
    const [openingService, setOpeningService] = useState<number>(
        Number(localStorage.getItem("openingService") || "1")
    );

    // chatType = {1: DM, 2: GM, 3: PM, 4: Pin, 5: Activity}
    const [currentChatPaneType, setCurrentChatPaneType] = useState<number>(
        Number(localStorage.getItem("currentChatPaneType") || "1")
    );

    // noteType = {0: Home, 1: personal note, 2: task note, 3: chat note}
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
                    tsLastSeen: getCurrentTimestamp(),
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
    // Chat Related
    ///////////////////////
    const [isMainChatVisible, setIsMainChatVisible] = useState(true); // Is Main chat pane visible or not
    const [isSubChatVisible, setIsSubChatVisible] = useState(false); // Is Sub chat in the main chat pane visible or not
    const [isThreadVisible, setIsThreadVisible] = useState(false); // Is Thread pane visible or not
    const [currentMainChat, setCurrentMainChat] = useState<ChatProps | undefined>(undefined);
    const [currentSubChat, setCurrentSubChat] = useState<ChatProps>();
    const [currentThreadChat, setCurrentThreadChat] = useState<ThreadProps>();
    const [allChats, setAllChats] = useState<AllChatProps[]>([]);
    const funcSetAllChats = async () => {
        const _allChats: AllChatProps[] = await popAllChats();
        if (_allChats) {
            setAllChats(_allChats);
            setUnReadChatCounts(countUnreadChats(_allChats));
        }
    };
    const [unReadChatCounts, setUnReadChatCounts] = useState<Record<string, number>>({});
    const countUnreadChats = (chats: AllChatProps[]): Record<string, number> => {
        return chats.reduce<Record<string, number>>((acc, chat) => {
            if (chat.latestMessage && chat.lastReadMessageId < chat.latestMessage.messageId) {
                acc[chat.chatType] = (acc[chat.chatType] ?? 0) + 1;
            }
            return acc;
        }, {});
    };

    useEffect(() => {
        setUnReadChatCounts(countUnreadChats(allChats));
    }, [allChats]);

    // Activity variables
    const [activityMessages, setActivityMessages] = useState<ActivityMessageProps[]>([]);
    const funcSetActivityMessages = async () => {
        const activityMessages: ActivityMessageProps[] = await popActivityMessages(myself);
        if (activityMessages) {
            setActivityMessages(activityMessages);
            setUnReadActivityMessageCounts(countUnreadActivityMessages(activityMessages));
        }
    };
    const [unReadActivityMessageCounts, setUnReadActivityMessageCounts] = useState<number>(-1);
    const [unReadChatAndActivityCounts, setUnReadChatAndActivityCounts] = useState<number>(0);
    const countUnreadActivityMessages = (activityMessages: ActivityMessageProps[]): number => {
        return activityMessages.reduce<number>((acc, activity) => {
            if (activity.isRead === false) {
                acc += 1;
            }
            return acc;
        }, 0);
    };
    useEffect(() => {
        // Exclude the first thread message cause it's actually not a thread message.
        const tmpActivityMessages: ActivityMessageProps[] = activityMessages.filter(
            (item) => !(item.isThread === true && item.messageId === 1)
        );
        setUnReadActivityMessageCounts(countUnreadActivityMessages(tmpActivityMessages));
    }, [activityMessages]);
    useEffect(() => {
        if (unReadChatCounts) {
            // 1: DM, 2: GM, 3: PM
            setUnReadChatAndActivityCounts(
                (unReadChatCounts[1] || 0 + unReadChatCounts[2] || 0 + unReadChatCounts[3] || 0) +
                    unReadActivityMessageCounts
            );
        }
    }, [unReadChatCounts, unReadActivityMessageCounts]);

    ///////////////////////
    // Project Related
    ///////////////////////
    const [teamProjects, setTeamProjects] = useState<ProjectProps[]>([]);
    const [openCreateProject, setOpenCreateProject] = useState(false);
    const [currentProject, setCurrentProject] = useState<ProjectProps | null>(null);
    const loadProjects = async (targetProjectId: number) => {
        // Load the latest project as initial process
        const loadedTeamProjects: ProjectProps[] = await loadTeamProjects(myself, accessToken);

        // Set the current project to one of the joining project.
        // TODO: should set "last-opened-project" using cache(localstorage)
        if (loadedTeamProjects.length > 0) {
            setTeamProjects([...loadedTeamProjects]);

            for (let i = 0; i < loadedTeamProjects.length; i++) {
                if (targetProjectId !== -1 && currentProject) {
                    if (
                        loadedTeamProjects[i].projectId === targetProjectId ||
                        myself.teamId !== currentTeamId
                    ) {
                        await loadProjectTasks(
                            myself,
                            loadedTeamProjects[i].projectId,
                            accessToken
                        );
                        break;
                    }
                } else {
                    // If targetProjectId is not -1, set the target project as the current project
                    if (targetProjectId !== -1) {
                        if (loadedTeamProjects[i].projectId === targetProjectId) {
                            setCurrentProject({
                                projectId: loadedTeamProjects[i].projectId,
                                projectName: loadedTeamProjects[i].projectName,
                                projectTags: loadedTeamProjects[i].projectTags,
                                isPrivate: loadedTeamProjects[i].isPrivate,
                                systemUserId: loadedTeamProjects[i].systemUserId,
                            });
                            await loadProjectTasks(
                                myself,
                                loadedTeamProjects[i].projectId,
                                accessToken
                            );
                            break;
                        }
                    } else if (loadedTeamProjects[i].isJoined === true) {
                        setCurrentProject({
                            projectId: loadedTeamProjects[i].projectId,
                            projectName: loadedTeamProjects[i].projectName,
                            projectTags: loadedTeamProjects[i].projectTags,
                            isPrivate: loadedTeamProjects[i].isPrivate,
                            systemUserId: loadedTeamProjects[i].systemUserId,
                        });
                        await loadProjectTasks(
                            myself,
                            loadedTeamProjects[i].projectId,
                            accessToken
                        );
                        break;
                    }

                    // If not meeting any condition, set the last project as the current project
                    if (i === loadedTeamProjects.length - 1) {
                        setCurrentProject({
                            projectId: loadedTeamProjects[i].projectId,
                            projectName: loadedTeamProjects[i].projectName,
                            projectTags: loadedTeamProjects[i].projectTags,
                            isPrivate: loadedTeamProjects[i].isPrivate,
                            systemUserId: loadedTeamProjects[i].systemUserId,
                        });
                        await loadProjectTasks(
                            myself,
                            loadedTeamProjects[i].projectId,
                            accessToken
                        );
                        break;
                    }
                }
            }
        } else {
            setCurrentProject(null);
        }
    };

    useEffect(() => {
        // If isPrivate is undefined, set the current project to the project
        //  with the same project id in the team projects
        // console.log("currentProject", currentProject);
        if (currentProject && currentProject.isPrivate === undefined) {
            const targetProject: ProjectProps | undefined = teamProjects.find(
                (project) => project.projectId === currentProject.projectId
            );
            if (targetProject) {
                setCurrentProject(targetProject);
            }
        }
    }, [currentProject]);

    ///////////////////////
    // Task Related
    ///////////////////////
    const [isTaskPreviewVisible, setIsTaskPreviewVisible] = useState(false); // Is task preview visible or not
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
    const [isNewTagCreated, setIsNewTagCreated] = useState(false);
    const [currentPreviewTaskId, setCurrentPreviewTaskId] = useState<number>(-1);
    const [currentPreviewTask, setCurrentPreviewTask] = useState<TaskProps>();
    const [isTaskCommentUpdated, setIsTaskCommentUpdated] = useState({
        isUpdate: false,
        scrollToBottom: true,
    });

    ///////////////////////
    // Note Related
    ///////////////////////
    // Common
    const [selectedTabIndex, setSelectedTabIndex] = useState(0);
    const [tabItems, setTabItems] = useState<any[]>([]);
    const [allNoteIdChains, setAllNoteIdChains] = useState<Record<string, number[]>>({});
    const [isChatNoteVisible, setIsChatNoteVisible] = useState(false);
    const [isTaskNoteVisible, setIsTaskNoteVisible] = useState(false);

    // My Note Related
    const [currentMyNote, setCurrentMyNote] = useState<MyNoteProps | null>(null);
    const [currentMyNoteTitle, setCurrentMyNoteTitle] = useState<string>("");
    const [myNoteMeta, setMyNoteMeta] = useState<MyNoteMetaProps[]>([]);
    const [currentMyNoteChain, setCurrentMyNoteChain] = useState<MyNoteMetaTreeNode[]>();
    const [newlyCreatedMyNotes, setNewlyCreatedMyNotes] = useState<MyNoteProps[]>([]);
    const handleCreateNewMyNote = async (parentNoteId: number | null) => {
        const title = `${parentNoteId ? "Child" : "New"} Note (${newlyCreatedMyNotes.length + 1})`;
        const _newNote = await createEmptyMyNote(myself, parentNoteId, title, accessToken);
        const newNote: MyNoteProps = { noteType: 1, ..._newNote };
        setNewlyCreatedMyNotes([...newlyCreatedMyNotes, newNote]);
        setCurrentMyNote(newNote);
        setCurrentMyNoteTitle(title);
        addNote(1, newNote);
        setMyNoteMeta([
            {
                noteType: newNote.noteType,
                noteId: newNote.noteId,
                parentNoteId: newNote.parentNoteId,
                title: newNote.title,
                tsUpdated: newNote.tsUpdated,
            },
            ...myNoteMeta,
        ]);
    };
    const getMyNoteMeta = async () => {
        const loadedNotes: MyNoteMetaProps[] = await loadMyNoteMeta(myself, accessToken);
        if (loadedNotes.length > 0) {
            setMyNoteMeta(loadedNotes);
        }
    };
    const [myNoteMetaTree, setMyNoteMetaTree] = useState<MyNoteMetaTreeNode[]>(
        buildMyNoteTree(myNoteMeta)
    );
    useEffect(() => {
        setMyNoteMetaTree(buildMyNoteTree(myNoteMeta));
    }, [myNoteMeta]);
    initCurrentMyNoteChain({
        myNoteMeta: myNoteMeta,
        currentMyNoteChain: currentMyNoteChain,
        setCurrentMyNoteChain: setCurrentMyNoteChain,
    });
    updateTabFromMyNoteUpdate({
        currentMyNote: currentMyNote,
        setSelectedTabIndex: setSelectedTabIndex,
        tabItems: tabItems,
        setTabItems: setTabItems,
    });
    updataMyNoteChain({
        currentMyNote: currentMyNote,
        myNoteMetaTree: myNoteMetaTree,
        currentMyNoteChain: currentMyNoteChain,
        setCurrentMyNoteChain: setCurrentMyNoteChain,
        allNoteIdChains: allNoteIdChains,
        setAllNoteIdChains: setAllNoteIdChains,
        tabItems: tabItems,
        selectedTabIndex: selectedTabIndex,
    });

    // Task Note Related
    const [currentTaskNote, setCurrentTaskNote] = useState<TaskNoteProps | null>(null);
    const [currentTaskNoteTitle, setCurrentTaskNoteTitle] = useState<string>("");
    const [taskNoteMeta, setTaskNoteMeta] = useState<TaskNoteMetaProps[]>([]);
    const [currentTaskNoteChain, setCurrentTaskNoteChain] = useState<TaskNoteMetaTreeNode[]>();
    const [newlyCreatedTaskNotes, setNewlyCreatedTaskNotes] = useState<TaskNoteProps[]>([]);
    const handleCreateNewTaskNote = async (
        parentNoteId: number | null,
        projectId: number,
        taskId: number
    ) => {
        const title = `${parentNoteId ? "Child" : "New"} Note (${
            newlyCreatedTaskNotes.length + 1
        })`;
        const _newNote = await createEmptyTaskNote(
            myself,
            parentNoteId,
            projectId,
            taskId,
            title,
            accessToken
        );
        const newNote: TaskNoteProps = { noteType: 2, ..._newNote };
        setNewlyCreatedTaskNotes([...newlyCreatedTaskNotes, newNote]);
        setCurrentTaskNote(newNote);
        setCurrentTaskNoteTitle(title);
        addNote(2, newNote);
        setTaskNoteMeta([
            {
                noteType: newNote.noteType,
                noteId: newNote.noteId,
                parentNoteId: newNote.parentNoteId,
                projectId: newNote.projectId,
                taskId: newNote.taskId,
                title: newNote.title,
                tsUpdated: newNote.tsUpdated,
            },
            ...taskNoteMeta,
        ]);
    };
    const getTaskNoteMeta = async () => {
        const loadedNotes: TaskNoteMetaProps[] = await loadTaskNoteMeta(myself, accessToken);
        if (loadedNotes.length > 0) {
            setTaskNoteMeta(loadedNotes);
        }
    };
    const [taskNoteMetaTree, setTaskNoteMetaTree] = useState<TaskNoteMetaTreeNode[]>(
        buildTaskNoteTree(taskNoteMeta)
    );
    useEffect(() => {
        setTaskNoteMetaTree(buildTaskNoteTree(taskNoteMeta));
    }, [taskNoteMeta]);
    initCurrentTaskNoteChain({
        taskNoteMeta: taskNoteMeta,
        currentTaskNoteChain: currentTaskNoteChain,
        setCurrentTaskNoteChain: setCurrentTaskNoteChain,
    });
    updateTabFromTaskNoteUpdate({
        currentTaskNote: currentTaskNote,
        setSelectedTabIndex: setSelectedTabIndex,
        tabItems: tabItems,
        setTabItems: setTabItems,
    });
    updataTaskNoteChain({
        currentTaskNote: currentTaskNote,
        taskNoteMetaTree: taskNoteMetaTree,
        currentTaskNoteChain: currentTaskNoteChain,
        setCurrentTaskNoteChain: setCurrentTaskNoteChain,
        allNoteIdChains: allNoteIdChains,
        setAllNoteIdChains: setAllNoteIdChains,
        tabItems: tabItems,
        selectedTabIndex: selectedTabIndex,
    });

    // Chat Note Related
    const [currentChatNote, setCurrentChatNote] = useState<ChatNoteProps | null>(null);
    const [currentChatNoteTitle, setCurrentChatNoteTitle] = useState<string>("");
    const [chatNoteMeta, setChatNoteMeta] = useState<ChatNoteMetaProps[]>([]);
    const [currentChatNoteChain, setCurrentChatNoteChain] = useState<ChatNoteMetaTreeNode[]>();
    const [newlyCreatedChatNotes, setNewlyCreatedChatNotes] = useState<ChatNoteProps[]>([]);
    const handleCreateNewChatNote = async (
        parentNoteId: number | null,
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number
    ) => {
        const title = `${parentNoteId ? "Child" : "New"} Note (${
            newlyCreatedChatNotes.length + 1
        })`;
        const _newNote = await createEmptyChatNote(
            myself,
            parentNoteId,
            chatType,
            chatId,
            isThread,
            threadId,
            title,
            accessToken
        );
        const newNote: ChatNoteProps = { noteType: 3, ..._newNote };
        setNewlyCreatedChatNotes([...newlyCreatedChatNotes, newNote]);
        setCurrentChatNote(newNote);
        setCurrentChatNoteTitle(title);
        addNote(3, newNote);
        setChatNoteMeta([
            {
                noteType: newNote.noteType,
                noteId: newNote.noteId,
                parentNoteId: newNote.parentNoteId,
                chatType: newNote.chatType,
                chatId: newNote.chatId,
                isThread: newNote.isThread,
                threadId: newNote.threadId,
                title: newNote.title,
                tsUpdated: newNote.tsUpdated,
            },
            ...chatNoteMeta,
        ]);
    };
    const getChatNoteMeta = async () => {
        const loadedNotes: ChatNoteMetaProps[] = await loadChatNoteMeta(myself, accessToken);
        if (loadedNotes.length > 0) {
            setChatNoteMeta(loadedNotes);
        }
    };
    const [chatNoteMetaTree, setChatNoteMetaTree] = useState<ChatNoteMetaTreeNode[]>(
        buildChatNoteTree(chatNoteMeta)
    );
    useEffect(() => {
        setChatNoteMetaTree(buildChatNoteTree(chatNoteMeta));
    }, [chatNoteMeta]);
    initCurrentChatNoteChain({
        chatNoteMeta: chatNoteMeta,
        currentChatNoteChain: currentChatNoteChain,
        setCurrentChatNoteChain: setCurrentChatNoteChain,
    });
    updateTabFromChatNoteUpdate({
        currentChatNote: currentChatNote,
        setSelectedTabIndex: setSelectedTabIndex,
        tabItems: tabItems,
        setTabItems: setTabItems,
    });
    updataChatNoteChain({
        currentChatNote: currentChatNote,
        chatNoteMetaTree: chatNoteMetaTree,
        currentChatNoteChain: currentChatNoteChain,
        setCurrentChatNoteChain: setCurrentChatNoteChain,
        allNoteIdChains: allNoteIdChains,
        setAllNoteIdChains: setAllNoteIdChains,
        tabItems: tabItems,
        selectedTabIndex: selectedTabIndex,
    });

    const handleCreateNewChatNoteIfNotExist = async (
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number
    ) => {
        const chatNotes: ChatNoteProps[] = await loadChatNotesByChatId(
            myself,
            chatType,
            chatId,
            isThread,
            threadId,
            accessToken
        );
        if (chatNotes.length > 0) {
            const newNote = chatNotes[0];
            setCurrentChatNote(newNote);
            setCurrentChatNoteTitle(newNote.title);
            addNote(3, newNote);
        } else {
            const title = "New Note";
            const _newNote = await createEmptyChatNote(
                myself,
                null,
                chatType,
                chatId,
                isThread,
                threadId,
                title,
                accessToken
            );
            const newNote: ChatNoteProps = { noteType: 3, ..._newNote };
            setNewlyCreatedChatNotes([...newlyCreatedChatNotes, newNote]);
            setCurrentChatNote(newNote);
            setCurrentChatNoteTitle(title);
            addNote(3, newNote);
            setChatNoteMeta([
                {
                    noteType: newNote.noteType,
                    noteId: newNote.noteId,
                    parentNoteId: newNote.parentNoteId,
                    chatType: newNote.chatType,
                    chatId: newNote.chatId,
                    isThread: newNote.isThread,
                    threadId: newNote.threadId,
                    title: newNote.title,
                    tsUpdated: newNote.tsUpdated,
                },
                ...chatNoteMeta,
            ]);
        }
    };

    ///////////////////////
    // Inbox Related
    ///////////////////////
    const [inboxItems, setInboxItems] = useState<InboxItemProps[]>([]);
    const [unReadInboxItemCount, setUnReadInboxItemCount] = useState<number>(0);
    const countUnReadInboxItem = (inboxItems: InboxItemProps[]): number => {
        return inboxItems.reduce<number>((acc, item) => {
            if (item.isRead === false) {
                acc += 1;
            }
            return acc;
        }, 0);
    };
    const funcSetInboxItems = async () => {
        const inboxItems: InboxItemProps[] = await popInboxItems();
        if (inboxItems) {
            setInboxItems(inboxItems);
        }
    };
    useEffect(() => {
        setUnReadInboxItemCount(
            countUnReadInboxItem(
                inboxItems.filter((item) => item.itemType === 1 || item.itemType === 2)
            )
        );
    }, [inboxItems]);

    ///////////////////////
    // Other Hooks
    ///////////////////////
    // Common Hooks
    wsHook({
        socket: socketInstance,
        accessToken: accessToken,
        myself: myself,
        allChats: allChats,
        currentMainChat: currentMainChat,
        currentSubChat: currentSubChat,
        currentThreadChat: currentThreadChat,
        setCurrentMainChat: setCurrentMainChat,
        setCurrentSubChat: setCurrentSubChat,
        setCurrentThreadChat: setCurrentThreadChat,
        funcSetAllChats: funcSetAllChats,
        setIsTaskCommentUpdated: setIsTaskCommentUpdated,
        isLoading: isLoading,
        funcSetActivityMessages: funcSetActivityMessages,
        funcSetInboxItems: funcSetInboxItems,
    });

    // Initialization Hooks
    useEffect(() => {
        funcSetInboxItems();
        funcSetAllChats();
        funcSetActivityMessages();
    }, []);

    useEffect(() => {
        if (isLoading === false) {
            funcSetInboxItems();
            funcSetAllChats();
            funcSetActivityMessages();

            // Load all team users
            funcSetTeamMembers();

            // Load note metadata
            getMyNoteMeta();
            getTaskNoteMeta();
            getChatNoteMeta();
        }
    }, [isLoading]);

    useEffect(() => {
        if (accessToken) {
            if (socketInstance === null || myself.teamId !== currentTeamId) {
                setSocketInstance(socket(accessToken));
                console.log("Finished connecting WS");
            }
        }
    }, [myself, accessToken, currentTeamId, socketInstance]);

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
            funcSetAllChats();
            if (currentMainChat) {
                if (currentMainChat.chatType === 1 && currentMainChat.chatId !== -1) {
                    localStorage.setItem("lastChatType", "1");
                    localStorage.setItem("lastDMChatId", currentMainChat.chatId.toString() || "");
                }
                if (currentMainChat.chatType === 2 && currentMainChat.chatId !== -1) {
                    localStorage.setItem("lastChatType", "2");
                    localStorage.setItem("lastGMChatId", currentMainChat.chatId.toString() || "");
                }
                if (currentMainChat.chatType === 3 && currentMainChat.chatId !== -1) {
                    localStorage.setItem("lastChatType", "3");
                    localStorage.setItem("lastPMChatId", currentMainChat.chatId.toString() || "");
                }
                if (currentMainChat.chatType === 4 && currentMainChat.chatId !== -1) {
                    localStorage.setItem("lastChatType", "4");
                    localStorage.setItem(
                        "lastPinnedChatId",
                        currentMainChat.chatId.toString() || ""
                    );
                }
            }
        }, 500); // wait 500ms
    }, [currentMainChat, currentSubChat]);

    // Task Related Hooks
    useEffect(() => {
        // If the thread chat is visible and has a task id, set the current preview task id.
        // This happens when someone created a task in the thread chat.
        if (currentThreadChat && currentThreadChat.taskId !== null && isThreadVisible === true) {
            setCurrentPreviewTaskId(currentThreadChat.taskId);
        }
    }, [currentThreadChat]);

    return isLoading || currentMainChat === undefined ? (
        <InitialLoad
            myself={myself}
            setIsLoading={setIsLoading}
            setCurrentMainChat={setCurrentMainChat}
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
                        setCurrentMainChat={setCurrentMainChat}
                        inboxItems={inboxItems}
                        unReadInboxItemCount={unReadInboxItemCount}
                        unReadChatAndActivityCounts={unReadChatAndActivityCounts}
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
                        currentChatPaneType={currentChatPaneType}
                        setCurrentChatPaneType={setCurrentChatPaneType}
                        activityMessages={activityMessages}
                        setActivityMessages={setActivityMessages}
                        currentMainChat={currentMainChat}
                        setCurrentMainChat={setCurrentMainChat}
                        currentSubChat={currentSubChat}
                        setCurrentSubChat={setCurrentSubChat}
                        currentThreadChat={currentThreadChat}
                        setCurrentThreadChat={setCurrentThreadChat}
                        openingService={openingService}
                        setOpeningService={setOpeningService}
                        allChats={allChats}
                        setAllChats={setAllChats}
                        funcSetAllChats={funcSetAllChats}
                        isCommentUpdated={isTaskCommentUpdated}
                        setIsCommentUpdated={setIsTaskCommentUpdated}
                        unReadInboxItemCount={unReadInboxItemCount}
                        unReadChatCounts={unReadChatCounts}
                        unReadActivityMessageCounts={unReadActivityMessageCounts}
                        unReadChatAndActivityCounts={unReadChatAndActivityCounts}
                        currentNoteType={currentNoteType}
                        currentChatNote={currentChatNote}
                        setCurrentChatNote={setCurrentChatNote}
                        currentChatNoteTitle={currentChatNoteTitle}
                        setCurrentChatNoteTitle={setCurrentChatNoteTitle}
                        chatNoteMeta={chatNoteMeta}
                        setChatNoteMeta={setChatNoteMeta}
                        tabItems={tabItems}
                        setTabItems={setTabItems}
                        selectedTabIndex={selectedTabIndex}
                        setSelectedTabIndex={setSelectedTabIndex}
                        handleCreateNewChatNote={handleCreateNewChatNote}
                        handleCreateNewChatNoteIfNotExist={handleCreateNewChatNoteIfNotExist}
                        currentChatNoteChain={currentChatNoteChain}
                        setCurrentNoteType={setCurrentNoteType}
                        handleCreateNewTaskNote={handleCreateNewTaskNote}
                        setCurrentTaskNote={setCurrentTaskNote}
                        isTaskPreviewVisible={isTaskPreviewVisible}
                        setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                        isCreatingTask={isCreatingTask}
                        setIsCreatingTask={setIsCreatingTask}
                        isChatNoteVisible={isChatNoteVisible}
                        setIsChatNoteVisible={setIsChatNoteVisible}
                        isTaskNoteVisible={isTaskNoteVisible}
                        setIsTaskNoteVisible={setIsTaskNoteVisible}
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
                        isMainChatVisible={isMainChatVisible}
                        setIsMainChatVisible={setIsMainChatVisible}
                        isSubChatVisible={isSubChatVisible}
                        setIsSubChatVisible={setIsSubChatVisible}
                        isThreadVisible={isThreadVisible}
                        setIsThreadVisible={setIsThreadVisible}
                    />
                ) : null}

                {openingService === 2 ? (
                    <TaskHome
                        currentTeam={currentTeam}
                        setCurrentTeam={setCurrentTeam}
                        teamMembers={teamMembers}
                        teamMemberProfiles={teamMemberProfiles}
                        socket={socketInstance}
                        myself={myself}
                        setMyself={setMyself}
                        setCurrentMainChat={setCurrentMainChat}
                        openingService={openingService}
                        setOpeningService={setOpeningService}
                        isCommentUpdated={isTaskCommentUpdated}
                        setIsCommentUpdated={setIsTaskCommentUpdated}
                        unReadInboxItemCount={unReadInboxItemCount}
                        unReadChatAndActivityCounts={unReadChatAndActivityCounts}
                        currentTaskNote={currentTaskNote}
                        setCurrentTaskNote={setCurrentTaskNote}
                        currentTaskNoteTitle={currentTaskNoteTitle}
                        setCurrentTaskNoteTitle={setCurrentTaskNoteTitle}
                        currentNoteType={currentNoteType}
                        setCurrentNoteType={setCurrentNoteType}
                        taskNoteMeta={taskNoteMeta}
                        setTaskNoteMeta={setTaskNoteMeta}
                        tabItems={tabItems}
                        setTabItems={setTabItems}
                        selectedTabIndex={selectedTabIndex}
                        setSelectedTabIndex={setSelectedTabIndex}
                        handleCreateNewTaskNote={handleCreateNewTaskNote}
                        currentTaskNoteChain={currentTaskNoteChain}
                        currentTeamId={currentTeamId}
                        setCurrentTeamId={setCurrentTeamId}
                        isTaskPreviewVisible={isTaskPreviewVisible}
                        setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                        isTaskNoteVisible={isTaskNoteVisible}
                        setIsTaskNoteVisible={setIsTaskNoteVisible}
                        isCreatingTask={isCreatingTask}
                        setIsCreatingTask={setIsCreatingTask}
                        teamProjects={teamProjects}
                        setTeamProjects={setTeamProjects}
                        loadProjects={loadProjects}
                        currentProject={currentProject}
                        setCurrentProject={setCurrentProject}
                    />
                ) : null}

                {openingService === 3 ? (
                    <NoteHome
                        currentTeam={currentTeam}
                        setCurrentTeam={setCurrentTeam}
                        teamMemberProfiles={teamMemberProfiles}
                        socket={socketInstance}
                        teamMembers={teamMembers}
                        myself={myself}
                        setMyself={setMyself}
                        openingService={openingService}
                        setOpeningService={setOpeningService}
                        setCurrentMainChat={setCurrentMainChat}
                        currentNoteType={currentNoteType}
                        setCurrentNoteType={setCurrentNoteType}
                        currentMyNoteTitle={currentMyNoteTitle}
                        setCurrentMyNoteTitle={setCurrentMyNoteTitle}
                        currentTaskNoteTitle={currentTaskNoteTitle}
                        setCurrentTaskNoteTitle={setCurrentTaskNoteTitle}
                        currentChatNoteTitle={currentChatNoteTitle}
                        setCurrentChatNoteTitle={setCurrentChatNoteTitle}
                        myNoteMeta={myNoteMeta}
                        setMyNoteMeta={setMyNoteMeta}
                        taskNoteMeta={taskNoteMeta}
                        setTaskNoteMeta={setTaskNoteMeta}
                        chatNoteMeta={chatNoteMeta}
                        setChatNoteMeta={setChatNoteMeta}
                        tabItems={tabItems}
                        setTabItems={setTabItems}
                        selectedTabIndex={selectedTabIndex}
                        setSelectedTabIndex={setSelectedTabIndex}
                        currentMyNote={currentMyNote}
                        setCurrentMyNote={setCurrentMyNote}
                        handleCreateNewMyNote={handleCreateNewMyNote}
                        currentTaskNote={currentTaskNote}
                        setCurrentTaskNote={setCurrentTaskNote}
                        handleCreateNewTaskNote={handleCreateNewTaskNote}
                        currentChatNote={currentChatNote}
                        setCurrentChatNote={setCurrentChatNote}
                        handleCreateNewChatNote={handleCreateNewChatNote}
                        currentMyNoteChain={currentMyNoteChain}
                        currentTaskNoteChain={currentTaskNoteChain}
                        currentChatNoteChain={currentChatNoteChain}
                        unReadInboxItemCount={unReadInboxItemCount}
                        unReadChatAndActivityCounts={unReadChatAndActivityCounts}
                        myNoteMetaTree={myNoteMetaTree}
                        taskNoteMetaTree={taskNoteMetaTree}
                        chatNoteMetaTree={chatNoteMetaTree}
                        allNoteIdChains={allNoteIdChains}
                        isCreatingTask={isCreatingTask}
                        setIsMainChatVisible={setIsMainChatVisible}
                        setIsTaskNoteVisible={setIsTaskNoteVisible}
                        setIsChatNoteVisible={setIsChatNoteVisible}
                    />
                ) : null}
            </CssVarsProvider>
        </div>
    );
};
