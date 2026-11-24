/**
 * When to renew the access token before it expires (MIP-2242).
 *
 * The access token lives 30 minutes, so the app renews it ahead of expiry instead of waiting for a
 * 401. The `exp` claim is read for scheduling only; the server is what decides whether a token is
 * valid.
 */

// Renew this long before expiry: room for a slow or retried refresh (the cross-tab lock and the
// one retry in refreshSession take a few seconds) without ever sending an expired token.
export const REFRESH_AHEAD_MS = 5 * 60 * 1000;

// Never schedule sooner than this, so a token that is already inside the window (a clock that is
// off, or a very short lifetime) cannot start a refresh loop.
export const MIN_REFRESH_DELAY_MS = 10 * 1000;

/** The token's `exp` in ms since the epoch, or null when it cannot be read. */
export const accessTokenExpiryMs = (token: string | null | undefined): number | null => {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    try {
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
        const payload = JSON.parse(atob(padded)) as { exp?: unknown };
        return typeof payload.exp === "number" ? payload.exp * 1000 : null;
    } catch {
        return null;
    }
};

/**
 * Milliseconds from `now` until the token should be renewed, or null when the expiry is unknown
 * (then nothing is scheduled and the existing behaviour stays: the next load refreshes).
 */
export const msUntilRefresh = (token: string | null | undefined, now: number): number | null => {
    const expiry = accessTokenExpiryMs(token);
    if (expiry === null) return null;
    return Math.max(expiry - REFRESH_AHEAD_MS - now, MIN_REFRESH_DELAY_MS);
};

/** True when the token is inside the renewal window (or already expired). */
export const isDueForRefresh = (token: string | null | undefined, now: number): boolean => {
    const expiry = accessTokenExpiryMs(token);
    return expiry !== null && expiry - REFRESH_AHEAD_MS <= now;
};
