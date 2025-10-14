import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Box, Sheet, IconButton } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

import { ThreadPane } from "./ThreadChatPane";
import { ChatSidebar } from "./components/ChatSidebar";
import { MessagesPane } from "./MainChatPane";
import { MessagesSubPane } from "./SubChatPane";
import { Team, UserProps } from "../../types/admin";
import {
    ActivityMessageProps,
    AllChatProps,
    ChatProps,
    FlaggedMessageProps,
    ThreadProps,
    ToDoFactProps,
} from "../../types/chat";
import { TaskProps, ProjectProps } from "../../types/tasks";
import { ModalCreateTag } from "../tasks/components/modals/ModalCreateTag";
import { ModalCreateProject } from "../tasks/components/modals/ModalCreateProject";
import { CreateTaskForm } from "../tasks/components/contents/CreateTaskForm";
import { TaskPreview } from "../tasks/components/contents/TaskPreview";
import { Sidebar } from "../../components/layout/sidebar";
import { ChatNoteMain } from "../notes/components/ChatNoteMain";
import { loadTodo } from "./services/loadTodo";
import { extractYYYYMMDD } from "../../utils/dateUtils";
import { useAuth } from "../../context/AuthContext";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";

type ChatHomeProps = {
    currentTeam: Team;
    setCurrentTeam: (value: Team) => void;
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    teamMembers: UserProps[];
    setTeamMembers: (value: UserProps[]) => void;
    CM: ChatManagementState;
    openingService: number;
    setOpeningService: (service: number) => void;
    isCommentUpdated: { isUpdate: boolean; scrollToBottom: boolean };
    setIsCommentUpdated: (value: { isUpdate: boolean; scrollToBottom: boolean }) => void;
    unReadInboxItemCount: number;
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };
    setIsCreatingTask: (value: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    }) => void;
    currentPreviewTaskId: number;
    setCurrentPreviewTaskId: (value: number) => void;
    currentPreviewTask: TaskProps | undefined;
    setCurrentPreviewTask: (value: TaskProps | undefined) => void;
    setOpenCreateTag: (value: boolean) => void;
    isNewTagCreated: boolean;
    setIsNewTagCreated: (value: boolean) => void;
    openCreateTag: boolean;
    initialEmptyTaskId?: number;
    setInitialEmptyTaskId: (value: number | undefined) => void;
    NM: NoteManagementState;
    PM: ProjectManagementState;
    setIsTaskPreviewVisible: (value: boolean) => void;
    isTaskPreviewVisible: boolean;
};

