import { useEffect, useState } from "react";
import { Box, Sheet } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Panel, PanelGroup } from "react-resizable-panels";
import { Socket } from "socket.io-client";

import { ChatProvider } from "./context/ChatContext";
import { ChatSidebar } from "./components/list/ChatSidebar";
import { ChatNotePanel } from "./components/panels/ChatNotePanel";
import { CreateTaskPanel } from "./components/panels/CreateTaskPanel";
import { MainChatPanel } from "./components/panels/MainChatPanel";
import { SelectChatPanel } from "./components/panels/SelectChatPanel";
import { SubChatPanel } from "./components/panels/SubChatPanel";
import { TaskPreviewPanel } from "./components/panels/TaskPreviewPanel";
import { ThreadPanel } from "./components/panels/ThreadPanel";
import { ResizeHandle } from "./components/shared/ResizeHandle";

import { Sidebar } from "../../components/layout/sidebar";
import { useAuth } from "../../context/AuthContext";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { InboxManagementState } from "../../hooks/inbox/useInboxManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { usePanelSizes } from "../../hooks/usePanelSizes";
import { useTodos } from "../../hooks/useTodos";
import { useWindowSize } from "../../hooks/useWindowSize";
import { UserProps } from "../../types/admin";
import { ModalCreateProject } from "../tasks/components/modals/ModalCreateProject";
import { ModalCreateTag } from "../tasks/components/modals/ModalCreateTag";

type ChatHomeProps = {
    TEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    CM: ChatManagementState;
    UIM: UIStateManagementState;
    IM: InboxManagementState;
    NM: NoteManagementState;
    PM: ProjectManagementState;
    TM: TaskManagementState;
};

