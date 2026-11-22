import { useEffect } from "react";

import { useAuth } from "../../context/authState";
import { _refetch, _setAccessToken, _setState, EMPTY_STATE } from "./personalGMTagsState";

// ---- public surface --------------------------------------------------

/**
 * Null-rendering singleton mounted once in `App`. Owns the token →
 * store wiring: refetches on token change and on window focus.
 */
export const PersonalGMTagsBootstrap = () => {
    const { accessToken } = useAuth();

    useEffect(() => {
        _setAccessToken(accessToken ?? null);
        // CRITICAL: clear synchronously on every token change before the
        // refetch resolves. The store is a module-level singleton (unlike
        // the Provider it mirrors, whose state dies on unmount), so a
        // direct account swap A→B that never passes through null (team
        // supersede / session switch) would otherwise leave user A's
        // PRIVATE tags in state and render them to B during B's in-flight
        // GET. Clearing first guarantees no cross-user window.
        _setState(EMPTY_STATE);
        void _refetch();
        if (typeof window === "undefined") return;
        // Same-user freshness (other tabs/devices) — does NOT clear, so
        // no flicker when the window regains focus.
        const onFocus = () => void _refetch();
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [accessToken]);

    return null;
};
