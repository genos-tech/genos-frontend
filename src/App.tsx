import "./App.css";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Box } from "@mui/joy";
import CssBaseline from "@mui/joy/CssBaseline";
import { CssVarsProvider } from "@mui/joy/styles";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

import { CalendarModalProvider, useCalendarModalState } from "./context/CalendarModalContext";
import {
    MentionGroupModalProvider,
    useMentionGroupModalState,
} from "./context/MentionGroupModalContext";
import { MentionGroupsProvider } from "./context/MentionGroupsContext";
import { FeatureErrorBoundary } from "./components/FeatureErrorBoundary";
import { BottomTabBar } from "./components/layout/BottomTabBar";
import { ConnectionStatusSnackbar } from "./components/layout/ConnectionStatusSnackbar";
import { HistoryShell } from "./components/layout/HistoryShell";
import { MentionGroupModal } from "./components/layout/MentionGroupModal";
import { MobileSpotlightFab } from "./components/layout/MobileSpotlightFab";
import {
    QuickMeetClipboardHandle,
    QuickMeetClipboardHost,
} from "./components/layout/QuickMeetClipboardHost";
import { ServiceSwitcherOverlay } from "./components/layout/ServiceSwitcherOverlay";
import { Sidebar } from "./components/layout/sidebar";
import { TooSmallScreen } from "./components/layout/TooSmallScreen";
import { UrlLinkModal } from "./components/modals/UrlLinkModal";
import { AvatarContextProvider } from "./components/ui/avatars/AvatarContext";
import { InitialLoad } from "./components/ui/misc/InitialLoad";
import { RouteLoadingFallback } from "./components/ui/misc/RouteLoadingFallback";
import { CalendarModal } from "./features/calendar/components/CalendarModal";
import { OAUTH_INTEGRATIONS_ENABLED } from "./features/integrations/featureFlags";
import { SpotlightOverlay } from "./features/spotlight/SpotlightOverlay";
import { CHAT_TYPE_CODE, SpotlightResult } from "./features/spotlight/types";
import { useSpotlight } from "./features/spotlight/useSpotlight";
import { ModalTaskDiagram } from "./features/tasks/diagram/components/ModalTaskDiagram";
import { UrlLinkModalProvider } from "./hooks/common/UrlLinkModalContext";
import { useAnalyticsIdentity } from "./hooks/common/useAnalyticsIdentity";
import { useAnalyticsPageviews } from "./hooks/common/useAnalyticsPageviews";
import { AnalyticsPreferencesProvider } from "./hooks/common/useAnalyticsPreferences";
import { useAppInitialization } from "./hooks/common/useAppInitialization";
import { BubbleStylePreferenceProvider } from "./hooks/common/useBubbleStylePreference";
import { DoubleClickTodoPreferenceProvider } from "./hooks/common/useDoubleClickTodoPreference";
import { useGlobalServiceShortcut } from "./hooks/common/useGlobalServiceShortcut";
import { HistoryProvider } from "./hooks/common/useHistory";
import { useNotifications } from "./hooks/common/useNotifications";
import { useProjectTaskManagement } from "./hooks/common/useProjectTaskManagement";
import { useServiceInitialization } from "./hooks/common/useServiceInitialization";
import { SpotlightPreferencesProvider } from "./hooks/common/useSpotlightPreferences";
import { webSocketSync } from "./hooks/common/useSyncManagement";
import { TaskSortPreferencesProvider } from "./hooks/common/useTaskSortPreferences";
import { ThemePreferenceProvider } from "./hooks/common/useThemePreference";
import { useThreadTaskHandling } from "./hooks/common/useThreadTaskHandling";
import { useUrlLinkModalState } from "./hooks/common/useUrlLinkModalState";
import { useWebSocket } from "./hooks/common/useWebSocket";
import { useWindowSize } from "./hooks/common/useWindowSize";
import { registerApiHealthListener, unregisterApiHealthListener } from "./services/api";
import { NotificationsProvider } from "./services/notifications/NotificationsContext";
import { NotificationToastHost } from "./services/notifications/NotificationToastHost";
import { PermissionBanner } from "./services/notifications/PermissionBanner";
import { NotificationIntent } from "./services/notifications/types";