export const ChatHome = (props: ChatHomeProps) => {
    const { TEM, socket, myself, setMyself, UIM, IM, CM, NM, PM, TM } = props;

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

    // Custom hooks
    const { width, height } = useWindowSize();
    const { mainChatPanelSize, setMainChatPanelSize, subChatPanelSize, setSubChatPanelSize } =
        usePanelSizes();
    const { todos, setTodos, isExistingTodaysTodo, setIsExistingTodaysTodo, incompleteTodoCount } =
        useTodos(myself, accessToken, isToDoVisible);

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

    return (
        <ChatProvider
            CM={CM}
            myself={myself}
            NM={NM}
            PM={PM}
            setMyself={setMyself}
            socket={socket}
            TEM={TEM}
            TM={TM}
            UIM={UIM}
        >
            <Box sx={{ display: "flex", minHeight: "100dvh", width: "100vw" }}>
                <Sidebar
                    CM={CM}
                    IM={IM}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    TEM={TEM}
                    UIM={UIM}
                />

                <PanelGroup autoSaveId="conditional" direction="horizontal">
                    {/* Chat Sidebar pane which is always visible */}
                    <Panel id={"1"} maxSize={30} minSize={20} order={1}>
                        <Box
                            sx={{
                                height: "100%",
                                width: "100%",
                                borderColor: mode === "dark" ? "black" : "white",
                                borderRight:
                                    mode === "dark" ? "2px black inset" : "2px lightgrey inset",
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
                                    CM={CM}
                                    incompleteTodoCount={incompleteTodoCount}
                                    myself={myself}
                                    setCurrentProject={PM.setCurrentProject}
                                    setIsToDoVisible={setIsToDoVisible}
                                    setMyself={setMyself}
                                    socket={socket}
                                    TEM={TEM}
                                    UIM={UIM}
                                    TM={TM}
                                />
                            </Sheet>
                        </Box>
                    </Panel>

                    {/* Main Chat and Sub Chat Pane */}
                    {CM.isMainChatVisible === true && (
                        <>
                            <ResizeHandle key="main-chat-resize-handle" />
                            <Panel id={"2"} maxSize={90} minSize={25} order={2}>
                                <PanelGroup autoSaveId="conditional" direction="vertical">
                                    {/* Sub Chat Pane */}
                                    {CM.isSubChatVisible === true && (
                                        <>
                                            <SubChatPanel
                                                CM={CM}
                                                currentSubChatId={currentSubChatId}
                                                currentWindowHeight={height}
                                                incompleteTodoCount={incompleteTodoCount}
                                                isExistingTodaysTodo={isExistingTodaysTodo}
                                                isToDoVisible={isToDoVisible}
                                                myself={myself}
                                                PM={PM}
                                                setIsExistingTodaysTodo={setIsExistingTodaysTodo}
                                                setMyself={setMyself}
                                                setSubChatPanelSize={setSubChatPanelSize}
                                                setTodos={setTodos}
                                                socket={socket}
                                                subChatPanelSize={subChatPanelSize}
                                                TEM={TEM}
                                                TM={TM}
                                                todos={todos}
                                                UIM={UIM}
                                            />
                                            <ResizeHandle
                                                key="sub-chat-resize-handle"
                                                className="chat-resize-handle-ver"
                                            />
                                        </>
                                    )}

                                    {/* Main Chat Pane */}
                                    <MainChatPanel
                                        CM={CM}
                                        currentMainChatId={currentMainChatId}
                                        currentWindowHeight={height}
                                        incompleteTodoCount={incompleteTodoCount}
                                        isExistingTodaysTodo={isExistingTodaysTodo}
                                        isToDoVisible={isToDoVisible}
                                        mainChatPanelSize={mainChatPanelSize}
                                        myself={myself}
                                        PM={PM}
                                        setIsExistingTodaysTodo={setIsExistingTodaysTodo}
                                        setIsToDoVisible={setIsToDoVisible}
                                        setMainChatPanelSize={setMainChatPanelSize}
                                        setMyself={setMyself}
                                        setTodos={setTodos}
                                        socket={socket}
                                        TEM={TEM}
                                        TM={TM}
                                        todos={todos}
                                        UIM={UIM}
                                    />
                                </PanelGroup>
                            </Panel>
                        </>
                    )}

                    {/* Thread Chat Pane */}
                    {CM.isThreadVisible === true && CM.currentThreadChat && (
                        <>
                            <ResizeHandle key="thread-chat-resize-handle" />
                            <ThreadPanel
                                CM={CM}
                                currentThreadChatId={currentThreadChatId}
                                currentWindowHeight={height}
                                myself={myself}
                                NM={NM}
                                setMyself={setMyself}
                                socket={socket}
                                TEM={TEM}
                                TM={TM}
                                UIM={UIM}
                            />
                        </>
                    )}

                    {/* Create Task Pane */}
                    {TM.isCreatingTask.flag === true && (
                        <>
                            <ResizeHandle key="create-task-resize-handle" />
                            <CreateTaskPanel
                                CM={CM}
                                myself={myself}
                                PM={PM}
                                setMyself={setMyself}
                                socket={socket}
                                TEM={TEM}
                                TM={TM}
                                UIM={UIM}
                            />
                        </>
                    )}

                    {/* Task Preview Pane */}
                    {TM.isTaskPreviewVisible === true && TM.currentPreviewTask && (
                        <>
                            <ResizeHandle key="task-preview-resize-handle" />
                            <TaskPreviewPanel
                                CM={CM}
                                myself={myself}
                                NM={NM}
                                PM={PM}
                                setMyself={setMyself}
                                socket={socket}
                                TEM={TEM}
                                TM={TM}
                                UIM={UIM}
                            />
                        </>
                    )}

                    {/* Chat Note Pane */}
                    {CM.isChatNoteVisibleInChat === true && (
                        <>
                            <ResizeHandle key="chat-note-resize-handle" />
                            <ChatNotePanel
                                CM={CM}
                                myself={myself}
                                NM={NM}
                                PM={PM}
                                setMyself={setMyself}
                                socket={socket}
                                TEM={TEM}
                                TM={TM}
                                UIM={UIM}
                            />
                        </>
                    )}

                    {/* Select Chat Pane if no pane is visible */}
                    {CM.isMainChatVisible === false &&
                        CM.isThreadVisible === false &&
                        TM.isCreatingTask.flag === false &&
                        TM.isTaskPreviewVisible === false &&
                        CM.isChatNoteVisibleInChat === false && (
                            <>
                                <ResizeHandle key="select-chat-resize-handle" />
                                <SelectChatPanel
                                    mainChatPanelSize={mainChatPanelSize}
                                    setMainChatPanelSize={setMainChatPanelSize}
                                />
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
                        background-color: grey !important;
                        width: 8px !important;
                    }
                    `}
                </style>
            </Box>
        </ChatProvider>
    );
};
