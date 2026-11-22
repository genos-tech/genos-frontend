import { ReactNode, useCallback, useEffect, useState } from "react";

import { useAuth } from "../../context/authState";
import { authApi } from "../../services/api";
import {
    DEFAULT_WEB_SEARCH,
    readAiAnswers,
    SpotlightPreferencesContext,
    STORAGE_KEY,
    WEB_SEARCH_PREF_URL,
} from "./spotlightPreferencesState";

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
