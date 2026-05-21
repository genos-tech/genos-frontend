import { useEffect, useState } from "react";
import { Box, Sheet, Snackbar } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Panel, PanelGroup } from "react-resizable-panels";
import { Socket } from "socket.io-client";

import { ChatProvider } from "./context/ChatContext";
import { ChatNotePanel } from "./components/panels/ChatNotePanel";
import { CreateTaskPanel } from "./components/panels/CreateTaskPanel";
import { MainChatPanel } from "./components/panels/MainChatPanel";
import { SelectChatPanel } from "./components/panels/SelectChatPanel";
import { SubChatPanel } from "./components/panels/SubChatPanel";
import { TaskPreviewPanel } from "./components/panels/TaskPreviewPanel";
import { ThreadPanel } from "./components/panels/ThreadPanel";
import { ResizeHandle } from "./components/shared/ResizeHandle";
import { ChatSidebar } from "./components/sidebar/ChatSidebar";
import { useChatRouting } from "./hooks/useChatRouting";
import { appendTodoContent, createNewTodo } from "./services/createNewTodo";
import { getFirstLine } from "./utils/common";
import { defaultTodoContent } from "./utils/defaults";

import { LayoutStyles } from "../../components/ui/styles/commonStyle";
import { useAuth } from "../../context/AuthContext";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { InboxManagementState } from "../../hooks/inbox/useInboxManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { usePanelSizes } from "../../hooks/usePanelSizes";
import { useTodos } from "../../hooks/useTodos";
import { useWindowSize } from "../../hooks/useWindowSize";
import { UserProps } from "../../types/admin";
import { MessageProps, ThreadMessageProps, ToDoFactProps } from "../../types/chat";
import { TaskCommentProps } from "../../types/tasks";
import { getLocalCurrentDate } from "../../utils/dateUtils";
import { ModalCreateProject } from "../tasks/components/modals/ModalCreateProject";
import { ModalCreateTag } from "../tasks/components/modals/ModalCreateTag";

type ChatHomeProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    useIM: InboxManagementState;
    useNM: NoteManagementState;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    // Required so the chat-side TaskPreview can reroute to
    // MilestonePreviewInner when the opened task is a milestone backing
    // row (e.g. the thread chat header's "Open Task" button on a
    // milestone-tied thread).
    useSM: SprintMilestoneManagementState;
};

