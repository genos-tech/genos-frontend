import { createContext, useContext } from "react";

// The context and its consumer hook live apart from ThemePreferenceProvider
// (useThemePreference.tsx) so that file exports components only, which keeps
// React Fast Refresh working there. No behaviour change: same context object,
// same stub returned when no provider is mounted.

export type ThemePreference = "light" | "dark" | "system";

export interface ThemePreferenceContextValue {
    preference: ThemePreference;
    setPreference: (p: ThemePreference) => void;
}

export const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

export const useThemePreference = (): ThemePreferenceContextValue => {
    const ctx = useContext(ThemePreferenceContext);
    if (!ctx) {
        // Provider not mounted yet (or consumed outside the tree). Return a
        // no-op stub so callers don't crash; the real provider will take
        // over once the App tree mounts.
        return { preference: "system", setPreference: () => {} };
    }
    return ctx;
};
