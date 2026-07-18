// `simple-import-sort` and the prettier import-sort plugin disagree on
// the order of `react` vs the alphabetically-earlier `@mui/...` block.
// Prettier wins (it reformats on save); disable simple-import-sort.
import "./App.css";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/joy";
import CssBaseline from "@mui/joy/CssBaseline";
import { CssVarsProvider } from "@mui/joy/styles";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { CalendarModalProvider, useCalendarModalState } from "./context/CalendarModalContext";
import { HashMentionDataProvider } from "./context/HashMentionDataContext";
import {
    MentionGroupModalProvider,
    useMentionGroupModalState,
} from "./context/MentionGroupModalContext";
import { MentionGroupsProvider } from "./context/MentionGroupsContext";
import { TeamEmojiProvider } from "./context/TeamEmojiContext";
import { SessionSupersededOverlay } from "./components/common/SessionSupersededOverlay";
import { FeatureErrorBoundary } from "./components/FeatureErrorBoundary";
import { BillingReturnSnackbar } from "./components/layout/BillingReturnSnackbar";
import { BottomTabBar } from "./components/layout/BottomTabBar";
import { ConnectionStatusSnackbar } from "./components/layout/ConnectionStatusSnackbar";
import { HistoryShell } from "./components/layout/HistoryShell";
import { MentionGroupModal } from "./components/layout/MentionGroupModal";
import { MobileSpotlightFab } from "./components/layout/MobileSpotlightFab";
import {
    QuickMeetClipboardHandle,
    QuickMeetClipboardHost,
} from "./components/layout/QuickMeetClipboardHost";
import { RequestErrorSnackbar } from "./components/layout/RequestErrorSnackbar";
import { ServiceSwitcherOverlay } from "./components/layout/ServiceSwitcherOverlay";
import { Sidebar } from "./components/layout/sidebar";
import { UrlLinkModal } from "./components/modals/UrlLinkModal";
import { AvatarContextProvider } from "./components/ui/avatars/AvatarContext";
import { InitialLoad } from "./components/ui/misc/InitialLoad";
import { RouteLoadingFallback } from "./components/ui/misc/RouteLoadingFallback";
import { CalendarModal } from "./features/calendar/components/CalendarModal";
import { useIsV3ChatEnabled } from "./features/channel/chatRolloutFlags";
import { OAUTH_INTEGRATIONS_ENABLED } from "./features/integrations/featureFlags";
import { SpotlightOverlay } from "./features/spotlight/SpotlightOverlay";
import { SpotlightSettingsModal } from "./features/spotlight/SpotlightSettingsModal";
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
import { useReconcileMyselfAvatar } from "./hooks/common/useReconcileMyselfAvatar";
import { useServiceInitialization } from "./hooks/common/useServiceInitialization";
import { SpotlightPreferencesProvider } from "./hooks/common/useSpotlightPreferences";
import { webSocketSync } from "./hooks/common/useSyncManagement";
import { TaskSortPreferencesProvider } from "./hooks/common/useTaskSortPreferences";
import { ThemePreferenceProvider } from "./hooks/common/useThemePreference";
import { useThreadTaskHandling } from "./hooks/common/useThreadTaskHandling";
import { useUrlLinkModalState } from "./hooks/common/useUrlLinkModalState";
import { useWakeRefresh } from "./hooks/common/useWakeRefresh";
import { useWebSocket } from "./hooks/common/useWebSocket";
import { useWindowSize } from "./hooks/common/useWindowSize";
import { useTodoGroups } from "./hooks/useTodoGroups";
import { registerApiHealthListener, unregisterApiHealthListener } from "./services/api";
import { useChannelServiceBootstrap } from "./services/channel/useChannelServiceBootstrap";
import { NotificationsProvider } from "./services/notifications/NotificationsContext";
import { NotificationToastHost } from "./services/notifications/NotificationToastHost";
import { PermissionBanner } from "./services/notifications/PermissionBanner";
import { NotificationIntent } from "./services/notifications/types";
import { refreshAllData } from "./services/refreshAllData";
import { useRuntimeConfigBootstrap } from "./services/runtimeConfig/useRuntimeConfig";
import { canonicalSpotlightHref, milestoneIdFromEntityId } from "./utils/canonicalSpotlightHref";
import { parseInternalUrl } from "./utils/parseInternalUrl";

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
const PlansHome = lazy(() =>
    import("./features/billing/PlansHome").then((m) => ({ default: m.PlansHome }))
);
// The v3 chat shell's import graph reaches the message composer and
// the whole BlockNote editor stack (the ~900 kB gzipped vendor-editor
// chunk). Loading it lazily keeps that out of the initial entry — the
// rollout flag it used to be co-located with lives in
// `chatRolloutFlags.ts` precisely so this import can be deferred.
const V3ChatShell = lazy(() =>
    import("./features/channel/V3ChatShell").then((m) => ({ default: m.V3ChatShell }))
);

const API_DOWN_THRESHOLD = 3;

// Chip/citation → in-app URL mapping lives in
// `utils/canonicalSpotlightHref` (extracted for unit testing); keep its
// URL shapes in sync with `handleSpotlightSelect` below.

