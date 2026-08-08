import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useColorScheme } from "@mui/joy/styles";

import { useUiSettings } from "./useUiSettings";

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
// Key inside the cross-device `ui_settings` store. localStorage stays the
// synchronous source for first paint (theme is read pre-auth, before any
// token exists — see AuthShell); the server value is adopted once loaded.
const UI_SETTINGS_KEY = "theme";

const isThemePreference = (v: unknown): v is ThemePreference =>
    v === "light" || v === "dark" || v === "system";

const readPreference = (): ThemePreference => {
    if (typeof window === "undefined") return "system";
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isThemePreference(v) ? v : "system";
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
    const { loaded, get, set } = useUiSettings();
    const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);

    // Reconcile with the cross-device store once the account's settings
    // load. Two cases:
    //   - the account HAS a synced theme → adopt it (this is what makes
    //     the choice follow the user to another device);
    //   - the account has NONE but this device made an explicit local
    //     pick (a stored value that isn't the "system" default) → migrate
    //     that pick up to the server so it starts syncing.
    // Runs on `loaded` only, so it doesn't fight the user's own setPreference.
    useEffect(() => {
        if (!loaded) return;
        const synced = get<ThemePreference | null>(UI_SETTINGS_KEY, null);
        if (isThemePreference(synced)) {
            setPreferenceState((prev) => (prev === synced ? prev : synced));
            if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, synced);
        } else if (typeof window !== "undefined") {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (isThemePreference(stored)) set(UI_SETTINGS_KEY, stored);
        }
        // `get`/`set` are stable per store value; keying on `loaded` alone
        // keeps this a one-shot adopt-on-load.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded]);

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

    const setPreference = useCallback(
        (p: ThemePreference) => {
            setPreferenceState(p);
            if (typeof window !== "undefined") {
                window.localStorage.setItem(STORAGE_KEY, p);
            }
            // Sync across devices. localStorage above stays the fast-path
            // for first paint / offline; this is the durable per-account copy.
            set(UI_SETTINGS_KEY, p);
        },
        [set]
    );

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
