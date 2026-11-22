import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../../context/authState";
import { authApi } from "../../services/api";
import {
    readCache,
    UI_SETTINGS_URL,
    UiSettingsContext,
    UiSettingsContextValue,
    UiSettingsMap,
    writeCache,
} from "./uiSettingsState";

export const UiSettingsProvider = ({ children }: { children: ReactNode }) => {
    const { accessToken } = useAuth();

    // Seed from the localStorage cache so a synced pref is available on
    // first paint even before the server GET returns.
    const [settings, setSettings] = useState<UiSettingsMap>(readCache);
    const [loaded, setLoaded] = useState(false);

    // Always read the freshest map inside `set` without making it a
    // dependency (which would re-create the callback on every change and
    // churn every consumer's effect).
    const settingsRef = useRef(settings);
    settingsRef.current = settings;

    // Load the account's blob once per token. Server value wins over the
    // cache; on failure we keep the cache and still flip `loaded` so
    // consumers stop waiting and use their local values.
    useEffect(() => {
        let cancelled = false;
        setLoaded(false);
        const api = authApi(accessToken);
        if (!api) {
            // Signed out: no account blob to load. Consumers fall back to
            // their localStorage values; leave `loaded` false so they don't
            // treat "server has no value" as authoritative.
            return;
        }
        (async () => {
            try {
                const res = await api.get<{ ui_settings: UiSettingsMap }>(UI_SETTINGS_URL);
                if (cancelled) return;
                const blob =
                    res.data?.ui_settings && typeof res.data.ui_settings === "object"
                        ? res.data.ui_settings
                        : {};
                setSettings(blob);
                writeCache(blob);
            } catch {
                // Endpoint missing / network error — keep the cached blob.
            } finally {
                if (!cancelled) setLoaded(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [accessToken]);

    const get = useCallback(
        <T,>(key: string, fallback: T): T => {
            const value = settings[key];
            return value === undefined || value === null ? fallback : (value as T);
        },
        [settings]
    );

    const set = useCallback(
        (key: string, value: unknown) => {
            const next = { ...settingsRef.current };
            if (value === null || value === undefined) {
                delete next[key];
            } else {
                next[key] = value;
            }
            setSettings(next);
            writeCache(next);
            const api = authApi(accessToken);
            if (!api) return;
            // Fire-and-forget PATCH; the optimistic state already applied.
            // A failure leaves the server behind but the local cache
            // correct, and the next successful set/GET reconciles.
            void api.patch(UI_SETTINGS_URL, { [key]: value ?? null }).catch(() => {});
        },
        [accessToken]
    );

    const value = useMemo<UiSettingsContextValue>(
        () => ({ loaded, get, set }),
        [loaded, get, set]
    );

    return <UiSettingsContext.Provider value={value}>{children}</UiSettingsContext.Provider>;
};
