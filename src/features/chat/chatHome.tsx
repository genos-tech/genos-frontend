import { useEffect, useState } from "react";
import { Box, IconButton, Sheet } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Socket } from "socket.io-client";

import { ChatSidebar } from "./components/ChatSidebar";
import { loadTodo } from "./services/loadTodo";

import { Sidebar } from "../../components/layout/sidebar";
import { useAuth } from "../../context/AuthContext";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { ToDoFactProps } from "../../types/chat";
import { extractYYYYMMDD } from "../../utils/dateUtils";
import { ChatNoteMain } from "../notes/components/ChatNoteMain";
import { CreateTaskForm } from "../tasks/components/contents/CreateTaskForm";
import { TaskPreview } from "../tasks/components/contents/TaskPreview";
import { ModalCreateProject } from "../tasks/components/modals/ModalCreateProject";
import { ModalCreateTag } from "../tasks/components/modals/ModalCreateTag";
import { MessagesPane } from "./MainChatPane";
import { MessagesSubPane } from "./SubChatPane";
import { ThreadPane } from "./ThreadChatPane";

type ChatHomeProps = {
    TEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    CM: ChatManagementState;
    openingService: number;
    setOpeningService: (service: number) => void;
    unReadInboxItemCount: number;
    NM: NoteManagementState;
    PM: ProjectManagementState;
    TM: TaskManagementState;
};

