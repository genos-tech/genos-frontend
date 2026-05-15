import "./App.css";

import { useCallback, useEffect, useRef, useState } from "react";
import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";
import ScreenRotationRoundedIcon from "@mui/icons-material/ScreenRotationRounded";
import WifiOffRoundedIcon from "@mui/icons-material/WifiOffRounded";
import { Box, Snackbar, Stack, Typography } from "@mui/joy";
import CssBaseline from "@mui/joy/CssBaseline";
import { CssVarsProvider } from "@mui/joy/styles";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

import { ServiceSwitcherOverlay } from "./components/layout/ServiceSwitcherOverlay";
import { Sidebar } from "./components/layout/sidebar";
import { AvatarContextProvider } from "./components/ui/avatars/AvatarContext";
import { InitialLoad } from "./components/ui/misc/InitialLoad";
import { ChatHome } from "./features/chat/chatHome";
import { InboxHome } from "./features/inbox/inboxHome";
import { NoteHome } from "./features/notes/NoteHome";
import { SpotlightOverlay } from "./features/spotlight/SpotlightOverlay";
import { CHAT_TYPE_CODE, SpotlightResult } from "./features/spotlight/types";
import { useSpotlight } from "./features/spotlight/useSpotlight";
import { TaskHome } from "./features/tasks/taskHome";
import { useAppInitialization } from "./hooks/common/useAppInitialization";
import { useGlobalServiceShortcut } from "./hooks/common/useGlobalServiceShortcut";
import { useNotifications } from "./hooks/common/useNotifications";
import { useProjectTaskManagement } from "./hooks/common/useProjectTaskManagement";
import { useServiceInitialization } from "./hooks/common/useServiceInitialization";
import { webSocketSync } from "./hooks/common/useSyncManagement";
import { ThemePreferenceProvider } from "./hooks/common/useThemePreference";
import { useThreadTaskHandling } from "./hooks/common/useThreadTaskHandling";
import { useWebSocket } from "./hooks/common/useWebSocket";
import { useWindowSize } from "./hooks/common/useWindowSize";
import { registerApiHealthListener, unregisterApiHealthListener } from "./services/api";
import { NotificationsProvider } from "./services/notifications/NotificationsContext";
import { NotificationToastHost } from "./services/notifications/NotificationToastHost";
import { PermissionBanner } from "./services/notifications/PermissionBanner";
import { NotificationIntent } from "./services/notifications/types";

const API_DOWN_THRESHOLD = 3;

