import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

import { analytics } from "../../services/analytics";

/**
 * User-toggleable opt-out for PostHog analytics. Defaults to `true` so
 * existing users keep their previous (enabled) state; toggling off in
 * Settings flips PostHog's own opt-out flag and resets the distinct ID.
 *
 * Persistence shape and storage approach mirror useSpotlightPreferences
 * so the patterns stay aligned across user-facing preferences. The same
 * storage key is read inside `analytics.init()` (in main.tsx) so the
 * preference applies before React mounts — this provider then keeps the
 * wrapper in sync with any in-app changes.
 */

export interface AnalyticsPreferences {
    enabled: boolean;
}

const STORAGE_KEY = "genos-analytics-preferences:v1";
const DEFAULTS: AnalyticsPreferences = {
    enabled: true,
};

const readPreferences = (): AnalyticsPreferences => {
    if (typeof window === "undefined") return DEFAULTS;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULTS;
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
            const obj = parsed as Record<string, unknown>;
            return {
                enabled: typeof obj.enabled === "boolean" ? obj.enabled : DEFAULTS.enabled,
            };
        }
        return DEFAULTS;
    } catch {
        return DEFAULTS;
    }
};

interface AnalyticsPreferencesContextValue extends AnalyticsPreferences {
    setEnabled: (v: boolean) => void;
}

const AnalyticsPreferencesContext = createContext<AnalyticsPreferencesContextValue | null>(null);

export const AnalyticsPreferencesProvider = ({ children }: { children: ReactNode }) => {
    const [prefs, setPrefs] = useState<AnalyticsPreferences>(readPreferences);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
        } catch {
            // Quota or private-mode failure — ignore. Next session will
            // fall back to defaults, which is the safer behaviour anyway.
        }
        analytics.setEnabled(prefs.enabled);
    }, [prefs]);

    const setEnabled = useCallback((v: boolean) => {
        setPrefs((p) => ({ ...p, enabled: v }));
    }, []);

    return (
        <AnalyticsPreferencesContext.Provider value={{ ...prefs, setEnabled }}>
            {children}
        </AnalyticsPreferencesContext.Provider>
    );
};

export const useAnalyticsPreferences = (): AnalyticsPreferencesContextValue => {
    const ctx = useContext(AnalyticsPreferencesContext);
    if (!ctx) {
        // Provider not mounted (e.g. consumed outside the App tree).
        // Return defaults + no-op setter so callers don't crash.
        return { ...DEFAULTS, setEnabled: () => {} };
    }
    return ctx;
};