export const ChatHome = (props: ChatHomeProps) => {
    const {
        currentTeam,
        setCurrentTeam,
        teamMemberProfiles,
        socket,
        myself,
        setMyself,
        teamMembers,
        setTeamMembers,
        openingService,
        setOpeningService,
        CM,
        isCommentUpdated,
        setIsCommentUpdated,
        unReadInboxItemCount,
        isCreatingTask,
        setIsCreatingTask,
        currentPreviewTaskId,
        setCurrentPreviewTaskId,
        currentPreviewTask,
        setCurrentPreviewTask,
        setOpenCreateTag,
        isNewTagCreated,
        setIsNewTagCreated,
        openCreateTag,
        initialEmptyTaskId,
        setInitialEmptyTaskId,
        NM,
        PM,
        setIsTaskPreviewVisible,
        isTaskPreviewVisible,
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
        if (currentPreviewTask) {
            setCurrentThreadChatId(Number(currentPreviewTask.id));
        }
    }, [currentPreviewTask]);

    /////////////////// NEED FOR MAIN/SUB Chat Pane height ////////////////////
    const [mainChatPanelSize, setMainChatPanelSize] = useState(50);
    const [subChatPanelSize, setSubChatPanelSize] = useState(50);
    const useWindowSize = () => {
        const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

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
                currentTeam={currentTeam}
                setCurrentTeam={setCurrentTeam}
                teamMemberProfiles={teamMemberProfiles}
                socket={socket}
                myself={myself}
                setMyself={setMyself}
                openingService={openingService}
                setOpeningService={setOpeningService}
                setCurrentMainChat={CM.setCurrentMainChat}
                unReadInboxItemCount={unReadInboxItemCount}
                unReadChatAndActivityCounts={CM.unReadChatAndActivityCounts}
            />

            <PanelGroup autoSaveId="conditional" direction="horizontal">
                {/* Chat Sidebar pane which is always visible */}
                <Panel id={"1"} order={1} minSize={20} maxSize={30}>
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
                                teamMemberProfiles={teamMemberProfiles}
                                myself={myself}
                                setMyself={setMyself}
                                currentChatPaneType={CM.currentChatPaneType}
                                setCurrentChatPaneType={CM.setCurrentChatPaneType}
                                activityMessages={CM.activityMessages}
                                setActivityMessages={CM.setActivityMessages}
                                allChats={CM.allChats}
                                setAllChats={CM.setAllChats}
                                setCurrentMainChat={CM.setCurrentMainChat}
                                setCurrentSubChat={CM.setCurrentSubChat}
                                setCurrentThreadChat={CM.setCurrentThreadChat}
                                currentMainChat={CM.currentMainChat}
                                currentSubChat={
                                    CM.currentSubChat ? CM.currentSubChat : CM.currentMainChat
                                }
                                socket={socket}
                                setIsMainChatVisible={CM.setIsMainChatVisible}
                                isSubChatVisible={CM.isSubChatVisible}
                                setIsSubChatVisible={CM.setIsSubChatVisible}
                                setIsThreadVisible={CM.setIsThreadVisible}
                                isThreadVisible={CM.isThreadVisible}
                                setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                isTaskPreviewVisible={isTaskPreviewVisible}
                                isCreatingTask={isCreatingTask}
                                setOpeningService={setOpeningService}
                                setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                setCurrentProject={PM.setCurrentProject}
                                unReadChatCounts={CM.unReadChatCounts}
                                unReadActivityMessageCounts={CM.unReadActivityMessageCounts}
                                funcSetAllChats={CM.funcSetAllChats}
                                incompleteTodoCount={incompleteTodoCount}
                                setIsToDoVisible={setIsToDoVisible}
                                flaggedMessages={CM.flaggedMessages}
                                setFlaggedMessages={CM.setFlaggedMessages}
                            />
                        </Sheet>
                    </Box>
                </Panel>

                {/* Main Chat and Sub Chat Pane */}
                {CM.isMainChatVisible === true && (
                    <>
                        <PanelResizeHandle
                            key="main-chat-resize-handle"
                            style={{
                                width: "1px",
                                backgroundColor: mode === "dark" ? "black" : "white",
                                transition: "all 0.3s ease-in-out",
                                cursor: "col-resize",
                            }}
                            className="chat-resize-handle"
                        />
                        <Panel id={"2"} order={2} minSize={25} maxSize={90}>
                            <PanelGroup autoSaveId="conditional" direction="vertical">
                                {/* Sub Chat Pane */}
                                {CM.isSubChatVisible === true && (
                                    <>
                                        <Panel
                                            id={"3"}
                                            order={3}
                                            minSize={30}
                                            maxSize={80}
                                            onResize={setSubChatPanelSize}
                                        >
                                            <MessagesSubPane
                                                teamMemberProfiles={teamMemberProfiles}
                                                currentWindowHeight={height}
                                                paneSizePCT={subChatPanelSize}
                                                myself={myself}
                                                setMyself={setMyself}
                                                teamMembers={teamMembers}
                                                chat={CM.currentMainChat}
                                                subChat={
                                                    CM.currentSubChat
                                                        ? CM.currentSubChat
                                                        : CM.currentMainChat
                                                }
                                                socket={socket}
                                                setCurrentMainChat={CM.setCurrentMainChat}
                                                setCurrentSubChat={CM.setCurrentSubChat}
                                                currentSubChat={CM.currentSubChat}
                                                currentThreadChat={CM.currentThreadChat}
                                                setCurrentThreadChat={CM.setCurrentThreadChat}
                                                isThreadVisible={CM.isThreadVisible}
                                                setIsMainChatVisible={CM.setIsMainChatVisible}
                                                setIsSubChatVisible={CM.setIsSubChatVisible}
                                                setIsThreadVisible={CM.setIsThreadVisible}
                                                setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                                isCreatingTask={isCreatingTask}
                                                setIsCreatingTask={setIsCreatingTask}
                                                currentSubChatId={currentSubChatId}
                                                setCurrentPreviewTask={setCurrentPreviewTask}
                                                setOpeningService={setOpeningService}
                                                funcSetAllChats={CM.funcSetAllChats}
                                                setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                                setCurrentProject={PM.setCurrentProject}
                                                isToDoVisible={isToDoVisible}
                                                setIsToDoVisible={setIsToDoVisible}
                                                todos={todos}
                                                setTodos={setTodos}
                                                isExistingTodaysTodo={isExistingTodaysTodo}
                                                setIsExistingTodaysTodo={setIsExistingTodaysTodo}
                                                incompleteTodoCount={incompleteTodoCount}
                                                flaggedMessages={CM.flaggedMessages}
                                                setFlaggedMessages={CM.setFlaggedMessages}
                                            />
                                        </Panel>

                                        <PanelResizeHandle
                                            key="sub-chat-resize-handle"
                                            style={{
                                                width: "1px",
                                                backgroundColor:
                                                    mode === "dark" ? "black" : "white",
                                                transition: "all 0.3s ease-in-out",
                                                cursor: "col-resize",
                                            }}
                                            className="chat-resize-handle-ver"
                                        />
                                    </>
                                )}

                                {/* Main Chat Pane */}
                                <Panel
                                    id={"4"}
                                    order={4}
                                    minSize={30}
                                    maxSize={80}
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
                                                    component="button"
                                                    variant="soft"
                                                    color="neutral"
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
                                            teamMemberProfiles={teamMemberProfiles}
                                            currentWindowHeight={height}
                                            paneSizePCT={mainChatPanelSize}
                                            chat={CM.currentMainChat}
                                            subChat={
                                                CM.currentSubChat
                                                    ? CM.currentSubChat
                                                    : CM.currentMainChat
                                            }
                                            myself={myself}
                                            setMyself={setMyself}
                                            teamMembers={teamMembers}
                                            socket={socket}
                                            currentMainChat={CM.currentMainChat}
                                            setCurrentMainChat={CM.setCurrentMainChat}
                                            setCurrentSubChat={CM.setCurrentSubChat}
                                            currentThreadChat={CM.currentThreadChat}
                                            setCurrentThreadChat={CM.setCurrentThreadChat}
                                            isThreadVisible={CM.isThreadVisible}
                                            setIsMainChatVisible={CM.setIsMainChatVisible}
                                            setIsThreadVisible={CM.setIsThreadVisible}
                                            isCreatingTask={isCreatingTask}
                                            setIsCreatingTask={setIsCreatingTask}
                                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                            isSubChatVisible={CM.isSubChatVisible}
                                            setIsSubChatVisible={CM.setIsSubChatVisible}
                                            currentMainChatId={currentMainChatId}
                                            setCurrentPreviewTask={setCurrentPreviewTask}
                                            setOpeningService={setOpeningService}
                                            funcSetAllChats={CM.funcSetAllChats}
                                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                            setCurrentProject={PM.setCurrentProject}
                                            setIsToDoVisible={setIsToDoVisible}
                                            isToDoVisible={isToDoVisible}
                                            todos={todos}
                                            setTodos={setTodos}
                                            isExistingTodaysTodo={isExistingTodaysTodo}
                                            setIsExistingTodaysTodo={setIsExistingTodaysTodo}
                                            incompleteTodoCount={incompleteTodoCount}
                                            flaggedMessages={CM.flaggedMessages}
                                            setFlaggedMessages={CM.setFlaggedMessages}
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
                            style={{
                                width: "1px",
                                backgroundColor: mode === "dark" ? "black" : "white",
                                transition: "all 0.3s ease-in-out",
                                cursor: "col-resize",
                            }}
                            className="chat-resize-handle"
                        />
                        <Panel id={"5"} order={5} minSize={25} maxSize={70}>
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
                                    teamMemberProfiles={teamMemberProfiles}
                                    currentWindowHeight={height}
                                    thread={CM.currentThreadChat}
                                    myself={myself}
                                    setMyself={setMyself}
                                    socket={socket}
                                    teamMembers={teamMembers}
                                    currentThreadChat={CM.currentThreadChat}
                                    setCurrentThreadChat={CM.setCurrentThreadChat}
                                    setIsThreadVisible={CM.setIsThreadVisible}
                                    currentThreadChatId={currentThreadChatId}
                                    setIsMainChatVisible={CM.setIsMainChatVisible}
                                    setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                    isTaskPreviewVisible={isTaskPreviewVisible}
                                    isCreatingTask={isCreatingTask}
                                    setIsCreatingTask={setIsCreatingTask}
                                    currentPreviewTask={currentPreviewTask}
                                    setOpeningService={setOpeningService}
                                    setCurrentMainChat={CM.setCurrentMainChat}
                                    currentPreviewTaskId={currentPreviewTaskId}
                                    isChatNoteVisibleInChat={CM.isChatNoteVisibleInChat}
                                    setIsChatNoteVisibleInChat={CM.setIsChatNoteVisibleInChat}
                                    handleCreateNewChatNoteIfNotExist={
                                        NM.handleCreateNewChatNoteIfNotExist
                                    }
                                    flaggedMessages={CM.flaggedMessages}
                                    setFlaggedMessages={CM.setFlaggedMessages}
                                />
                            </Box>
                        </Panel>
                    </>
                )}

                {/* Create Task Pane */}
                {isCreatingTask.flag === true && (
                    <>
                        <PanelResizeHandle
                            key="create-task-resize-handle"
                            style={{
                                width: "1px",
                                backgroundColor: mode === "dark" ? "black" : "white",
                                transition: "all 0.3s ease-in-out",
                                cursor: "col-resize",
                            }}
                            className="chat-resize-handle"
                        />

                        <Panel id={"6"} order={6} minSize={30} maxSize={70}>
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
                                    teamMembers={teamMembers}
                                    setTeamMembers={setTeamMembers}
                                    teamMemberProfiles={teamMemberProfiles}
                                    socket={socket}
                                    myself={myself}
                                    setMyself={setMyself}
                                    currentMainChat={CM.currentMainChat}
                                    currentThreadChat={CM.currentThreadChat}
                                    chatType={CM.currentThreadChat?.chatType || -1}
                                    setIsMainChatVisible={CM.setIsMainChatVisible}
                                    isThreadVisible={CM.isThreadVisible}
                                    setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                    isCreatingTask={isCreatingTask}
                                    setIsCreatingTask={setIsCreatingTask}
                                    setOpenCreateTag={setOpenCreateTag}
                                    setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                    isNewTagCreated={isNewTagCreated}
                                    setCurrentMainChat={CM.setCurrentMainChat}
                                    setOpeningService={setOpeningService}
                                    parentTaskId={null}
                                    rootTaskId={null}
                                    initialEmptyTaskId={initialEmptyTaskId}
                                    setInitialEmptyTaskId={setInitialEmptyTaskId}
                                    moveToSpecificChat={CM.moveToSpecificChat}
                                    openingService={openingService}
                                    PM={PM}
                                />
                            </Box>
                        </Panel>
                    </>
                )}

                {/* Task Preview Pane */}
                {isTaskPreviewVisible === true && currentPreviewTask && (
                    <>
                        <PanelResizeHandle
                            key="task-preview-resize-handle"
                            style={{
                                width: "1px",
                                backgroundColor: mode === "dark" ? "black" : "white",
                                transition: "all 0.3s ease-in-out",
                                cursor: "col-resize",
                            }}
                            className="chat-resize-handle"
                        />

                        <Panel id={"7"} order={7} minSize={30} maxSize={70}>
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
                                    teamMembers={teamMembers}
                                    setTeamMembers={setTeamMembers}
                                    teamMemberProfiles={teamMemberProfiles}
                                    socket={socket}
                                    myself={myself}
                                    setMyself={setMyself}
                                    setCurrentProject={PM.setCurrentProject}
                                    currentPreviewTask={currentPreviewTask}
                                    setIsMainChatVisible={CM.setIsMainChatVisible}
                                    setIsThreadVisible={CM.setIsThreadVisible}
                                    isThreadVisible={CM.isThreadVisible}
                                    setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                    isCreatingTask={isCreatingTask}
                                    setIsCreatingTask={setIsCreatingTask}
                                    setCurrentPreviewTask={setCurrentPreviewTask}
                                    setOpenCreateProject={PM.setOpenCreateProject}
                                    setOpenCreateTag={setOpenCreateTag}
                                    setCurrentMainChat={CM.setCurrentMainChat}
                                    setOpeningService={setOpeningService}
                                    currentPreviewTaskId={currentPreviewTaskId}
                                    setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                    isCommentUpdated={isCommentUpdated}
                                    setIsCommentUpdated={setIsCommentUpdated}
                                    setIsTaskNoteVisible={NM.setIsTaskNoteVisible}
                                    handleCreateNewTaskNote={NM.handleCreateNewTaskNote}
                                    setCurrentTaskNote={NM.setCurrentTaskNote}
                                    isTaskNoteVisible={NM.isTaskNoteVisible}
                                    teamProjects={PM.teamProjects}
                                    setTeamProjects={PM.setTeamProjects}
                                    taskNoteMeta={NM.taskNoteMeta}
                                    moveToSpecificChat={CM.moveToSpecificChat}
                                    openingService={openingService}
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
                            style={{
                                width: "1px",
                                backgroundColor: mode === "dark" ? "black" : "white",
                                transition: "all 0.3s ease-in-out",
                                cursor: "col-resize",
                            }}
                            className="chat-resize-handle"
                        />

                        <Panel id={"8"} order={8} minSize={30} maxSize={90}>
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
                                    teamMemberProfiles={teamMemberProfiles}
                                    socket={socket}
                                    teamMembers={teamMembers}
                                    myself={myself}
                                    setMyself={setMyself}
                                    setOpeningService={setOpeningService}
                                    isInChatPage={true}
                                    setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                    setCurrentProject={PM.setCurrentProject}
                                    NM={NM}
                                    CM={CM}
                                />
                            </Box>
                        </Panel>
                    </>
                )}

                {/* Select Chat Pane if no pane is visible */}
                {CM.isMainChatVisible === false &&
                    CM.isThreadVisible === false &&
                    isCreatingTask.flag === false &&
                    isTaskPreviewVisible === false &&
                    CM.isChatNoteVisibleInChat === false && (
                        <>
                            <PanelResizeHandle
                                key="select-chat-resize-handle"
                                style={{
                                    width: "1px",
                                    backgroundColor: mode === "dark" ? "black" : "white",
                                    transition: "all 0.3s ease-in-out",
                                    cursor: "col-resize",
                                }}
                                className="chat-resize-handle"
                            />
                            <Panel
                                id={"9"}
                                order={9}
                                defaultSize={70}
                                minSize={30}
                                maxSize={80}
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
                                        component="button"
                                        variant="soft"
                                        color="neutral"
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
                <ModalCreateTag
                    myself={myself}
                    currentProject={PM.currentProject}
                    openCreateTag={openCreateTag}
                    setOpenCreateTag={setOpenCreateTag}
                    setIsNewTagCreated={setIsNewTagCreated}
                />
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
