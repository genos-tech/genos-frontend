import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { NoteService } from "../db/services/note.service";
import { TaskService } from "../db/services/task.service";
import { DatabaseUtils } from "../db/utils/database";
import { setProjectStatusesToken } from "../hooks/tasks/useProjectStatuses";
import {
    accessTokenExpiryMs,
    isDueForRefresh,
    msUntilRefresh,
} from "../services/accessTokenExpiry";
import { analytics } from "../services/analytics";
import {
    clearPrivateProfile,
    ensurePrivateProfile,
    purgeStoredPrivateProfile,
} from "../services/privateProfileStore";
import { refreshSession } from "../services/refreshSession";
import { clearAllEditorDrafts } from "../utils/editorDraftStorage";
import { clearSignOutLeftovers } from "../utils/signOutLeftovers";
import { AUTH_LOCAL_STORAGE_KEYS, AuthContext } from "./authState";

// Outcome of a single refresh attempt. We need to distinguish three
// cases because they have different policies:
//   - "ok": got a new access token, stop the retry loop.
//   - "unauthenticated": server told us the refresh token is missing
//      / invalid / expired (HTTP 401/403). No amount of retrying will
//      fix it — we have to send the user back to /signin.
//   - "transient": network error or server hiccup. Worth retrying.
type RefreshOutcome = "ok" | "unauthenticated" | "transient";

// Exponential-backoff schedule for transient failures. We start with
// a short delay (so a quick blip recovers fast) and cap at 60 s so a
// stale tab on a long network outage doesn't hammer the API. Order
// matters; the last value is also the steady-state cap.
const REFRESH_BACKOFF_SCHEDULE_MS = [2_000, 5_000, 10_000, 20_000, 60_000];

