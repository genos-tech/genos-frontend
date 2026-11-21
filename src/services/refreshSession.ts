/**
 * One way to refresh the session, shared by AuthContext and AcceptInviteHandler (MIP-1878, MIP-1882).
 *
 * The refresh token rotates: every refresh blacklists the cookie it was sent with and sets a new one.
 * Two refreshes with the same cookie (two tabs loading together, or a retry after a lost response)
 * made the later one fail, which signed the person out. So:
 *
 *  - one refresh at a time across tabs (Web Locks; without them it behaves as before), so the
 *    second tab's request goes out after the first one's Set-Cookie was applied;
 *  - one request at a time within a tab (callers share the promise);
 *  - a 401/403 is retried once after 1-2 s (the lock is taken again per attempt), because another
 *    tab may have rotated meanwhile; only then is it "unauthenticated". A server error or a network
 *    failure is "transient" and is NOT retried here: the caller's backoff owns that.
 *
 * Refresh is a POST that reads the httpOnly cookie (MIP-1882): a GET with side effects could be
 * triggered by any page.
 */
const base_url = import.meta.env.VITE_API_BASE_URL;

export const REFRESH_LOCK_NAME = "genos-auth-refresh";

// Abort a refresh that has not answered in this window, counted from when the request is sent (not
// from when the lock was queued), so a hung backend cannot block the app boot forever.
export const REFRESH_TIMEOUT_MS = 10_000;

const RETRY_BASE_MS = 1_000;
const RETRY_JITTER_MS = 1_000;

export type RefreshResult =
    | { kind: "ok"; access: string }
    | { kind: "unauthenticated" }
    | { kind: "transient" };

const withLock = <T>(fn: () => Promise<T>): Promise<T> => {
    const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
    if (!locks?.request) return fn();
    return locks.request(REFRESH_LOCK_NAME, { mode: "exclusive" }, () => fn()) as Promise<T>;
};

const attemptOnce = async (method: "POST" | "GET" = "POST"): Promise<RefreshResult> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
    try {
        const response = await fetch(`${base_url}/user/signin/refresh/`, {
            method,
            credentials: "include",
            signal: controller.signal,
        });
        if (response.ok) {
            const data = (await response.json()) as { access?: string };
            if (data.access) return { kind: "ok", access: data.access };
            console.error("[AUTH] Token refresh answered without an access token");
            return { kind: "transient" };
        }
        if (response.status === 401 || response.status === 403) {
            return { kind: "unauthenticated" };
        }
        // An API that predates POST refresh answers 400 (it wants a token in the body) or 405. The
        // API keeps GET for one release, so a frontend deployed first still gets a session.
        if (method === "POST" && (response.status === 400 || response.status === 405)) {
            clearTimeout(timeoutId);
            return attemptOnce("GET");
        }
        console.error(`[AUTH] Token refresh failed with status ${response.status}`);
        return { kind: "transient" };
    } catch (error) {
        // Network/CORS failure or the abort timeout.
        console.error("[AUTH] Token refresh failed (network or timeout)");
        console.error(error);
        return { kind: "transient" };
    } finally {
        clearTimeout(timeoutId);
    }
};

const run = async (): Promise<RefreshResult> => {
    let result = await withLock(() => attemptOnce());
    if (result.kind === "unauthenticated") {
        await new Promise((resolve) =>
            setTimeout(resolve, RETRY_BASE_MS + Math.random() * RETRY_JITTER_MS)
        );
        result = await withLock(() => attemptOnce());
    }
    return result;
};

let inFlight: Promise<RefreshResult> | null = null;

export const refreshSession = (): Promise<RefreshResult> => {
    if (!inFlight) {
        inFlight = run().finally(() => {
            inFlight = null;
        });
    }
    return inFlight;
};
