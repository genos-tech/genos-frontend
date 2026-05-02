import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
    getNotificationPreferences,
    updateNotificationPreferences,
} from "../../services/notifications/notificationApi";
import { NotificationManager } from "../../services/notifications/notificationManager";
import {
    ActiveSurface,
    NotificationCategory,
    NotificationIntent,
    NotificationPreference,
} from "../../services/notifications/types";
import { UserProps } from "../../types/admin";

export type WebNotificationPermission = NotificationPermission | "unsupported";

const isNotificationsApiSupported = (): boolean =>
    typeof window !== "undefined" &&
    typeof Notification !== "undefined" &&
    window.isSecureContext === true;

const readPermission = (): WebNotificationPermission => {
    if (!isNotificationsApiSupported()) return "unsupported";
    return Notification.permission;
};

const PUSH_DEBOUNCE_MS = 300;

export interface NotificationsState {
    manager: NotificationManager;
    preferences: NotificationPreference;
    permission: WebNotificationPermission;
    requestPermission: () => Promise<WebNotificationPermission>;
    setMasterEnabled: (value: boolean) => void;
    setCategoryEnabled: (category: NotificationCategory, value: boolean) => void;
    mute: (chatType: number, chatId: string) => void;
    unmute: (chatType: number, chatId: string) => void;
    isMuted: (chatType: number, chatId: string) => boolean;
    setActiveSurface: (surface: ActiveSurface | null) => void;
    subscribeToasts: (listener: (intent: NotificationIntent) => void) => () => void;
}

/**
 * Constructs and owns a singleton `NotificationManager`. Hydrates prefs from
 * the backend on mount, owns the browser permission state, and pushes prefs
 * patches back to the server on a 300ms debounce.
 *
 * The returned `manager` is what wiring code (websocket router, active
 * surface trackers) should hold a reference to; the higher-level helpers
 * (`mute`, `setMasterEnabled`, ...) are convenience wrappers for UI.
 */
export const useNotifications = (
    myself: UserProps,
    accessToken: string | null,
    onOpenIntent?: (intent: NotificationIntent) => void
): NotificationsState => {
    const accessTokenRef = useRef<string | null>(accessToken);
    useEffect(() => {
        accessTokenRef.current = accessToken;
    }, [accessToken]);

    const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingPatchRef = useRef<Partial<NotificationPreference>>({});

    const flushPush = useCallback(async () => {
        if (pushTimerRef.current) {
            clearTimeout(pushTimerRef.current);
            pushTimerRef.current = null;
        }
        const patch = pendingPatchRef.current;
        pendingPatchRef.current = {};
        if (Object.keys(patch).length === 0) return;
        await updateNotificationPreferences(accessTokenRef.current, patch);
    }, []);

    const manager = useMemo(() => {
        const m = new NotificationManager({
            currentUserId: myself.userId || null,
            onPreferencesChange: (patch) => {
                pendingPatchRef.current = {
                    ...pendingPatchRef.current,
                    ...patch,
                };
                if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
                pushTimerRef.current = setTimeout(flushPush, PUSH_DEBOUNCE_MS);
            },
            onOpenIntent,
        });
        return m;
    }, []);

    // Keep the manager's currentUserId in sync as the user finishes auth.
    useEffect(() => {
        manager.setCurrentUserId(myself.userId || null);
    }, [manager, myself.userId]);

    // Keep the open-intent closure fresh — App.tsx rebuilds `openIntent`
    // when its dependencies (useCM/useTM/useUISM/...) change, and we want
    // the manager to use the latest version without throwing away its
    // dedupe map.
    useEffect(() => {
        manager.setOnOpenIntent(onOpenIntent);
    }, [manager, onOpenIntent]);

    const [preferences, setPreferences] = useState<NotificationPreference>(() =>
        manager.getPreferences()
    );
    const [permission, setPermission] = useState<WebNotificationPermission>(() =>
        readPermission()
    );

    // Mirror manager prefs into React state so consumers re-render.
    useEffect(() => {
        return manager.subscribePreferences((next) => {
            setPreferences({ ...next, mutedChats: [...next.mutedChats] });
        });
    }, [manager]);

    // Initial hydrate from backend once we have a token.
    useEffect(() => {
        let cancelled = false;
        if (!accessToken || !myself.userId) return;
        (async () => {
            const prefs = await getNotificationPreferences(accessToken);
            if (cancelled) return;
            manager.hydratePreferences(prefs);
        })();
        return () => {
            cancelled = true;
        };
    }, [manager, accessToken, myself.userId]);

    // Refresh permission state on tab focus in case the user changed it via
    // browser settings without a prompt.
    useEffect(() => {
        const onFocus = () => setPermission(readPermission());
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onFocus);
        return () => {
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onFocus);
        };
    }, []);

    // Flush the debounced push on unmount so we don't lose a pending patch.
    useEffect(() => {
        return () => {
            void flushPush();
        };
    }, [flushPush]);

    const requestPermission = useCallback(async (): Promise<WebNotificationPermission> => {
        if (!isNotificationsApiSupported()) {
            setPermission("unsupported");
            return "unsupported";
        }
        const next = await Notification.requestPermission();
        setPermission(next);
        return next;
    }, []);

    const setMasterEnabled = useCallback(
        (value: boolean) => manager.setMasterEnabled(value),
        [manager]
    );
    const setCategoryEnabled = useCallback(
        (category: NotificationCategory, value: boolean) =>
            manager.setCategoryEnabled(category, value),
        [manager]
    );
    const mute = useCallback(
        (chatType: number, chatId: string) => manager.mute(chatType, chatId),
        [manager]
    );
    const unmute = useCallback(
        (chatType: number, chatId: string) => manager.unmute(chatType, chatId),
        [manager]
    );
    const isMuted = useCallback(
        (chatType: number, chatId: string) => manager.isMuted(chatType, chatId),
        [manager]
    );
    const setActiveSurface = useCallback(
        (surface: ActiveSurface | null) => manager.setActiveSurface(surface),
        [manager]
    );
    const subscribeToasts = useCallback(
        (listener: (intent: NotificationIntent) => void) => manager.subscribeToasts(listener),
        [manager]
    );

    return {
        manager,
        preferences,
        permission,
        requestPermission,
        setMasterEnabled,
        setCategoryEnabled,
        mute,
        unmute,
        isMuted,
        setActiveSurface,
        subscribeToasts,
    };
};