export const App = () => {
    const isTooSmall = useWindowSize();
    const navigate = useNavigate();

    // Initialize app with authentication and basic setup
    const { accessToken, myself, setMyself, useUISM, useTEM } = useAppInitialization();

    // WebSocket management
    const { socketInstance, showDisconnected: showWsDisconnected } = useWebSocket(
        accessToken,
        myself,
        useTEM.currentTeamId
    );

    // API server health tracking
    const [showApiDown, setShowApiDown] = useState(false);
    const apiFailCountRef = useRef(0);
    const apiRecoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleApiHealth = useCallback((isDown: boolean) => {
        if (isDown) {
            apiFailCountRef.current += 1;
            if (apiRecoverTimerRef.current) {
                clearTimeout(apiRecoverTimerRef.current);
                apiRecoverTimerRef.current = null;
            }
            if (apiFailCountRef.current >= API_DOWN_THRESHOLD) {
                setShowApiDown(true);
            }
        } else {
            apiFailCountRef.current = 0;
            if (apiRecoverTimerRef.current) {
                clearTimeout(apiRecoverTimerRef.current);
            }
            apiRecoverTimerRef.current = setTimeout(() => {
                setShowApiDown(false);
                apiRecoverTimerRef.current = null;
            }, 1000);
        }
    }, []);

    useEffect(() => {
        registerApiHealthListener(handleApiHealth);
        return () => {
            unregisterApiHealthListener();
            if (apiRecoverTimerRef.current) {
                clearTimeout(apiRecoverTimerRef.current);
            }
        };
    }, [handleApiHealth]);

    // Project and task management
    const { usePM, useTM, useSM } = useProjectTaskManagement({
        myself,
        accessToken: accessToken || "",
        currentTeamId: useTEM.currentTeamId,
    });

    // Service-specific initialization and management
    const { useNM, useCM, useIM } = useServiceInitialization({
        myself,
        accessToken: accessToken || "",
        currentTeamId: useTEM.currentTeamId,
        isLoading: useUISM.isLoading,
        socketInstance,
    });

    // Handle thread task interactions
    useThreadTaskHandling({ useCM, useTM });

    // Global keyboard shortcut for switching services. Modifier is Ctrl+Cmd
    // on Mac, Ctrl+Alt on Windows/Linux. Letter shortcuts now compose the
    // navigation with a creation side effect: T opens Tasks and starts a
    // new task; N opens Notes and creates a new top-level My Note. The
    // Cmd+Tab–style cycle gesture (hold Cmd, tap Ctrl) is unchanged.
    const { previewIndex: serviceSwitcherPreviewIndex, mruOrder: serviceSwitcherMruOrder } =
        useGlobalServiceShortcut({
            onOpenTasksAndCreate: () => {
                navigate("/workspace/tasks");
                useTM.handleCreateTask();
            },
            onOpenNotesAndCreate: () => {
                navigate("/workspace/notes");
                void useNM.handleCreateNewMyNote(null);
            },
        });

    // Click-to-open: jump to the chat / thread / task / inbox that the
    // notification refers to. Lives here because this is the layer that has
    // every store, navigator, and helper in scope at the same time.
    const openIntent = useCallback(
        (intent: NotificationIntent) => {
            const src = intent.source;

            // Inbox: no source -> just switch services.
            if (intent.category === "inbox" || !src) {
                navigate("/workspace/inbox");
                return;
            }

            // Task / milestone: navigate to the task deep URL when we have
            // both ids; otherwise fall through to the chat branch.
            if (src.taskId !== undefined && src.projectId !== undefined) {
                navigate(`/workspace/tasks/project/${src.projectId}/task/${src.taskId}`);
                return;
            }

            // Chat / thread: orchestrate via the existing helper which loads
            // the chat and pushes the right deep URL.
            if (src.chatType !== undefined && src.chatId !== undefined) {
                const numericChatId = Number(src.chatId);
                const threadId = src.threadId ?? 0;
                useCM.moveToSpecificChat(
                    src.chatType,
                    numericChatId,
                    threadId,
                    false,
                    threadId !== 0,
                    useTM.setCurrentPreviewTaskId,
                    usePM.setCurrentProject
                );
                return;
            }

            // Defensive fallback: surface the chat service.
            navigate("/workspace/chat");
        },
        [useCM, useTM, useUISM, usePM, navigate]
    );

    // Web notifications: hydrates prefs from backend, owns permission state,
    // and exposes the manager that the websocket router pushes intents to.
    const useNotif = useNotifications(myself, accessToken, openIntent);

    // Global Cmd-K / Ctrl-K Spotlight overlay. The hook owns open/close
    // state, the keyboard listener, the debounced query, and an `onAsk`
    // stub (Phase 1 just logs; Phase 2 will dispatch the Gemini RAG
    // call). Navigation on result-click is handled here so we have
    // every navigator (useCM / navigate) in scope.
    const spotlight = useSpotlight({
        accessToken,
        teamId: useTEM.currentTeamId,
    });

    const handleSpotlightSelect = useCallback(
        (r: SpotlightResult) => {
            spotlight.close();
            if (r.entity_type === "task" && r.task_id && r.project_id) {
                navigate(`/workspace/tasks/project/${r.project_id}/task/${r.task_id}`);
                return;
            }
            if (r.entity_type === "chat" && r.chat_type && r.chat_id) {
                const chatTypeCode = CHAT_TYPE_CODE[r.chat_type];
                const numericChatId = Number(r.chat_id);
                const numericThreadId = r.thread_id ? Number(r.thread_id) : 0;
                useCM.moveToSpecificChat(
                    chatTypeCode,
                    numericChatId,
                    numericThreadId,
                    false,
                    numericThreadId !== 0,
                    useTM.setCurrentPreviewTaskId,
                    usePM.setCurrentProject
                );
                return;
            }
            if (r.entity_type === "note") {
                // Notes don't have a deep-link route yet (see plan
                // file's "Known caveats" — true note deep-link is a
                // follow-up). For now just take the user to the notes
                // home and let them find it there.
                navigate("/workspace/notes");
                return;
            }
        },
        [spotlight, navigate, useCM, useTM, usePM]
    );

    // Tell the manager which chat / thread / task is currently in view so it
    // can suppress notifications for that surface.
    useEffect(() => {
        const current = useCM.currentThreadChat
            ? {
                  chatType: useCM.currentThreadChat.chatType,
                  chatId: String(useCM.currentThreadChat.chatId),
                  threadId: useCM.currentThreadChat.threadId,
              }
            : useCM.currentMainChat
              ? {
                    chatType: useCM.currentMainChat.chatType,
                    chatId: String(useCM.currentMainChat.chatId),
                }
              : useTM.currentPreviewTaskId
                ? { taskId: useTM.currentPreviewTaskId }
                : null;
        useNotif.setActiveSurface(current);
    }, [useCM.currentMainChat, useCM.currentThreadChat, useTM.currentPreviewTaskId, useNotif]);

    // WebSocket synchronization
    webSocketSync({
        useCM: useCM,
        accessToken: accessToken,
        currentPreviewTaskId: useTM.currentPreviewTaskId,
        currentProject: usePM.currentProject,
        funcSetInboxItems: useIM.funcSetInboxItems,
        isLoading: useUISM.isLoading,
        myself: myself,
        setIsTaskCommentUpdated: useTM.setIsTaskCommentUpdated,
        setIsTaskUpdatedBySomeone: useTM.setIsTaskUpdatedBySomeone,
        socket: socketInstance,
        useTEM: useTEM,
        notificationManager: useNotif.manager,
    });

    if (isTooSmall) {
        return (
            <CssVarsProvider disableTransitionOnChange>
                <CssBaseline />
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100dvh",
                        width: "100vw",
                        textAlign: "center",
                        px: 4,
                        gap: 2,
                        bgcolor: "background.surface",
                    }}
                >
                    <ScreenRotationRoundedIcon sx={{ fontSize: 56, color: "neutral.400" }} />
                    <Typography level="h3">Window Size Too Small</Typography>
                    <Typography level="body-md" sx={{ color: "neutral.500", maxWidth: 360 }}>
                        This application is designed for desktop use. Please resize your browser
                        window or switch to a larger screen.
                    </Typography>
                </Box>
            </CssVarsProvider>
        );
    }

    return (
        <CssVarsProvider disableTransitionOnChange>
            <CssBaseline />
            <ThemePreferenceProvider>
                <NotificationsProvider value={useNotif}>
                    <NotificationToastHost
                        subscribeToasts={useNotif.subscribeToasts}
                        onOpenIntent={openIntent}
                    />
                    <ServiceSwitcherOverlay
                        mruOrder={serviceSwitcherMruOrder}
                        previewIndex={serviceSwitcherPreviewIndex}
                    />
                    <SpotlightOverlay
                        ask={spotlight.ask}
                        error={spotlight.error}
                        isLoading={spotlight.isLoading}
                        isOpen={spotlight.isOpen}
                        query={spotlight.query}
                        results={spotlight.results}
                        onApprove={spotlight.onApprove}
                        onAsk={spotlight.onAsk}
                        onClose={spotlight.close}
                        onQueryChange={spotlight.setQuery}
                        onReject={spotlight.onReject}
                        onSelect={handleSpotlightSelect}
                    />
                    <Snackbar
                        anchorOrigin={{ vertical: "top", horizontal: "center" }}
                        color="danger"
                        open={showWsDisconnected || showApiDown}
                        sx={{ gap: 1 }}
                        variant="soft"
                    >
                        <Stack spacing={0.5}>
                            {showWsDisconnected && (
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        fontWeight: 500,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <WifiOffRoundedIcon sx={{ fontSize: 16 }} />
                                    Real-time connection lost. Attempting to reconnect...
                                </Typography>
                            )}
                            {showApiDown && (
                                <Typography
                                    level="body-sm"
                                    sx={{
                                        fontWeight: 500,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <CloudOffRoundedIcon sx={{ fontSize: 16 }} />
                                    API server is unreachable.
                                </Typography>
                            )}
                        </Stack>
                    </Snackbar>
                    {useUISM.isLoading ? (
                        <InitialLoad
                            myself={myself}
                            setCurrentMainChat={useCM.setCurrentMainChat}
                            setIsLoading={useUISM.setIsLoading}
                        />
                    ) : (
                        <div className="main-container">
                            <PermissionBanner
                                masterEnabled={useNotif.preferences.masterEnabled}
                                permission={useNotif.permission}
                                requestPermission={useNotif.requestPermission}
                            />
                            {/* Sidebar lives here (outside <Routes>) so it
                                is mounted once for the whole authenticated
                                shell. Switching services only swaps the
                                routed content next to it instead of
                                remounting the sidebar each time.

                                The whole shell is wrapped in
                                <AvatarContextProvider> so any avatar
                                deep in the tree (chat bubbles, task
                                rows, comments, etc.) can resolve a
                                profile by `userId` from a single source
                                of truth instead of taking a fan-out of
                                props at every callsite. */}
                            <AvatarContextProvider
                                value={{
                                    myself,
                                    setMyself,
                                    teamMemberProfiles: useTEM.teamMemberProfiles,
                                    setTeamMemberProfiles: useTEM.setTeamMemberProfiles,
                                    socket: socketInstance,
                                    useCM,
                                    useUISM,
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        minHeight: "100dvh",
                                        width: "100vw",
                                    }}
                                >
                                    <Sidebar
                                        myself={myself}
                                        setMyself={setMyself}
                                        socket={socketInstance}
                                        useCM={useCM}
                                        useIM={useIM}
                                        useTEM={useTEM}
                                        useUISM={useUISM}
                                    />
                                    <Routes>
                                        <Route
                                            path="inbox/*"
                                            element={
                                                <InboxHome
                                                    myself={myself}
                                                    setMyself={setMyself}
                                                    socket={socketInstance}
                                                    useCM={useCM}
                                                    useIM={useIM}
                                                    useTEM={useTEM}
                                                    useUISM={useUISM}
                                                />
                                            }
                                        />
                                        <Route
                                            path="chat/*"
                                            element={
                                                <ChatHome
                                                    myself={myself}
                                                    setMyself={setMyself}
                                                    socket={socketInstance}
                                                    useCM={useCM}
                                                    useIM={useIM}
                                                    useNM={useNM}
                                                    usePM={usePM}
                                                    useSM={useSM}
                                                    useTEM={useTEM}
                                                    useTM={useTM}
                                                    useUISM={useUISM}
                                                />
                                            }
                                        />
                                        <Route
                                            path="tasks/*"
                                            element={
                                                <TaskHome
                                                    myself={myself}
                                                    setMyself={setMyself}
                                                    socket={socketInstance}
                                                    useCM={useCM}
                                                    useIM={useIM}
                                                    useNM={useNM}
                                                    usePM={usePM}
                                                    useSM={useSM}
                                                    useTEM={useTEM}
                                                    useTM={useTM}
                                                    useUISM={useUISM}
                                                />
                                            }
                                        />
                                        <Route
                                            path="notes/*"
                                            element={
                                                <NoteHome
                                                    myself={myself}
                                                    setMyself={setMyself}
                                                    socket={socketInstance}
                                                    useCM={useCM}
                                                    useIM={useIM}
                                                    useNM={useNM}
                                                    usePM={usePM}
                                                    useSM={useSM}
                                                    useTEM={useTEM}
                                                    useTM={useTM}
                                                    useUISM={useUISM}
                                                />
                                            }
                                        />
                                        {/* Default redirect to inbox */}
                                        <Route element={<Navigate to="inbox" replace />} path="" />
                                    </Routes>
                                </Box>
                            </AvatarContextProvider>
                        </div>
                    )}
                </NotificationsProvider>
            </ThemePreferenceProvider>
        </CssVarsProvider>
    );
};
