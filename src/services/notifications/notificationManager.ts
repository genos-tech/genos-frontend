import {
    ActiveSurface,
    DEFAULT_NOTIFICATION_PREFERENCE,
    MutedChatRef,
    NotificationCategory,
    NotificationDispatch,
    NotificationIntent,
    NotificationPreference,
} from "./types";

type PreferenceListener = (prefs: NotificationPreference) => void;
type ToastListener = (intent: NotificationIntent) => void;

interface ManagerOptions {
    /** Used to skip self-originated notifications. */
    currentUserId: string | null;
    /** Manager invokes this whenever prefs change so the React layer can
     *  PUT the patch to the backend (debounced upstream). */
    onPreferencesChange?: (patch: Partial<NotificationPreference>) => void;
    /** Invoked when a notification (browser or toast) is clicked. The React
     *  layer is responsible for navigating / orchestrating the destination
     *  surface; the manager just forwards the intent. */
    onOpenIntent?: (intent: NotificationIntent) => void;
    dedupeWindowMs?: number;
}

const DEFAULT_DEDUPE_MS = 30_000;

const isNotificationsApiSupported = (): boolean =>
    typeof window !== "undefined" &&
    typeof Notification !== "undefined" &&
    window.isSecureContext === true;

const isPageHidden = (): boolean =>
    typeof document !== "undefined" && document.visibilityState === "hidden";

const matchesActiveSurface = (
    intent: NotificationIntent,
    active: ActiveSurface | null
): boolean => {
    if (!active || !intent.source) return false;
    const src = intent.source;

    // Thread surface only matches thread intents (threadId on both sides).
    if (active.threadId !== undefined && src.threadId !== undefined) {
        return (
            active.threadId === src.threadId &&
            active.chatId === src.chatId &&
            active.chatType === src.chatType
        );
    }

    // Task preview matches task-comment intents.
    if (active.taskId !== undefined && src.taskId !== undefined) {
        if (active.taskId === src.taskId) return true;
    }

    // Main chat surface matches non-thread chat intents.
    if (
        active.chatId !== undefined &&
        active.chatType !== undefined &&
        src.chatId === active.chatId &&
        src.chatType === active.chatType &&
        src.threadId === undefined
    ) {
        return true;
    }

    return false;
};

/**
 * Pure (no React) class that owns:
 *
 *  - the in-memory copy of the user's notification preferences
 *  - the per-message dedupe map
 *  - the current "active surface" (which chat / thread / task is on screen)
 *
 * `notify(intent)` runs the full gate and either:
 *   - drops the intent (returning the reason),
 *   - pushes a `Notification` (when the tab is hidden), or
 *   - emits a toast event for the React layer to render in-app.
 */
export class NotificationManager {
    private currentUserId: string | null;
    private prefs: NotificationPreference;
    private readonly seenIds = new Map<string, number>();
    private readonly dedupeWindowMs: number;
    private activeSurface: ActiveSurface | null = null;
    private readonly prefListeners = new Set<PreferenceListener>();
    private readonly toastListeners = new Set<ToastListener>();
    private onPreferencesChange?: (patch: Partial<NotificationPreference>) => void;
    private onOpenIntent?: (intent: NotificationIntent) => void;

    constructor(opts: ManagerOptions) {
        this.currentUserId = opts.currentUserId;
        this.dedupeWindowMs = opts.dedupeWindowMs ?? DEFAULT_DEDUPE_MS;
        this.onPreferencesChange = opts.onPreferencesChange;
        this.onOpenIntent = opts.onOpenIntent;
        this.prefs = { ...DEFAULT_NOTIFICATION_PREFERENCE };
    }

    setCurrentUserId(userId: string | null) {
        this.currentUserId = userId;
    }

    setOnPreferencesChange(cb: (patch: Partial<NotificationPreference>) => void) {
        this.onPreferencesChange = cb;
    }

    setOnOpenIntent(cb: ((intent: NotificationIntent) => void) | undefined) {
        this.onOpenIntent = cb;
    }

    // Replace the full prefs blob (e.g. after the initial backend GET).
    // Does NOT trigger the onPreferencesChange callback.
    hydratePreferences(prefs: NotificationPreference) {
        this.prefs = { ...prefs, mutedChats: [...prefs.mutedChats] };
        this.notifyPrefListeners();
    }

    getPreferences(): NotificationPreference {
        return this.prefs;
    }

    subscribePreferences(listener: PreferenceListener): () => void {
        this.prefListeners.add(listener);
        return () => this.prefListeners.delete(listener);
    }

    subscribeToasts(listener: ToastListener): () => void {
        this.toastListeners.add(listener);
        return () => this.toastListeners.delete(listener);
    }