// Delays between attempts to load the private profile after a reload.
const PRIVATE_PROFILE_RETRY_MS = [2_000, 10_000];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    // Single pending retry timer (replaces the previous flat-interval
    // approach). We re-arm it manually after each transient failure
    // using the backoff schedule above.
    const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const refreshAttemptCountRef = useRef(0);
    // Guard so we only fire the redirect once even if multiple
    // refresh attempts overlap (e.g. timer tick + initial call).
    const hasRedirectedRef = useRef(false);

    // Single refresh attempt. Distinguishes server-reported auth
    // failures (401/403) from transient errors so the caller can
    // decide whether to keep retrying.
    const refreshAccessToken = async (): Promise<RefreshOutcome> => {
        // The request, the cross-tab lock and the one retry on 401/403 live in refreshSession
        // (MIP-1878). Here a 401/403 that survived the retry means the session really is gone.
        const result = await refreshSession();
        if (result.kind === "ok") {
            setAccessToken(result.access);
            return "ok";
        }
        return result.kind;
    };

    // Force a sign-out: clear the localStorage flags AuthGuard reads,
    // null out the in-memory access token, and navigate to /signin
    // via a full-page redirect. We use `window.location.assign`
    // instead of `useNavigate` so a forced sign-out wipes the entire
    // app state (React state, cached query data, websocket
    // connections, etc.) on the way out — starting from a clean
    // slate is much safer here than a soft navigation.
    //
    // Note: AuthProvider is intentionally NOT mounted on the public
    // /home marketing page (see main.tsx), so this code path can
    // never fire there — but the path-based early return inside
    // attemptRefresh is kept as defense-in-depth for /signin and
    // /signup, which DO live inside AuthProvider.
    const forceSignOut = () => {
        if (hasRedirectedRef.current) return;
        hasRedirectedRef.current = true;

        clearRefreshTimer();
        AUTH_LOCAL_STORAGE_KEYS.forEach((key) => localStorage.setItem(key, ""));
        localStorage.setItem("isOfflineForced", "false");
        clearPrivateProfile();
        clearAllEditorDrafts();
        analytics.reset();
        setAccessToken(null);

        // The same leftovers the normal sign-out clears (Spotlight session,
        // chat thread memory, device id, per-team history, IndexedDB incl. the
        // Yjs documents; MIP-2255). The redirect waits for the wipe, since a
        // full-page navigation would cut it off; it never throws.
        void clearSignOutLeftovers().finally(() => {
            // Avoid stacking redirects if the user is already on the
            // signin page (e.g. from another tab racing).
            if (window.location.pathname !== "/signin") {
                window.location.assign("/signin");
            }
        });
    };

    // The proactive-refresh effect below must not re-run (and reset its timer) on every render, so
    // it reaches the latest forceSignOut through this ref instead of listing it as a dependency.
    const forceSignOutRef = useRef(forceSignOut);
    useEffect(() => {
        forceSignOutRef.current = forceSignOut;
    });

    // Pick the delay for the next retry from the backoff schedule.
    // Once we run off the end of the schedule we stick at the last
    // (largest) value so this stays a steady poll, not unbounded.
    const nextBackoffDelayMs = (attemptIndex: number): number => {
        const i = Math.min(attemptIndex, REFRESH_BACKOFF_SCHEDULE_MS.length - 1);
        return REFRESH_BACKOFF_SCHEDULE_MS[i];
    };

    const startTokenRefreshRetry = () => {
        if (isRefreshing) return; // Prevent multiple retry cycles

        setIsRefreshing(true);
        refreshAttemptCountRef.current = 0;

        const attemptRefresh = async () => {
            // Return if the user is on the signin or signup page.
            //
            // /accept-invite is included because it's a public-but-
            // AuthProvider page that manages its own auth routing: a
            // logged-out invitee must be sent to /signup or /signin based
            // on the invite preview, not force-redirected to /signin (which
            // would drop the invite context). For a logged-in visitor it
            // refreshes the token itself and hands it over; the actual
            // accept happens on /jointeam or via the signup endpoint.
            if (
                window.location.pathname === "/signin" ||
                window.location.pathname === "/signup" ||
                window.location.pathname === "/reset-password" ||
                window.location.pathname === "/oauth/success" ||
                window.location.pathname === "/accept-invite" ||
                window.location.pathname === "/home"
            ) {
                return;
            }

            const outcome = await refreshAccessToken();

            if (outcome === "ok") {
                clearRefreshTimer();
                return;
            }

            if (outcome === "unauthenticated") {
                forceSignOut();
                return;
            }

            // Transient: schedule the next attempt with backoff.
            const delay = nextBackoffDelayMs(refreshAttemptCountRef.current);
            refreshAttemptCountRef.current += 1;
            refreshTimeoutRef.current = setTimeout(attemptRefresh, delay);
        };

        attemptRefresh();
    };

    const clearRefreshTimer = () => {
        if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
            refreshTimeoutRef.current = null;
        }
        refreshAttemptCountRef.current = 0;
        setIsRefreshing(false);
    };

    useEffect(() => {
        if (accessToken === null) {
            startTokenRefreshRetry();
        } else if (accessToken) {
            clearRefreshTimer(); // Cancel any pending retries
        }
    }, [accessToken]);

    useEffect(() => {
        return () => {
            clearRefreshTimer();
        };
    }, []);

    // Renew the access token ahead of its expiry (MIP-2242). It lives 30 minutes, so waiting for a
    // 401 would break a request in front of the user. A timer renews it 5 min before `exp`; a
    // background tab's timers are throttled or frozen, so coming back to the tab (or the network
    // coming back) renews at once when the token is inside that window. The new token lands in
    // state, which re-runs this effect and schedules the next one. A refresh the server refuses
    // (cookie gone or revoked) signs out as before; a network failure retries with the backoff.
    useEffect(() => {
        if (!accessToken) return;
        if (accessTokenExpiryMs(accessToken) === null) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let running = false;
        let failures = 0;

        const run = async () => {
            if (cancelled || running) return;
            running = true;
            try {
                const outcome = await refreshAccessToken();
                if (cancelled) return;
                if (outcome === "unauthenticated") {
                    forceSignOutRef.current();
                } else if (outcome === "transient") {
                    const delay = nextBackoffDelayMs(failures++);
                    timer = setTimeout(() => void run(), delay);
                }
                // "ok": setAccessToken re-ran this effect for the new token.
            } finally {
                running = false;
            }
        };

        const wake = () => {
            if (document.visibilityState === "hidden") return;
            if (!isDueForRefresh(accessToken, Date.now())) return;
            if (timer) clearTimeout(timer);
            timer = null;
            void run();
        };

        timer = setTimeout(() => void run(), msUntilRefresh(accessToken, Date.now()) ?? 0);
        document.addEventListener("visibilitychange", wake);
        window.addEventListener("online", wake);
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            document.removeEventListener("visibilitychange", wake);
            window.removeEventListener("online", wake);
        };
    }, [accessToken]);

    // The signed-in user's email, phone, country, location and bio are
    // kept in memory only (`privateProfileStore`, MIP-619). Delete the
    // copies earlier releases cached in localStorage, which outlived every
    // sign-out as empty-or-not keys.
    useEffect(() => {
        purgeStoredPrivateProfile();
    }, []);

    // A reload empties that store, so refill it once there is a token. A
    // sign-in has usually filled it already, which makes this a no-op. A
    // failure is retried a couple of times: the user's own profile card
    // reads these, and an empty bio there looks like one to be rewritten.
    useEffect(() => {
        if (!accessToken) return;
        let cancelled = false;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        const attempt = async (n: number) => {
            const profile = await ensurePrivateProfile(accessToken);
            if (cancelled || profile || n >= PRIVATE_PROFILE_RETRY_MS.length) return;
            retryTimer = setTimeout(() => void attempt(n + 1), PRIVATE_PROFILE_RETRY_MS[n]);
        };
        void attempt(0);
        return () => {
            cancelled = true;
            if (retryTimer) clearTimeout(retryTimer);
        };
    }, [accessToken]);

    // One-shot sweep of orphaned per-document Yjs IndexedDB databases
    // (`task-body:<id>`, `my-note:<id>`, `chat-note:<id>`, `task-note:<id>`).
    // y-indexeddb creates one DB per editor document and never cleans up,
    // so deleted tasks/notes leave their CRDT logs behind forever. Per-row
    // deletes are hooked at the delete-modal call sites; this sweep cleans
    // up orphans that pre-date the hook or escaped it (e.g. soft-deleted
    // tasks that later disappear from `taskMeta`).
    //
    // Fires once per sign-in (the `hasSweptRef` guard skips later token
    // refreshes). Delayed so the post-auth fetches have time to repopulate
    // genosData — the sweep reads its allow-list from there.
    const hasSweptRef = useRef(false);
    useEffect(() => {
        if (!accessToken || hasSweptRef.current) return;
        hasSweptRef.current = true;
        const timer = setTimeout(async () => {
            try {
                const taskService = new TaskService();
                const noteService = new NoteService();
                const [tasks, myNotes, chatNotes, taskNotes] = await Promise.all([
                    taskService.getAllTasks(),
                    noteService.getAllPersonalNotes(),
                    noteService.getAllChatNotes(),
                    noteService.getAllTaskNotes(),
                ]);
                const taskIds = new Set<number>();
                for (const t of tasks) {
                    const n = Number((t as { id?: number | string }).id);
                    if (Number.isFinite(n)) taskIds.add(n);
                }
                const myNoteIds = new Set<number>(
                    myNotes
                        .map((n) => Number((n as { noteId?: number }).noteId))
                        .filter(Number.isFinite)
                );
                const chatNoteIds = new Set<number>(
                    chatNotes
                        .map((n) => Number((n as { noteId?: number }).noteId))
                        .filter(Number.isFinite)
                );
                const taskNoteIds = new Set<number>(
                    taskNotes
                        .map((n) => Number((n as { noteId?: number }).noteId))
                        .filter(Number.isFinite)
                );
                await DatabaseUtils.sweepOrphanYjsDatabases({
                    taskIds,
                    myNoteIds,
                    chatNoteIds,
                    taskNoteIds,
                });
            } catch (err) {
                console.error("[IDB] Yjs orphan sweep failed:", err);
            }
        }, 30_000);
        return () => clearTimeout(timer);
    }, [accessToken]);

    // `setAccessToken` is a stable useState setter; memo only needs to refresh
    // when `accessToken` changes. Without this, the provider's `value` is a
    // fresh object every render → every `useAuth()` consumer (and there are
    // many in the chat/notes/tasks tree) re-renders on every parent re-render.
    const value = useMemo(() => ({ accessToken, setAccessToken }), [accessToken]);

    // The project statuses store reads the token from here (MIP-2493).
    useEffect(() => setProjectStatusesToken(value.accessToken), [value.accessToken]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
