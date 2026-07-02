import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useColorScheme } from "@mui/joy/styles";

/**
 * Theme preference layer that wraps `useColorScheme` from MUI Joy.
 *
 * MUI Joy supports `mode === "system"` natively, but a large portion of our
 * components branch on `mode === "dark"` directly (without consulting
 * `systemMode`). When Joy is in `"system"` mode those checks evaluate to
 * `false` regardless of what the OS resolves to, so half the UI ends up in
 * light styling while the half that uses Joy's CSS variables correctly
 * picks up dark — the inconsistency the user reported.
 *
 * The walkaround: store the user's *intent* (`"light" | "dark" | "system"`)
 * separately, and always feed Joy an explicit `"light"` or `"dark"` value.
 * When the user picks `"system"`, we listen to
 * `(prefers-color-scheme: dark)` and re-apply on every change.
 *
 * Consumers that need to know the user's intent (e.g. the Settings modal)
 * read `preference` from this hook. Consumers that need the resolved mode
 * (the rest of the app) keep using `useColorScheme()` exactly as before —
 * `mode` will now reliably be `"light"` or `"dark"`.
 */

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "genos-theme-preference";

const readPreference = (): ThemePreference => {
    if (typeof window === "undefined") return "system";
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
};

const systemPrefersDark = (): boolean =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

interface ThemePreferenceContextValue {
    preference: ThemePreference;
    setPreference: (p: ThemePreference) => void;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

export const ThemePreferenceProvider = ({ children }: { children: ReactNode }) => {
    const { setMode } = useColorScheme();
    const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);

    // Resolve preference -> concrete Joy mode whenever preference changes.
    useEffect(() => {
        const resolved =
            preference === "system" ? (systemPrefersDark() ? "dark" : "light") : preference;
        setMode(resolved);
    }, [preference, setMode]);

    // Track OS theme changes only while preference is "system".
    useEffect(() => {
        if (preference !== "system") return;
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
            return;
        }
        const mql = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = (e: MediaQueryListEvent) => {
            setMode(e.matches ? "dark" : "light");
        };
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
    }, [preference, setMode]);

    const setPreference = useCallback((p: ThemePreference) => {
        setPreferenceState(p);
        if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, p);
        }
    }, []);

    return (
        <ThemePreferenceContext.Provider value={{ preference, setPreference }}>
            {children}
        </ThemePreferenceContext.Provider>
    );
};

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
