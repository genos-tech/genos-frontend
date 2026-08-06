import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CoarseGroup, NotificationCategory } from "../../services/notifications/categories";
import {
    clearPresence,
    getNotificationPreferences,
    sendPresenceHeartbeat,
    updateNotificationPreferences,
} from "../../services/notifications/notificationApi";
import { NotificationManager } from "../../services/notifications/notificationManager";
import {
    ensurePushSubscription,
    initPushClickNavigation,
} from "../../services/notifications/pushSubscription";
import {
    ActiveSurface,
    MutedTargetRef,
    MutedTargetType,
    NotificationIntent,
    NotificationPreference,
} from "../../services/notifications/types";
import { viewingSurfaceToken } from "../../services/notifications/viewingSurface";
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
    /** True when a Web Push subscription is active (OS notifications work
     *  while the app tab is hidden or closed). */
    pushActive: boolean;
    requestPermission: () => Promise<WebNotificationPermission>;
    setMasterEnabled: (value: boolean) => void;
    /** Toggle the independent EMAIL-channel master. */
    setEmailEnabled: (value: boolean) => void;
    /** Toggle an email category (SERVER vocabulary — see emailCategories.ts). */
    setEmailCategoryEnabled: (serverKey: string, value: boolean) => void;
    /** Toggle a coarse group master (e.g. all mentions). */
    setGroupEnabled: (group: CoarseGroup, value: boolean) => void;
    /** Toggle a fine sub-category (e.g. task-body mentions). */
    setSubCategoryEnabled: (category: NotificationCategory, value: boolean) => void;
    mute: (chatType: number, chatId: string, chatName?: string) => void;
    unmute: (chatType: number, chatId: string) => void;
    isMuted: (chatType: number, chatId: string) => boolean;
    /** Add/replace a per-object mute (thread / task / note). */
    muteTarget: (entry: MutedTargetRef) => void;
    unmuteTarget: (targetType: MutedTargetType, targetId: string | number) => void;
    isTargetMutedByKey: (targetType: MutedTargetType, targetId: string | number) => boolean;
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

    // The conversation on screen, and a handle on the heartbeat that
    // reports it. Refs rather than state: `setActiveSurface` runs from a
    // layout effect on every route/chat change, and re-rendering every
    // consumer of this hook for a value only the heartbeat reads would be
    // a needless render on each one.
    const viewingSurfaceRef = useRef<string>("");
    const beatRef = useRef<(() => void) | null>(null);

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
    const [pushActive, setPushActive] = useState(false);

    // Mirror manager prefs into React state so consumers re-render. Clone
    // the mutable collections so a later in-place manager update can't
    // mutate the snapshot React is holding (and a new reference triggers
    // the re-render).
    useEffect(() => {
        return manager.subscribePreferences((next) => {
            setPreferences({
                ...next,
                categorySettings: { ...next.categorySettings },
                mutedChats: [...next.mutedChats],
                mutedTargets: [...next.mutedTargets],
            });
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

    // Subscribe to Web Push once permission is granted, and tell the
    // manager so it stops firing the page-context hidden-tab notification
    // (the service worker owns OS notifications from server pushes). No-ops
    // when unsupported / VITE_VAPID_PUBLIC_KEY unset.
    useEffect(() => {
        if (!accessToken || !myself.userId || permission !== "granted") return;
        let cancelled = false;
        (async () => {
            const active = await ensurePushSubscription(accessTokenRef.current);
            if (cancelled) return;
            setPushActive(active);
            manager.setPushActive(active);
        })();
        return () => {
            cancelled = true;
        };
    }, [manager, accessToken, myself.userId, permission]);

    // Route a push click (while a tab is open) to the deep-link target.
    useEffect(() => {
        initPushClickNavigation();
    }, []);

    // "I have a visible tab" heartbeat — drives server-side push
    // suppression so an open, focused tab gets the in-app toast rather than
    // a duplicate push. Sent only while visible.
    //
    // Hiding sends an explicit clear rather than waiting for the key to
    // expire. The TTL alone left a hole on iOS: a backgrounded PWA has its
    // JavaScript suspended after ~30s, so the page stops raising its own
    // notifications, while the server went on suppressing push for the
    // remaining ~60s of the TTL — nothing notified in between.
    useEffect(() => {
        if (!accessToken || !myself.userId) return;
        const beat = () => {
            if (document.visibilityState === "visible") {
                void sendPresenceHeartbeat(accessTokenRef.current, viewingSurfaceRef.current);
            }
        };
        beatRef.current = beat;
        beat();
        const interval = setInterval(beat, 45_000);
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") beat();
            else clearPresence(accessTokenRef.current);
        };
        // `pagehide` too: iOS often skips a final visibilitychange when the
        // app is swiped away, and this is the last code that runs.
        const onPageHide = () => clearPresence(accessTokenRef.current);
        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("pagehide", onPageHide);
        return () => {
            clearInterval(interval);
            beatRef.current = null;
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("pagehide", onPageHide);
        };
    }, [accessToken, myself.userId]);

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
    const setEmailEnabled = useCallback(
        (value: boolean) => manager.setEmailEnabled(value),
        [manager]
    );
    const setEmailCategoryEnabled = useCallback(
        (serverKey: string, value: boolean) => manager.setEmailCategoryEnabled(serverKey, value),
        [manager]
    );
    const setGroupEnabled = useCallback(
        (group: CoarseGroup, value: boolean) => manager.setGroupEnabled(group, value),
        [manager]
    );
    const setSubCategoryEnabled = useCallback(
        (category: NotificationCategory, value: boolean) =>
            manager.setSubCategoryEnabled(category, value),
        [manager]
    );
    const mute = useCallback(
        (chatType: number, chatId: string, chatName?: string) =>
            manager.mute(chatType, chatId, chatName),
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
    const muteTarget = useCallback(
        (entry: MutedTargetRef) => manager.muteTarget(entry),
        [manager]
    );
    const unmuteTarget = useCallback(
        (targetType: MutedTargetType, targetId: string | number) =>
            manager.unmuteTarget(targetType, targetId),
        [manager]
    );
    const isTargetMutedByKey = useCallback(
        (targetType: MutedTargetType, targetId: string | number) =>
            manager.isTargetMutedByKey(targetType, targetId),
        [manager]
    );
    // Two consumers of one value: the manager suppresses toasts locally,
    // and the presence heartbeat tells the server so it can skip the
    // activity-feed row too (`viewingSurface.ts`).
    //
    // Beating immediately on change — rather than letting the next 45s tick
    // carry it — is what keeps the server's picture honest while someone
    // clicks between chats. The old surface is retracted by the same beat
    // (the server remembers what this device last claimed), so a chat you
    // left stops suppressing its activities right away instead of for the
    // rest of the TTL.
    const setActiveSurface = useCallback(
        (surface: ActiveSurface | null) => {
            manager.setActiveSurface(surface);
            const token = viewingSurfaceToken(surface);
            if (token === viewingSurfaceRef.current) return;
            viewingSurfaceRef.current = token;
            beatRef.current?.();
        },
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
        pushActive,
        requestPermission,
        setMasterEnabled,
        setEmailEnabled,
        setEmailCategoryEnabled,
        setGroupEnabled,
        setSubCategoryEnabled,
        mute,
        unmute,
        isMuted,
        muteTarget,
        unmuteTarget,
        isTargetMutedByKey,
        setActiveSurface,
        subscribeToasts,
    };
};
