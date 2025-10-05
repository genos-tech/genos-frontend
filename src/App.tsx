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
import {
    ActivityMessageProps,
    AllChatProps,
    ChatProps,
    ThreadMessageProps,
    ThreadProps,
} from "./types/chat";
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
import {
    ProjectProps,
    TaskMetaProps,
    TaskMetaTreeNode,
    TaskProps,
    TaskTableProps,
    TaskTypesProps,
} from "./types/tasks";
import { loadTeamProjects } from "./features/tasks/services/loadTeamProjects";
import { loadProjectTasks } from "./features/tasks/services/loadProjectTasks";
import { popSpecificProjectTasks } from "./features/chat/services/popSpecificProjectTasks";
import { loadSpecificTask } from "./features/tasks/services/loadSpecificTask";
import { getData } from "./db/crud";
import { loadSpecificNote } from "./features/notes/services/loadSpecificNote";
import { STORES } from "./db/conf";
import { buildTaskTree } from "./features/tasks/utils/buildTaskTree";
import { initCurrentTaskChain } from "./hooks/tasks/sidebar";
import { loadTaskMeta } from "./features/notes/services/loadTaskMeta";
import { popSpecificMessages } from "./features/chat/services/popSpecificMessages";
import { loadSpecificThreadMessages } from "./features/chat/services/loadSpecificThreadMessages";

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
    useEffect(() => {
        localStorage.setItem("openingService", openingService.toString());
    }, [openingService]);

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
    // Project Related
    ///////////////////////
    const [teamProjects, setTeamProjects] = useState<ProjectProps[]>([]);
    const [openCreateProject, setOpenCreateProject] = useState(false);
    const [isNewProjectCreated, setIsNewProjectCreated] = useState(false);
    const [currentProject, setCurrentProject] = useState<ProjectProps | null>(null);
    const loadProjectsAndTasks = async (targetProjectId: number = -1) => {
        // Load the latest project as initial process
        const loadedTeamProjects: ProjectProps[] = await loadTeamProjects(myself, accessToken);

        // Set the current project to one of the joining project.
        // TODO: should set "last-opened-project" using cache(localstorage)
        if (loadedTeamProjects && loadedTeamProjects.length > 0) {
            setTeamProjects([...loadedTeamProjects]);

            for (let i = 0; i < loadedTeamProjects.length; i++) {
                if (targetProjectId !== -1 && currentProject) {
                    if (
                        loadedTeamProjects[i].projectId === targetProjectId ||
                        myself.teamId !== currentTeamId
                    ) {
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
                    } else if (
                        loadedTeamProjects[i].isJoined === true &&
                        loadedTeamProjects[i].projectId
                    ) {
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

                // If not meeting any condition, set the last project as the current project
                if (i === loadedTeamProjects.length - 1 && loadedTeamProjects[i].projectId) {
                    setCurrentProject({
                        projectId: loadedTeamProjects[i].projectId,
                        projectName: loadedTeamProjects[i].projectName,
                        projectTags: loadedTeamProjects[i].projectTags,
                        isPrivate: loadedTeamProjects[i].isPrivate,
                        systemUserId: loadedTeamProjects[i].systemUserId,
                    });
                    await loadProjectTasks(myself, loadedTeamProjects[i].projectId, accessToken);
                    break;
                }
            }
        }
    };

    useEffect(() => {
        // If isPrivate is undefined, set the current project to the project
        // with the same project id in the team projects
        if (currentProject && currentProject.isPrivate === undefined) {
            const targetProject: ProjectProps | undefined = teamProjects.find(
                (project) => project.projectId === currentProject.projectId
            );
            if (targetProject) {
                setCurrentProject(targetProject);
            }
        }
    }, [currentProject]);

    useEffect(() => {
        (async () => {
            await loadProjectsAndTasks(
                localStorage.getItem("lastProjectId")
                    ? Number(localStorage.getItem("lastProjectId"))
                    : -1
            );
        })();
    }, [myself]);

    ///////////////////////
    // Chat Related
    ///////////////////////
    const [isMainChatVisible, setIsMainChatVisible] = useState(true); // Is Main chat pane visible or not
    const [isSubChatVisible, setIsSubChatVisible] = useState(false); // Is Sub chat in the main chat pane visible or not
    const [isThreadVisible, setIsThreadVisible] = useState(false); // Is Thread pane visible or not
    const [isThreadTaskVisible, setIsThreadTaskVisible] = useState(false); // Is task preview visible or not
    const [currentMainChat, setCurrentMainChat] = useState<ChatProps | undefined>(undefined);
    const [currentSubChat, setCurrentSubChat] = useState<ChatProps>();
    const [currentThreadChat, setCurrentThreadChat] = useState<ThreadProps>();
    const [allChats, setAllChats] = useState<AllChatProps[]>([]);
    const funcSetAllChats = async () => {
        const rawAllChats: AllChatProps[] = await popAllChats();
        if (rawAllChats) {
            // Exclude the chats that have not any messages except the first message, which is "Has joined".
            const allChatsWithoutInitialDMChat = rawAllChats.filter(
                (chat) => !(chat.chatType === 1 && chat.latestMessage.messageId <= 1)
            );

            // But only if the current main chat is the chat without no messages, keep the chat displayed.
            // This happens when the user searched the DM chat and is trying to start the initial DM chat.
            const initialDMChatIdx = rawAllChats.findIndex(
                (chat) =>
                    chat.chatType === 1 &&
                    currentMainChat?.chatId === chat.chatId &&
                    chat.latestMessage.messageId <= 1
            );
            let finalAllChats: AllChatProps[];
            if (initialDMChatIdx !== -1) {
                // If the initial DM chat has only one message, set the current timestamp as the latest
                // message's tsSent. This needs to not show the time that the chat was actually created,
                // which is the past time. So set the current timestamp as the tsSent.
                const initialDMChat = rawAllChats[initialDMChatIdx];
                finalAllChats = [
                    {
                        ...initialDMChat,
                        latestMessage: {
                            ...initialDMChat.latestMessage,
                            tsSent: getCurrentTimestamp(),
                        },
                    },
                    ...allChatsWithoutInitialDMChat,
                ];
            } else {
                finalAllChats = allChatsWithoutInitialDMChat;
            }

            setAllChats(finalAllChats);

            // No need to count the init chat.
            setUnReadChatCounts(countUnreadChats(allChatsWithoutInitialDMChat));
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
    const defineNewChat = (chat: AllChatProps, messages: any) => {
        const newMessages: ChatProps = {
            chatId: chat.chatId,
            chatName: chat.chatName,
            chatType: chat.chatType,
            dmPartnerUser: chat.dmPartnerUser,
            lastReadMessageId: messages[messages.length - 1].messageId,
            messages: messages,
            latestMessage: messages[messages.length - 1],
            latestMessageText: messages[messages.length - 1].contentText,
            TSLastMessage: messages[messages.length - 1].tsSent,
            systemUserId: chat.systemUserId,
            project: chat.project,
            isPrivate: chat.isPrivate,
            profileImagePath: chat.profileImagePath,
        };
        return newMessages;
    };
    const moveToSpecificThreadChat = async (chat: AllChatProps, threadId: number) => {
        const threadMessages: ThreadMessageProps[] = await loadSpecificThreadMessages(
            myself,
            chat.chatType,
            chat.chatId,
            threadId,
            accessToken
        );
        if (threadMessages && threadMessages.length > 0) {
            const newThread: ThreadProps = {
                chatId: chat.chatId,
                chatName: chat.chatName,
                threadId: threadId,
                chatType: chat.chatType,
                dmPartnerUser: chat.dmPartnerUser,
                taskId: threadMessages[threadMessages.length - 1].taskId,
                messages: threadMessages,
                project: threadMessages[threadMessages.length - 1].project,
                TSLastMessage: threadMessages[threadMessages.length - 1].tsSent,
                taskExist: threadMessages[threadMessages.length - 1].taskExist,
            };
            if (newThread) {
                // Set project if the project id exists in the thread messages.
                // In other words, if the thread has the corresponding task,
                // set the project to the project of the task.
                if (newThread.project?.projectId) {
                    setCurrentProject(newThread.project);
                }
                setCurrentThreadChat(newThread);
                if (newThread.taskExist === true && newThread.taskId) {
                    setCurrentPreviewTaskId(newThread.taskId);
                }
            }
        }
    };
    const moveToSpecificChat = async (chatType: number, chatId: number, threadId: number) => {
        setOpeningService(1); // move to chat
        setIsMainChatVisible(false); // initialize the main chat pane to be closed
        const targetChat: AllChatProps = allChats.filter(
            (chat) => chat.chatType === chatType && chat.chatId === chatId
        )[0];
        popSpecificMessages(chatId, chatType)
            .then((messages) => {
                const newChat: ChatProps = defineNewChat(targetChat, messages);
                setCurrentMainChat(newChat);

                if (threadId > 0) {
                    moveToSpecificThreadChat(targetChat, threadId);
                    setIsThreadVisible(true);
                } else {
                    setIsMainChatVisible(true);
                }
                setIsChatNoteVisible(true);
            })
            .catch((error) => console.error(error));
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
    const [ongoingTasks, setOnGoingTasks] = useState<TaskTableProps[]>([]);
    const [closedTasks, setClosedTasks] = useState<TaskTableProps[]>([]);
    const [deletedTasks, setDeletedTasks] = useState<TaskTableProps[]>([]);
    const fetchProjectTasks = async (projectId: number) => {
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
        setOnGoingTasks(_onGoingTasks);
        setClosedTasks(_closedTasks);
        setDeletedTasks(_deletedTasks);
    };

    useEffect(() => {
        (async () => {
            if (currentProject && currentProject.projectId) {
                fetchProjectTasks(currentProject.projectId);
                localStorage.setItem("lastProjectId", currentProject.projectId.toString());
            }
        })();
    }, [currentProject]);

    useEffect(() => {
        (async () => {
            if (currentProject && (isNewProjectCreated === true || isNewTaskCreated === true)) {
                fetchProjectTasks(currentProject.projectId);
                localStorage.setItem("lastProjectId", currentProject.projectId.toString());
            }
        })();
    }, [isNewProjectCreated, isNewTaskCreated]);

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
                    setOnGoingTasks((prev) => [
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
                            concatTags: loadedTask[0].concatTags || null,
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
            setOnGoingTasks((prevTasks) =>
                prevTasks.map((task) =>
                    task.id === String(currentPreviewTask.id)
                        ? {
                              id: String(currentPreviewTask.id) || null,
                              title: currentPreviewTask.title || null,
                              priority: currentPreviewTask.priority.priority || null,
                              effortLevel: currentPreviewTask.effortLevel.level || null,
                              createdDate: currentPreviewTask.createdDate || null,
                              updatedAt: currentPreviewTask.updatedAt || null,
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
            (async () => {
                await loadProjectsAndTasks(
                    localStorage.getItem("lastProjectId")
                        ? Number(localStorage.getItem("lastProjectId"))
                        : -1
                );
            })();
        }
    }, [isNewTaskCreated]);

    ///////////////////////
    // Note Related
    ///////////////////////
    // Common
    const [selectedTabIndex, setSelectedTabIndex] = useState(0);
    const [tabItems, setTabItems] = useState<any[]>([]);
    const [tmpTabItems, setTmpTabItems] = useState<any[]>([]);
    const [allNoteIdChains, setAllNoteIdChains] = useState<Record<string, number[]>>({});
    const [isChatNoteVisible, setIsChatNoteVisible] = useState(false);
    const [isTaskNoteVisible, setIsTaskNoteVisible] = useState(false);
    const loadNote = async (noteType: number, noteId: number, nextTabIndex: number) => {
        const targetTabIndex: number = Math.max(
            nextTabIndex !== -1
                ? nextTabIndex
                : tabItems.findIndex(
                      (note) => note.noteType === noteType && note.noteId === noteId
                  ),
            0
        );

        if (noteType === 1) {
            const note = await getData({ storeName: STORES.PERSONAL_NOTES, key: noteId });
            if (note) {
                if (note.noteType === 1) {
                    setCurrentMyNote(note);
                    setSelectedTabIndex(targetTabIndex);
                }
            } else {
                const note: MyNoteProps = await loadSpecificNote(myself, 1, noteId, accessToken);
                if (!note.error && note.noteType === 1) {
                    addNote(1, note);
                    setCurrentMyNote(note);
                    setSelectedTabIndex(targetTabIndex);
                }
            }
            setCurrentNoteType(1);
        } else if (noteType === 2) {
            const note = await getData({ storeName: STORES.TASK_NOTES, key: noteId });
            if (note) {
                if (note.noteType === 2) {
                    setCurrentTaskNote(note);
                    setSelectedTabIndex(targetTabIndex);
                }
            } else {
                const note: TaskNoteProps = await loadSpecificNote(myself, 2, noteId, accessToken);
                if (!note.error && note.noteType === 2) {
                    addNote(2, note);
                    setCurrentTaskNote(note);
                    setSelectedTabIndex(targetTabIndex);
                }
            }
            setCurrentNoteType(2);
        } else if (noteType === 3) {
            const note = await getData({ storeName: STORES.CHAT_NOTES, key: noteId });
            if (note) {
                if (note.noteType === 3) {
                    setCurrentChatNote(note);
                    setSelectedTabIndex(targetTabIndex);
                }
            } else {
                const note: ChatNoteProps = await loadSpecificNote(myself, 3, noteId, accessToken);
                if (note && !note.error && note.noteType === 3) {
                    addNote(3, note);
                    setCurrentChatNote(note);
                    setSelectedTabIndex(targetTabIndex);
                }
            }
            setCurrentNoteType(3);
        }
    };

    const popInitialNote = async () => {
        const noteType: string | null = localStorage.getItem("lastOpenNoteType");
        const myNoteId: string | null = localStorage.getItem("lastOpenMyNoteId");
        const taskNoteId: string | null = localStorage.getItem("lastOpenTaskNoteId");
        const chatNoteId: string | null = localStorage.getItem("lastOpenChatNoteId");
        if (noteType && myNoteId) {
            if (Number(noteType) === 1 && myNoteId) {
                await loadNote(1, Number(myNoteId), -1);
            } else if (Number(noteType) === 2 && taskNoteId) {
                await loadNote(2, Number(taskNoteId), -1);
            } else if (Number(noteType) === 3 && chatNoteId) {
                await loadNote(3, Number(chatNoteId), -1);
            }
        }
    };

    // My Note Related
    const [currentMyNote, setCurrentMyNote] = useState<MyNoteProps | null>(null);
    const [myNoteMeta, setMyNoteMeta] = useState<MyNoteMetaProps[]>([]);
    const [currentMyNoteChain, setCurrentMyNoteChain] = useState<MyNoteMetaTreeNode[]>();
    const [newlyCreatedMyNotes, setNewlyCreatedMyNotes] = useState<MyNoteProps[]>([]);
    const handleCreateNewMyNote = async (parentNoteId: number | null) => {
        const title = `${parentNoteId ? "Child" : "New"} Note (${newlyCreatedMyNotes.length + 1})`;
        const _newNote = await createEmptyMyNote(myself, parentNoteId, title, accessToken);
        const newNote: MyNoteProps = { noteType: 1, ..._newNote };
        setNewlyCreatedMyNotes([...newlyCreatedMyNotes, newNote]);
        setCurrentMyNote(newNote);
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
    const [taskNoteMeta, setTaskNoteMeta] = useState<TaskNoteMetaProps[]>([]);
    const [currentTaskNoteChain, setCurrentTaskNoteChain] = useState<TaskNoteMetaTreeNode[]>();
    const [newlyCreatedTaskNotes, setNewlyCreatedTaskNotes] = useState<TaskNoteProps[]>([]);
    const [isTaskVisibleInNote, setIsTaskVisibleInNote] = useState(false);
    const handleCreateNewTaskNote = async (
        parentNoteId: number | null,
        projectId: number,
        taskId: number,
        title?: string
    ) => {
        const _title =
            title && title.length > 0
                ? title
                : `${parentNoteId ? "Child" : "New"} Note (${newlyCreatedTaskNotes.length + 1})`;
        const _newNote = await createEmptyTaskNote(
            myself,
            parentNoteId,
            projectId,
            taskId,
            _title,
            accessToken
        );
        const newNote: TaskNoteProps = { noteType: 2, ..._newNote };
        setNewlyCreatedTaskNotes([...newlyCreatedTaskNotes, newNote]);
        setCurrentTaskNote(newNote);
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
            countUnReadInboxItem(inboxItems.filter((item) => item.itemType !== 1))
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
        currentProject: currentProject,
        currentPreviewTaskId: currentPreviewTaskId,
        setIsTaskUpdatedBySomeone: setIsTaskUpdatedBySomeone,
    });

    useEffect(() => {
        // Reset note variables when the team changes
        setTabItems([]);
        setTmpTabItems([]);
        setCurrentMyNote(null);
        setCurrentTaskNote(null);
        setCurrentChatNote(null);
        setCurrentChatNoteChain(undefined);
        setCurrentMyNoteChain(undefined);
        setCurrentTaskNoteChain(undefined);
        setAllNoteIdChains({});
        setMyNoteMeta([]);
        setTaskNoteMeta([]);
        setChatNoteMeta([]);
        setMyNoteMetaTree([]);
        setTaskNoteMetaTree([]);
        setChatNoteMetaTree([]);
        setNewlyCreatedMyNotes([]);
        setNewlyCreatedTaskNotes([]);
        setNewlyCreatedChatNotes([]);
    }, [currentTeamId]);

    useEffect(() => {
        if (openingService === 0) {
            // Init all notes
            setCurrentMyNote(null);
            setCurrentTaskNote(null);
            setCurrentChatNote(null);
        } else if (openingService === 1) {
            // Keep the tabItems when an user changes the page from Notes to other pages.
            setTmpTabItems(tabItems);
            setTabItems(tabItems.filter((item) => item.noteType === 3));

            // Initialize the task visibility.
            setIsTaskPreviewVisible(false);

            // Initialize the chat note visibility.
            if (tabItems.filter((item) => item.noteType === 3).length === 0) {
                setIsChatNoteVisible(false);
            }

            // Init all notes
            setCurrentMyNote(null);
            setCurrentTaskNote(null);
            // setCurrentChatNote(null);
        } else if (openingService === 2) {
            // Keep the tabItems when an user changes the page from Notes to other pages.
            setTmpTabItems(tabItems);
            setTabItems(tabItems.filter((item) => item.noteType === 2));

            // Initialize the chat note visibility.
            setIsTaskNoteVisible(false);

            // Init all notes
            setCurrentMyNote(null);
            setCurrentTaskNote(null);
            setCurrentChatNote(null);
        } else if (openingService === 3) {
            // Keep the tabItems when an user changes the page from Notes to other pages.
            setTabItems(tmpTabItems);
            setTmpTabItems([]);

            if (socketInstance) {
                popInitialNote();
            }
        }
    }, [openingService]);

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

            // Load task metadata
            getTaskMeta();

            // Load note metadata
            getMyNoteMeta();
            getTaskNoteMeta();
            getChatNoteMeta();
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
    }, [myself]);

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
            popInitialNote();

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
                        setTeamMembers={setTeamMembers}
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
                        chatNoteMeta={chatNoteMeta}
                        setChatNoteMeta={setChatNoteMeta}
                        tabItems={tabItems}
                        setTabItems={setTabItems}
                        selectedTabIndex={selectedTabIndex}
                        handleCreateNewChatNote={handleCreateNewChatNote}
                        handleCreateNewChatNoteIfNotExist={handleCreateNewChatNoteIfNotExist}
                        currentChatNoteChain={currentChatNoteChain}
                        handleCreateNewTaskNote={handleCreateNewTaskNote}
                        setCurrentTaskNote={setCurrentTaskNote}
                        isTaskPreviewVisible={isThreadTaskVisible}
                        setIsTaskPreviewVisible={setIsThreadTaskVisible}
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
                        teamProjects={teamProjects}
                        setTeamProjects={setTeamProjects}
                        taskNoteMeta={taskNoteMeta}
                        loadNote={loadNote}
                        initialEmptyTaskId={initialEmptyTaskId}
                        setInitialEmptyTaskId={setInitialEmptyTaskId}
                        moveToSpecificChat={moveToSpecificChat}
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
                        setCurrentMainChat={setCurrentMainChat}
                        openingService={openingService}
                        setOpeningService={setOpeningService}
                        isCommentUpdated={isTaskCommentUpdated}
                        setIsCommentUpdated={setIsTaskCommentUpdated}
                        unReadInboxItemCount={unReadInboxItemCount}
                        unReadChatAndActivityCounts={unReadChatAndActivityCounts}
                        currentTaskNote={currentTaskNote}
                        setCurrentTaskNote={setCurrentTaskNote}
                        currentNoteType={currentNoteType}
                        taskNoteMeta={taskNoteMeta}
                        setTaskNoteMeta={setTaskNoteMeta}
                        tabItems={tabItems}
                        setTabItems={setTabItems}
                        selectedTabIndex={selectedTabIndex}
                        handleCreateNewTaskNote={handleCreateNewTaskNote}
                        currentTaskNoteChain={currentTaskNoteChain}
                        isTaskPreviewVisible={isTaskPreviewVisible}
                        setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                        isTaskNoteVisible={isTaskNoteVisible}
                        setIsTaskNoteVisible={setIsTaskNoteVisible}
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
                        setOngoingTasks={setOnGoingTasks}
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
                        loadNote={loadNote}
                        setIsTaskVisibleInNote={setIsTaskVisibleInNote}
                        taskMetaTree={taskMetaTree}
                        currentTaskChain={currentTaskChain}
                        initialEmptyTaskId={initialEmptyTaskId}
                        setInitialEmptyTaskId={setInitialEmptyTaskId}
                        allChats={allChats}
                        funcSetAllChats={funcSetAllChats}
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
                        setCurrentMainChat={setCurrentMainChat}
                        currentNoteType={currentNoteType}
                        setCurrentNoteType={setCurrentNoteType}
                        myNoteMeta={myNoteMeta}
                        setMyNoteMeta={setMyNoteMeta}
                        taskNoteMeta={taskNoteMeta}
                        setTaskNoteMeta={setTaskNoteMeta}
                        chatNoteMeta={chatNoteMeta}
                        setChatNoteMeta={setChatNoteMeta}
                        tabItems={tabItems}
                        setTabItems={setTabItems}
                        selectedTabIndex={selectedTabIndex}
                        currentMyNote={currentMyNote}
                        handleCreateNewMyNote={handleCreateNewMyNote}
                        currentTaskNote={currentTaskNote}
                        handleCreateNewTaskNote={handleCreateNewTaskNote}
                        currentChatNote={currentChatNote}
                        setCurrentChatNote={setCurrentChatNote}
                        handleCreateNewChatNote={handleCreateNewChatNote}
                        currentProject={currentProject}
                        allChats={allChats}
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
                        loadNote={loadNote}
                        setIsTaskVisibleInNote={setIsTaskVisibleInNote}
                        isTaskVisibleInNote={isTaskVisibleInNote}
                        setCurrentProject={setCurrentProject}
                        currentPreviewTask={currentPreviewTask}
                        setIsThreadVisible={setIsThreadVisible}
                        isThreadVisible={isThreadVisible}
                        setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                        setIsCreatingTask={setIsCreatingTask}
                        setCurrentPreviewTask={setCurrentPreviewTask}
                        setOpenCreateProject={setOpenCreateProject}
                        setOpenCreateTag={setOpenCreateTag}
                        currentPreviewTaskId={currentPreviewTaskId}
                        setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                        isCommentUpdated={isTaskCommentUpdated}
                        setIsCommentUpdated={setIsTaskCommentUpdated}
                        setCurrentTaskNote={setCurrentTaskNote}
                        isTaskNoteVisible={isTaskNoteVisible}
                        teamProjects={teamProjects}
                        setTeamProjects={setTeamProjects}
                        moveToSpecificChat={moveToSpecificChat}
                        funcSetAllChats={funcSetAllChats}
                    />
                ) : null}
            </CssVarsProvider>
        </div>
    );
};
