import { CATEGORY_BY_KEY, COARSE_FIELD, CoarseGroup, NotificationCategory } from "./categories";
import { isSnoozedNow, SnoozeSchedule } from "./snooze";
import {
    ActiveSurface,
    DEFAULT_NOTIFICATION_PREFERENCE,
    MutedChatRef,
    MutedTargetRef,
    MutedTargetType,
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

// Categories the server actually delivers via Web Push (see the backend
// `webpush_dispatch._PUSH_DEFAULTS`). For these, a hidden-tab page
// notification would DUPLICATE the push, so we suppress it. Keep this
// IN LOCKSTEP with the server: a category listed here that the server does
// NOT push would get no hidden-tab notification at all; a pushed category
// missing here would double-notify.
//
// This list used to hold only the two mention categories, and the drift
// was load-bearing by accident: the server suppressed push for ~90s after
// a tab hid, and the page's own notification was what covered that window.
// Now that hiding clears presence immediately (`clearPresence`), push
// fires right away — so the page raising its own card as well is a
// straight duplicate, visible for the ~30s iOS keeps a backgrounded PWA's
// JavaScript alive.
//
// "In lockstep" is harder than it reads, because the two sides don't use
// the same words. The server's taxonomy is coarser, and mapping it onto
// these keys is what the equivalences below record — get one wrong and
// the failure is silent in one direction (a duplicate card) or invisible
// in the other (no notification at all):
//   server `mention_task` -> mention_task_body + mention_task_comment
//   server `mention_note` -> mention_note_my + mention_note_task + mention_note_chat
//   server `reactions`    -> no client category exists (reactions raise no
//                            page intent, so nothing to suppress)
//   server `agent_run_done` -> deliberately absent; see the note below.
const PUSH_COVERED_CATEGORIES: ReadonlySet<NotificationCategory> = new Set([
    "mention_chat",
    "mention_thread",
    "mention_task_body",
    "mention_task_comment",
    "mention_note_my",
    "mention_note_task",
    "mention_note_chat",
    "thread_replies",
    "task_comments",
    // The BlockNote inline-comment participant fan-out. The server pushes it
    // (`webpush_dispatch` routes THREAD_REPLY+isCommentParticipant to the
    // `comments` category, gated by `should_push`), so the page must defer to
    // that push — otherwise an away user gets both a card and an OS popup.
    "comments",
    "inbox",
    "chats",
]);
// NOT listed above, deliberately: `agent_run_done`. The server does push
// it, so listing it looks right — but the server applies two gates this
// code can't see (a minimum run duration, and presence, which counts a
// hidden tab as visible for up to 90s after the user switches away).
// Deferring would mean a hidden tab inside either gate gets NOTHING,
// which is the one outcome the feature exists to prevent. So the page
// always raises its own card, and the two are kept from stacking by
// sharing a notification `tag` (`agent_run_done:<run_id>`, set on both
// sides) — a same-tag notification REPLACES rather than adds, so a
// server push that also lands collapses into the one card.
// This works because an agent run only completes while the tab is alive:
// the stream stops draining when the tab closes, so the page is always
// there to notice. Revisit if run completion ever moves fully server-side.

// Synchronous "can this browser receive Web Push?" check — i.e. will the
// service worker deliver a covered category, so the page shouldn't also
// show one. Deliberately not the async "subscribed" flag (which can lag /
// fail to set); permission-granted + push support is a reliable proxy.
const isPushCapable = (): boolean =>
    isNotificationsApiSupported() &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof PushManager !== "undefined" &&
    Notification.permission === "granted";

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

    // Task preview matches task-comment intents only — the comment thread
    // and the comment-reaction stream are the conversation surface for an
    // open task, so a toast for a comment you're already reading would be
    // redundant. Mentions and chat broadcasts that happen to be linked to
    // the same task (e.g. the PM "task created" card you get pinged for
    // immediately after creating the task) are intentionally NOT
    // suppressed by this rule — those carry information the preview pane
    // doesn't render (the inline @assignee mention, etc.) and the user
    // expects to see the toast confirming the broadcast went out.
    if (
        active.taskId !== undefined &&
        src.taskId !== undefined &&
        intent.category === "task_comments"
    ) {
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
    // True once a Web Push subscription is active. When set, the service
    // worker owns OS notifications for hidden/closed tabs (driven by server
    // pushes), so the page-context `new Notification()` fallback below is
    // suppressed to avoid double-notifying.
    private pushActive = false;
    // Resolves the current user's IANA zone for the recurring-schedule branch
    // of the pause predicate. The manager is a context-free singleton, so the
    // React layer sets this to `resolveDisplayZone(myself, true)`; until then
    // the default keeps the schedule evaluating in UTC (the one-shot
    // `snoozeUntil` is zone-independent and works regardless).
    private zoneProvider: () => string = () => "UTC";

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

    /** Toggle whether a Web Push subscription is active. When true, the
     *  hidden-tab `new Notification()` fallback is suppressed (the SW shows
     *  the OS notification from a server push instead). */
    setPushActive(value: boolean) {
        this.pushActive = value;
    }

    /** The React layer supplies the current user's resolved IANA zone (via
     *  `resolveDisplayZone(myself, true)`) so the recurring-schedule branch
     *  fires in the same zone the profile card shows. */
    setZoneProvider(provider: () => string) {
        this.zoneProvider = provider;
    }

    /** Set (or clear, with `null`) the one-shot pause expiry — an absolute
     *  ISO instant. Commits like any other pref (debounced PUT upstream); a
     *  `null` clears it, which `toWire` sends explicitly. */
    setSnoozeUntil(value: string | null) {
        this.commitPatch({ snoozeUntil: value });
    }

    /** Set (or clear, with `null`) the recurring daily quiet window. */
    setSnoozeSchedule(value: SnoozeSchedule | null) {
        this.commitPatch({ snoozeSchedule: value });
    }

    /** Whether notifications are paused right now — the one-shot expiry OR an
     *  active recurring window, evaluated in the provided zone. Lazy (read at
     *  `notify()` time) so a lapsed pause needs no timer to take effect. */
    private isSnoozedNow(): boolean {
        return isSnoozedNow(
            this.prefs.snoozeUntil,
            this.prefs.snoozeSchedule,
            this.zoneProvider()
        );
    }

    /** Public read of the live paused state — the same lazy evaluation the
     *  `notify()` gate uses. Consumed by the self-echo reconciler to decide
     *  whether an echoed `isNotificationsPaused` diverges from local truth. */
    getIsSnoozedNow(): boolean {
        return this.isSnoozedNow();
    }

    // Replace the full prefs blob (e.g. after the initial backend GET).
    // Does NOT trigger the onPreferencesChange callback.
    hydratePreferences(prefs: NotificationPreference) {
        this.prefs = {
            ...prefs,
            categorySettings: { ...prefs.categorySettings },
            mutedChats: [...prefs.mutedChats],
            mutedTargets: [...prefs.mutedTargets],
            // `snoozeUntil` (string|null) and `snoozeSchedule` (object|null)
            // ride the spread; the schedule object is copied so a later
            // in-place edit of `prefs` can't mutate the manager's copy.
            snoozeSchedule: prefs.snoozeSchedule ? { ...prefs.snoozeSchedule } : null,
        };
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

    /** Independent EMAIL-channel master (backend `email_enabled`). */
    setEmailEnabled(value: boolean) {
        this.commitPatch({ emailEnabled: value });
    }

    /**
     * Set an EMAIL per-category override. `serverKey` is the SERVER's
     * fine-category vocabulary, stored as `email:<serverKey>` in the same
     * full-map-replaced `categorySettings` blob (see `emailCategories.ts`
     * for why the client registry's keys are the wrong ones here).
     */
    setEmailCategoryEnabled(serverKey: string, value: boolean) {
        const next = { ...this.prefs.categorySettings, [`email:${serverKey}`]: value };
        this.commitPatch({ categorySettings: next });
    }

    /**
     * Set a coarse *group* master (writes the legacy boolean column). When
     * off it hard-gates every sub-category in the group regardless of
     * `categorySettings`.
     */
    setGroupEnabled(group: CoarseGroup, value: boolean) {
        this.commitPatch({ [COARSE_FIELD[group]]: value } as Partial<NotificationPreference>);
    }

    /**
     * Set a fine sub-category override. Always commits the FULL
     * `categorySettings` map (the backend JSON field is replaced wholesale,
     * not merged) — never send a single-key delta.
     */
    setSubCategoryEnabled(category: NotificationCategory, value: boolean) {
        const next = { ...this.prefs.categorySettings, [category]: value };
        this.commitPatch({ categorySettings: next });
    }

    /**
     * Resolve whether a fine category notifies. The order encodes the
     * backward-compat hard-gate:
     *   masterEnabled && coarseGroupOn && (categorySettings[key] ?? default)
     * — an old client that turned a group off still suppresses every
     * sub-category under it.
     */
    isCategoryEnabled(category: NotificationCategory): boolean {
        const entry = CATEGORY_BY_KEY[category];
        if (!entry) return false;
        if (!this.prefs.masterEnabled) return false;
        const coarseOn = this.prefs[COARSE_FIELD[entry.group]] as boolean;
        if (!coarseOn) return false;
        return this.prefs.categorySettings[category] ?? entry.defaultEnabled;
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

    // ----- Per-object mute targets (thread / task / note) -----------------
    //
    // Identity is `(targetType, targetId)`. `categories` is a mutable scope
    // attribute, NOT part of identity — re-muting the same object with a
    // different scope upserts (replaces) the existing entry.

    isTargetMutedByKey(targetType: MutedTargetType, targetId: string | number): boolean {
        const id = String(targetId);
        return this.prefs.mutedTargets.some(
            (t) => t.targetType === targetType && t.targetId === id
        );
    }

    /**
     * Add (or replace, by `(targetType, targetId)`) a per-object mute.
     * `targetId` is normalized to a string so stored and compared forms
     * always match.
     */
    muteTarget(entry: MutedTargetRef) {
        const targetId = String(entry.targetId);
        const next = this.prefs.mutedTargets.filter(
            (t) => !(t.targetType === entry.targetType && t.targetId === targetId)
        );
        next.push({ ...entry, targetId });
        this.commitPatch({ mutedTargets: next });
    }

    unmuteTarget(targetType: MutedTargetType, targetId: string | number) {
        const id = String(targetId);
        if (!this.isTargetMutedByKey(targetType, id)) return;
        const next = this.prefs.mutedTargets.filter(
            (t) => !(t.targetType === targetType && t.targetId === id)
        );
        this.commitPatch({ mutedTargets: next });
    }

    /**
     * True when any `mutedTargets` entry matches this intent. Matches
     * per-object using the EXPLICIT source fields (threadId / taskId /
     * noteId) — never the overloaded `chatId` — and honors the optional
     * per-entry `categories` scope.
     */
    private isTargetMuted(intent: NotificationIntent): boolean {
        const src = intent.source;
        if (!src) return false;
        return this.prefs.mutedTargets.some((t) => {
            // Category scope: when set, only mute intents in those categories.
            if (t.categories && t.categories.length > 0) {
                if (!t.categories.includes(intent.category)) return false;
            }
            switch (t.targetType) {
                case "chat":
                    return (
                        src.chatType !== undefined &&
                        t.chatType !== undefined &&
                        src.chatType === t.chatType &&
                        src.chatId === t.targetId
                    );
                case "thread":
                    if (src.threadId === undefined) return false;
                    if (String(src.threadId) !== t.targetId) return false;
                    if (t.chatType !== undefined && src.chatType !== t.chatType) return false;
                    return true;
                case "task":
                    return src.taskId !== undefined && String(src.taskId) === t.targetId;
                case "note":
                    return src.noteId !== undefined && String(src.noteId) === t.targetId;
                default:
                    return false;
            }
        });
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
     *   1. self-origin       -> ignored-self
     *   2. paused (snooze)   -> ignored-paused
     *   3. master / cat      -> ignored-disabled
     *   4. muted chat/target -> ignored-muted
     *   5. dedupe            -> ignored-duplicate
     *   6. active surface    -> ignored-active-surface (only when foreground)
     *   7. dispatch          -> browser (hidden tab) or toast (foreground)
     */
    notify(intent: NotificationIntent): NotificationDispatch {
        if (intent.senderId && intent.senderId === this.currentUserId) {
            return "ignored-self";
        }

        // Slack-style pause: a one-shot expiry or an active recurring window
        // silences EVERYTHING. Placed high — above category/mute/dedupe — so a
        // pause is a clean top-level short-circuit that never entangles with
        // per-category logic, and so it can't consume the dedupe slot (a
        // message dropped for pause must still notify if it re-fires after the
        // pause lapses). Mirrors the server gates (`should_push`/`should_email`).
        if (this.isSnoozedNow()) {
            return "ignored-paused";
        }

        // `masterEnabled` is folded into `isCategoryEnabled` (checked once).
        if (!this.isCategoryEnabled(intent.category)) {
            return "ignored-disabled";
        }

        // Coarse "whole chat" mute.
        if (
            intent.source?.chatType !== undefined &&
            intent.source?.chatId !== undefined &&
            this.isMuted(intent.source.chatType, intent.source.chatId)
        ) {
            return "ignored-muted";
        }

        // Fine per-object mute (thread / task / note), optionally
        // category-scoped. Either mute matching is sufficient -> muted.
        if (this.isTargetMuted(intent)) {
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
            // Web Push (service worker) delivers the categories the server
            // pushes (PUSH_COVERED_CATEGORIES) whenever the browser can
            // receive push — so for those, suppress the page-context
            // notification to avoid duplicating the push. Other categories
            // (and push-incapable browsers) still fall through to
            // `new Notification()`, so they keep getting a hidden-tab alert.
            if (
                PUSH_COVERED_CATEGORIES.has(intent.category) &&
                (this.pushActive || isPushCapable())
            ) {
                return "ignored-push-owned";
            }
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
