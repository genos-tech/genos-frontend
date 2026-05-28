import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Box, IconButton } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { ChatSidebar } from "./components/sidebar/ChatSidebar";
import { useChatRouting } from "./hooks/useChatRouting";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UseTodoGroupsState } from "../../hooks/useTodoGroups";
import { UserProps } from "../../types/admin";
import { MessageProps, ThreadMessageProps } from "../../types/chat";
import { TaskCommentProps } from "../../types/tasks";
import { ChatNoteMain } from "../notes/chat-notes/components/ChatNoteMain";
import { CreateTaskForm } from "../tasks/components/contents/CreateTaskForm";
import { TaskPreview } from "../tasks/components/contents/TaskPreview";
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
    isToDoVisible: boolean;
    setIsToDoVisible: (v: boolean) => void;
    useTG: UseTodoGroupsState;
    setTodoFromMessageBubble: (todo: MessageProps | ThreadMessageProps | TaskCommentProps) => void;
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
                aria-label="Close"
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
                onClick={onClose}
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
        isToDoVisible,
        setIsToDoVisible,
        useTG,
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
                        chatRouting={chatRouting}
                        incompleteTodoCount={incompleteTodoCount}
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
                </Box>
            )}

            {hasMain && (
                <Box sx={{ height: "100%", width: "100%" }}>
                    <MessagesPane
                        currentMainChatId={currentMainChatId}
                        currentWindowHeight={currentWindowHeight}
                        incompleteTodoCount={incompleteTodoCount}
                        isToDoVisible={isToDoVisible}
                        myself={myself}
                        paneSizePCT={mainChatPanelSize}
                        setIsToDoVisible={setIsToDoVisible}
                        setMyself={setMyself}
                        setTodoFromMessageBubble={setTodoFromMessageBubble}
                        socket={socket}
                        useCM={useCM}
                        usePM={usePM}
                        useTEM={useTEM}
                        useTG={useTG}
                        useTM={useTM}
                        useUISM={useUISM}
                    />
                </Box>
            )}

            {hasThread && (
                <Box sx={{ height: "100%", width: "100%" }}>
                    <ThreadPane
                        currentThreadChatId={currentThreadChatId}
                        currentWindowHeight={currentWindowHeight}
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
                </Box>
            )}

            {/* Flag-driven overlays (no URL representation) */}
            {useTM.isCreatingTask.flag === true && (
                <MobileOverlay
                    onClose={() => useTM.setIsCreatingTask((prev) => ({ ...prev, flag: false }))}
                >
                    <Box sx={{ p: 1, pt: 6, height: "100%", overflow: "auto" }}>
                        <CreateTaskForm
                            chatType={useCM.currentThreadChat?.chatType || -1}
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
                    </Box>
                </MobileOverlay>
            )}

            {useTM.isTaskPreviewVisible === true &&
                (useTM.currentPreviewTask || useTM.currentPreviewKind === "milestone") && (
                    <MobileOverlay onClose={() => useTM.setIsTaskPreviewVisible(false)}>
                        <Box sx={{ p: 1, pt: 6, height: "100%", overflow: "auto" }}>
                            <TaskPreview
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
                        </Box>
                    </MobileOverlay>
                )}

            {useCM.isChatNoteVisibleInChat === true && (
                <MobileOverlay onClose={() => useCM.setIsChatNoteVisibleInChat(false)}>
                    <Box sx={{ p: 1, pt: 6, height: "100%", overflow: "auto" }}>
                        <ChatNoteMain
                            isInChatPage={true}
                            isInTaskPage={false}
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
                    </Box>
                </MobileOverlay>
            )}
        </Box>
    );
};
