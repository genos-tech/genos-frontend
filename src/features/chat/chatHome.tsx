// `simple-import-sort` and the prettier import-sort plugin disagree on
// the order of `react` vs `@mui/...`. Prettier wins; disable
// simple-import-sort.

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
import { appendTodoFromMessage } from "./components/todo/services/appendTodoFromMessage";
import { useChatRouting } from "./hooks/useChatRouting";
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
import { useSurfaceTaskPreviewVisible } from "../../hooks/tasks/useSurfaceTaskPreviewVisible";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { usePanelSizes } from "../../hooks/usePanelSizes";
import { UseTodoGroupsState } from "../../hooks/useTodoGroups";
import { useWindowSize } from "../../hooks/useWindowSize";
import { useTranslation } from "../../i18n";
import { UserProps } from "../../types/admin";
import { MessageProps, ThreadMessageProps } from "../../types/chat";
import { TaskCommentProps } from "../../types/tasks";
import { isNotePaneVisible } from "../notes/common/utils/notePaneVisibility";
import { ModalCreateProject } from "../tasks/components/modals/ModalCreateProject";
import { ModalCreateTag } from "../tasks/components/modals/ModalCreateTag";
import { hasTaskPreviewContent } from "../tasks/utils/taskPreviewPaneVisibility";
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
    // Owned by App (single instance — it also feeds the agent-input "#"
    // mention picker via HashMentionDataContext) and passed down so the
    // todo pane keeps its one source of truth.
    useTG: UseTodoGroupsState;
    // False while this Home is kept mounted but hidden (keep-alive). Threaded
    // into useChatRouting so a backgrounded Chat Home doesn't hijack the URL.
    isActiveRoute: boolean;
};