    setActiveSurface(surface: ActiveSurface | null) {
        this.activeSurface = surface;
    }

    private notifyPrefListeners() {
        const snapshot = this.prefs;
        this.prefListeners.forEach((l) => l(snapshot));
    }

    private commitPatch(patch: Partial<NotificationPreference>) {
        this.prefs = { ...this.prefs, ...patch };
        this.notifyPrefListeners();
        this.onPreferencesChange?.(patch);
    }

    setMasterEnabled(value: boolean) {
        this.commitPatch({ masterEnabled: value });
    }

    setCategoryEnabled(category: NotificationCategory, value: boolean) {
        const key: keyof NotificationPreference = (() => {
            switch (category) {
                case "chats":
                    return "enableChats";
                case "thread_replies":
                    return "enableThreadReplies";
                case "mentions":
                    return "enableMentions";
                case "task_comments":
                    return "enableTaskComments";
                case "inbox":
                    return "enableInbox";
            }
        })();
        this.commitPatch({ [key]: value } as Partial<NotificationPreference>);
    }

    isCategoryEnabled(category: NotificationCategory): boolean {
        switch (category) {
            case "chats":
                return this.prefs.enableChats;
            case "thread_replies":
                return this.prefs.enableThreadReplies;
            case "mentions":
                return this.prefs.enableMentions;
            case "task_comments":
                return this.prefs.enableTaskComments;
            case "inbox":
                return this.prefs.enableInbox;
        }
    }

    isMuted(chatType: number, chatId: string): boolean {
        return this.prefs.mutedChats.some((m) => m.chatType === chatType && m.chatId === chatId);
    }

    /**
     * Add a chat to the muted list. `chatName` is optional and only used
     * for display in the settings panel — leaving it undefined is harmless
     * (the panel falls back to `chatId`), but supplying it gives the user
     * something readable next time they open settings.
     */
    mute(chatType: number, chatId: string, chatName?: string) {
        if (this.isMuted(chatType, chatId)) return;
        const ref: MutedChatRef = chatName ? { chatType, chatId, chatName } : { chatType, chatId };
        const next: MutedChatRef[] = [...this.prefs.mutedChats, ref];
        this.commitPatch({ mutedChats: next });
    }

    unmute(chatType: number, chatId: string) {
        if (!this.isMuted(chatType, chatId)) return;
        const next = this.prefs.mutedChats.filter(
            (m) => !(m.chatType === chatType && m.chatId === chatId)
        );
        this.commitPatch({ mutedChats: next });
    }

    private pruneSeen() {
        const now = Date.now();
        for (const [id, seenAt] of this.seenIds.entries()) {
            if (now - seenAt > this.dedupeWindowMs) {
                this.seenIds.delete(id);
            }
        }
    }

    /**
     * Decide what to do with a translated intent. Order of checks:
     *   1. self-origin     -> ignored-self
     *   2. master / cat    -> ignored-disabled
     *   3. muted chat      -> ignored-muted
     *   4. dedupe          -> ignored-duplicate
     *   5. active surface  -> ignored-active-surface (only when foreground)
     *   6. dispatch        -> browser (hidden tab) or toast (foreground)
     */
    notify(intent: NotificationIntent): NotificationDispatch {
        if (intent.senderId && intent.senderId === this.currentUserId) {
            return "ignored-self";
        }

        if (!this.prefs.masterEnabled || !this.isCategoryEnabled(intent.category)) {
            return "ignored-disabled";
        }

        if (
            intent.source?.chatType !== undefined &&
            intent.source?.chatId !== undefined &&
            this.isMuted(intent.source.chatType, intent.source.chatId)
        ) {
            return "ignored-muted";
        }

        this.pruneSeen();
        if (this.seenIds.has(intent.id)) {
            return "ignored-duplicate";
        }
        this.seenIds.set(intent.id, Date.now());

        const hidden = isPageHidden();
        if (!hidden && matchesActiveSurface(intent, this.activeSurface)) {
            return "ignored-active-surface";
        }

        if (hidden) {
            if (!isNotificationsApiSupported() || Notification.permission !== "granted") {
                return "ignored-permission";
            }
            try {
                const n = new Notification(intent.title, {
                    body: intent.body,
                    icon: intent.icon,
                    tag: intent.id,
                });
                n.onclick = () => {
                    if (typeof window !== "undefined") window.focus();
                    this.onOpenIntent?.(intent);
                    n.close();
                };
                window.setTimeout(() => n.close(), 8000);
                return "browser";
            } catch (err) {
                console.warn("[notifications] failed to show browser notification", err);
                return "ignored-permission";
            }
        }

        this.toastListeners.forEach((l) => l(intent));
        return "toast";
    }
}