import { I18nProvider } from "./i18n";
import { purpleTheme } from "./theme/purplePalette";

// Feature roots are code-split: BlockNote/Yjs (notes), the rich-text editor
// in the chat preview, @hello-pangea/dnd + the task table/board, and the
// inbox view each pull in tens of kilobytes of dependencies that we'd
// otherwise ship in the main bundle. With `lazy` + `Suspense` the chunks
// load on-demand when the user navigates to that route — initial paint
// for the workspace shell stays small.
const ChatHome = lazy(() =>
    import("./features/chat/chatHome").then((m) => ({ default: m.ChatHome }))
);
const InboxHome = lazy(() =>
    import("./features/inbox/inboxHome").then((m) => ({ default: m.InboxHome }))
);
const NoteHome = lazy(() =>
    import("./features/notes/NoteHome").then((m) => ({ default: m.NoteHome }))
);
const TaskHome = lazy(() =>
    import("./features/tasks/taskHome").then((m) => ({ default: m.TaskHome }))
);
const IntegrationsHome = lazy(() =>
    import("./features/integrations/IntegrationsHome").then((m) => ({
        default: m.IntegrationsHome,
    }))
);

const API_DOWN_THRESHOLD = 3;

// Build the canonical in-app URL for a SpotlightResult so we can feed
// it to UrlLinkModalProvider.openModalByHref (which parses URLs via
// parseInternalUrl into a ModalTarget). Returns null when there's no
// modal-capable URL — either the entity_type doesn't have a modal view
// yet (project) or the source is missing the ids needed to deep-link.
// Mirrors the URL shapes encoded in `handleSpotlightSelect` below.
const canonicalSpotlightHref = (r: SpotlightResult): string | null => {
    if (r.entity_type === "task" && r.task_id && r.project_id) {
        return `/workspace/tasks/project/${r.project_id}/task/${r.task_id}`;
    }
    if (r.entity_type === "chat" && r.chat_type && r.chat_id) {
        const base = `/workspace/chat/${r.chat_type}/${r.chat_id}`;
        const withThread = r.thread_id ? `${base}/thread/${r.thread_id}` : base;
        return r.message_id ? `${withThread}/message/${r.message_id}` : withThread;
    }
    if (r.entity_type === "note" && r.note_id) {
        if (r.note_type === "personal") {
            return `/workspace/notes/my/${r.note_id}`;
        }
        if (r.note_type === "task" && r.project_id && r.task_id) {
            return (
                `/workspace/notes/task/project/${r.project_id}` +
                `/task/${r.task_id}/note/${r.note_id}`
            );
        }
        if (r.note_type === "chat" && r.chat_type && r.chat_id) {
            // Chat notes can live on a thread or on the main channel;
            // thread_id=0 is the sentinel for "not in a thread" per the
            // existing parseInternalUrl convention.
            const tid = r.thread_id ?? "0";
            return (
                `/workspace/notes/chat/${r.chat_type}` +
                `/${r.chat_id}/thread/${tid}/note/${r.note_id}`
            );
        }
    }
    return null;
};

