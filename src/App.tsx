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
    ChatNoteMetaProps,
    ChatNoteMetaTreeNode,
    ChatNoteProps,
    MyNoteMetaProps,
    MyNoteMetaTreeNode,
    MyNoteProps,
    TaskNoteMetaProps,
    TaskNoteMetaTreeNode,
    TaskNoteProps,
} from "./types/notes";
import { createEmptyNote } from "./features/notes/services/createEmptyNote";
import { addNote } from "./features/notes/services/addNote";

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

    const { accessToken } = useAuth();
    const { myself, setMyself } = useMyself();
    const [currentTeamId, setCurrentTeamId] = useState("");
    const [teamMembers, setTeamMembers] = useState<UserProps[]>([]);
    const [teamMemberProfiles, setTeamMemberProfiles] = useState<Record<string, UserProps>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [currentMainChat, setCurrentMainChat] = useState<ChatProps | undefined>(undefined);

    // {0: Inbox, 1: Chat, 2: Tasks, 3: Notes}
    const [openingService, setOpeningService] = useState<number>(
        Number(localStorage.getItem("openingService") || "1")
    );

    // {1: DM, 2: GM, 3: PM, 4: Pin, 5: Activity}
    const [currentChatPaneType, setCurrentChatPaneType] = useState<number>(
        Number(localStorage.getItem("currentChatPaneType") || "1")
    );

    // 0: Home, 1: personal note, 2: task note, 3: chat note
    const [currentNoteType, setCurrentNoteType] = useState<number>(
        Number(localStorage.getItem("currentNoteType") || "1")
    );

    // My Note
    const [currentMyNote, setCurrentMyNote] = useState<MyNoteProps | null>(null);
    const [currentMyNoteTitle, setCurrentMyNoteTitle] = useState<string>("");
    const [myNoteMeta, setMyNoteMeta] = useState<MyNoteMetaProps[]>([]);
    const [currentMyNoteChain, setCurrentMyNoteChain] = useState<MyNoteMetaTreeNode[]>();
    const [tabMyNotes, setTabMyNotes] = useState<MyNoteProps[]>(
        currentMyNote ? [currentMyNote] : []
    );
    const [newlyCreatedMyNotes, setNewlyCreatedMyNotes] = useState<MyNoteProps[]>([]);

    // Task Note
    const [currentTaskNote, setCurrentTaskNote] = useState<TaskNoteProps | null>(null);
    const [currentTaskNoteTitle, setCurrentTaskNoteTitle] = useState<string>("");
    const [taskNoteMeta, setTaskNoteMeta] = useState<TaskNoteMetaProps[]>([]);
    const [currentTaskNoteChain, setCurrentTaskNoteChain] = useState<TaskNoteMetaTreeNode[]>();
    const [tabTaskNotes, setTabTaskNotes] = useState<TaskNoteProps[]>(
        currentTaskNote ? [currentTaskNote] : []
    );
    const [newlyCreatedTaskNotes, setNewlyCreatedTaskNotes] = useState<TaskNoteProps[]>([]);

    // Chat Note
    const [currentChatNote, setCurrentChatNote] = useState<ChatNoteProps | null>(null);
    const [currentChatNoteTitle, setCurrentChatNoteTitle] = useState<string>("");
    const [chatNoteMeta, setChatNoteMeta] = useState<ChatNoteMetaProps[]>([]);
    const [currentChatNoteChain, setCurrentChatNoteChain] = useState<ChatNoteMetaTreeNode[]>();
    const [tabChatNotes, setTabChatNotes] = useState<ChatNoteProps[]>(
        currentChatNote ? [currentChatNote] : []
    );
    const [newlyCreatedChatNotes, setNewlyCreatedChatNotes] = useState<ChatNoteProps[]>([]);

    // Note common
    const [selectedTabIndex, setSelectedTabIndex] = useState(0);
    const handleCreateNewNote = async (parentNoteId: number | null) => {
        const title = `${parentNoteId ? "Child" : "New"} Note (${newlyCreatedMyNotes.length + 1})`;
        const newNote = await createEmptyNote(myself, parentNoteId, title, accessToken);
        if (currentNoteType === 1) {
            if (tabMyNotes.length === 0 || tabMyNotes[0] === undefined) {
                setSelectedTabIndex(0);
                setTabMyNotes([newNote]);
            } else {
                setSelectedTabIndex(tabMyNotes.length);
                setTabMyNotes([...tabMyNotes, newNote]);
            }
            setNewlyCreatedMyNotes([...newlyCreatedMyNotes, newNote]);
            setCurrentMyNote(newNote);
            setCurrentMyNoteTitle(title);
            addNote(newNote);
            setMyNoteMeta([
                {
                    noteId: newNote.noteId,
                    parentNoteId: newNote.parentNoteId,
                    title: newNote.title,
                    tsCreated: newNote.tsCreated,
                    tsUpdated: newNote.tsUpdated,
                },
                ...myNoteMeta,
            ]);
        }
    };

    // ...
    const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
    const [currentSubChat, setCurrentSubChat] = useState<ChatProps>();
    const [currentThreadChat, setCurrentThreadChat] = useState<ThreadProps>();
    const [isTaskCommentUpdated, setIsTaskCommentUpdated] = useState({
        isUpdate: false,
        scrollToBottom: true,
    });

    // Inbox variables
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

    // Chat variables
    const [allChats, setAllChats] = useState<AllChatProps[]>([]);
    const funcSetAllChats = async () => {
        const _allChats: AllChatProps[] = await popAllChats();
        if (_allChats) {
            setAllChats(_allChats);
            setUnReadChatCounts(countUnreadChats(_allChats));
        }
    };
    const [unReadChatCounts, setUnReadChatCounts] = useState<Record<string, number>>();
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

    // Chat count icon on the sidebar
    const [unReadChatAndActivityCounts, setUnReadChatAndActivityCounts] = useState<number>(0);
    useEffect(() => {
        if (unReadChatCounts) {
            // 1: DM, 2: GM, 3: PM
            setUnReadChatAndActivityCounts(
                (unReadChatCounts[1] || 0 + unReadChatCounts[2] || 0 + unReadChatCounts[3] || 0) +
                    unReadActivityMessageCounts
            );
        }
    }, [unReadChatCounts, unReadActivityMessageCounts]);

    const funcSetTeamMembers = async () => {
        const teamMembers: UserProps[] = await popTeamMembers(myself);
        if (teamMembers) {
            setTeamMembers(teamMembers);
        }
    };

    // Load the current team info
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

    useEffect(() => {
        funcSetInboxItems();
        funcSetAllChats();
        funcSetActivityMessages();
    }, []);

    // Auto save task body every Nms if needed
    useEffect(() => {
        setTimeout(() => {
            funcSetAllChats();
        }, 500); // wait 500ms
    }, [currentMainChat, currentSubChat]);

    useEffect(() => {
        initCurrentTeam();

        if (myself.teamId !== currentTeamId) {
            setIsLoading(true);
            setCurrentTeamId(myself.teamId);
        }
    }, [myself]);

    useEffect(() => {
        if (isLoading === false) {
            funcSetInboxItems();
            funcSetAllChats();
            funcSetActivityMessages();

            // Load all team users
            funcSetTeamMembers();
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
                        tabChatNotes={tabChatNotes}
                        setTabChatNotes={setTabChatNotes}
                        selectedTabIndex={selectedTabIndex}
                        setSelectedTabIndex={setSelectedTabIndex}
                        handleCreateNewNote={handleCreateNewNote}
                        currentChatNoteChain={currentChatNoteChain}
                    />
                ) : null}

                {openingService === 2 ? (
                    <TaskHome
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
                        currentNote={currentMyNote}
                        setCurrentNote={setCurrentMyNote}
                        currentNoteTitle={currentMyNoteTitle}
                        setCurrentNoteTitle={setCurrentMyNoteTitle}
                        myNoteMeta={myNoteMeta}
                        setMyNoteMeta={setMyNoteMeta}
                        taskNoteMeta={taskNoteMeta}
                        setTaskNoteMeta={setTaskNoteMeta}
                        chatNoteMeta={chatNoteMeta}
                        setChatNoteMeta={setChatNoteMeta}
                        tabMyNotes={tabMyNotes}
                        setTabMyNotes={setTabMyNotes}
                        selectedTabIndex={selectedTabIndex}
                        setSelectedTabIndex={setSelectedTabIndex}
                        newlyCreatedMyNotes={newlyCreatedMyNotes}
                        setNewlyCreatedMyNotes={setNewlyCreatedMyNotes}
                        handleCreateNewNote={handleCreateNewNote}
                        currentMyNoteChain={currentMyNoteChain}
                        setCurrentMyNoteChain={setCurrentMyNoteChain}
                        unReadInboxItemCount={unReadInboxItemCount}
                        unReadChatAndActivityCounts={unReadChatAndActivityCounts}
                    />
                ) : null}
            </CssVarsProvider>
        </div>
    );
};