export const ChatHome = (props: ChatHomeProps) => {
    const {
        TEM,
        socket,
        myself,
        setMyself,
        openingService,
        setOpeningService,
        unReadInboxItemCount,
        CM,
        NM,
        PM,
        TM,
    } = props;

    // Common
    const { mode } = useColorScheme();
    const { accessToken } = useAuth();

    // Chat Related
    const [currentMainChatId, setCurrentMainChatId] = useState<number>(-1);
    const [currentSubChatId, setCurrentSubChatId] = useState<number>(-1);
    const [currentThreadChatId, setCurrentThreadChatId] = useState<number>(-1);
    const [isToDoVisible, setIsToDoVisible] = useState<boolean>(
        localStorage.getItem("isToDoVisible") === "true"
    );

    useEffect(() => {
        localStorage.setItem("isToDoVisible", isToDoVisible.toString());
    }, [isToDoVisible]);

    useEffect(() => {
        if (CM.currentMainChat) {
            if (currentMainChatId !== CM.currentMainChat.chatId) {
                setCurrentMainChatId(CM.currentMainChat.chatId);
            }
            if (CM.currentMainChat.project && CM.currentMainChat.project.projectId) {
                PM.setCurrentProject(CM.currentMainChat.project);
            }
        }
    }, [CM.currentMainChat]);

    useEffect(() => {
        if (CM.currentSubChat) {
            if (CM.currentSubChat !== undefined && currentSubChatId !== CM.currentSubChat.chatId) {
                setCurrentSubChatId(CM.currentSubChat.chatId);
            }
            if (CM.currentSubChat?.project && CM.currentSubChat.project.projectId) {
                PM.setCurrentProject(CM.currentSubChat.project);
            }
        }
    }, [CM.currentSubChat]);

    useEffect(() => {
        if (currentThreadChatId !== -1) {
            setCurrentThreadChatId(currentThreadChatId);
        }
    }, [CM.currentThreadChat]);

    useEffect(() => {
        if (TM.currentPreviewTask) {
            setCurrentThreadChatId(Number(TM.currentPreviewTask.id));
        }
    }, [TM.currentPreviewTask]);

    /////////////////// NEED FOR MAIN/SUB Chat Pane height ////////////////////
    const [mainChatPanelSize, setMainChatPanelSize] = useState(50);
    const [subChatPanelSize, setSubChatPanelSize] = useState(50);
    const useWindowSize = () => {
        const [size, setSize] = useState({
            width: window.innerWidth,
            height: window.innerHeight,
        });

        useEffect(() => {
            const handleResize = () => {
                setSize({ width: window.innerWidth, height: window.innerHeight });
            };

            window.addEventListener("resize", handleResize);

            // Cleanup event listener on unmount
            return () => window.removeEventListener("resize", handleResize);
        }, []);

        return size;
    };
    const { width, height } = useWindowSize();
    ////////////////////////////////////////////////////////////////////////////

    // To-Do Related
    const [todos, setTodos] = useState<ToDoFactProps[]>([]);
    const [isExistingTodaysTodo, setIsExistingTodaysTodo] = useState(false);
    const [incompleteTodoCount, setIncompleteTodoCount] = useState<number>(0);
    useEffect(() => {
        loadTodo(myself, accessToken).then((data) => {
            if (data) {
                setTodos(data);
                if (data.length > 0) {
                    setIsExistingTodaysTodo(
                        extractYYYYMMDD(data[0].tsCreatedAt) ===
                            extractYYYYMMDD(new Date().toISOString())
                    );
                }
            }
        });
    }, [myself, accessToken]);
    useEffect(() => {
        setIncompleteTodoCount(todos.filter((todo) => !todo.isCompleted).length);
    }, [todos]);

    return (
        <Box sx={{ display: "flex", minHeight: "100dvh", width: "100vw" }}>
            <Sidebar
                currentTeam={TEM.currentTeam}
                myself={myself}
                openingService={openingService}
                setCurrentMainChat={CM.setCurrentMainChat}
                setCurrentTeam={TEM.setCurrentTeam}
                setMyself={setMyself}
                setOpeningService={setOpeningService}
                socket={socket}
                teamMemberProfiles={TEM.teamMemberProfiles}
                unReadChatAndActivityCounts={CM.unReadChatAndActivityCounts}
                unReadInboxItemCount={unReadInboxItemCount}
            />

            <PanelGroup autoSaveId="conditional" direction="horizontal">
                {/* Chat Sidebar pane which is always visible */}
                <Panel id={"1"} maxSize={30} minSize={20} order={1}>
                    <Box
                        sx={{
                            height: "100%",
                            width: "100%",
                            borderColor: mode === "dark" ? "black" : "white",
                            borderRight: mode === "dark" ? "2px black groove" : "2px white groove",
                        }}
                    >
                        <Sheet
                            sx={{
                                position: { xs: "fixed", sm: "sticky" },
                                transform: {
                                    xs: "translateX(calc(100% * (var(--MessagesPane-slideIn, 0) - 1)))",
                                    sm: "none",
                                },
                                transition: "transform 0.4s, width 0.4s",
                                zIndex: 100,
                                top: 10,
                            }}
                        >
                            <ChatSidebar
                                activityMessages={CM.activityMessages}
                                allChats={CM.allChats}
                                currentChatPaneType={CM.currentChatPaneType}
                                currentMainChat={CM.currentMainChat}
                                flaggedMessages={CM.flaggedMessages}
                                funcSetAllChats={CM.funcSetAllChats}
                                incompleteTodoCount={incompleteTodoCount}
                                isCreatingTask={TM.isCreatingTask}
                                isSubChatVisible={CM.isSubChatVisible}
                                isTaskPreviewVisible={TM.isTaskPreviewVisible}
                                isThreadVisible={CM.isThreadVisible}
                                myself={myself}
                                setActivityMessages={CM.setActivityMessages}
                                setAllChats={CM.setAllChats}
                                setCurrentChatPaneType={CM.setCurrentChatPaneType}
                                setCurrentMainChat={CM.setCurrentMainChat}
                                setCurrentPreviewTaskId={TM.setCurrentPreviewTaskId}
                                setCurrentProject={PM.setCurrentProject}
                                setCurrentSubChat={CM.setCurrentSubChat}
                                setCurrentThreadChat={CM.setCurrentThreadChat}
                                setFlaggedMessages={CM.setFlaggedMessages}
                                setIsMainChatVisible={CM.setIsMainChatVisible}
                                setIsSubChatVisible={CM.setIsSubChatVisible}
                                setIsTaskPreviewVisible={TM.setIsTaskPreviewVisible}
                                setIsThreadVisible={CM.setIsThreadVisible}
                                setIsToDoVisible={setIsToDoVisible}
                                setMyself={setMyself}
                                setOpeningService={setOpeningService}
                                socket={socket}
                                teamMemberProfiles={TEM.teamMemberProfiles}
                                unReadActivityMessageCounts={CM.unReadActivityMessageCounts}
                                unReadChatCounts={CM.unReadChatCounts}
                                currentSubChat={
                                    CM.currentSubChat ? CM.currentSubChat : CM.currentMainChat
                                }
                            />
                        </Sheet>
                    </Box>
                </Panel>

                {/* Main Chat and Sub Chat Pane */}
                {CM.isMainChatVisible === true && (
                    <>
                        <PanelResizeHandle
                            key="main-chat-resize-handle"
                            className="chat-resize-handle"
                            style={{
                                width: "1px",
                                backgroundColor: mode === "dark" ? "black" : "white",
                                transition: "all 0.3s ease-in-out",
                                cursor: "col-resize",
                            }}
                        />
                        <Panel id={"2"} maxSize={90} minSize={25} order={2}>
                            <PanelGroup autoSaveId="conditional" direction="vertical">
                                {/* Sub Chat Pane */}
                                {CM.isSubChatVisible === true && (
                                    <>
                                        <Panel
                                            id={"3"}
                                            maxSize={80}
                                            minSize={30}
                                            order={3}
                                            onResize={setSubChatPanelSize}
                                        >
                                            <MessagesSubPane
                                                chat={CM.currentMainChat}
                                                currentSubChat={CM.currentSubChat}
                                                currentSubChatId={currentSubChatId}
                                                currentThreadChat={CM.currentThreadChat}
                                                currentWindowHeight={height}
                                                flaggedMessages={CM.flaggedMessages}
                                                funcSetAllChats={CM.funcSetAllChats}
                                                incompleteTodoCount={incompleteTodoCount}
                                                isCreatingTask={TM.isCreatingTask}
                                                isExistingTodaysTodo={isExistingTodaysTodo}
                                                isThreadVisible={CM.isThreadVisible}
                                                isToDoVisible={isToDoVisible}
                                                myself={myself}
                                                paneSizePCT={subChatPanelSize}
                                                setCurrentMainChat={CM.setCurrentMainChat}
                                                setCurrentPreviewTask={TM.setCurrentPreviewTask}
                                                setCurrentProject={PM.setCurrentProject}
                                                setCurrentSubChat={CM.setCurrentSubChat}
                                                setCurrentThreadChat={CM.setCurrentThreadChat}
                                                setFlaggedMessages={CM.setFlaggedMessages}
                                                setIsCreatingTask={TM.setIsCreatingTask}
                                                setIsExistingTodaysTodo={setIsExistingTodaysTodo}
                                                setIsMainChatVisible={CM.setIsMainChatVisible}
                                                setIsSubChatVisible={CM.setIsSubChatVisible}
                                                setIsThreadVisible={CM.setIsThreadVisible}
                                                setIsToDoVisible={setIsToDoVisible}
                                                setMyself={setMyself}
                                                setOpeningService={setOpeningService}
                                                setTodos={setTodos}
                                                socket={socket}
                                                teamMemberProfiles={TEM.teamMemberProfiles}
                                                teamMembers={TEM.teamMembers}
                                                todos={todos}
                                                setCurrentPreviewTaskId={
                                                    TM.setCurrentPreviewTaskId
                                                }
                                                setIsTaskPreviewVisible={
                                                    TM.setIsTaskPreviewVisible
                                                }
                                                subChat={
                                                    CM.currentSubChat
                                                        ? CM.currentSubChat
                                                        : CM.currentMainChat
                                                }
                                            />
                                        </Panel>

                                        <PanelResizeHandle
                                            key="sub-chat-resize-handle"
                                            className="chat-resize-handle-ver"
                                            style={{
                                                width: "1px",
                                                backgroundColor:
                                                    mode === "dark" ? "black" : "white",
                                                transition: "all 0.3s ease-in-out",
                                                cursor: "col-resize",
                                            }}
                                        />
                                    </>
                                )}

                                {/* Main Chat Pane */}
                                <Panel
                                    id={"4"}
                                    maxSize={80}
                                    minSize={30}
                                    order={4}
                                    onResize={setMainChatPanelSize}
                                >
                                    {/* No chat selected */}
                                    {CM.currentMainChat && CM.currentMainChat.chatId === -1 && (
                                        <>
                                            <Box
                                                sx={{
                                                    height: "100%",
                                                    display: "flex",
                                                    justifyContent: "center",
                                                    alignItems: "center",
                                                    width: "100%",
                                                }}
                                            >
                                                <IconButton
                                                    color="neutral"
                                                    component="button"
                                                    variant="soft"
                                                    sx={{
                                                        fontSize: "15px",
                                                        padding: "10px",
                                                    }}
                                                >
                                                    No Chat Selected
                                                </IconButton>
                                            </Box>
                                        </>
                                    )}

                                    {/* Chat selected */}
                                    {CM.currentMainChat && CM.currentMainChat.chatId !== -1 && (
                                        <MessagesPane
                                            chat={CM.currentMainChat}
                                            currentMainChat={CM.currentMainChat}
                                            currentMainChatId={currentMainChatId}
                                            currentThreadChat={CM.currentThreadChat}
                                            currentWindowHeight={height}
                                            flaggedMessages={CM.flaggedMessages}
                                            funcSetAllChats={CM.funcSetAllChats}
                                            incompleteTodoCount={incompleteTodoCount}
                                            isCreatingTask={TM.isCreatingTask}
                                            isExistingTodaysTodo={isExistingTodaysTodo}
                                            isSubChatVisible={CM.isSubChatVisible}
                                            isThreadVisible={CM.isThreadVisible}
                                            isToDoVisible={isToDoVisible}
                                            myself={myself}
                                            paneSizePCT={mainChatPanelSize}
                                            setCurrentMainChat={CM.setCurrentMainChat}
                                            setCurrentPreviewTask={TM.setCurrentPreviewTask}
                                            setCurrentPreviewTaskId={TM.setCurrentPreviewTaskId}
                                            setCurrentProject={PM.setCurrentProject}
                                            setCurrentSubChat={CM.setCurrentSubChat}
                                            setCurrentThreadChat={CM.setCurrentThreadChat}
                                            setFlaggedMessages={CM.setFlaggedMessages}
                                            setIsCreatingTask={TM.setIsCreatingTask}
                                            setIsExistingTodaysTodo={setIsExistingTodaysTodo}
                                            setIsMainChatVisible={CM.setIsMainChatVisible}
                                            setIsSubChatVisible={CM.setIsSubChatVisible}
                                            setIsTaskPreviewVisible={TM.setIsTaskPreviewVisible}
                                            setIsThreadVisible={CM.setIsThreadVisible}
                                            setIsToDoVisible={setIsToDoVisible}
                                            setMyself={setMyself}
                                            setOpeningService={setOpeningService}
                                            setTodos={setTodos}
                                            socket={socket}
                                            teamMemberProfiles={TEM.teamMemberProfiles}
                                            teamMembers={TEM.teamMembers}
                                            todos={todos}
                                            subChat={
                                                CM.currentSubChat
                                                    ? CM.currentSubChat
                                                    : CM.currentMainChat
                                            }
                                        />
                                    )}
                                </Panel>
                            </PanelGroup>
                        </Panel>
                    </>
                )}

                {/* Thread Chat Pane */}
                {CM.isThreadVisible === true && CM.currentThreadChat && (
                    <>
                        <PanelResizeHandle
                            key="thread-chat-resize-handle"
                            className="chat-resize-handle"
                            style={{
                                width: "1px",
                                backgroundColor: mode === "dark" ? "black" : "white",
                                transition: "all 0.3s ease-in-out",
                                cursor: "col-resize",
                            }}
                        />
                        <Panel id={"5"} maxSize={70} minSize={25} order={5}>
                            <Box
                                sx={{
                                    height: "100%",
                                    backgroundColor: "black",
                                    borderColor: mode === "dark" ? "black" : "white",
                                    borderLeft:
                                        mode === "dark" ? "2px black groove" : "2px white groove",
                                }}
                            >
                                <ThreadPane
                                    currentThreadChat={CM.currentThreadChat}
                                    currentThreadChatId={currentThreadChatId}
                                    currentWindowHeight={height}
                                    flaggedMessages={CM.flaggedMessages}
                                    isChatNoteVisibleInChat={CM.isChatNoteVisibleInChat}
                                    myself={myself}
                                    setCurrentMainChat={CM.setCurrentMainChat}
                                    setCurrentThreadChat={CM.setCurrentThreadChat}
                                    setFlaggedMessages={CM.setFlaggedMessages}
                                    setIsChatNoteVisibleInChat={CM.setIsChatNoteVisibleInChat}
                                    setIsMainChatVisible={CM.setIsMainChatVisible}
                                    setIsThreadVisible={CM.setIsThreadVisible}
                                    setMyself={setMyself}
                                    setOpeningService={setOpeningService}
                                    socket={socket}
                                    teamMemberProfiles={TEM.teamMemberProfiles}
                                    teamMembers={TEM.teamMembers}
                                    thread={CM.currentThreadChat}
                                    TM={TM}
                                    handleCreateNewChatNoteIfNotExist={
                                        NM.handleCreateNewChatNoteIfNotExist
                                    }
                                />
                            </Box>
                        </Panel>
                    </>
                )}

                {/* Create Task Pane */}
                {TM.isCreatingTask.flag === true && (
                    <>
                        <PanelResizeHandle
                            key="create-task-resize-handle"
                            className="chat-resize-handle"
                            style={{
                                width: "1px",
                                backgroundColor: mode === "dark" ? "black" : "white",
                                transition: "all 0.3s ease-in-out",
                                cursor: "col-resize",
                            }}
                        />

                        <Panel id={"6"} maxSize={70} minSize={30} order={6}>
                            <Box
                                sx={{
                                    px: { xs: 1, md: 2 },
                                    pt: {
                                        xs: "calc(12px + var(--Header-height))",
                                        sm: "calc(12px + var(--Header-height))",
                                        md: 2,
                                    },
                                    pb: { xs: 2, sm: 2, md: 1 },
                                    flex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    minWidth: 0,
                                    height: "100dvh",
                                    gap: 1,
                                    ml: "1px",
                                    boxShadow: "0 0 0 1px grey",
                                    borderColor: mode === "dark" ? "black" : "white",
                                }}
                            >
                                <CreateTaskForm
                                    chatType={CM.currentThreadChat?.chatType || -1}
                                    currentMainChat={CM.currentMainChat}
                                    currentThreadChat={CM.currentThreadChat}
                                    isThreadVisible={CM.isThreadVisible}
                                    moveToSpecificChat={CM.moveToSpecificChat}
                                    myself={myself}
                                    openingService={openingService}
                                    parentTaskId={null}
                                    PM={PM}
                                    rootTaskId={null}
                                    setCurrentMainChat={CM.setCurrentMainChat}
                                    setIsMainChatVisible={CM.setIsMainChatVisible}
                                    setMyself={setMyself}
                                    setOpeningService={setOpeningService}
                                    setTeamMembers={TEM.setTeamMembers}
                                    socket={socket}
                                    teamMemberProfiles={TEM.teamMemberProfiles}
                                    teamMembers={TEM.teamMembers}
                                    TM={TM}
                                />
                            </Box>
                        </Panel>
                    </>
                )}

                {/* Task Preview Pane */}
                {TM.isTaskPreviewVisible === true && TM.currentPreviewTask && (
                    <>
                        <PanelResizeHandle
                            key="task-preview-resize-handle"
                            className="chat-resize-handle"
                            style={{
                                width: "1px",
                                backgroundColor: mode === "dark" ? "black" : "white",
                                transition: "all 0.3s ease-in-out",
                                cursor: "col-resize",
                            }}
                        />

                        <Panel id={"7"} maxSize={70} minSize={30} order={7}>
                            <Box
                                sx={{
                                    px: { xs: 1, md: 2 },
                                    pt: {
                                        xs: "calc(12px + var(--Header-height))",
                                        sm: "calc(12px + var(--Header-height))",
                                        md: 2,
                                    },
                                    pb: { xs: 2, sm: 2, md: 3 },
                                    flex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    minWidth: 0,
                                    height: "100dvh",
                                    gap: 1,
                                    ml: "1px",
                                    boxShadow: "0 0 0 1px grey",
                                    borderColor: mode === "dark" ? "black" : "white",
                                }}
                            >
                                <TaskPreview
                                    handleCreateNewTaskNote={NM.handleCreateNewTaskNote}
                                    isTaskNoteVisible={NM.isTaskNoteVisible}
                                    isThreadVisible={CM.isThreadVisible}
                                    moveToSpecificChat={CM.moveToSpecificChat}
                                    myself={myself}
                                    openingService={openingService}
                                    setCurrentMainChat={CM.setCurrentMainChat}
                                    setCurrentProject={PM.setCurrentProject}
                                    setCurrentTaskNote={NM.setCurrentTaskNote}
                                    setIsMainChatVisible={CM.setIsMainChatVisible}
                                    setIsTaskNoteVisible={NM.setIsTaskNoteVisible}
                                    setIsThreadVisible={CM.setIsThreadVisible}
                                    setMyself={setMyself}
                                    setOpenCreateProject={PM.setOpenCreateProject}
                                    setOpeningService={setOpeningService}
                                    setTeamMembers={TEM.setTeamMembers}
                                    setTeamProjects={PM.setTeamProjects}
                                    socket={socket}
                                    taskNoteMeta={NM.taskNoteMeta}
                                    teamMemberProfiles={TEM.teamMemberProfiles}
                                    teamMembers={TEM.teamMembers}
                                    teamProjects={PM.teamProjects}
                                    TM={TM}
                                />
                            </Box>
                        </Panel>
                    </>
                )}

                {/* Chat Note Pane */}
                {CM.isChatNoteVisibleInChat === true && (
                    <>
                        <PanelResizeHandle
                            key="chat-note-resize-handle"
                            className="chat-resize-handle"
                            style={{
                                width: "1px",
                                backgroundColor: mode === "dark" ? "black" : "white",
                                transition: "all 0.3s ease-in-out",
                                cursor: "col-resize",
                            }}
                        />

                        <Panel id={"8"} maxSize={90} minSize={30} order={8}>
                            <Box
                                sx={{
                                    px: { xs: 1, md: 2 },
                                    pt: {
                                        xs: "calc(12px + var(--Header-height))",
                                        sm: "calc(12px + var(--Header-height))",
                                        md: 2,
                                    },
                                    pb: { xs: 2, sm: 2, md: 3 },
                                    flex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    minWidth: 0,
                                    height: "100dvh",
                                    gap: 1,
                                    ml: "1px",
                                    boxShadow: "0 0 0 1px grey",
                                    borderColor: mode === "dark" ? "black" : "white",
                                }}
                            >
                                <ChatNoteMain
                                    CM={CM}
                                    isInChatPage={true}
                                    myself={myself}
                                    NM={NM}
                                    setCurrentPreviewTaskId={TM.setCurrentPreviewTaskId}
                                    setCurrentProject={PM.setCurrentProject}
                                    setMyself={setMyself}
                                    setOpeningService={setOpeningService}
                                    socket={socket}
                                    teamMemberProfiles={TEM.teamMemberProfiles}
                                    teamMembers={TEM.teamMembers}
                                />
                            </Box>
                        </Panel>
                    </>
                )}

                {/* Select Chat Pane if no pane is visible */}
                {CM.isMainChatVisible === false &&
                    CM.isThreadVisible === false &&
                    TM.isCreatingTask.flag === false &&
                    TM.isTaskPreviewVisible === false &&
                    CM.isChatNoteVisibleInChat === false && (
                        <>
                            <PanelResizeHandle
                                key="select-chat-resize-handle"
                                className="chat-resize-handle"
                                style={{
                                    width: "1px",
                                    backgroundColor: mode === "dark" ? "black" : "white",
                                    transition: "all 0.3s ease-in-out",
                                    cursor: "col-resize",
                                }}
                            />
                            <Panel
                                defaultSize={70}
                                id={"9"}
                                maxSize={80}
                                minSize={30}
                                order={9}
                                onResize={setMainChatPanelSize}
                            >
                                <Box
                                    sx={{
                                        height: "100%",
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        width: "100%",
                                    }}
                                >
                                    <IconButton
                                        color="neutral"
                                        component="button"
                                        variant="soft"
                                        sx={{
                                            fontSize: "15px",
                                            padding: "10px",
                                        }}
                                    >
                                        No Chat Selected
                                    </IconButton>
                                </Box>
                            </Panel>
                        </>
                    )}

                {/* Modal for creating a new project */}
                <ModalCreateProject myself={myself} PM={PM} />

                {/* Modal for creating a new tag */}
                <ModalCreateTag currentProject={PM.currentProject} myself={myself} TM={TM} />
            </PanelGroup>

            {/* Hover Animation with CSS */}
            <style>
                {`
                .chat-resize-handle {
                    transition: all 0.3s ease-in-out;
                }
                .chat-resize-handle:hover {
                    background-color: lightgray !important;
                    width: 8px !important;
                }
                `}
            </style>
        </Box>
    );
};
