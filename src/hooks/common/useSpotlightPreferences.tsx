import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

/**
 * User-toggleable preferences that gate Spotlight's LLM behaviour.
 *
 * - `aiAnswers`: when off, the "Ask" path (agent / LLM) is unavailable —
 *   Spotlight stays a pure OpenSearch keyword + vector lookup. The Ask
 *   button renders disabled with an explanatory tooltip.
 * - `webSearch`: sub-option of `aiAnswers`. When off, the frontend tells
 *   the agent backend to omit its web-browse tool from the tool list.
 *   Defaults to off — web browsing adds latency and external calls, so
 *   it's opt-in rather than on-by-default.
 *
 * Persistence is a single JSON blob in localStorage; context fans
 * updates out so the Settings modal and Spotlight overlay stay in sync.
 */

export interface SpotlightPreferences {
    aiAnswers: boolean;
    webSearch: boolean;
}

const STORAGE_KEY = "genos-spotlight-preferences:v1";
const DEFAULTS: SpotlightPreferences = {
    aiAnswers: true,
    webSearch: false,
};

const readPreferences = (): SpotlightPreferences => {
    if (typeof window === "undefined") return DEFAULTS;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULTS;
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
            const obj = parsed as Record<string, unknown>;
            return {
                aiAnswers: typeof obj.aiAnswers === "boolean" ? obj.aiAnswers : DEFAULTS.aiAnswers,
                webSearch: typeof obj.webSearch === "boolean" ? obj.webSearch : DEFAULTS.webSearch,
            };
        }
        return DEFAULTS;
    } catch {
        return DEFAULTS;
    }
};

interface SpotlightPreferencesContextValue extends SpotlightPreferences {
    setAiAnswers: (v: boolean) => void;
    setWebSearch: (v: boolean) => void;
}

const SpotlightPreferencesContext = createContext<SpotlightPreferencesContextValue | null>(null);

export const SpotlightPreferencesProvider = ({ children }: { children: ReactNode }) => {
    const [prefs, setPrefs] = useState<SpotlightPreferences>(readPreferences);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
        } catch {
            // Quota or private-mode failure — ignore. Next session will
            // fall back to defaults, which is the safer behaviour anyway.
        }
    }, [prefs]);

    const setAiAnswers = useCallback((v: boolean) => {
        setPrefs((p) => ({ ...p, aiAnswers: v }));
    }, []);

    const setWebSearch = useCallback((v: boolean) => {
        setPrefs((p) => ({ ...p, webSearch: v }));
    }, []);

    return (
        <SpotlightPreferencesContext.Provider value={{ ...prefs, setAiAnswers, setWebSearch }}>
            {children}
        </SpotlightPreferencesContext.Provider>
    );
};

export const useSpotlightPreferences = (): SpotlightPreferencesContextValue => {
    const ctx = useContext(SpotlightPreferencesContext);
    if (!ctx) {
        // Provider not mounted (e.g. consumed outside the App tree).
        // Return defaults + no-op setters so callers don't crash.
        return { ...DEFAULTS, setAiAnswers: () => {}, setWebSearch: () => {} };
    }
    return ctx;
};
