import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../services/api";

/**
 * User-toggleable preferences that gate Spotlight's LLM behaviour.
 *
 * - `aiAnswers`: when off, the "Ask" path (agent / LLM) is unavailable —
 *   Spotlight stays a pure OpenSearch keyword + vector lookup. The Ask
 *   button renders disabled with an explanatory tooltip. Stored in
 *   localStorage: it gates the Ask button synchronously on open and
 *   needs no account round-trip.
 * - `webSearch`: sub-option of `aiAnswers`. When off, the frontend tells
 *   the agent backend to omit its web-browse tool from the tool list.
 *   Defaults to off — web browsing adds latency and external calls, so
 *   it's opt-in rather than on-by-default.
 *
 *   `webSearch` is persisted **per-account** (GET/PATCH
 *   `/user/preferences/spotlight-web-search/`), NOT in localStorage, so
 *   the choice follows the user across devices/sessions. localStorage-only
 *   persistence used to silently drop the toggle when the user switched
 *   browser/device — the agent then omitted `search_web` and answered
 *   "I don't have live web search enabled in this environment" even
 *   though the user had turned it on elsewhere. `null` while the initial
 *   GET is in flight or the user is unauthenticated; treated as off.
 */

export interface SpotlightPreferences {
    aiAnswers: boolean;
    webSearch: boolean;
}

const STORAGE_KEY = "genos-spotlight-preferences:v1";
const WEB_SEARCH_PREF_URL = "/user/preferences/spotlight-web-search/";

const DEFAULT_AI_ANSWERS = true;
const DEFAULT_WEB_SEARCH = false;

// aiAnswers is the only field still kept in localStorage. A `webSearch`
// value in an older stored blob is intentionally ignored (that field is
// now server-backed); on the next aiAnswers change the blob is rewritten
// without it.
const readAiAnswers = (): boolean => {
    if (typeof window === "undefined") return DEFAULT_AI_ANSWERS;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_AI_ANSWERS;
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
            const obj = parsed as Record<string, unknown>;
            return typeof obj.aiAnswers === "boolean" ? obj.aiAnswers : DEFAULT_AI_ANSWERS;
        }
        return DEFAULT_AI_ANSWERS;
    } catch {
        return DEFAULT_AI_ANSWERS;
    }
};

interface SpotlightPreferencesContextValue extends SpotlightPreferences {
    setAiAnswers: (v: boolean) => void;
    setWebSearch: (v: boolean) => void;
}

const SpotlightPreferencesContext = createContext<SpotlightPreferencesContextValue | null>(null);

export const SpotlightPreferencesProvider = ({ children }: { children: ReactNode }) => {
    const { accessToken } = useAuth();

    // aiAnswers — localStorage-backed.
    const [aiAnswers, setAiAnswersState] = useState<boolean>(readAiAnswers);
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ aiAnswers }));
        } catch {
            // Quota or private-mode failure — ignore. Next session falls
            // back to the default, which is the safer behaviour anyway.
        }
    }, [aiAnswers]);
    const setAiAnswers = useCallback((v: boolean) => setAiAnswersState(v), []);

    // webSearch — server-backed (per-account). Load once per token; fall
    // back to OFF on any failure so the UI renders something sensible
    // rather than hanging. Mirrors `useAutoCloseOnPrMergePreference`.
    const [webSearch, setWebSearchState] = useState<boolean>(DEFAULT_WEB_SEARCH);
    useEffect(() => {
        let cancelled = false;
        const api = authApi(accessToken);
        if (!api) {
            setWebSearchState(DEFAULT_WEB_SEARCH);
            return;
        }
        (async () => {
            try {
                const res = await api.get<{ spotlight_web_search_enabled: boolean }>(
                    WEB_SEARCH_PREF_URL
                );
                if (!cancelled) setWebSearchState(!!res.data.spotlight_web_search_enabled);
            } catch {
                // Endpoint missing / network error — default OFF.
                if (!cancelled) setWebSearchState(DEFAULT_WEB_SEARCH);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [accessToken]);

    const setWebSearch = useCallback(
        async (v: boolean) => {
            const api = authApi(accessToken);
            // Optimistic flip so the Switch responds instantly; roll back
            // if the PATCH fails.
            const previous = webSearch;
            setWebSearchState(v);
            if (!api) return;
            try {
                await api.patch(WEB_SEARCH_PREF_URL, { spotlight_web_search_enabled: v });
            } catch {
                setWebSearchState(previous);
            }
        },
        [accessToken, webSearch]
    );

    return (
        <SpotlightPreferencesContext.Provider
            value={{ aiAnswers, webSearch, setAiAnswers, setWebSearch }}
        >
            {children}
        </SpotlightPreferencesContext.Provider>
    );
};

export const useSpotlightPreferences = (): SpotlightPreferencesContextValue => {
    const ctx = useContext(SpotlightPreferencesContext);
    if (!ctx) {
        // Provider not mounted (e.g. consumed outside the App tree).
        // Return defaults + no-op setters so callers don't crash.
        return {
            aiAnswers: DEFAULT_AI_ANSWERS,
            webSearch: DEFAULT_WEB_SEARCH,
            setAiAnswers: () => {},
            setWebSearch: () => {},
        };
    }
    return ctx;
};
