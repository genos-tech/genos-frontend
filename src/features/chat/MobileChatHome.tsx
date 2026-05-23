import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Box, IconButton } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { MessageProps, ThreadMessageProps, ToDoFactProps } from "../../types/chat";
import { TaskCommentProps } from "../../types/tasks";
import { ChatNoteMain } from "../notes/chat-notes/components/ChatNoteMain";
import { CreateTaskForm } from "../tasks/components/contents/CreateTaskForm";
import { TaskPreview } from "../tasks/components/contents/TaskPreview";
import { ChatSidebar } from "./components/sidebar/ChatSidebar";
import { useChatRouting } from "./hooks/useChatRouting";
import { MessagesPane } from "./MainChatPane";
import { ThreadPane } from "./ThreadChatPane";

type MobileChatHomeProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    useNM: NoteManagementState;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
    useSM: SprintMilestoneManagementState;
    chatRouting: ReturnType<typeof useChatRouting>;
    currentMainChatId: number;
    currentThreadChatId: number;
    currentWindowHeight: number;
    mainChatPanelSize: number;
    incompleteTodoCount: number;
    isExistingTodaysTodo: boolean;
    setIsExistingTodaysTodo: (v: boolean) => void;
    isToDoVisible: boolean;
    setIsToDoVisible: (v: boolean) => void;
    todos: ToDoFactProps[];
    setTodos: React.Dispatch<React.SetStateAction<ToDoFactProps[]>>;
    setTodoFromMessageBubble: (
        todo: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => void;
};

// Full-screen overlay shell for flag-driven side panes that have no URL
// representation (TaskPreview, ChatNote, CreateTaskForm). The close
// button toggles the corresponding visibility flag back off.
const MobileOverlay = ({
    children,
    onClose,
}: {
    children: React.ReactNode;
    onClose: () => void;
}) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    return (
        <Box
            sx={{
                position: "fixed",
                inset: 0,
                zIndex: 1300,
                background: isDark
                    ? "linear-gradient(180deg, rgba(20,14,34,1) 0%, rgba(11,10,22,1) 100%)"
                    : "linear-gradient(180deg, rgba(252,250,255,1) 0%, rgba(248,245,255,1) 100%)",
                display: "flex",
                flexDirection: "column",
                paddingBottom: "var(--BottomTabBar-height, 60px)",
            }}
        >
            <IconButton
                onClick={onClose}
                size="sm"
                variant="plain"
                sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    zIndex: 1,
                    borderRadius: "10px",
                    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                    "&:hover": {
                        background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                    },
                }}
                aria-label="Close"
            >
                <CloseRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>{children}</Box>
        </Box>
    );
};

export const MobileChatHome = (props: MobileChatHomeProps) => {
    const {
        useTEM,
        socket,
        myself,
        setMyself,
        useCM,
        useUISM,
        useNM,
        usePM,
        useTM,
        useSM,
        chatRouting,
        currentMainChatId,
        currentThreadChatId,
        currentWindowHeight,
        mainChatPanelSize,
        incompleteTodoCount,
        isExistingTodaysTodo,
        setIsExistingTodaysTodo,
        isToDoVisible,
        setIsToDoVisible,
        todos,
        setTodos,
        setTodoFromMessageBubble,
    } = props;

    // URL-driven pane selection. Sidebar is the default; main chat takes
    // over once a chatId appears in the URL; thread replaces main once a
    // threadId appears.
    const route = chatRouting.parseCurrentRoute();
    const hasThread =
        route.threadId !== undefined &&
        useCM.isThreadVisible === true &&
        !!useCM.currentThreadChat &&
        useCM.currentThreadChat.chatId !== -1;
    const hasMain =
        !hasThread &&
        route.chatId !== undefined &&
        useCM.isMainChatVisible === true &&
        !!useCM.currentMainChat &&
        useCM.currentMainChat.chatId !== -1;
    const showSidebar = !hasMain && !hasThread;

    return (
        <Box sx={{ flex: 1, height: "100%", overflow: "hidden", position: "relative" }}>
            {showSidebar && (
                <Box sx={{ height: "100%", width: "100%" }}>
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
                </Box>
            )}

            {hasMain && (
                <Box sx={{ height: "100%", width: "100%" }}>
                    <MessagesPane
                        useCM={useCM}
                        currentMainChatId={currentMainChatId}
                        currentWindowHeight={currentWindowHeight}
                        incompleteTodoCount={incompleteTodoCount}
                        isExistingTodaysTodo={isExistingTodaysTodo}
                        isToDoVisible={isToDoVisible}
                        myself={myself}
                        paneSizePCT={mainChatPanelSize}
                        setIsExistingTodaysTodo={setIsExistingTodaysTodo}
                        setIsToDoVisible={setIsToDoVisible}
                        setMyself={setMyself}
                        setTodos={setTodos}
                        socket={socket}
                        useTEM={useTEM}
                        todos={todos}
                        useUISM={useUISM}
                        useTM={useTM}
                        usePM={usePM}
                        setTodoFromMessageBubble={setTodoFromMessageBubble}
                    />
                </Box>
            )}

            {hasThread && (
                <Box sx={{ height: "100%", width: "100%" }}>
                    <ThreadPane
                        useCM={useCM}
                        usePM={usePM}
                        currentThreadChatId={currentThreadChatId}
                        currentWindowHeight={currentWindowHeight}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                        useNM={useNM}
                        setTodoFromMessageBubble={setTodoFromMessageBubble}
                    />
                </Box>
            )}

            {/* Flag-driven overlays (no URL representation) */}
            {useTM.isCreatingTask.flag === true && (
                <MobileOverlay
                    onClose={() =>
                        useTM.setIsCreatingTask((prev) => ({ ...prev, flag: false }))
                    }
                >
                    <Box sx={{ p: 1, pt: 6, height: "100%", overflow: "auto" }}>
                        <CreateTaskForm
                            chatType={useCM.currentThreadChat?.chatType || -1}
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
                    </Box>
                </MobileOverlay>
            )}

            {useTM.isTaskPreviewVisible === true &&
                (useTM.currentPreviewTask || useTM.currentPreviewKind === "milestone") && (
                    <MobileOverlay onClose={() => useTM.setIsTaskPreviewVisible(false)}>
                        <Box sx={{ p: 1, pt: 6, height: "100%", overflow: "auto" }}>
                            <TaskPreview
                                useCM={useCM}
                                myself={myself}
                                setMyself={setMyself}
                                socket={socket}
                                useTEM={useTEM}
                                useTM={useTM}
                                useSM={useSM}
                                useUISM={useUISM}
                                useNM={useNM}
                                usePM={usePM}
                                setTodoFromMessageBubble={setTodoFromMessageBubble}
                            />
                        </Box>
                    </MobileOverlay>
                )}

            {useCM.isChatNoteVisibleInChat === true && (
                <MobileOverlay onClose={() => useCM.setIsChatNoteVisibleInChat(false)}>
                    <Box sx={{ p: 1, pt: 6, height: "100%", overflow: "auto" }}>
                        <ChatNoteMain
                            useCM={useCM}
                            isInChatPage={true}
                            isInTaskPage={false}
                            myself={myself}
                            useNM={useNM}
                            useTM={useTM}
                            usePM={usePM}
                            setMyself={setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    </Box>
                </MobileOverlay>
            )}

        </Box>
    );
};
