import { useEffect, useRef, useState } from "react";
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
import { appendTodoFromMessage } from "./services/appendTodoFromMessage";
import { getFirstLine } from "./utils/common";

import { LayoutStyles } from "../../components/ui/styles/commonStyle";
import { useAuth } from "../../context/AuthContext";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { InboxManagementState } from "../../hooks/inbox/useInboxManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { usePanelSizes } from "../../hooks/usePanelSizes";
import { useTodoGroups } from "../../hooks/useTodoGroups";
import { useWindowSize } from "../../hooks/useWindowSize";
import { UserProps } from "../../types/admin";
import { MessageProps, ThreadMessageProps } from "../../types/chat";
import { TaskCommentProps } from "../../types/tasks";
import { ModalCreateProject } from "../tasks/components/modals/ModalCreateProject";
import { ModalCreateTag } from "../tasks/components/modals/ModalCreateTag";
import { MobileChatHome } from "./MobileChatHome";

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
    const isMobile = useIsMobile();

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
    const useTG = useTodoGroups(myself, accessToken, isToDoVisible);
    const { incompleteCount } = useTG;

    // URL-based routing
    const chatRouting = useChatRouting({ useCM, useTM, myself });

    const [todoFromMessageBubble, setTodoFromMessageBubble] = useState<
        MessageProps | ThreadMessageProps | TaskCommentProps | null
    >(null);
    const [todoAddedFromMessageOpen, setTodoAddedFromMessageOpen] = useState<boolean>(false);

    const handleAppendTodo = async (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => {
        let created;
        if ("messageIdWithChatIdAndThreadId" in todoFromMessageBubble) {
            created = await appendTodoFromMessage(accessToken, myself, {
                chatType: todoFromMessageBubble.chatType,
                chatId: todoFromMessageBubble.chatId,
                threadId: todoFromMessageBubble.threadId,
                messageId: todoFromMessageBubble.messageId,
                isThread: true,
                messageText: getFirstLine(todoFromMessageBubble.content[0]),
            });
        } else if ("messageIdWithChatId" in todoFromMessageBubble) {
            created = await appendTodoFromMessage(accessToken, myself, {
                chatType: todoFromMessageBubble.chatType,
                chatId: todoFromMessageBubble.chatId,
                threadId: null,
                messageId: todoFromMessageBubble.messageId,
                isThread: false,
                messageText: getFirstLine(todoFromMessageBubble.content[0]),
            });
        } else if ("commentId" in todoFromMessageBubble) {
            if (!todoFromMessageBubble.projectId) return;
            created = await appendTodoFromMessage(accessToken, myself, {
                chatType: 3,
                chatId: todoFromMessageBubble.projectId,
                threadId: todoFromMessageBubble.taskId,
                messageId: todoFromMessageBubble.commentId,
                isThread: true,
                messageText: getFirstLine(todoFromMessageBubble.commentBody[0]),
            });
        }

        if (created) {
            // appendTodoFromMessage bypassed the hook's optimistic
            // mutator, so re-pull groups for an authoritative view.
            await useTG.refresh();
            setTodoAddedFromMessageOpen(true);
        }
        setTodoFromMessageBubble(null);
    };

    // Task preview is closed by default on chat. `useTM.isTaskPreviewVisible`
    // may already be true on mount because it's shared with other pages (e.g.
    // task home) — we must not auto-open the panel in that case. The sticky
    // flag flips only when the user actively opens (false → true) or switches
    // tasks while on the chat page; once true it stays true for this mount.
    const [initialTaskPreviewVisible, setInitialTaskPreviewVisible] = useState<boolean>(false);
    const prevPreviewRef = useRef({
        visible: useTM.isTaskPreviewVisible,
        taskId: useTM.currentPreviewTaskId,
    });
    useEffect(() => {
        const opened = !prevPreviewRef.current.visible && useTM.isTaskPreviewVisible;
        const switched =
            useTM.isTaskPreviewVisible &&
            prevPreviewRef.current.taskId !== useTM.currentPreviewTaskId;
        if (opened || switched) {
            setInitialTaskPreviewVisible(true);
        }
        prevPreviewRef.current = {
            visible: useTM.isTaskPreviewVisible,
            taskId: useTM.currentPreviewTaskId,
        };
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

    // Spotlight source-chip → todo flow: App.tsx dispatches
    // `openTodoPane` after it navigates to the self-DM. We flip the
    // local visibility flag (which the toggle button also drives) so
    // the pane is open by the time the navigation lands.
    useEffect(() => {
        const handler = () => setIsToDoVisible(true);
        window.addEventListener("openTodoPane", handler);
        return () => window.removeEventListener("openTodoPane", handler);
    }, []);

    const ls = mode === "dark" ? LayoutStyles.dark : LayoutStyles.light;

    return (
        <ChatProvider
            currentThreadTaskId={currentThreadTaskId}
            myself={myself}
            setCurrentThreadTaskId={setCurrentThreadTaskId}
            setMyself={setMyself}
            socket={socket}
            useCM={useCM}
            useNM={useNM}
            usePM={usePM}
            useTEM={useTEM}
            useTM={useTM}
            useUISM={useUISM}
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

                    {isMobile ? (
                        <MobileChatHome
                            chatRouting={chatRouting}
                            currentMainChatId={currentMainChatId}
                            currentThreadChatId={currentThreadChatId}
                            currentWindowHeight={height}
                            incompleteTodoCount={incompleteCount}
                            isToDoVisible={isToDoVisible}
                            mainChatPanelSize={mainChatPanelSize}
                            myself={myself}
                            setIsToDoVisible={setIsToDoVisible}
                            setMyself={setMyself}
                            setTodoFromMessageBubble={setTodoFromMessageBubble}
                            socket={socket}
                            useCM={useCM}
                            useNM={useNM}
                            usePM={usePM}
                            useSM={useSM}
                            useTEM={useTEM}
                            useTG={useTG}
                            useTM={useTM}
                            useUISM={useUISM}
                        />
                    ) : (
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
                                            chatRouting={chatRouting}
                                            incompleteTodoCount={incompleteCount}
                                            isToDoVisible={isToDoVisible}
                                            myself={myself}
                                            setIsToDoVisible={setIsToDoVisible}
                                            setMyself={setMyself}
                                            socket={socket}
                                            useCM={useCM}
                                            useNM={useNM}
                                            usePM={usePM}
                                            useTEM={useTEM}
                                            useTM={useTM}
                                            useUISM={useUISM}
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
                                                        currentSubChatId={currentSubChatId}
                                                        currentWindowHeight={height}
                                                        incompleteTodoCount={incompleteCount}
                                                        isToDoVisible={isToDoVisible}
                                                        myself={myself}
                                                        setMyself={setMyself}
                                                        setSubChatPanelSize={setSubChatPanelSize}
                                                        socket={socket}
                                                        subChatPanelSize={subChatPanelSize}
                                                        useCM={useCM}
                                                        usePM={usePM}
                                                        useTEM={useTEM}
                                                        useTG={useTG}
                                                        useTM={useTM}
                                                        useUISM={useUISM}
                                                        setTodoFromMessageBubble={
                                                            setTodoFromMessageBubble
                                                        }
                                                        todoFromMessageBubble={
                                                            todoFromMessageBubble
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
                                                currentMainChatId={currentMainChatId}
                                                currentWindowHeight={height}
                                                incompleteTodoCount={incompleteCount}
                                                isToDoVisible={isToDoVisible}
                                                mainChatPanelSize={mainChatPanelSize}
                                                myself={myself}
                                                setIsToDoVisible={setIsToDoVisible}
                                                setMainChatPanelSize={setMainChatPanelSize}
                                                setMyself={setMyself}
                                                setTodoFromMessageBubble={setTodoFromMessageBubble}
                                                socket={socket}
                                                todoFromMessageBubble={todoFromMessageBubble}
                                                useCM={useCM}
                                                usePM={usePM}
                                                useTEM={useTEM}
                                                useTG={useTG}
                                                useTM={useTM}
                                                useUISM={useUISM}
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
                                        currentThreadChatId={currentThreadChatId}
                                        currentWindowHeight={height}
                                        myself={myself}
                                        setMyself={setMyself}
                                        setTodoFromMessageBubble={setTodoFromMessageBubble}
                                        socket={socket}
                                        useCM={useCM}
                                        useNM={useNM}
                                        usePM={usePM}
                                        useTEM={useTEM}
                                        useTM={useTM}
                                        useUISM={useUISM}
                                    />
                                </>
                            )}

                            {/* Create Task Pane */}
                            {useTM.isCreatingTask.flag === true && (
                                <>
                                    <ResizeHandle key="create-task-resize-handle" />
                                    <CreateTaskPanel
                                        myself={myself}
                                        setMyself={setMyself}
                                        socket={socket}
                                        useCM={useCM}
                                        useNM={useNM}
                                        usePM={usePM}
                                        useSM={useSM}
                                        useTEM={useTEM}
                                        useTM={useTM}
                                        useUISM={useUISM}
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
                                            myself={myself}
                                            setMyself={setMyself}
                                            setTodoFromMessageBubble={setTodoFromMessageBubble}
                                            socket={socket}
                                            useCM={useCM}
                                            useNM={useNM}
                                            usePM={usePM}
                                            useSM={useSM}
                                            useTEM={useTEM}
                                            useTM={useTM}
                                            useUISM={useUISM}
                                        />
                                    </>
                                )}

                            {/* Chat Note Pane */}
                            {useCM.isChatNoteVisibleInChat === true && (
                                <>
                                    <ResizeHandle key="chat-note-resize-handle" />
                                    <ChatNotePanel
                                        myself={myself}
                                        setMyself={setMyself}
                                        socket={socket}
                                        useCM={useCM}
                                        useNM={useNM}
                                        usePM={usePM}
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
                                        <SelectChatPanel
                                            setMainChatPanelSize={setMainChatPanelSize}
                                        />
                                    </>
                                )}
                        </PanelGroup>
                    )}

                    {/* Modal for creating a new project — global flag-gated */}
                    <ModalCreateProject myself={myself} usePM={usePM} />

                    {/* Modal for creating a new tag — global flag-gated */}
                    <ModalCreateTag myself={myself} usePM={usePM} useTM={useTM} />
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