export const App = () => {
    // Call retained for the hook's resize-listener side effects; the
    // `isTooSmall` gate around `<TooSmallScreen />` is currently
    // commented out (see history) so the return value isn't read.
    useWindowSize();
    const navigate = useNavigate();
    const location = useLocation();

    // Initialize app with authentication and basic setup
    const {
        accessToken,
        myself,
        setMyself,
        useUISM,
        useTEM,
        useMGM,
        useTEJ,
        supersededByTeamName,
    } = useAppInitialization();

    // Analytics: identify the user when their profile is available and
    // emit a $pageview on every route change. Both hooks are passive
    // (`useEffect`-only) and silently no-op when PostHog isn't configured.
    useAnalyticsIdentity(myself);
    useAnalyticsPageviews();

    // Keep the logged-in user's own avatar in sync with the authoritative
    // team-members store, so a second session (or a post-change reload) doesn't
    // render a stale/blank self-avatar from localStorage. See the hook for why.
    useReconcileMyselfAvatar(myself, setMyself, useTEM.teamMemberProfiles);

    // WebSocket management
    const { socketInstance, showDisconnected: showWsDisconnected } = useWebSocket(
        accessToken,
        myself,
        useTEM.currentTeamId
    );

    // v3 messaging stack: opens a parallel `/v3` namespace socket,
    // wires `channelService` (token / user id / socket), registers
    // the inbound event router, and hydrates the in-memory store
    // from IDB. The legacy chat surfaces continue using
    // `socketInstance` above; v3-aware surfaces (mounted via the
    // `useChannel` / `useChannelList` hooks) consume `channelService`
    // directly. Side-by-side until the legacy paths are deleted.
    useChannelServiceBootstrap(accessToken, myself.userId || null);

    // Runtime config: poll `/api/v2/runtime-config` on auth ready and every
    // 60s. Source of truth for the per-chat-type v3 rollout flags and
    // the panic switch. Silent / fail-closed if the endpoint errors.
    useRuntimeConfigBootstrap(accessToken, myself.userId || null);

    // v3 chat gate. True iff build-time env var OR a per-chat-kind
    // runtime flag is rolled out to this user (panic switch overrides).
    // Re-evaluates on each config poll so a server-side rollout flip
    // propagates within ≤60s without a reload.
    const v3ChatEnabled = useIsV3ChatEnabled();

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

    // Project and task management. Keys sorted per `sort-keys`.
    const { usePM, useTM, useSM } = useProjectTaskManagement({
        accessToken: accessToken || "",
        currentTeamId: useTEM.currentTeamId,
        myself,
    });

    // Service-specific initialization and management.
    const { useNM, useCM, useIM } = useServiceInitialization({
        accessToken: accessToken || "",
        currentTeamId: useTEM.currentTeamId,
        isLoading: useUISM.isLoading,
        myself,
        socketInstance,
    });

    // Daily todo groups — one instance for the whole app: the chat todo
    // pane (prop-drilled through ChatHome) and the agent-input "#"
    // mention picker (via HashMentionDataContext) share it.
    const useTG = useTodoGroups(myself, accessToken);

    // Backing data for the "#" mention menu (tasks / notes / GM chats /
    // projects), fed to every editor's `HashSuggestionMenuController` via
    // `HashMentionDataProvider`. Memoized so the four arrays keep stable
    // refs across renders — the menu builder's per-editor WeakMap cache
    // only hits while these references are unchanged, so without this each
    // keystroke would re-merge the lists. Notes are merged into one list,
    // each row tagged with its kind so the chip can rebuild the right
    // deep-link URL; chats are pre-filtered to GM (chatType === 2).
    const hashMentionData = useMemo(
        () => ({
            tasks: useTM.allTasks,
            notes: [
                ...useNM.myNoteMeta.map((m) => ({ kind: "my" as const, ...m })),
                ...useNM.taskNoteMeta.map((m) => ({ kind: "task" as const, ...m })),
                ...useNM.chatNoteMeta.map((m) => ({ kind: "chat" as const, ...m })),
                ...useNM.sharedNoteMeta.map((m) => ({ kind: "shared" as const, ...m })),
            ],
            chats: useCM.allChats.filter((c) => c.chatType === 2),
            allChats: useCM.allChats,
            projects: usePM.teamProjects,
            todoGroups: useTG.groups,
            myself,
        }),
        [
            useTM.allTasks,
            useNM.myNoteMeta,
            useNM.taskNoteMeta,
            useNM.chatNoteMeta,
            useNM.sharedNoteMeta,
            useCM.allChats,
            usePM.teamProjects,
            useTG.groups,
            myself,
        ]
    );

    // Team roster for the Spotlight ask-input's `@` mention menu. The
    // overlay mounts above AvatarContext, so it can't read
    // teamMemberProfiles from context like the Ask modals do. Memoized:
    // Object.values would otherwise mint a fresh array every render and
    // defeat the mention-source memos downstream.
    const spotlightMentionMembers = useMemo(
        () => Object.values(useTEM.teamMemberProfiles),
        [useTEM.teamMemberProfiles]
    );

    // Push freshly-cached IDB data into React state after a background
    // network refresh writes it. Shared by the cache-first boot refresh and
    // the wake refresh — both refresh IDB, then call this to repaint.
    const onIDBRefreshed = useCallback(async () => {
        await Promise.allSettled([
            useCM.funcSetAllChats(),
            useCM.funcSetFlaggedMessages(),
            useCM.funcSetActivityMessages(),
            useTEM.funcSetTeamMembers(),
            usePM.currentProject?.projectId
                ? usePM.refreshProjectTasks(usePM.currentProject.projectId)
                : Promise.resolve(),
        ]);
    }, [useCM, useTEM, usePM]);
    // Held in a ref so the once-per-team boot effect below doesn't re-run (and
    // re-fire the refresh) every time these manager objects get a new identity.
    const onIDBRefreshedRef = useRef(onIDBRefreshed);
    onIDBRefreshedRef.current = onIDBRefreshed;

    // Cache-first boot: `loadInitialData` renders the shell from IDB, while
    // THIS fires the network hydration in the background — once per team.
    // Living in `App` (not the short-lived `<InitialLoad>`, which unmounts the
    // moment the spinner clears) is what lets the `onIDBRefreshed` re-pull
    // actually run after the fresh data lands. `firstRefreshDone` unblocks the
    // cold-start path in `loadInitialData` (empty cache → wait for this).
    const [firstRefreshDone, setFirstRefreshDone] = useState(false);
    const bootRefreshedTeamRef = useRef<string | null>(null);
    useEffect(() => {
        if (!accessToken || !myself.userId || !useTEM.currentTeamId) return;
        if (bootRefreshedTeamRef.current === useTEM.currentTeamId) return;
        bootRefreshedTeamRef.current = useTEM.currentTeamId;
        setFirstRefreshDone(false);
        let cancelled = false;
        // currentProject is usually not loaded yet at boot; fall back to the
        // last-open project so tasks refresh too.
        const lastProjectId = Number(localStorage.getItem("lastProjectId")) || null;
        void refreshAllData({
            accessToken,
            currentProjectId: usePM.currentProject?.projectId ?? lastProjectId,
            myself,
            onIDBRefreshed: () => onIDBRefreshedRef.current(),
        }).finally(() => {
            if (!cancelled) setFirstRefreshDone(true);
        });
        return () => {
            cancelled = true;
        };
        // `usePM.currentProject` is read only for the initial project id; the
        // team ref guards against re-firing when it (or the token) later change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken, myself.userId, useTEM.currentTeamId]);

    // When the user returns from a long idle (closed laptop overnight,
    // backgrounded tab for hours) or after the browser regains network,
    // re-run the boot-time loaders so stale IDB is repopulated from the
    // API. Without this, the chat list / task table / sidebar show
    // whatever was cached before the offline stretch — anything that
    // happened while the WS was disconnected is silently missed.
    useWakeRefresh(() => {
        return refreshAllData({
            accessToken: accessToken || null,
            currentProjectId: usePM.currentProject?.projectId ?? null,
            myself,
            onIDBRefreshed,
        });
    });

    // URL-link modal: opens an in-place preview of internal chat / task /
    // note URLs clicked inside a BlockNote-rendered message. Mounted
    // once globally so the provider sits inside auth gating, all data
    // hooks, BrowserRouter, and every provider above.
    const urlLinkModal = useUrlLinkModalState({ navigate });

    // Fresh-load todo deep link: /workspace/todo/... has no page route
    // (the /workspace/* catch-all renders nothing), so a pasted URL
    // would land on a blank workspace. Mirror how a pasted chat-message
    // URL behaves — open the PAGE, not the preview modal (the modal is
    // reserved for clicked links): route to the self-DM with the todo
    // pane flipped visible and hand the focus target to ToDoPane via
    // sessionStorage — ChatHome/ToDoPane aren't mounted yet on a fresh
    // load, so a CustomEvent would be lost. One-shot; waits for the
    // chat list so the self-DM is resolvable.
    const todoDeepLinkHandledRef = useRef(false);
    useEffect(() => {
        if (todoDeepLinkHandledRef.current) return;
        if (!accessToken || !myself.userId) return;
        if (!window.location.pathname.startsWith("/workspace/todo/")) return;
        const classified = parseInternalUrl(window.location.pathname);
        if (classified.kind !== "todo") {
            todoDeepLinkHandledRef.current = true;
            return;
        }
        const selfDm = useCM.allChats.find(
            (c) => c.chatType === 1 && c.dmPartnerUser?.userId === myself.userId
        );
        // Chat list not loaded yet — the allChats dep re-runs us.
        if (!selfDm) return;
        todoDeepLinkHandledRef.current = true;
        localStorage.setItem("isToDoVisible", "true");
        sessionStorage.setItem(
            "todoDeepLinkTarget",
            JSON.stringify({ itemId: classified.itemId, localDate: classified.localDate })
        );
        // PUNCH LIST (v3 chatId migration): same legacy-slot cast as the
        // Spotlight todo branch below.
        useCM.moveToSpecificChat(
            1,
            selfDm.chatId as unknown as number,
            0,
            false,
            false,
            useTM.setCurrentPreviewTaskId,
            usePM.setCurrentProject,
            undefined
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken, myself.userId, useCM.allChats]);

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
    // Anchored on the currently previewed task OR milestone, so it's a
    // no-op when neither is in the preview pane (or the entity is missing
    // a project / backing task id, since the diagram fetches by project
    // and walks the parent tree from a task node).
    const [taskDiagramOpen, setTaskDiagramOpen] = useState(false);

    // Unified diagram target: covers both the task-preview and
    // milestone-preview cases so the shortcut handler and the modal
    // render block share one source of truth. Returns null when no
    // valid entity is previewed — both call sites use that as the gate.
    const taskDiagramTarget = useMemo<{
        projectId: number;
        rootTaskId: number;
        rootLabel: string;
    } | null>(() => {
        if (useTM.currentPreviewKind === "task") {
            const task = useTM.currentPreviewTask;
            if (!task?.id || !task.project?.projectId) return null;
            return {
                projectId: task.project.projectId,
                rootLabel: task.displayId ? `${task.displayId} · ${task.title}` : task.title,
                // Walk up to the hierarchy root so the diagram shows the
                // milestone / parent / siblings rather than a lone leaf.
                rootTaskId: Number(task.rootTaskId ?? task.id),
            };
        }
        if (useTM.currentPreviewKind === "milestone") {
            const projectId = usePM.currentProject?.projectId;
            if (!projectId) return null;
            const milestone = useSM.projectMilestones[projectId]?.find(
                (m) => m.milestoneId === useTM.currentPreviewMilestoneId
            );
            if (!milestone || milestone.taskId == null || milestone.projectId == null) {
                return null;
            }
            return {
                projectId: milestone.projectId,
                // Match the label used by the in-pane button in
                // MilestonePreviewInner so the shortcut and click paths
                // open visually identical diagrams.
                rootLabel: `${milestone.title || "Milestone"} · diagram`,
                rootTaskId: milestone.taskId,
            };
        }
        return null;
    }, [
        useTM.currentPreviewKind,
        useTM.currentPreviewTask,
        useTM.currentPreviewMilestoneId,
        usePM.currentProject?.projectId,
        useSM.projectMilestones,
    ]);

    const { previewIndex: serviceSwitcherPreviewIndex, mruOrder: serviceSwitcherMruOrder } =
        useGlobalServiceShortcut({
            onOpenCalendarModal: calendarModal.open,
            onOpenHistory: openHistory,
            onOpenNotesAndCreate: () => {
                navigate("/workspace/notes");
                void useNM.handleCreateNewMyNote(null);
            },
            onOpenTaskDiagram: () => {
                if (!taskDiagramTarget) return;
                setTaskDiagramOpen(true);
            },
            onOpenTasksAndCreate: () => {
                navigate("/workspace/tasks");
                useTM.handleCreateTask();
            },
            onQuickMeetClipboard: () => meetClipboardRef.current?.trigger(),
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

            // Note mentions (surface 6/7/8): open the NOTE, not the task or
            // chat it lives in. MUST branch before the task/chat branches —
            // a task-note mention carries taskId+projectId (which would
            // otherwise open the task) and a chat-note carries chat routing
            // (which would otherwise hit the chat branch). Open via
            // `loadNote(noteType, noteId)` — the same path the Unread sidebar
            // uses — so it works for EVERY note type by id alone, with no
            // dependence on URL params or the backend shipping parent-chat
            // routing. `navigate("/workspace/notes")` just ensures the notes
            // surface is mounted; `loadNote` then opens the specific note and
            // `useNoteRouting` syncs the deep URL.
            if (src.surfaceType === 6 || src.surfaceType === 7 || src.surfaceType === 8) {
                const noteId = src.noteId;
                navigate("/workspace/notes");
                if (noteId !== undefined) {
                    const noteType = src.surfaceType - 5; // 6→1 (my), 7→2 (task), 8→3 (chat)
                    useNM.setCurrentNoteType(noteType);
                    void useNM.loadNote(noteType, noteId, -1);
                }
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
                // `src.chatId` is the v3 channel UUID (string). Pass it
                // through unchanged — `Number(uuid)` -> NaN here produced
                // `/workspace/chat/dm/NaN` (same class as the Spotlight
                // branch below; this notification-click branch was missed
                // in that fix). The `as unknown as number` keeps
                // moveToSpecificChat's legacy `chatId: number` param type.
                const numericChatId = src.chatId as unknown as number;
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
        [useCM, useTM, usePM, useNM, navigate]
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
    // Spotlight-scoped settings modal (LLM model picker + AI-answer
    // toggles), opened from the gear icon on the Spotlight bar. Local
    // to the App root so the dialog can layer above the overlay.
    const [spotlightSettingsOpen, setSpotlightSettingsOpen] = useState(false);

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
            // A collected past answer has no entity to navigate to — render it
            // inline in the overlay (reusing the live-answer renderer) instead
            // of closing Spotlight. Its own source chips still route normally
            // (they carry chat/task/note/project entity types, not this one).
            if (r.entity_type === "spotlight_answer") {
                spotlight.showStoredAnswer(r);
                return;
            }

            spotlight.close();

            // Milestones deep-link to the milestone route (the id rides
            // in entity_id — see canonicalSpotlightHref for why routing
            // through the backing task broke fresh milestones).
            if (r.entity_type === "milestone" && r.project_id) {
                const milestoneId = milestoneIdFromEntityId(r.entity_id);
                if (milestoneId != null) {
                    navigate(`/workspace/tasks/project/${r.project_id}/milestone/${milestoneId}`);
                    return;
                }
                if (r.task_id) {
                    navigate(`/workspace/tasks/project/${r.project_id}/task/${r.task_id}`);
                    return;
                }
            }

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
                // `chat_id` is the v3 channel UUID (string). It used to be
                // a legacy integer — hence the old `Number(r.chat_id)`,
                // which now yields `NaN` for a UUID and produced
                // `/workspace/chat/dm/NaN`. `moveToSpecificChat` matches on
                // `String(chatId)` against the UUID-keyed chat list and
                // interpolates the id straight into the URL, so pass it
                // through unchanged. The `as unknown as number` keeps the
                // helper's legacy `chatId: number` param type — the same
                // migration shim used wherever v3 UUIDs ride the legacy
                // numeric chat-id slot.
                // `chat_id` (channel), `thread_id` (thread-root Message.id)
                // and `message_id` are all v3 UUID strings now — pass them
                // through so the chip deep-links to the exact thread / message
                // bubble. `moveToSpecificChat` treats ""/undefined as "no
                // focus" and resolves UUID ids directly (the old
                // `Number(...)` coerced UUIDs to NaN and silently dropped the
                // focus, which is why chips only opened the chat top).
                const chatId = r.chat_id;
                const threadId = r.thread_id ?? "";
                const messageId = r.message_id ?? undefined;
                useCM.moveToSpecificChat(
                    chatTypeCode,
                    chatId,
                    threadId,
                    false,
                    Boolean(r.thread_id),
                    useTM.setCurrentPreviewTaskId,
                    usePM.setCurrentProject,
                    messageId
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

            // Todos have no dedicated route — the ToDoPane lives inside
            // the user's self-DM. Route to that DM and dispatch a
            // `openTodoPane` event that chatHome consumes to flip the
            // pane visible (it persists in localStorage too so a
            // subsequent reload keeps the user on the pane).
            if (r.entity_type === "todo") {
                const selfDm = useCM.allChats.find(
                    (c) => c.chatType === 1 && c.dmPartnerUser?.userId === myself.userId
                );
                localStorage.setItem("isToDoVisible", "true");
                // Hand the clicked item to ToDoPane so it can scroll to
                // and highlight it: sessionStorage covers a pane that
                // mounts later; the event detail covers one already
                // mounted (its listener consumes the same shape).
                const todoMatch = /^todo:(\d{4}-\d{2}-\d{2})(?::item:(\d+))?$/.exec(
                    r.entity_id || ""
                );
                const focusDetail = todoMatch
                    ? {
                          itemId: todoMatch[2] ? Number(todoMatch[2]) : undefined,
                          localDate: todoMatch[1],
                      }
                    : null;
                if (focusDetail) {
                    sessionStorage.setItem("todoDeepLinkTarget", JSON.stringify(focusDetail));
                }
                window.dispatchEvent(new CustomEvent("openTodoPane", { detail: focusDetail }));
                if (selfDm) {
                    // PUNCH LIST (v3 chatId migration): `selfDm.chatId`
                    // is `string` post-flip; `moveToSpecificChat`'s
                    // signature still takes `number` (its internal
                    // legacy services do too — see the punch-list note
                    // in `useChatManagement`). Cast at the boundary
                    // until that hook's signature flips.
                    useCM.moveToSpecificChat(
                        1,
                        selfDm.chatId as unknown as number,
                        0,
                        false,
                        false,
                        useTM.setCurrentPreviewTaskId,
                        usePM.setCurrentProject,
                        undefined
                    );
                } else {
                    // No self-DM cached locally yet — drop the user on
                    // the workspace root; the chat list will populate
                    // and the pane opens on first self-DM click.
                    navigate("/workspace");
                }
                return;
            }
        },
        // `myself.userId` reads the auth-stable user id — it doesn't
        // change for the lifetime of this component once auth settles,
        // so including it would just churn the callback identity on
        // every render with no behavior change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                  chatId: String(useCM.currentThreadChat.chatId),
                  chatType: useCM.currentThreadChat.chatType,
                  threadId: useCM.currentThreadChat.threadId,
              }
            : useCM.currentMainChat
              ? {
                    chatId: String(useCM.currentMainChat.chatId),
                    chatType: useCM.currentMainChat.chatType,
                }
              : useTM.currentPreviewTaskId
                ? { taskId: useTM.currentPreviewTaskId }
                : null;
        useNotif.setActiveSurface(current);
    }, [useCM.currentMainChat, useCM.currentThreadChat, useTM.currentPreviewTaskId, useNotif]);

    // WebSocket synchronization. Keys sorted per `sort-keys`.
    webSocketSync({
        accessToken: accessToken,
        currentPreviewTaskId: useTM.currentPreviewTaskId,
        currentProject: usePM.currentProject,
        funcSetInboxItems: useIM.funcSetInboxItems,
        isLoading: useUISM.isLoading,
        myself: myself,
        notificationManager: useNotif.manager,
        setIsTaskCommentUpdated: useTM.setIsTaskCommentUpdated,
        setIsTaskUpdatedBySomeone: useTM.setIsTaskUpdatedBySomeone,
        socket: socketInstance,
        useCM: useCM,
        useTEM: useTEM,
    });

    // ---- Keep-alive navigation -------------------------------------------
    // chat/tasks/notes Homes mount on first visit and stay mounted (hidden)
    // thereafter, so switching between them no longer tears down and rebuilds
    // their heavy subtrees (Notes' BlockNote/Yjs editors, the Tasks table, the
    // chat panels) — that rebuild was the multi-second navigation freeze.
    // Inbox stays route-driven (it is light and uses nested <Routes>/useParams).
    const activeService = useMemo<"chat" | "tasks" | "notes" | "inbox" | null>(() => {
        const p = location.pathname;
        if (p.includes("/workspace/chat")) return "chat";
        if (p.includes("/workspace/tasks")) return "tasks";
        if (p.includes("/workspace/notes")) return "notes";
        if (p.includes("/workspace/inbox")) return "inbox";
        return null;
    }, [location.pathname]);

    const [mountedHomes, setMountedHomes] = useState<ReadonlySet<string>>(() => new Set());
    // Include the active heavy service synchronously so its first visit paints
    // immediately, without one blank frame before the effect below commits.
    const homesToRender = useMemo<ReadonlySet<string>>(() => {
        if (activeService && activeService !== "inbox" && !mountedHomes.has(activeService)) {
            return new Set(mountedHomes).add(activeService);
        }
        return mountedHomes;
    }, [mountedHomes, activeService]);
    useEffect(() => {
        if (activeService && activeService !== "inbox" && !mountedHomes.has(activeService)) {
            setMountedHomes((prev) => new Set(prev).add(activeService));
        }
    }, [activeService, mountedHomes]);

    // Prewarm the lazy route chunks once the shell is up and the browser is
    // idle, so the first visit to a section doesn't pay the chunk download.
    // React.lazy dedupes, so this only pre-warms.
    useEffect(() => {
        if (useUISM.isLoading) return;
        const w = window as unknown as {
            requestIdleCallback?: (cb: () => void) => number;
            cancelIdleCallback?: (h: number) => void;
        };
        const ric: (cb: () => void) => number =
            w.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
        const cic: (h: number) => void = w.cancelIdleCallback ?? window.clearTimeout;
        const handle = ric(() => {
            void import("./features/chat/chatHome");
            void import("./features/tasks/taskHome");
            void import("./features/notes/NoteHome");
            void import("./features/inbox/inboxHome");
        });
        return () => cic(handle);
    }, [useUISM.isLoading]);

    // Shared manager bag for the three keep-alive Homes (identical prop set).
    const homeManagers = {
        myself,
        setMyself,
        socket: socketInstance,
        useCM,
        useIM,
        useNM,
        usePM,
        useSM,
        useTEM,
        useTM,
        useUISM,
    };

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
                {/* Blocks the tab when another tab takes over the single
                    browser session with a different team/user (see
                    useMyself). Sits above everything; renders nothing in
                    the normal case. */}
                <SessionSupersededOverlay teamName={supersededByTeamName} />
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
                                            {/* Second HashMentionDataProvider: the overlay
                                                mounts above the main provider tree (line
                                                ~1000), so it gets its own wrapper reusing
                                                the same memoized value — the ask input's
                                                `#` mention menu reads it via context. */}
                                            <HashMentionDataProvider value={hashMentionData}>
                                                <SpotlightOverlay
                                                    aiAnswersEnabled={spotlight.aiAnswersEnabled}
                                                    ask={spotlight.ask}
                                                    backToHistoryList={spotlight.backToHistoryList}
                                                    closeHistory={spotlight.closeHistory}
                                                    dailyUsage={spotlight.dailyUsage}
                                                    error={spotlight.error}
                                                    filterServices={spotlight.filterServices}
                                                    historyDetail={spotlight.historyDetail}
                                                    historyIsLoading={spotlight.historyIsLoading}
                                                    historyMode={spotlight.historyMode}
                                                    historySessions={spotlight.historySessions}
                                                    isLoading={spotlight.isLoading}
                                                    isOpen={spotlight.isOpen}
                                                    mentionGroups={useMGM.mentionGroups}
                                                    mentionMembers={spotlightMentionMembers}
                                                    openHistory={spotlight.openHistory}
                                                    query={spotlight.query}
                                                    results={spotlight.results}
                                                    turns={spotlight.turns}
                                                    viewHistorySession={
                                                        spotlight.viewHistorySession
                                                    }
                                                    onApprove={spotlight.onApprove}
                                                    onAsk={spotlight.onAsk}
                                                    onCancel={spotlight.onCancel}
                                                    onClose={spotlight.close}
                                                    onFeedback={spotlight.submitFeedback}
                                                    onNewConversation={spotlight.onNewConversation}
                                                    onOpenSettings={() =>
                                                        setSpotlightSettingsOpen(true)
                                                    }
                                                    onPreview={handleSpotlightPreview}
                                                    onQueryChange={spotlight.setQuery}
                                                    onReject={spotlight.onReject}
                                                    onSelect={handleSpotlightSelect}
                                                    onToggleFilterService={
                                                        spotlight.onToggleFilterService
                                                    }
                                                />
                                            </HashMentionDataProvider>
                                            <SpotlightSettingsModal
                                                open={spotlightSettingsOpen}
                                                onClose={() => setSpotlightSettingsOpen(false)}
                                            />
                                            <ConnectionStatusSnackbar
                                                showApiDown={showApiDown}
                                                showWsDisconnected={showWsDisconnected}
                                            />
                                            <RequestErrorSnackbar />
                                            <BillingReturnSnackbar />
                                            <QuickMeetClipboardHost
                                                ref={meetClipboardRef}
                                                accessToken={accessToken}
                                            />
                                            {useUISM.isLoading ? (
                                                <InitialLoad
                                                    myself={myself}
                                                    setCurrentMainChat={useCM.setCurrentMainChat}
                                                    setIsLoading={useUISM.setIsLoading}
                                                    firstRefreshDone={firstRefreshDone}
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
                                                            setTeamMemberProfiles:
                                                                useTEM.setTeamMemberProfiles,
                                                            socket: socketInstance,
                                                            teamMemberProfiles:
                                                                useTEM.teamMemberProfiles,
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
                                                            <HashMentionDataProvider
                                                                value={hashMentionData}
                                                            >
                                                                <CalendarModalProvider
                                                                    value={calendarModal}
                                                                >
                                                                    <MentionGroupsProvider
                                                                        value={useMGM}
                                                                    >
                                                                        <TeamEmojiProvider
                                                                            value={useTEJ}
                                                                        >
                                                                            <MentionGroupModalProvider
                                                                                value={
                                                                                    mentionGroupModal
                                                                                }
                                                                            >
                                                                                <HistoryProvider
                                                                                    teamId={
                                                                                        useTEM.currentTeamId
                                                                                    }
                                                                                >
                                                                                    <UrlLinkModal
                                                                                        myself={
                                                                                            myself
                                                                                        }
                                                                                        useCM={
                                                                                            useCM
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
                                                                                        useTG={
                                                                                            useTG
                                                                                        }
                                                                                        useTM={
                                                                                            useTM
                                                                                        }
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
                                                                                        useUISM={
                                                                                            useUISM
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
                                                                                        myself={
                                                                                            myself
                                                                                        }
                                                                                        useCM={
                                                                                            useCM
                                                                                        }
                                                                                        useTEM={
                                                                                            useTEM
                                                                                        }
                                                                                        setMyself={
                                                                                            setMyself
                                                                                        }
                                                                                        socket={
                                                                                            socketInstance
                                                                                        }
                                                                                        useUISM={
                                                                                            useUISM
                                                                                        }
                                                                                    />
                                                                                    <HistoryShell
                                                                                        useCM={
                                                                                            useCM
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
                                                                                        useTM={
                                                                                            useTM
                                                                                        }
                                                                                        open={
                                                                                            historyOpen
                                                                                        }
                                                                                        onClose={
                                                                                            closeHistory
                                                                                        }
                                                                                    />
                                                                                    {/* Task graph modal —
                                                                                opened by the
                                                                                Ctrl+Cmd+G /
                                                                                Ctrl+Alt+G
                                                                                shortcut. Gated on
                                                                                `taskDiagramTarget`,
                                                                                which resolves the
                                                                                projectId / rootTaskId
                                                                                / label from either
                                                                                the previewed task
                                                                                or the previewed
                                                                                milestone. */}
                                                                                    {taskDiagramOpen &&
                                                                                        taskDiagramTarget && (
                                                                                            <ModalTaskDiagram
                                                                                                myself={
                                                                                                    myself
                                                                                                }
                                                                                                open={
                                                                                                    taskDiagramOpen
                                                                                                }
                                                                                                projectId={
                                                                                                    taskDiagramTarget.projectId
                                                                                                }
                                                                                                rootLabel={
                                                                                                    taskDiagramTarget.rootLabel
                                                                                                }
                                                                                                rootTaskId={
                                                                                                    taskDiagramTarget.rootTaskId
                                                                                                }
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
                                                                                            <Route
                                                                                                path="plans"
                                                                                                element={
                                                                                                    <FeatureErrorBoundary feature="Plans">
                                                                                                        <Suspense
                                                                                                            fallback={
                                                                                                                <RouteLoadingFallback />
                                                                                                            }
                                                                                                        >
                                                                                                            <PlansHome />
                                                                                                        </Suspense>
                                                                                                    </FeatureErrorBoundary>
                                                                                                }
                                                                                            />
                                                                                            {/* v3 proof-of-life routes. Behind `VITE_USE_V3_CHAT`
                                                                                        — production builds without the env flag don't
                                                                                        even register the routes. The bare `/v3` shows
                                                                                        the chat list with no pane; `/v3/<uuid>` opens
                                                                                        that channel. Selecting a channel from the
                                                                                        sidebar navigates between them. */}
                                                                                            {v3ChatEnabled && (
                                                                                                <>
                                                                                                    <Route
                                                                                                        path="v3"
                                                                                                        element={
                                                                                                            <Suspense
                                                                                                                fallback={
                                                                                                                    <RouteLoadingFallback />
                                                                                                                }
                                                                                                            >
                                                                                                                <V3ChatShell />
                                                                                                            </Suspense>
                                                                                                        }
                                                                                                    />
                                                                                                    <Route
                                                                                                        path="v3/:channelId"
                                                                                                        element={
                                                                                                            <Suspense
                                                                                                                fallback={
                                                                                                                    <RouteLoadingFallback />
                                                                                                                }
                                                                                                            >
                                                                                                                <V3ChatShell />
                                                                                                            </Suspense>
                                                                                                        }
                                                                                                    />
                                                                                                    <Route
                                                                                                        path="v3/:channelId/t/:rootMessageId"
                                                                                                        element={
                                                                                                            <Suspense
                                                                                                                fallback={
                                                                                                                    <RouteLoadingFallback />
                                                                                                                }
                                                                                                            >
                                                                                                                <V3ChatShell />
                                                                                                            </Suspense>
                                                                                                        }
                                                                                                    />
                                                                                                </>
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
                                                                                            {/* chat/tasks/notes render as keep-alive panes below, not routes;
    swallow their paths so the router doesn't warn about no match. */}
                                                                                            <Route
                                                                                                path="*"
                                                                                                element={
                                                                                                    null
                                                                                                }
                                                                                            />
                                                                                        </Routes>
                                                                                        {homesToRender.has(
                                                                                            "chat"
                                                                                        ) && (
                                                                                            <div
                                                                                                style={{
                                                                                                    display:
                                                                                                        activeService ===
                                                                                                        "chat"
                                                                                                            ? "contents"
                                                                                                            : "none",
                                                                                                }}
                                                                                            >
                                                                                                <FeatureErrorBoundary feature="Chat">
                                                                                                    <Suspense
                                                                                                        fallback={
                                                                                                            <RouteLoadingFallback />
                                                                                                        }
                                                                                                    >
                                                                                                        <ChatHome
                                                                                                            {...homeManagers}
                                                                                                            isActiveRoute={
                                                                                                                activeService ===
                                                                                                                "chat"
                                                                                                            }
                                                                                                            useTG={
                                                                                                                useTG
                                                                                                            }
                                                                                                        />
                                                                                                    </Suspense>
                                                                                                </FeatureErrorBoundary>
                                                                                            </div>
                                                                                        )}
                                                                                        {homesToRender.has(
                                                                                            "tasks"
                                                                                        ) && (
                                                                                            <div
                                                                                                style={{
                                                                                                    display:
                                                                                                        activeService ===
                                                                                                        "tasks"
                                                                                                            ? "contents"
                                                                                                            : "none",
                                                                                                }}
                                                                                            >
                                                                                                <FeatureErrorBoundary feature="Tasks">
                                                                                                    <Suspense
                                                                                                        fallback={
                                                                                                            <RouteLoadingFallback />
                                                                                                        }
                                                                                                    >
                                                                                                        <TaskHome
                                                                                                            {...homeManagers}
                                                                                                            isActiveRoute={
                                                                                                                activeService ===
                                                                                                                "tasks"
                                                                                                            }
                                                                                                        />
                                                                                                    </Suspense>
                                                                                                </FeatureErrorBoundary>
                                                                                            </div>
                                                                                        )}
                                                                                        {homesToRender.has(
                                                                                            "notes"
                                                                                        ) && (
                                                                                            <div
                                                                                                style={{
                                                                                                    display:
                                                                                                        activeService ===
                                                                                                        "notes"
                                                                                                            ? "contents"
                                                                                                            : "none",
                                                                                                }}
                                                                                            >
                                                                                                <FeatureErrorBoundary feature="Notes">
                                                                                                    <Suspense
                                                                                                        fallback={
                                                                                                            <RouteLoadingFallback />
                                                                                                        }
                                                                                                    >
                                                                                                        <NoteHome
                                                                                                            {...homeManagers}
                                                                                                            isActiveRoute={
                                                                                                                activeService ===
                                                                                                                "notes"
                                                                                                            }
                                                                                                        />
                                                                                                    </Suspense>
                                                                                                </FeatureErrorBoundary>
                                                                                            </div>
                                                                                        )}
                                                                                        <BottomTabBar
                                                                                            useCM={
                                                                                                useCM
                                                                                            }
                                                                                            useIM={
                                                                                                useIM
                                                                                            }
                                                                                        />
                                                                                        <MobileSpotlightFab
                                                                                            onOpenSpotlight={
                                                                                                spotlight.open
                                                                                            }
                                                                                        />
                                                                                    </Box>
                                                                                </HistoryProvider>
                                                                            </MentionGroupModalProvider>
                                                                        </TeamEmojiProvider>
                                                                    </MentionGroupsProvider>
                                                                </CalendarModalProvider>
                                                            </HashMentionDataProvider>
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
