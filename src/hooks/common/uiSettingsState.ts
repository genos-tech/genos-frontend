import { createContext, useContext } from "react";

/**
 * Cross-device UI settings store — the frontend half of
 * `CustomUser.ui_settings` (GET/PATCH `/user/preferences/ui-settings/`).
 *
 * WHY this exists: preferences like theme, locale and chat-bubble style
 * used to live only in browser localStorage, so they didn't follow a user
 * to another device or browser. This provider persists a flat bag of such
 * preferences per-account so they sync, while keeping localStorage as the
 * **pre-auth / offline fallback** — the signed-out routes and the very
 * first paint read theme before any token exists (see `AuthShell`), so a
 * server-only store would flash the wrong theme on load.
 *
 * The division of labour with the individual preference hooks
 * (`useThemePreference`, `useBubbleStylePreference`, the locale source):
 *
 *   - Each of those keeps its own localStorage key as the synchronous
 *     source for first paint and offline use.
 *   - Each also reads its value out of THIS store once the server GET
 *     resolves (`loaded`), adopting the synced value when the account has
 *     one, and migrating an EXPLICIT local choice up to the server on the
 *     first authenticated load when the account has none yet.
 *
 * Keys are opaque strings owned by the consuming hooks; this store is
 * schemaless on purpose (a new synced pref is a frontend-only change).
 * `set(key, null)` deletes a key — the server treats a null value as
 * "reset to built-in default".
 *
 * Device-specific state (auth mirrors, drafts, last-opened nav, filter
 * selections, …) deliberately stays in plain localStorage and never
 * routes through here — see `DEVICE_PREFERENCE_LOCAL_STORAGE_KEYS`.
 */

export type UiSettingsMap = Record<string, unknown>;

export const UI_SETTINGS_URL = "/user/preferences/ui-settings/";
// localStorage mirror of the last-known server blob, so an offline or
// pre-auth read of a synced pref can still see the account's value from
// the previous session instead of falling back to the built-in default.
const CACHE_KEY = "genos-ui-settings:v1";

export const readCache = (): UiSettingsMap => {
    if (typeof window === "undefined") return {};
    try {
        const raw = window.localStorage.getItem(CACHE_KEY);
        if (!raw) return {};
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as UiSettingsMap;
        }
        return {};
    } catch {
        return {};
    }
};

export const writeCache = (settings: UiSettingsMap) => {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
    } catch {
        // Quota / private mode — ignore. The store still works in memory
        // for this session; only the offline fallback is degraded.
    }
};

export interface UiSettingsContextValue {
    /** True once the initial server GET has resolved (or failed) for the
     *  current token, so consumers know the synced values are available
     *  (or that they should keep using their local value). */
    loaded: boolean;
    /** Read a synced value, or `fallback` when the key is unset. */
    get: <T>(key: string, fallback: T) => T;
    /** Optimistically set (or, with `null`, delete) a synced value and
     *  PATCH it to the server. No-ops the network call when unauthenticated
     *  (the value still updates in memory + cache for this session). */
    set: (key: string, value: unknown) => void;
}

export const UiSettingsContext = createContext<UiSettingsContextValue | null>(null);

export const useUiSettings = (): UiSettingsContextValue => {
    const ctx = useContext(UiSettingsContext);
    if (!ctx) {
        // Provider not mounted (e.g. a component rendered outside the App
        // tree, or a test). Degrade to a no-op store so consumers keep
        // working off their localStorage values.
        return { loaded: false, get: (_key, fallback) => fallback, set: () => {} };
    }
    return ctx;
};