export const App = () => {
    const isTooSmall = useWindowSize();
    const navigate = useNavigate();

    // Initialize app with authentication and basic setup
    const { accessToken, myself, setMyself, useUISM, useTEM, useMGM } = useAppInitialization();

    // Analytics: identify the user when their profile is available and
    // emit a $pageview on every route change. Both hooks are passive
    // (`useEffect`-only) and silently no-op when PostHog isn't configured.
    useAnalyticsIdentity(myself);
    useAnalyticsPageviews();

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

    // URL-link modal: opens an in-place preview of internal chat / task /
    // note URLs clicked inside a BlockNote-rendered message. Mounted
    // once globally so the provider sits inside auth gating, all data
    // hooks, BrowserRouter, and every provider above.
    const urlLinkModal = useUrlLinkModalState({ navigate });

    // Handle thread task interactions
    useThreadTaskHandling({ useCM, useTM });

    // Global keyboard shortcut for switching services. Modifier is Ctrl+Cmd
    // on Mac, Ctrl+Alt on Windows/Linux. Letter shortcuts now compose the
    // navigation with a creation side effect: T opens Tasks and starts a
    // new task; N opens Notes and creates a new top-level My Note. The
    // Cmd+Tab–style cycle gesture (hold Cmd, tap Ctrl) is unchanged.
    // Global Calendar modal state — opened from the keyboard
    // shortcut (Ctrl+Cmd+C / Ctrl+Alt+C), the DM-myself chat
    // header IconButton, and any future entry points. The actual
    // modal renders inside `CalendarModalProvider` further down
    // the tree.
    const calendarModal = useCalendarModalState();

    // Same owner pattern for the @group click-to-open modal — state
    // lives here, provider wraps the editor tree below, the modal
    // itself mounts alongside CalendarModal further down.
    const mentionGroupModal = useMentionGroupModalState();

    // Imperative bridge to the Meet-clipboard handler, which lives
    // inside I18nProvider (so its snackbar text can be translated).
    // The shortcut listener — registered HERE, outside the provider
    // tree — just calls `meetClipboardRef.current?.trigger()`.
    const meetClipboardRef = useRef<QuickMeetClipboardHandle>(null);

    // History modal — opened from the sidebar icon and the global
    // Ctrl+Cmd+H / Ctrl+Alt+H shortcut. Same `{ isOpen, open, close }`
    // shape calendarModal uses; rendered inside <HistoryProvider> via
    // <HistoryShell> further down the tree.
    const [historyOpen, setHistoryOpen] = useState(false);
    const openHistory = useCallback(() => setHistoryOpen(true), []);
    const closeHistory = useCallback(() => setHistoryOpen(false), []);

    // Task graph modal — opened by the Ctrl+Cmd+G / Ctrl+Alt+G shortcut.
    // Anchored on the currently previewed task, so it's a no-op when no
    // task is in the preview pane (or the task has no project, since the
    // diagram fetches by project).
    const [taskDiagramOpen, setTaskDiagramOpen] = useState(false);

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
            onOpenCalendarModal: calendarModal.open,
            onQuickMeetClipboard: () => meetClipboardRef.current?.trigger(),
            onOpenHistory: openHistory,
            onOpenTaskDiagram: () => {
                const task = useTM.currentPreviewTask;
                if (useTM.currentPreviewKind !== "task" || !task?.id || !task.project?.projectId) {
                    return;
                }
                setTaskDiagramOpen(true);
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

    // Translate a Spotlight result row into the canonical deep-link URL
    // for its entity type. We set the URL directly (rather than calling
    // feature-level helpers like `useCM.moveToSpecificChat`) so:
    //   • routing logic stays in one place,
    //   • the destination page's existing URL→state effects load and
    //     focus the entity uniformly, regardless of which page we're
    //     coming from, and
    //   • the URL itself reflects the deep link, so reload/back/share
    //     all work.
    //
    // Caveat: SpotlightResult does not yet carry a message_id, so chat
    // hits can focus the right chat/thread but not the exact matching
    // message bubble. Surfacing message_id from the search response is
    // a separate backend change.
    const handleSpotlightSelect = useCallback(
        (r: SpotlightResult) => {
            spotlight.close();

            if (r.entity_type === "task" && r.task_id && r.project_id) {
                navigate(`/workspace/tasks/project/${r.project_id}/task/${r.task_id}`);
                return;
            }

            // Project chips have no preview modal; route to the project's
            // task-list view (the closest "open the project" affordance).
            if (r.entity_type === "project" && r.project_id) {
                navigate(`/workspace/tasks/project/${r.project_id}`);
                return;
            }

            if (r.entity_type === "chat" && r.chat_type && r.chat_id) {
                // Use the chat-management helper rather than a bare
                // `navigate(...)`: for a chat the user hasn't opened
                // this session, `useChatRouting`'s URL→state effect
                // calls `popSpecificMessages` which returns an empty
                // array and then silently early-returns — the URL
                // updates but `currentMainChat` is never set, so the
                // chat surface stays blank. `moveToSpecificChat` sets
                // `currentMainChat` regardless of cache state and
                // performs the navigation itself (now including any
                // `/message/:id` segment and the matching
                // moveToSpecificIndex for scroll-target).
                const chatTypeCode = CHAT_TYPE_CODE[r.chat_type];
                const numericChatId = Number(r.chat_id);
                const numericThreadId = r.thread_id ? Number(r.thread_id) : 0;
                const numericMessageId = r.message_id ? Number(r.message_id) : undefined;
                useCM.moveToSpecificChat(
                    chatTypeCode,
                    numericChatId,
                    numericThreadId,
                    false,
                    numericThreadId !== 0,
                    useTM.setCurrentPreviewTaskId,
                    usePM.setCurrentProject,
                    numericMessageId
                );
                return;
            }

            if (r.entity_type === "note" && r.note_id) {
                if (r.note_type === "personal") {
                    navigate(`/workspace/notes/my/${r.note_id}`);
                    return;
                }
                if (r.note_type === "task") {
                    // Need project_id + task_id to deep-link. project_id
                    // has been on the chunk for a while; task_id is new
                    // (chunker only just started writing it). For pre-fix
                    // chunks the task_id only exists inside
                    // `related_entity_ids` as "task:N" — parse it from
                    // there so old data works without a reindex.
                    const projectId: string | null = r.project_id;
                    let taskId: string | null = r.task_id;
                    if (!taskId) {
                        for (const rel of r.related_entity_ids || []) {
                            if (rel.startsWith("task:")) {
                                taskId = rel.slice("task:".length) || null;
                                break;
                            }
                        }
                    }
                    if (projectId && taskId) {
                        navigate(
                            `/workspace/notes/task/project/${projectId}` +
                                `/task/${taskId}/note/${r.note_id}`
                        );
                        return;
                    }
                    // No project/task coordinates anywhere — fall
                    // through to notes home.
                }
                if (r.note_type === "chat") {
                    // Chat notes need chat_type + chat_id + thread_id
                    // to deep-link. New chunks carry them as top-level
                    // fields; older chunks (pre-routing-fix) only have
                    // them inside `related_entity_ids` as strings like
                    // "dm:5" or "pm:1:thread:3". Parse from there as a
                    // fallback so old data works without a reindex.
                    let chatType: typeof r.chat_type = r.chat_type;
                    let chatId: string | null = r.chat_id;
                    let threadId: string | null = r.thread_id;
                    if (!chatType || !chatId || !threadId) {
                        for (const rel of r.related_entity_ids || []) {
                            const parts = rel.split(":");
                            const t = parts[0];
                            if (t === "dm" || t === "gm" || t === "pm" || t === "mdm") {
                                if (!chatType) chatType = t;
                                if (!chatId) chatId = parts[1] ?? null;
                                if (!threadId && parts[2] === "thread") {
                                    threadId = parts[3] ?? null;
                                }
                                break;
                            }
                        }
                    }
                    if (chatType && chatId && threadId) {
                        navigate(
                            `/workspace/notes/chat/${chatType}` +
                                `/${chatId}/thread/${threadId}/note/${r.note_id}`
                        );
                        return;
                    }
                    // Chat note without a deep-link URL (no thread_id
                    // available anywhere): fall through to notes home.
                }
                // Fallback when note metadata is incomplete.
                navigate("/workspace/notes");
                return;
            }
        },
        [spotlight, navigate, useCM, useTM, usePM]
    );

    // Inline-citation preview. Opens the existing UrlLinkModal (the same
    // surface chat-message links use) on top of the Spotlight overlay so
    // the user can quick-look the entity without losing their place in
    // the conversation. Spotlight sits at z=13100; we pass z=13200 to
    // keep the preview on top.
    //
    // For project citations there is no preview modal yet — fall through
    // to handleSpotlightSelect which closes Spotlight and routes to the
    // project's task list.
    const handleSpotlightPreview = useCallback(
        (r: SpotlightResult) => {
            const href = canonicalSpotlightHref(r);
            if (!href) {
                handleSpotlightSelect(r);
                return;
            }
            const outcome = urlLinkModal.openModalByHref(href, { zIndex: 13200 });
            if (outcome !== "opened") {
                // Either parseInternalUrl rejected our URL (shouldn't
                // happen for the shapes we build) or the kind isn't
                // modal-able. Fall back to navigating.
                handleSpotlightSelect(r);
            }
        },
        [handleSpotlightSelect, urlLinkModal]
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

    // if (isTooSmall) {
    //     return (
    //         <CssVarsProvider theme={purpleTheme} disableTransitionOnChange>
    //             <CssBaseline />
    //             <I18nProvider>
    //                 <TooSmallScreen />
    //             </I18nProvider>
    //         </CssVarsProvider>
    //     );
    // }

    return (
        <CssVarsProvider theme={purpleTheme} disableTransitionOnChange>
            <CssBaseline />
            <I18nProvider>
                <ThemePreferenceProvider>
                    <BubbleStylePreferenceProvider>
                        <DoubleClickTodoPreferenceProvider>
                            <TaskSortPreferencesProvider>
                                <SpotlightPreferencesProvider>
                                    <AnalyticsPreferencesProvider>
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
                                                aiAnswersEnabled={spotlight.aiAnswersEnabled}
                                                ask={spotlight.ask}
                                                dailyUsage={spotlight.dailyUsage}
                                                error={spotlight.error}
                                                isLoading={spotlight.isLoading}
                                                isOpen={spotlight.isOpen}
                                                query={spotlight.query}
                                                results={spotlight.results}
                                                turns={spotlight.turns}
                                                historyMode={spotlight.historyMode}
                                                historySessions={spotlight.historySessions}
                                                historyDetail={spotlight.historyDetail}
                                                historyIsLoading={spotlight.historyIsLoading}
                                                onApprove={spotlight.onApprove}
                                                onAsk={spotlight.onAsk}
                                                onCancel={spotlight.onCancel}
                                                onClose={spotlight.close}
                                                onNewConversation={spotlight.onNewConversation}
                                                onPreview={handleSpotlightPreview}
                                                onQueryChange={spotlight.setQuery}
                                                onReject={spotlight.onReject}
                                                onSelect={handleSpotlightSelect}
                                                openHistory={spotlight.openHistory}
                                                viewHistorySession={spotlight.viewHistorySession}
                                                backToHistoryList={spotlight.backToHistoryList}
                                                closeHistory={spotlight.closeHistory}
                                            />
                                            <ConnectionStatusSnackbar
                                                showApiDown={showApiDown}
                                                showWsDisconnected={showWsDisconnected}
                                            />
                                            <QuickMeetClipboardHost
                                                ref={meetClipboardRef}
                                                accessToken={accessToken}
                                            />
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
                                                        masterEnabled={
                                                            useNotif.preferences.masterEnabled
                                                        }
                                                        requestPermission={
                                                            useNotif.requestPermission
                                                        }
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
                                                            teamMemberProfiles:
                                                                useTEM.teamMemberProfiles,
                                                            setTeamMemberProfiles:
                                                                useTEM.setTeamMemberProfiles,
                                                            socket: socketInstance,
                                                            useCM,
                                                            useUISM,
                                                        }}
                                                    >
                                                        <UrlLinkModalProvider
                                                            value={{
                                                                openModalByHref:
                                                                    urlLinkModal.openModalByHref,
                                                            }}
                                                        >
                                                            <CalendarModalProvider
                                                                value={calendarModal}
                                                            >
                                                                <MentionGroupsProvider
                                                                    value={useMGM}
                                                                >
                                                                    <MentionGroupModalProvider
                                                                        value={mentionGroupModal}
                                                                    >
                                                                        <HistoryProvider
                                                                            teamId={
                                                                                useTEM.currentTeamId
                                                                            }
                                                                        >
                                                                            <UrlLinkModal
                                                                                myself={myself}
                                                                                useCM={useCM}
                                                                                useNM={useNM}
                                                                                usePM={usePM}
                                                                                useSM={useSM}
                                                                                useTEM={useTEM}
                                                                                useTM={useTM}
                                                                                useUISM={useUISM}
                                                                                accessToken={
                                                                                    accessToken
                                                                                }
                                                                                setMyself={
                                                                                    setMyself
                                                                                }
                                                                                socket={
                                                                                    socketInstance
                                                                                }
                                                                                target={
                                                                                    urlLinkModal.target
                                                                                }
                                                                                zIndex={
                                                                                    urlLinkModal.zIndex
                                                                                }
                                                                                onClose={
                                                                                    urlLinkModal.closeModal
                                                                                }
                                                                            />
                                                                            <CalendarModal
                                                                                open={
                                                                                    calendarModal.isOpen
                                                                                }
                                                                                onClose={
                                                                                    calendarModal.close
                                                                                }
                                                                            />
                                                                            <MentionGroupModal
                                                                                myself={myself}
                                                                                useCM={useCM}
                                                                                useTEM={useTEM}
                                                                                useUISM={useUISM}
                                                                                setMyself={
                                                                                    setMyself
                                                                                }
                                                                                socket={
                                                                                    socketInstance
                                                                                }
                                                                            />
                                                                            <HistoryShell
                                                                                open={historyOpen}
                                                                                useCM={useCM}
                                                                                useNM={useNM}
                                                                                usePM={usePM}
                                                                                useSM={useSM}
                                                                                useTM={useTM}
                                                                                onClose={
                                                                                    closeHistory
                                                                                }
                                                                            />
                                                                            {/* Task graph modal —
                                                                                opened by the
                                                                                Ctrl+Cmd+G /
                                                                                Ctrl+Alt+G
                                                                                shortcut. Gated on
                                                                                a previewed task
                                                                                that has a project,
                                                                                since the diagram
                                                                                walks the parent
                                                                                tree within that
                                                                                project. */}
                                                                            {taskDiagramOpen &&
                                                                                useTM
                                                                                    .currentPreviewTask
                                                                                    ?.id != null &&
                                                                                useTM
                                                                                    .currentPreviewTask
                                                                                    ?.project
                                                                                    ?.projectId !=
                                                                                    null && (
                                                                                    <ModalTaskDiagram
                                                                                        myself={
                                                                                            myself
                                                                                        }
                                                                                        open={
                                                                                            taskDiagramOpen
                                                                                        }
                                                                                        projectId={
                                                                                            useTM
                                                                                                .currentPreviewTask
                                                                                                .project
                                                                                                .projectId
                                                                                        }
                                                                                        rootLabel={
                                                                                            useTM
                                                                                                .currentPreviewTask
                                                                                                .displayId
                                                                                                ? `${useTM.currentPreviewTask.displayId} · ${useTM.currentPreviewTask.title}`
                                                                                                : useTM
                                                                                                      .currentPreviewTask
                                                                                                      .title
                                                                                        }
                                                                                        rootTaskId={Number(
                                                                                            useTM
                                                                                                .currentPreviewTask
                                                                                                .id
                                                                                        )}
                                                                                        usePM={
                                                                                            usePM
                                                                                        }
                                                                                        useSM={
                                                                                            useSM
                                                                                        }
                                                                                        useTM={
                                                                                            useTM
                                                                                        }
                                                                                        onClose={() =>
                                                                                            setTaskDiagramOpen(
                                                                                                false
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                )}
                                                                            <Box
                                                                                sx={{
                                                                                    display:
                                                                                        "flex",
                                                                                    minHeight:
                                                                                        "100dvh",
                                                                                    width: "100vw",
                                                                                }}
                                                                            >
                                                                                <Sidebar
                                                                                    myself={myself}
                                                                                    useCM={useCM}
                                                                                    useIM={useIM}
                                                                                    useTEM={useTEM}
                                                                                    setMyself={
                                                                                        setMyself
                                                                                    }
                                                                                    socket={
                                                                                        socketInstance
                                                                                    }
                                                                                    useUISM={
                                                                                        useUISM
                                                                                    }
                                                                                    onOpenHistory={
                                                                                        openHistory
                                                                                    }
                                                                                    onOpenSpotlight={
                                                                                        spotlight.open
                                                                                    }
                                                                                />
                                                                                <Routes>
                                                                                    <Route
                                                                                        path="inbox/*"
                                                                                        element={
                                                                                            <Suspense
                                                                                                fallback={
                                                                                                    <RouteLoadingFallback />
                                                                                                }
                                                                                            >
                                                                                                <InboxHome
                                                                                                    myself={
                                                                                                        myself
                                                                                                    }
                                                                                                    setMyself={
                                                                                                        setMyself
                                                                                                    }
                                                                                                    socket={
                                                                                                        socketInstance
                                                                                                    }
                                                                                                    useCM={
                                                                                                        useCM
                                                                                                    }
                                                                                                    useIM={
                                                                                                        useIM
                                                                                                    }
                                                                                                    useTEM={
                                                                                                        useTEM
                                                                                                    }
                                                                                                    useUISM={
                                                                                                        useUISM
                                                                                                    }
                                                                                                />
                                                                                            </Suspense>
                                                                                        }
                                                                                    />
                                                                                    <Route
                                                                                        path="chat/*"
                                                                                        element={
                                                                                            <FeatureErrorBoundary feature="Chat">
                                                                                                <Suspense
                                                                                                    fallback={
                                                                                                        <RouteLoadingFallback />
                                                                                                    }
                                                                                                >
                                                                                                    <ChatHome
                                                                                                        myself={
                                                                                                            myself
                                                                                                        }
                                                                                                        setMyself={
                                                                                                            setMyself
                                                                                                        }
                                                                                                        socket={
                                                                                                            socketInstance
                                                                                                        }
                                                                                                        useCM={
                                                                                                            useCM
                                                                                                        }
                                                                                                        useIM={
                                                                                                            useIM
                                                                                                        }
                                                                                                        useNM={
                                                                                                            useNM
                                                                                                        }
                                                                                                        usePM={
                                                                                                            usePM
                                                                                                        }
                                                                                                        useSM={
                                                                                                            useSM
                                                                                                        }
                                                                                                        useTEM={
                                                                                                            useTEM
                                                                                                        }
                                                                                                        useTM={
                                                                                                            useTM
                                                                                                        }
                                                                                                        useUISM={
                                                                                                            useUISM
                                                                                                        }
                                                                                                    />
                                                                                                </Suspense>
                                                                                            </FeatureErrorBoundary>
                                                                                        }
                                                                                    />
                                                                                    <Route
                                                                                        path="tasks/*"
                                                                                        element={
                                                                                            <FeatureErrorBoundary feature="Tasks">
                                                                                                <Suspense
                                                                                                    fallback={
                                                                                                        <RouteLoadingFallback />
                                                                                                    }
                                                                                                >
                                                                                                    <TaskHome
                                                                                                        myself={
                                                                                                            myself
                                                                                                        }
                                                                                                        setMyself={
                                                                                                            setMyself
                                                                                                        }
                                                                                                        socket={
                                                                                                            socketInstance
                                                                                                        }
                                                                                                        useCM={
                                                                                                            useCM
                                                                                                        }
                                                                                                        useIM={
                                                                                                            useIM
                                                                                                        }
                                                                                                        useNM={
                                                                                                            useNM
                                                                                                        }
                                                                                                        usePM={
                                                                                                            usePM
                                                                                                        }
                                                                                                        useSM={
                                                                                                            useSM
                                                                                                        }
                                                                                                        useTEM={
                                                                                                            useTEM
                                                                                                        }
                                                                                                        useTM={
                                                                                                            useTM
                                                                                                        }
                                                                                                        useUISM={
                                                                                                            useUISM
                                                                                                        }
                                                                                                    />
                                                                                                </Suspense>
                                                                                            </FeatureErrorBoundary>
                                                                                        }
                                                                                    />
                                                                                    <Route
                                                                                        path="notes/*"
                                                                                        element={
                                                                                            <FeatureErrorBoundary feature="Notes">
                                                                                                <Suspense
                                                                                                    fallback={
                                                                                                        <RouteLoadingFallback />
                                                                                                    }
                                                                                                >
                                                                                                    <NoteHome
                                                                                                        myself={
                                                                                                            myself
                                                                                                        }
                                                                                                        setMyself={
                                                                                                            setMyself
                                                                                                        }
                                                                                                        socket={
                                                                                                            socketInstance
                                                                                                        }
                                                                                                        useCM={
                                                                                                            useCM
                                                                                                        }
                                                                                                        useIM={
                                                                                                            useIM
                                                                                                        }
                                                                                                        useNM={
                                                                                                            useNM
                                                                                                        }
                                                                                                        usePM={
                                                                                                            usePM
                                                                                                        }
                                                                                                        useSM={
                                                                                                            useSM
                                                                                                        }
                                                                                                        useTEM={
                                                                                                            useTEM
                                                                                                        }
                                                                                                        useTM={
                                                                                                            useTM
                                                                                                        }
                                                                                                        useUISM={
                                                                                                            useUISM
                                                                                                        }
                                                                                                    />
                                                                                                </Suspense>
                                                                                            </FeatureErrorBoundary>
                                                                                        }
                                                                                    />
                                                                                    {OAUTH_INTEGRATIONS_ENABLED && (
                                                                                        <Route
                                                                                            path="integrations"
                                                                                            element={
                                                                                                <FeatureErrorBoundary feature="Integrations">
                                                                                                    <Suspense
                                                                                                        fallback={
                                                                                                            <RouteLoadingFallback />
                                                                                                        }
                                                                                                    >
                                                                                                        <IntegrationsHome />
                                                                                                    </Suspense>
                                                                                                </FeatureErrorBoundary>
                                                                                            }
                                                                                        />
                                                                                    )}
                                                                                    {/* Default redirect to inbox */}
                                                                                    <Route
                                                                                        path=""
                                                                                        element={
                                                                                            <Navigate
                                                                                                to="inbox"
                                                                                                replace
                                                                                            />
                                                                                        }
                                                                                    />
                                                                                </Routes>
                                                                                <BottomTabBar
                                                                                    useCM={useCM}
                                                                                    useIM={useIM}
                                                                                />
                                                                                <MobileSpotlightFab
                                                                                    onOpenSpotlight={
                                                                                        spotlight.open
                                                                                    }
                                                                                />
                                                                            </Box>
                                                                        </HistoryProvider>
                                                                    </MentionGroupModalProvider>
                                                                </MentionGroupsProvider>
                                                            </CalendarModalProvider>
                                                        </UrlLinkModalProvider>
                                                    </AvatarContextProvider>
                                                </div>
                                            )}
                                        </NotificationsProvider>
                                    </AnalyticsPreferencesProvider>
                                </SpotlightPreferencesProvider>
                            </TaskSortPreferencesProvider>
                        </DoubleClickTodoPreferenceProvider>
                    </BubbleStylePreferenceProvider>
                </ThemePreferenceProvider>
            </I18nProvider>
        </CssVarsProvider>
    );
};
