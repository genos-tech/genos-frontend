import "./App.css";

import { useCallback, useEffect, useRef, useState } from "react";
import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";
import ScreenRotationRoundedIcon from "@mui/icons-material/ScreenRotationRounded";
import WifiOffRoundedIcon from "@mui/icons-material/WifiOffRounded";
import { Box, Snackbar, Stack, Typography } from "@mui/joy";
import CssBaseline from "@mui/joy/CssBaseline";
import { CssVarsProvider } from "@mui/joy/styles";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

import { InitialLoad } from "./components/ui/misc/InitialLoad";
import { ChatHome } from "./features/chat/chatHome";
import { InboxHome } from "./features/inbox/inboxHome";
import { NoteHome } from "./features/notes/NoteHome";
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
        openingService: useUISM.openingService,
    });

    // Service-specific initialization and management
    const { useNM, useCM, useIM } = useServiceInitialization({
        myself,
        accessToken: accessToken || "",
        currentTeamId: useTEM.currentTeamId,
        isLoading: useUISM.isLoading,
        openingService: useUISM.openingService,
        socketInstance,
    });

    // Handle thread task interactions
    useThreadTaskHandling({ useCM, useTM });

    // Global keyboard shortcut for switching services. Modifier is Ctrl+Cmd
    // on Mac, Ctrl+Alt on Windows/Linux; combine with a letter (I/C/T/N) to
    // jump directly, or with ArrowLeft/ArrowRight to cycle through services.
    useGlobalServiceShortcut(useUISM.openingService, useUISM.setOpeningService);

    // Click-to-open: jump to the chat / thread / task / inbox that the
    // notification refers to. Lives here because this is the layer that has
    // every store, navigator, and helper in scope at the same time.
    const openIntent = useCallback(
        (intent: NotificationIntent) => {
            const src = intent.source;

            // Inbox: no source -> just switch services.
            if (intent.category === "inbox" || !src) {
                useUISM.setOpeningService(0);
                navigate("/Home/inbox");
                return;
            }

            // Task / milestone: navigate to the task deep URL when we have
            // both ids; otherwise fall through to the chat branch.
            if (src.taskId !== undefined && src.projectId !== undefined) {
                useUISM.setOpeningService(2);
                navigate(`/Home/tasks/project/${src.projectId}/task/${src.taskId}`);
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
                    useUISM.setOpeningService,
                    useTM.setCurrentPreviewTaskId,
                    usePM.setCurrentProject
                );
                return;
            }

            // Defensive fallback: surface the chat service.
            useUISM.setOpeningService(1);
            navigate("/Home/chat");
        },
        [useCM, useTM, useUISM, usePM, navigate]
    );

    // Web notifications: hydrates prefs from backend, owns permission state,
    // and exposes the manager that the websocket router pushes intents to.
    const useNotif = useNotifications(myself, accessToken, openIntent);

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
                    <Snackbar
                        anchorOrigin={{ vertical: "top", horizontal: "center" }}
                        open={showWsDisconnected || showApiDown}
                        color="danger"
                        variant="soft"
                        sx={{ gap: 1 }}
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
                                permission={useNotif.permission}
                                masterEnabled={useNotif.preferences.masterEnabled}
                                requestPermission={useNotif.requestPermission}
                            />
                            <Routes>
                                <Route
                                    path="inbox/*"
                                    element={
                                        <InboxHome
                                            useCM={useCM}
                                            useIM={useIM}
                                            myself={myself}
                                            setMyself={setMyself}
                                            socket={socketInstance}
                                            useTEM={useTEM}
                                            useUISM={useUISM}
                                        />
                                    }
                                />
                                <Route
                                    path="chat/*"
                                    element={
                                        <ChatHome
                                            useCM={useCM}
                                            useIM={useIM}
                                            myself={myself}
                                            useNM={useNM}
                                            usePM={usePM}
                                            setMyself={setMyself}
                                            socket={socketInstance}
                                            useTEM={useTEM}
                                            useTM={useTM}
                                            useSM={useSM}
                                            useUISM={useUISM}
                                        />
                                    }
                                />
                                <Route
                                    path="tasks/*"
                                    element={
                                        <TaskHome
                                            useCM={useCM}
                                            useIM={useIM}
                                            myself={myself}
                                            useNM={useNM}
                                            usePM={usePM}
                                            setMyself={setMyself}
                                            socket={socketInstance}
                                            useTEM={useTEM}
                                            useTM={useTM}
                                            useSM={useSM}
                                            useUISM={useUISM}
                                        />
                                    }
                                />
                                <Route
                                    path="notes/*"
                                    element={
                                        <NoteHome
                                            useCM={useCM}
                                            useIM={useIM}
                                            myself={myself}
                                            useNM={useNM}
                                            usePM={usePM}
                                            setMyself={setMyself}
                                            socket={socketInstance}
                                            useTEM={useTEM}
                                            useTM={useTM}
                                            useSM={useSM}
                                            useUISM={useUISM}
                                        />
                                    }
                                />
                                {/* Default redirect to inbox */}
                                <Route path="" element={<Navigate to="inbox" replace />} />
                            </Routes>
                        </div>
                    )}
                </NotificationsProvider>
            </ThemePreferenceProvider>
        </CssVarsProvider>
    );
};