export const ChatHome = (props: ChatHomeProps) => {
    const { useTEM, socket, myself, setMyself, useUISM, useCM, useNM, usePM, useTM, useSM } =
        props;

    // Common
    const { mode } = useColorScheme();
    const { accessToken } = useAuth();

    // Chat Related
    const [currentMainChatId, setCurrentMainChatId] = useState<number>(-1);
    const [currentSubChatId, setCurrentSubChatId] = useState<number>(-1);
    const [currentThreadChatId, setCurrentThreadChatId] = useState<number>(-1);
    const [currentThreadTaskId, setCurrentThreadTaskId] = useState<number>(-1);
    const [isToDoVisible, setIsToDoVisible] = useState<boolean>(
        localStorage.getItem("isToDoVisible") === "true"
    );

    // Custom hooks
    const { width, height } = useWindowSize();
    const { mainChatPanelSize, setMainChatPanelSize, subChatPanelSize, setSubChatPanelSize } =
        usePanelSizes();
    const { todos, setTodos, isExistingTodaysTodo, setIsExistingTodaysTodo, incompleteTodoCount } =
        useTodos(myself, accessToken, isToDoVisible);

    // URL-based routing
    const chatRouting = useChatRouting({ useCM, useTM, myself });

    const [todoFromMessageBubble, setTodoFromMessageBubble] = useState<
        MessageProps | ThreadMessageProps | TaskCommentProps | null
    >(null);
    const [todoAddedFromMessageOpen, setTodoAddedFromMessageOpen] = useState<boolean>(false);

    const handleAppendTodo = async (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => {
        let todayTodo: ToDoFactProps | undefined = todos.find(
            (todo) => todo.dtCreatedOn === getLocalCurrentDate()
        );
        if (!todayTodo) {
            const todoContent: ToDoFactProps = await createNewTodo(
                accessToken,
                myself,
                defaultTodoContent,
                (error) => {
                    console.error(error);
                }
            );
            if (todoContent) {
                todayTodo = todoContent;
                setTodos((prev) => [todoContent, ...prev]);
                setIsExistingTodaysTodo(true);
            }
        }

        if (!todayTodo) {
            return;
        }

        if ("messageIdWithChatIdAndThreadId" in todoFromMessageBubble) {
            appendTodoContent(
                accessToken,
                myself,
                todos,
                setTodos,
                todayTodo,
                todoFromMessageBubble.chatType,
                todoFromMessageBubble.chatId,
                todoFromMessageBubble.threadId,
                todoFromMessageBubble.messageId,
                true,
                getFirstLine(todoFromMessageBubble.content[0])
            );
        } else if ("messageIdWithChatId" in todoFromMessageBubble) {
            // MessageProps
            appendTodoContent(
                accessToken,
                myself,
                todos,
                setTodos,
                todayTodo,
                todoFromMessageBubble.chatType,
                todoFromMessageBubble.chatId,
                null,
                todoFromMessageBubble.messageId,
                false,
                getFirstLine(todoFromMessageBubble.content[0])
            );
        } else if ("commentId" in todoFromMessageBubble) {
            // TaskCommentProps
            if (!todoFromMessageBubble.projectId) {
                return;
            }
            appendTodoContent(
                accessToken,
                myself,
                todos,
                setTodos,
                todayTodo,
                3,
                todoFromMessageBubble.projectId, // for chatId
                todoFromMessageBubble.taskId, // for threadId
                todoFromMessageBubble.commentId, // for messageId
                true,
                getFirstLine(todoFromMessageBubble.commentBody[0])
            );
        }

        setTodoFromMessageBubble(null);
        setTodoAddedFromMessageOpen(true);
    };

    // Task preview closed as default, but once it's opened, it should stay open.
    const [ignoreCount, setIgnoreCount] = useState<number>(0);
    const [initialTaskPreviewVisible, setInitialTaskPreviewVisible] = useState<boolean>(false);
    useEffect(() => {
        if (ignoreCount > 1 && useTM.isTaskPreviewVisible === true) {
            setInitialTaskPreviewVisible(true);
        }
        setIgnoreCount(ignoreCount + 1);
    }, [useTM.isTaskPreviewVisible, useTM.currentPreviewTaskId]);

    // Add a new todo from a message
    useEffect(() => {
        if (todoFromMessageBubble) {
            handleAppendTodo(todoFromMessageBubble);
        }
    }, [todoFromMessageBubble]);

    useEffect(() => {
        localStorage.setItem("isToDoVisible", isToDoVisible.toString());
    }, [isToDoVisible]);

    useEffect(() => {
        if (useCM.currentMainChat) {
            if (currentMainChatId !== useCM.currentMainChat.chatId) {
                setCurrentMainChatId(useCM.currentMainChat.chatId);
            }
            if (useCM.currentMainChat.project && useCM.currentMainChat.project.projectId) {
                usePM.setCurrentProject(useCM.currentMainChat.project);
            }
        }
    }, [useCM.currentMainChat]);

    useEffect(() => {
        if (useCM.currentSubChat) {
            if (
                useCM.currentSubChat !== undefined &&
                currentSubChatId !== useCM.currentSubChat.chatId
            ) {
                setCurrentSubChatId(useCM.currentSubChat.chatId);
            }
            if (useCM.currentSubChat?.project && useCM.currentSubChat.project.projectId) {
                usePM.setCurrentProject(useCM.currentSubChat.project);
            }
        }
    }, [useCM.currentSubChat]);

    useEffect(() => {
        if (useCM.currentThreadChat && useCM.currentThreadChat.chatId !== -1) {
            setCurrentThreadChatId(useCM.currentThreadChat.chatId);
        }
    }, [useCM.currentThreadChat]);

    useEffect(() => {
        if (useTM.currentPreviewTask) {
            setCurrentThreadChatId(Number(useTM.currentPreviewTask.id));
        }
    }, [useTM.currentPreviewTask]);

    const ls = mode === "dark" ? LayoutStyles.dark : LayoutStyles.light;

    return (
        <ChatProvider
            useCM={useCM}
            myself={myself}
            useNM={useNM}
            usePM={usePM}
            setMyself={setMyself}
            socket={socket}
            useTEM={useTEM}
            useTM={useTM}
            useUISM={useUISM}
            currentThreadTaskId={currentThreadTaskId}
            setCurrentThreadTaskId={setCurrentThreadTaskId}
        >
            <Box sx={LayoutStyles.outerWrapper}>
                <Snackbar
                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                    autoHideDuration={1500}
                    color="success"
                    open={todoAddedFromMessageOpen}
                    variant="soft"
                    onClose={(event, reason) => {
                        if (reason === "clickaway") {
                            return;
                        }
                        if (setTodoAddedFromMessageOpen) {
                            setTodoAddedFromMessageOpen(false);
                        }
                    }}
                >
                    Todo added from the message.
                </Snackbar>

                <Sheet sx={ls.serviceSurface}>
                    <Box sx={ls.decorTopRight} />
                    <Box sx={ls.decorBottomLeft} />

                    <PanelGroup
                        autoSaveId="conditional"
                        direction="horizontal"
                        style={{ flex: 1 }}
                    >
                        {/* Chat Sidebar pane which is always visible */}
                        <Panel id={"1"} maxSize={30} minSize={10} order={1}>
                            <Box sx={ls.sidebarPanel}>
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
                                        useCM={useCM}
                                        chatRouting={chatRouting}
                                        incompleteTodoCount={incompleteTodoCount}
                                        myself={myself}
                                        setIsToDoVisible={setIsToDoVisible}
                                        isToDoVisible={isToDoVisible}
                                        setMyself={setMyself}
                                        socket={socket}
                                        useTEM={useTEM}
                                        useUISM={useUISM}
                                        useTM={useTM}
                                        usePM={usePM}
                                    />
                                </Sheet>
                            </Box>
                        </Panel>

                        {/* Main Chat and Sub Chat Pane */}
                        {useCM.isMainChatVisible === true && (
                            <>
                                <ResizeHandle key="main-chat-resize-handle" />
                                <Panel id={"2"} maxSize={85} minSize={25} order={2}>
                                    <PanelGroup autoSaveId="conditional" direction="vertical">
                                        {/* Sub Chat Pane */}
                                        {useCM.isSubChatVisible === true && (
                                            <>
                                                <SubChatPanel
                                                    useCM={useCM}
                                                    currentSubChatId={currentSubChatId}
                                                    currentWindowHeight={height}
                                                    incompleteTodoCount={incompleteTodoCount}
                                                    isExistingTodaysTodo={isExistingTodaysTodo}
                                                    isToDoVisible={isToDoVisible}
                                                    myself={myself}
                                                    usePM={usePM}
                                                    setIsExistingTodaysTodo={
                                                        setIsExistingTodaysTodo
                                                    }
                                                    setMyself={setMyself}
                                                    setSubChatPanelSize={setSubChatPanelSize}
                                                    setTodos={setTodos}
                                                    socket={socket}
                                                    subChatPanelSize={subChatPanelSize}
                                                    useTEM={useTEM}
                                                    useTM={useTM}
                                                    todos={todos}
                                                    useUISM={useUISM}
                                                    todoFromMessageBubble={todoFromMessageBubble}
                                                    setTodoFromMessageBubble={
                                                        setTodoFromMessageBubble
                                                    }
                                                />
                                                <ResizeHandle
                                                    key="sub-chat-resize-handle"
                                                    className="chat-resize-handle-ver"
                                                />
                                            </>
                                        )}

                                        {/* Main Chat Pane */}
                                        <MainChatPanel
                                            useCM={useCM}
                                            currentMainChatId={currentMainChatId}
                                            currentWindowHeight={height}
                                            incompleteTodoCount={incompleteTodoCount}
                                            isExistingTodaysTodo={isExistingTodaysTodo}
                                            isToDoVisible={isToDoVisible}
                                            mainChatPanelSize={mainChatPanelSize}
                                            myself={myself}
                                            usePM={usePM}
                                            setIsExistingTodaysTodo={setIsExistingTodaysTodo}
                                            setIsToDoVisible={setIsToDoVisible}
                                            setMainChatPanelSize={setMainChatPanelSize}
                                            setMyself={setMyself}
                                            setTodos={setTodos}
                                            socket={socket}
                                            useTEM={useTEM}
                                            useTM={useTM}
                                            todos={todos}
                                            useUISM={useUISM}
                                            todoFromMessageBubble={todoFromMessageBubble}
                                            setTodoFromMessageBubble={setTodoFromMessageBubble}
                                        />
                                    </PanelGroup>
                                </Panel>
                            </>
                        )}

                        {/* Thread Chat Pane */}
                        {useCM.isThreadVisible === true && useCM.currentThreadChat && (
                            <>
                                <ResizeHandle key="thread-chat-resize-handle" />
                                <ThreadPanel
                                    useCM={useCM}
                                    currentThreadChatId={currentThreadChatId}
                                    currentWindowHeight={height}
                                    myself={myself}
                                    useNM={useNM}
                                    usePM={usePM}
                                    setMyself={setMyself}
                                    socket={socket}
                                    useTEM={useTEM}
                                    useTM={useTM}
                                    useUISM={useUISM}
                                    setTodoFromMessageBubble={setTodoFromMessageBubble}
                                />
                            </>
                        )}

                        {/* Create Task Pane */}
                        {useTM.isCreatingTask.flag === true && (
                            <>
                                <ResizeHandle key="create-task-resize-handle" />
                                <CreateTaskPanel
                                    useCM={useCM}
                                    myself={myself}
                                    usePM={usePM}
                                    setMyself={setMyself}
                                    socket={socket}
                                    useTEM={useTEM}
                                    useTM={useTM}
                                    useUISM={useUISM}
                                    useNM={useNM}
                                    useSM={useSM}
                                />
                            </>
                        )}

                        {/* Task Preview Pane.
                        Milestone previews intentionally leave
                        `currentPreviewTask` undefined and route via
                        `currentPreviewKind === "milestone"` +
                        `currentPreviewMilestoneId` (see TaskPreview.tsx),
                        so the gate has to accept either case. Without the
                        milestone branch, freshly-created milestones don't
                        render here. Mirrors TaskHomeLayout.tsx. */}
                        {initialTaskPreviewVisible &&
                            useTM.isTaskPreviewVisible === true &&
                            (useTM.currentPreviewTask ||
                                useTM.currentPreviewKind === "milestone") && (
                                <>
                                    <ResizeHandle key="task-preview-resize-handle" />
                                    <TaskPreviewPanel
                                        useCM={useCM}
                                        myself={myself}
                                        useNM={useNM}
                                        usePM={usePM}
                                        setMyself={setMyself}
                                        socket={socket}
                                        useTEM={useTEM}
                                        useTM={useTM}
                                        useSM={useSM}
                                        useUISM={useUISM}
                                        setTodoFromMessageBubble={setTodoFromMessageBubble}
                                    />
                                </>
                            )}

                        {/* Chat Note Pane */}
                        {useCM.isChatNoteVisibleInChat === true && (
                            <>
                                <ResizeHandle key="chat-note-resize-handle" />
                                <ChatNotePanel
                                    useCM={useCM}
                                    myself={myself}
                                    useNM={useNM}
                                    usePM={usePM}
                                    setMyself={setMyself}
                                    socket={socket}
                                    useTEM={useTEM}
                                    useTM={useTM}
                                    useUISM={useUISM}
                                />
                            </>
                        )}

                        {/* Select Chat Pane if no pane is visible */}
                        {useCM.isMainChatVisible === false &&
                            useCM.isThreadVisible === false &&
                            useTM.isCreatingTask.flag === false &&
                            useTM.isTaskPreviewVisible === false &&
                            useCM.isChatNoteVisibleInChat === false && (
                                <>
                                    <ResizeHandle key="select-chat-resize-handle" />
                                    <SelectChatPanel setMainChatPanelSize={setMainChatPanelSize} />
                                </>
                            )}

                        {/* Modal for creating a new project */}
                        <ModalCreateProject myself={myself} usePM={usePM} />

                        {/* Modal for creating a new tag */}
                        <ModalCreateTag myself={myself} useTM={useTM} usePM={usePM} />
                    </PanelGroup>
                </Sheet>

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