export const ChatHome = (props: ChatHomeProps) => {
    const {
        useTEM,
        socket,
        myself,
        setMyself,
        useUISM,
        useCM,
        useNM,
        usePM,
        useTM,
        useSM,
        useTG,
        isActiveRoute,
    } = props;

    // Common
    const { mode } = useColorScheme();
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const isMobile = useIsMobile();

    // Chat Related
    const [currentMainChatId, setCurrentMainChatId] = useState<number>(-1);
    const [currentSubChatId, setCurrentSubChatId] = useState<number>(-1);
    const [currentThreadChatId, setCurrentThreadChatId] = useState<number>(-1);
    const [currentThreadTaskId, setCurrentThreadTaskId] = useState<number>(-1);
    const [isToDoVisible, setIsToDoVisible] = useState<boolean>(
        localStorage.getItem("isToDoVisible") === "true"
    );

    // Custom hooks. `width` from `useWindowSize` is exposed for
    // future responsive logic but isn't read today; destructure
    // omits it so ESLint doesn't flag it as unused.
    const { height } = useWindowSize();
    const { mainChatPanelSize, setMainChatPanelSize, subChatPanelSize, setSubChatPanelSize } =
        usePanelSizes();
    const { incompleteCount } = useTG;

    // URL-based routing
    const chatRouting = useChatRouting({ myself, useCM, useTM, isActiveRoute });

    // The chat-note pane must not render without a note in it.
    // `ChatNoteMain` returns null on a null note, so the pane would paint
    // as an empty bordered column — and the only close button is the one
    // inside the note header that just didn't render, so the user is
    // stuck with it. Reachable by closing the last note tab or by an
    // open that resolves to nothing. Same class of bug as the task
    // page's note panel; see `isNotePaneVisible`.
    //
    // Used for BOTH the pane below and the `SelectChatPanel` fallback, so
    // the two can't disagree about whether this pane counts as visible
    // and leave the page with no pane at all.
    const isChatNotePaneVisible = isNotePaneVisible({
        isVisible: useCM.isChatNoteVisibleInChat === true,
        hasOpenNote: useNM.chatPanelApi.note !== null,
        isOpening: useNM.chatPanelApi.isLoading,
    });

    const [todoFromMessageBubble, setTodoFromMessageBubble] = useState<
        MessageProps | ThreadMessageProps | TaskCommentProps | null
    >(null);
    const [todoAddedFromMessageOpen, setTodoAddedFromMessageOpen] = useState<boolean>(false);

    const handleAppendTodo = async (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => {
        let created;
        // Keys sorted alphabetically per `sort-keys`.
        if ("messageIdWithChatIdAndThreadId" in todoFromMessageBubble) {
            created = await appendTodoFromMessage(accessToken, myself, {
                chatId: todoFromMessageBubble.chatId,
                chatType: todoFromMessageBubble.chatType,
                isThread: true,
                messageId: todoFromMessageBubble.messageId,
                messageText: getFirstLine(todoFromMessageBubble.content[0]),
                threadId: todoFromMessageBubble.threadId,
            });
        } else if ("messageIdWithChatId" in todoFromMessageBubble) {
            created = await appendTodoFromMessage(accessToken, myself, {
                chatId: todoFromMessageBubble.chatId,
                chatType: todoFromMessageBubble.chatType,
                isThread: false,
                messageId: todoFromMessageBubble.messageId,
                messageText: getFirstLine(todoFromMessageBubble.content[0]),
                threadId: null,
            });
        } else if ("commentId" in todoFromMessageBubble) {
            if (!todoFromMessageBubble.projectId) return;
            created = await appendTodoFromMessage(accessToken, myself, {
                chatId: todoFromMessageBubble.projectId,
                chatType: 3,
                isThread: true,
                messageId: todoFromMessageBubble.commentId,
                messageText: getFirstLine(todoFromMessageBubble.commentBody[0]),
                threadId: todoFromMessageBubble.taskId,
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
    // is shared with the task page, so it may already be true on mount — we
    // must not auto-open the panel in that case.
    //
    // This used to be an ungated sticky flag local to this component, which
    // was the bug: the Homes are keep-alive, so this component stays mounted
    // while the user is on the TASK page and its effect happily observed the
    // false → true transition caused by opening a preview *there*. Switching
    // to chat then found the flag already set and rendered the panel.
    // `useSurfaceTaskPreviewVisible` gates that observation on isActiveRoute
    // and persists the result per surface.
    const [initialTaskPreviewVisible, setInitialTaskPreviewVisible] = useSurfaceTaskPreviewVisible(
        "chat",
        isActiveRoute,
        useTM
    );

    // Consume the cross-page "open task preview on chat" intent. Set by
    // moveToSpecificChat (only when the opened thread carries a task, so
    // currentPreviewTaskId is fresh and matching), this flag survives the
    // task->chat route swap that remounts ChatHome — the sticky-flag effect
    // above can't observe the false->true transition because it happens
    // before this component mounts. We flip both gating pieces directly:
    // isTaskPreviewVisible (the chatHome.tsx:461 gate) and
    // initialTaskPreviewVisible (set directly, not via the effect above,
    // which won't fire if this task was already the preview on mount). The
    // panel's `currentPreviewTask` is loaded by the App-level auto-loader
    // (useProjectTaskManagement) from currentPreviewTaskId + currentProject.
    // We also clear a stale isCreatingTask.flag so the CreateTaskPanel
    // (chatHome.tsx:434) doesn't render in place of the preview, and we
    // consume (clear) the intent so a later chat mount can't re-open it.
    useEffect(() => {
        if (!useCM.isThreadTaskVisible) return;
        useTM.setIsTaskPreviewVisible(true);
        setInitialTaskPreviewVisible(true);
        useTM.setIsCreatingTask((prev) => ({ ...prev, flag: false }));
        useCM.setIsThreadTaskVisible(false);
        // Intentional: consume strictly on the intent flag. currentPreviewTaskId
        // is set synchronously in moveToSpecificChat before navigate, so it is
        // already present by the time this effect runs on mount; the setters are
        // stable and excluded to avoid re-running.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useCM.isThreadTaskVisible]);

    // Whether the task-preview pane actually shows on this surface: wanted
    // here, wanted globally, AND with something selected to render.
    //
    // That last arm is the fix for an empty right-hand column on the chat
    // page. `TaskPreview` returns null when nothing is selected, while the
    // pane draws its own frame — so the page painted a blank resizable
    // column whose only close control (the preview header) hadn't rendered.
    // Reached by opening a task on the TASK page (global flag true), then
    // opening a thread on a message with no task: `replayHandler` runs
    // `setCurrentPreviewTaskId(-1)`, deselecting without lowering the flag.
    // The task page has always carried this check inline (TaskHomeLayout);
    // `hasTaskPreviewContent` is that same rule, and it stays true through
    // a task switch so the panel can't flash out mid-load.
    //
    // Used for BOTH the pane and the `SelectChatPanel` fallback below, so
    // the two can't disagree and leave the page with no pane at all.
    const isTaskPreviewPaneVisible =
        initialTaskPreviewVisible &&
        useTM.isTaskPreviewVisible === true &&
        hasTaskPreviewContent(useTM);

    // Add a new todo from a message
    useEffect(() => {
        if (todoFromMessageBubble) {
            handleAppendTodo(todoFromMessageBubble);
        }
        // Intentional: only re-run when the bubble changes — including
        // `handleAppendTodo` would re-fire on every render (it's
        // re-derived each time).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [todoFromMessageBubble]);

    useEffect(() => {
        localStorage.setItem("isToDoVisible", isToDoVisible.toString());
    }, [isToDoVisible]);

    // The App-owned useTG no longer refetches on visibility flips (that
    // dep moved out with the hook); re-pull when the pane opens so it
    // still shows fresh data after edits from other sessions.
    useEffect(() => {
        if (isToDoVisible) void useTG.refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isToDoVisible]);

    useEffect(() => {
        if (useCM.currentMainChat) {
            // PUNCH LIST (v3 chatId migration): `useCM.currentMainChat.chatId`
            // is `string` post-flip; the legacy `currentMainChatId` state +
            // the downstream `MainChatPane.currentMainChatId: number`
            // signature haven't migrated yet. Cast at the boundary to
            // keep TS quiet — string-disguised-as-number rides through
            // to consumers and gets re-stringified for IDB / URL
            // composite keys. Flipping the state to `string` AND every
            // consumer's signature is a coordinated multi-file change
            // for a follow-on session.
            const mainChatIdAsNumber = useCM.currentMainChat.chatId as unknown as number;
            if (currentMainChatId !== mainChatIdAsNumber) {
                setCurrentMainChatId(mainChatIdAsNumber);
            }
            if (useCM.currentMainChat.project && useCM.currentMainChat.project.projectId) {
                usePM.setCurrentProject(useCM.currentMainChat.project);
            }
        }
        // Intentional: only re-sync the chat-id mirror when the live
        // chat changes. `currentMainChatId` is set inside the effect
        // (would loop on inclusion) and `usePM.setCurrentProject` is
        // a stable setter not worth a dep.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useCM.currentMainChat]);

    useEffect(() => {
        if (useCM.currentSubChat) {
            // Same v3 chatId boundary as the main-chat effect above.
            const subChatIdAsNumber = useCM.currentSubChat.chatId as unknown as number;
            if (useCM.currentSubChat !== undefined && currentSubChatId !== subChatIdAsNumber) {
                setCurrentSubChatId(subChatIdAsNumber);
            }
            if (useCM.currentSubChat?.project && useCM.currentSubChat.project.projectId) {
                usePM.setCurrentProject(useCM.currentSubChat.project);
            }
        }
        // Same reasoning as the main-chat effect above.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                    {t.chat.feedback.todoAddedFromMessage}
                </Snackbar>

                <Sheet sx={ls.serviceSurface}>
                    <Box sx={ls.decorTopRight} />
                    <Box sx={ls.decorBottomLeft} />

                    {isMobile ? (
                        <MobileChatHome
                            chatRouting={chatRouting}
                            isActiveRoute={isActiveRoute}
                            isTaskPreviewVisibleHere={initialTaskPreviewVisible}
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
                                            top: 10,
                                            transform: {
                                                xs: "translateX(calc(100% * (var(--MessagesPane-slideIn, 0) - 1)))",
                                                sm: "none",
                                            },
                                            transition: "transform 0.4s, width 0.4s",
                                            zIndex: 100,
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

                            {/* Create Task Pane. Gated on isActiveRoute
                                because the Homes are keep-alive: without
                                it this hidden pane would mount a second
                                CreateTaskForm while the task page shows
                                its own, and the two instances race over
                                the shared `initialEmptyTaskId` — the
                                loser hangs on "Preparing task…". */}
                            {useTM.isCreatingTask.flag === true && isActiveRoute && (
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

                            {/* Task Preview Pane. See `isTaskPreviewPaneVisible`
                        above for the derivation: it asks whether SOMETHING is
                        selected — deliberately NOT whether
                        `currentPreviewTask.id === currentPreviewTaskId`.
                        That id-match used to live here, but on a
                        PM→PM switch `currentPreviewTaskId` flips to the new
                        id a beat before `loadTask` swaps `currentPreviewTask`,
                        so the match went false mid-switch and UNMOUNTED the
                        whole panel (+ ResizeHandle) — a jarring "close then
                        reopen" flash on every task switch.
                        The stale-task protection the id-match provided (a
                        DM/GM task thread whose project isn't current →
                        `loadTask` returns empty → `currentPreviewTask` stays a
                        DIFFERENT task) now lives INSIDE TaskPreview via
                        `guardStaleTaskId`: it shows the loading pane on a
                        working-copy/id mismatch instead of rendering the stale
                        task, keeping the panel frame mounted through the swap.
                        Milestone previews (which leave `currentPreviewTask`
                        undefined AND `currentPreviewTaskId` at -1, routing via
                        `currentPreviewKind`) count as selected through the
                        predicate's milestone arm — the milestone branch inside
                        TaskPreview then renders them. */}
                            {isTaskPreviewPaneVisible && (
                                <>
                                    <ResizeHandle key="task-preview-resize-handle" />
                                    <TaskPreviewPanel
                                        guardStaleTaskId
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
                            {isChatNotePaneVisible && (
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
                                // The DERIVED pane state, not the raw flag: with
                                // the flag true but nothing selected the pane
                                // above stands down, so this fallback has to
                                // stand up or the page is left blank.
                                isTaskPreviewPaneVisible === false &&
                                isChatNotePaneVisible === false && (
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
                    <ModalCreateProject myself={myself} useCM={useCM} usePM={usePM} />

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
