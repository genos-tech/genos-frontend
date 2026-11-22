import { createContext, useContext } from "react";

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

export const STORAGE_KEY = "genos-spotlight-preferences:v1";
export const WEB_SEARCH_PREF_URL = "/user/preferences/spotlight-web-search/";

const DEFAULT_AI_ANSWERS = true;
export const DEFAULT_WEB_SEARCH = false;

// aiAnswers is the only field still kept in localStorage. A `webSearch`
// value in an older stored blob is intentionally ignored (that field is
// now server-backed); on the next aiAnswers change the blob is rewritten
// without it.
export const readAiAnswers = (): boolean => {
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

export const SpotlightPreferencesContext = createContext<SpotlightPreferencesContextValue | null>(
    null
);

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
