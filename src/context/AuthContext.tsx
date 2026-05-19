import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

import { analytics } from "../services/analytics";
import { clearAllEditorDrafts } from "../utils/editorDraftStorage";

interface AuthContextType {
    accessToken: string | null;
    setAccessToken: (token: string | null) => void;
}

const base_url = import.meta.env.VITE_API_BASE_URL;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// localStorage keys to wipe when we force the user back to the
// signin screen. Mirrors the list in `sidebar.tsx`'s logout handler
// so a forced sign-out from a missing/expired refresh cookie leaves
// the same clean slate as a manual logout.
export const AUTH_LOCAL_STORAGE_KEYS = [
    "isSigningIn",
    "userEmail",
    "userName",
    "userId",
    "avatarImgPath",
    "teamId",
    "tsJoined",
    "isOfflineForced",
    "role",
    "baseCountry",
    "customStatus",
    "teamName",
    "lastOpenMyNoteId",
    "lastOpenNoteType",
    "lastChatType",
    "lastDMChatId",
    "lastGMChatId",
    "lastPMChatId",
    "lastPinnedChatId",
    "lastPinnedChatType",
    "lastProjectId",
    "lastOpenChatNoteId",
    "lastOpenTaskNoteId",
    "currentMainChatId",
    "isDemoUser",
];

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
        console.log("[AUTH] Refreshing token");
        try {
            const response = await fetch(`${base_url}/user/signin/refresh/`, {
                method: "GET",
                credentials: "include",
            });

            if (response.ok) {
                const data = await response.json();
                setAccessToken(data.access);
                console.log("[AUTH] Token refreshed successfully");
                return "ok";
            }

            if (response.status === 401 || response.status === 403) {
                console.warn("[AUTH] Refresh rejected by server (no/invalid refresh token)");
                return "unauthenticated";
            }

            console.error(`[AUTH] Token refresh failed with status ${response.status}`);
            return "transient";
        } catch (error) {
            // Network/CORS failure — treat as transient and keep retrying.
            console.error("[AUTH] Token refresh failed (network)");
            console.error(error);
            return "transient";
        }
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
        clearAllEditorDrafts();
        analytics.reset();
        setAccessToken(null);

        // Avoid stacking redirects if the user is already on the
        // signin page (e.g. from another tab racing).
        if (window.location.pathname !== "/signin") {
            window.location.assign("/signin");
        }
    };

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
        console.log("[AUTH] Starting token refresh retry cycle");

        const attemptRefresh = async () => {
            // Return if the user is on the signin or signup page.
            if (
                window.location.pathname === "/signin" ||
                window.location.pathname === "/signup" ||
                window.location.pathname === "/home"
            ) {
                return;
            }

            const outcome = await refreshAccessToken();

            if (outcome === "ok") {
                clearRefreshTimer();
                console.log("[AUTH] Token refresh retry cycle completed successfully");
                return;
            }

            if (outcome === "unauthenticated") {
                console.log("[AUTH] No valid refresh token — sending user to /signin");
                forceSignOut();
                return;
            }

            // Transient: schedule the next attempt with backoff.
            const delay = nextBackoffDelayMs(refreshAttemptCountRef.current);
            refreshAttemptCountRef.current += 1;
            console.log(
                `[AUTH] Token refresh failed transiently, retrying in ${delay / 1000}s ` +
                    `(attempt #${refreshAttemptCountRef.current})`
            );
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
            console.log("[AUTH] Token is valid");
            clearRefreshTimer(); // Cancel any pending retries
        }
    }, [accessToken]);

    useEffect(() => {
        return () => {
            clearRefreshTimer();
        };
    }, []);

    // `setAccessToken` is a stable useState setter; memo only needs to refresh
    // when `accessToken` changes. Without this, the provider's `value` is a
    // fresh object every render → every `useAuth()` consumer (and there are
    // many in the chat/notes/tasks tree) re-renders on every parent re-render.
    const value = useMemo(() => ({ accessToken, setAccessToken }), [accessToken]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};
