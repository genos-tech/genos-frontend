/**
 * Unified channel/message service.
 *
 * One class, one wire contract, one IDB path. Replaces ~60 per-chat-type
 * service files (loadDMChats, loadGMChats, sendDMMessage, etc.) with a
 * single set of methods that work for every channel kind (DM/GM/PM/MDM).
 *
 * Architecture (now wired end-to-end):
 *   - REST: `listChannels` / `fetchMessagesDelta` / `fetchThreadsDelta`
 *     for cold reads.
 *   - Socket mutations: `send` / `edit` / `deleteMessage` / `react` /
 *     `unreact` / `markRead` / `createChannel` / `addMembers` /
 *     `removeMember` / `subscribeChannel` / `resync`. Each emits a v3
 *     event with a correlation id and awaits the ack.
 *   - Socket inbound: `handle*` methods are called by `socketRouter`
 *     for every server-pushed event. They update the in-memory
 *     reactive store (notify React subscribers) AND persist to IDB
 *     (async, fire-and-forget) so a page reload still has data.
 *   - Hydration: `hydrateFromIDB()` runs on app boot to seed the
 *     in-memory store from IDB. Hooks render immediately off the
 *     cache while the REST chat-list refresh fills any gaps.
 *
 * Render contract: hooks use `useSyncExternalStore(subscribe, getSnapshot)`
 * to consume the in-memory store. Every event handler must call
 * `this._notify()` after mutating state so React re-renders.
 *
 * PM "1 bubble per task" is intentionally NOT in this layer — it's a
 * render-time selector in the hook (`useChannelMessages({groupBy:'task'})`,
 * arriving alongside the hook live-query work). Storage stays uniform.
 */

import axios from "axios";
import type { Socket } from "socket.io-client";

import { rememberPeople } from "../../components/ui/avatars/userDirectory";
import { INDEX_NAMES, STORES } from "../../db/config/constants";
import { initDB } from "../../db/config/schema";
import { CheckpointRepository } from "../../db/repositories/checkpoints";
import type {
    Ack,
    Channel,
    ChannelKind,
    ChannelMember,
    ChannelRetention,
    ChannelShare,
    DeltaEnvelope,
    Flag,
    Message,
    MessageAttachment,
    MessageReaction,
    MessageReminder,
    MessagesDeltaData,
    Pin,
    ReadCursor,
    UserLite,
} from "../../types/channel";
import { isV3Uuid } from "../../utils/legacyId";

/**
 * v3 REST base URL.
 *
 * NOT the legacy `VITE_API_BASE_URL` — that env points at `/api/v2`, so
 * `authApi(...).get("/api/v3/...")` would land at `/api/v2/api/v3/...`.
 * We use `VITE_DJANGO_URL` (the Django host root) so v3 paths resolve
 * cleanly to `/api/v3/...`. Falls back to the legacy env minus the
 * `/api/v2` suffix in case `VITE_DJANGO_URL` is unset in some
 * environments.
 */
function v3BaseURL(): string {
    const explicit = import.meta.env.VITE_DJANGO_URL;
    if (explicit) return explicit.replace(/\/$/, "");
    const legacy = import.meta.env.VITE_API_BASE_URL ?? "";
    return legacy.replace(/\/api\/v\d+$/, "").replace(/\/$/, "");
}

/**
 * Bounds on the reminder sweep — the re-read that follows a reminder's time
 * so the UI stops promising a nudge that has already been delivered. See
 * `ChannelService._scheduleReminderSweep`.
 *
 * GRACE: the server drains due reminders on a minutely cron, so waiting a
 * little past the time avoids a round trip that returns the row unchanged.
 * MIN: a floor, so a reminder the server hasn't drained yet can't become a
 * tight polling loop. MAX: `setTimeout` overflows past ~24.8 days and would
 * fire immediately, so a reminder set for next month re-arms instead.
 */
const REMINDER_SWEEP_GRACE_MS = 90_000;
const REMINDER_SWEEP_MIN_MS = 60_000;
const REMINDER_SWEEP_MAX_MS = 6 * 60 * 60 * 1000;

/**
 * Errors raised by `ChannelService` REST + socket methods.
 *
 * Mirrors the backend `BackendError → err_ack` pattern: every failure
 * is a structured object with a `code` (machine-readable, drives the
 * FE error toast) and `message` (human-readable detail). Silent
 * `null`/`undefined` returns are not in the API — callers either get
 * data or get an exception.
 */
export class ChannelServiceError extends Error {
    code: string;

    constructor(code: string, message: string) {
        super(message);
        this.name = "ChannelServiceError";
        this.code = code;
    }
}

function unwrapAxiosError(err: unknown): ChannelServiceError {
    if (axios.isAxiosError(err)) {
        const status = err.response?.status ?? 0;
        const body = err.response?.data as { error?: string; detail?: string } | undefined;
        const detail = body?.error || body?.detail || err.message;
        if (status === 401) return new ChannelServiceError("UNAUTHENTICATED", detail);
        if (status === 403) return new ChannelServiceError("FORBIDDEN", detail);
        if (status === 404) return new ChannelServiceError("NOT_FOUND", detail);
        if (status >= 500) return new ChannelServiceError("BACKEND_ERROR", detail);
        return new ChannelServiceError("VALIDATION_FAILED", detail);
    }
    return new ChannelServiceError("INTERNAL", String((err as Error)?.message ?? err));
}

/**
 * A `send()` call that hasn't yet been confirmed by the server.
 *
 * Pending entries serve three purposes:
 *
 *   1. Optimistic "sending…" UI: the chat pane can render
 *      `pendingByChannel.get(channelId)` as a strip of bubbles below
 *      the real message timeline so the user sees their message
 *      immediately instead of after the socket round-trip.
 *
 *   2. Offline queue: if the socket is disconnected at send time,
 *      the entry sits in the map (status = "queued"). On socket
 *      reconnect the bootstrap calls `flushPendingQueue()` to drain
 *      it. The caller's `await send()` promise stays pending across
 *      the whole gap and resolves when the eventual ack lands.
 *
 *   3. Retry-on-failure: if the ack returns `ok=false`, the entry
 *      transitions to "failed" with `lastError` populated. A future
 *      dev panel / chat row can offer a "retry" button that calls
 *      `retryPending(correlationId)` to re-emit with the same id.
 *
 * The map is keyed by `correlationId` because that's how the server
 * round-trips the identity — the broadcast on `message.created` echoes
 * the same id, which is how `handleMessageCreated` removes the entry
 * even when the ack itself raced the broadcast and got lost.
 *
 * NOT a retry queue in the auto-retry sense: the server does NOT
 * de-dup by correlation_id, so silently re-emitting a "failed"
 * message would create duplicate Message rows. Retry is user-driven.
 */
export interface PendingMessage {
    correlationId: string;
    channelId: string;
    body: unknown[];
    bodyText: string;
    parentId: string | null;
    metadata: Record<string, unknown>;
    /**
     * - `queued`: created but not yet emitted (socket was down).
     * - `sending`: emit has gone out, waiting on ack.
     * - `failed`: emit returned `ok=false` (BACKEND_ERROR, VALIDATION,
     *   etc.) OR the ack timed out / the socket dropped mid-flight.
     */
    status: "queued" | "sending" | "failed";
    enqueuedAt: string;
    attempts: number;
    lastError: { code: string; message: string; at: string } | null;
    /**
     * Id of the optimistic local-echo Message row (== correlationId)
     * rendered in `messagesByChannel` while this send is in flight.
     * Null when the caller didn't request an echo (`opts.echo` absent)
     * or after the echo has been reconciled away (replaced by the
     * server row on ack/broadcast, or removed on failure/discard).
     */
    echoMessageId: string | null;
}

/**
 * Health of the IDB cache layer. Updated whenever any `_persist*`
 * method (or `hydrateFromIDB`, `_evictChannelMessages`, the resync
 * checkpoint write, etc.) raises. The in-memory store is the
 * authoritative source of truth — IDB is best-effort cache for next
 * page load — so a single failure doesn't crash the UI. Surfacing
 * this state lets a dev tools panel render a "cache is degraded"
 * indicator and an "Acknowledge" / "Force resync" button.
 *
 * Lifecycle:
 *   - Starts at `"ok"` / `null` / `0`.
 *   - Any IDB op that throws transitions to `"degraded"` and bumps
 *     `errorCount` + sets `lastError` to the most recent failure.
 *   - Successful IDB ops do NOT auto-clear the degraded state — a
 *     burst of failures followed by one success doesn't mean the
 *     cache is healthy. Use `resetIdbHealth()` (e.g. from a dev panel
 *     "Acknowledge" button) to reset.
 */
export interface IdbHealth {
    status: "ok" | "degraded";
    lastError: { source: string; message: string; at: string } | null;
    errorCount: number;
}

/** Shape of the in-memory store consumed by React via getSnapshot(). */
export interface ChannelStoreSnapshot {
    /** Monotonically increasing mutation version. Guarantees
     *  `Object.is(prev, next) === false` after any state change so
     *  React's `useSyncExternalStore` re-renders, even when the inner
     *  Maps are mutated in place. Not consumed by React code other
     *  than as a change beacon. */
    version: number;
    /** True once `hydrateFromIDB()` has resolved (success OR failure) AND
     *  the first `listChannels()` REST refresh has landed. Hooks use
     *  this to distinguish "still loading" from "loaded empty". */
    hydrated: boolean;
    /** All channels by id. Keyed map for O(1) lookup; list views sort
     *  by `tsLastMessage`. */
    channels: ReadonlyMap<string, Channel>;
    /** Per-channel members, by channel id. */
    membersByChannel: ReadonlyMap<string, readonly ChannelMember[]>;
    /** Per-channel message arrays. Sorted by `tsSent` asc.
     *  Includes both top-level and thread replies — the hooks filter
     *  by `isThreadReply` when rendering the main pane vs a thread. */
    messagesByChannel: ReadonlyMap<string, readonly Message[]>;
    /** Per-channel main-timeline read cursor (thread cursors live
     *  under a separate map keyed by threadRootId — wiring those when
     *  threads are first consumed). */
    cursorsByChannel: ReadonlyMap<string, ReadCursor>;
    /** Pins / flags, keyed by id (their `userId` is implicit — these
     *  are the requesting user's pins/flags only). */
    pins: ReadonlyMap<string, Pin>;
    flags: ReadonlyMap<string, Flag>;
    /** Secondary index: which Pin (if any) covers `channelId`. The UI
     *  reads this to render the per-row pin button's selected state. */
    pinByChannelId: ReadonlyMap<string, Pin>;
    /** Secondary index: which Flag (if any) covers `messageId`. */
    flagByMessageId: ReadonlyMap<string, Flag>;
    /** Monotonic version of the flags state. Bumps whenever a flag is
     *  added, removed, or hydrated — AND when a message that carries an
     *  active flag is upserted/mutated/deleted (the flagged-list derive
     *  reads message content, so those changes must re-derive it too).
     *  `flags` / `flagByMessageId` Maps are mutated in place for cheap
     *  writes, so subscribers that need to dedup on flag-only changes
     *  track this counter instead of the Map reference (which never
     *  changes). */
    flagsVersion: number;
    /** Secondary index: the user's PENDING reminder (if any) per
     *  `messageId` — "remind me about this message at T", which also
     *  flags it. Only pending ones are held: a reminder that has fired
     *  or been cancelled has nothing left to show. Server-authoritative
     *  (loaded by `fetchReminders`, no socket broadcast), so a reminder
     *  set on another device appears here at the next boot. */
    reminderByMessageId: ReadonlyMap<string, MessageReminder>;
    /** Monotonic version of the reminder state, for the same reason
     *  `flagsVersion` exists — the Map is mutated in place. */
    remindersVersion: number;
    /** Monotonic version of the chat-LIST inputs: `channels`,
     *  `membersByChannel`, and pins. Message-only events (reactions,
     *  edits of non-latest rows, thread replies, read cursors that
     *  don't change unread) leave it untouched, so subscribers that
     *  derive the sidebar list can skip their O(channels) re-derive
     *  on the (much more frequent) message traffic. */
    channelsVersion: number;
    /** Cache-layer health. See `IdbHealth` for state semantics. */
    idbHealth: IdbHealth;
    /** Unconfirmed sends keyed by correlation_id. See `PendingMessage`. */
    pendingByCorrelationId: ReadonlyMap<string, PendingMessage>;
    /** Secondary index: pending entries grouped by channel for the UI
     *  to render below the timeline. Maintained in lockstep with the
     *  primary map; ordered by `enqueuedAt` asc. */
    pendingByChannel: ReadonlyMap<string, readonly PendingMessage[]>;
    /** Per-channel tier retention window, as last reported by the
     *  message delta envelope. Absent = unlimited history for the
     *  viewing user. Drives the "history limited" banner and the
     *  render-time cutoff filter for IDB-cached rows that aged past
     *  the window between syncs. */
    retentionByChannel: ReadonlyMap<string, ChannelRetention>;
}

/** correlation_id generator — uses uuidv4-ish style without adding a dep. */
function randomCorrelationId(): string {
    return "corr-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Inbound socket payload shapes. Match `_helpers.py` server-emitted events. */
type MessageDeletedPayload = {
    id: string;
    channelId: string;
    channelKind: ChannelKind;
    correlation_id?: string;
};
type ReactionAddedPayload = {
    messageId: string;
    channelId: string;
    channelKind: ChannelKind;
    reaction: MessageReaction;
    correlation_id?: string;
};
type ReactionRemovedPayload = {
    messageId: string;
    channelId: string;
    channelKind: ChannelKind;
    userId: string;
    emoji: string;
    correlation_id?: string;
};
// Narrow reply-count delta. Replaces the old full-row `message.updated`
// re-broadcast of a thread-reply's parent — that carried a (possibly
// stale) body and clobbered concurrent edits via the whole-object
// upsert. This delta merges ONLY `replyCount` and never synthesizes a
// body-less row.
type MessageReplyCountChangedPayload = {
    id: string;
    channelId: string;
    channelKind: ChannelKind;
    replyCount: number;
    correlation_id?: string;
};
type ChannelMemberAddedPayload = {
    channelId: string;
    channelKind: ChannelKind;
    member: ChannelMember;
    correlation_id?: string;
};
type ChannelMemberRemovedPayload = {
    channelId: string;
    channelKind: ChannelKind;
    userId: string;
    correlation_id?: string;
};
/** Resync envelope `data` shape — the backend's per-channel resync
 *  merge includes BOTH top-level messages AND thread replies in one
 *  envelope (see backend `_merge_envelope_per_channel`). The extra
 *  `thread_messages` field is what distinguishes this from the
 *  per-stream `MessagesDeltaData` used by `fetchMessagesDelta` /
 *  `fetchThreadsDelta`. */
type ResyncDeltaData = MessagesDeltaData & {
    thread_messages?: Message[];
};
type ResyncBatch = {
    channels: Array<{ channel_id: string; envelope: DeltaEnvelope<ResyncDeltaData> }>;
    errors?: Array<{ channel_id: string; error: string }>;
};

/**
 * Single ChannelService instance per app lifetime. Hooks and the
 * socket router consume it via the default export.
 */
export class ChannelService {
    private accessToken: string | null = null;
    private socket: Socket | null = null;
    private currentUserId: string | null = null;
    // The team whose chats are on screen. Drives the `team_id` filter on
    // `listChannels` — without it the sidebar shows every team the user
    // belongs to at once, so switching teams left the previous team's
    // chats rendered. See `setCurrentTeamId`.
    private currentTeamId: string | null = null;

    // ---- Reactive in-memory store -----------------------------------------
    //
    // React consumers use `useSyncExternalStore(subscribe, getSnapshot)`
    // — `subscribe` registers a listener that fires on any mutation,
    // `getSnapshot` returns the current stable snapshot (new reference
    // on every mutation so React's referential equality check triggers
    // a re-render).
    private _channels = new Map<string, Channel>();
    private _members = new Map<string, ChannelMember[]>();
    private _messages = new Map<string, Message[]>();
    private _cursors = new Map<string, ReadCursor>();
    private _pins = new Map<string, Pin>();
    private _flags = new Map<string, Flag>();
    /** Secondary indices, kept in lockstep with `_pins` / `_flags` so
     *  UI lookups are O(1) instead of O(N). The primary id-keyed maps
     *  remain authoritative for IDB persistence (keyPath: "id"). */
    private _pinByChannelId = new Map<string, Pin>();
    private _flagByMessageId = new Map<string, Flag>();
    /** Bumped on every `_flags` / `_flagByMessageId` mutation so
     *  subscribers can detect flag-only changes without relying on Map
     *  reference identity (the Maps are mutated in place). */
    private _flagsVersion = 0;
    /** Pending message reminders, keyed by message id. See the snapshot
     *  field doc. Not persisted to IDB: it is one small GET at boot, and
     *  a stale cached reminder would claim a nudge is coming that the
     *  server has already fired. */
    private _reminderByMessageId = new Map<string, MessageReminder>();
    private _remindersVersion = 0;
    /** The single pending reminder sweep — see `_scheduleReminderSweep`. */
    private _reminderSweep: ReturnType<typeof setTimeout> | null = null;
    /** Bumped on every `_channels` / `_members` / pin mutation — the
     *  inputs the chat-list derive reads. See the snapshot field doc. */
    private _channelsVersion = 0;
    /** IDB cache health tracking — see `IdbHealth` for the contract. */
    private _idbErrorCount = 0;
    private _lastIdbError: IdbHealth["lastError"] = null;
    /** Pending sends — see `PendingMessage` for the contract. The
     *  primary `_pendingByCorrelationId` map is authoritative; the
     *  secondary `_pendingByChannel` is maintained in lockstep for
     *  O(1) per-channel lookup by the UI. */
    private _pendingByCorrelationId = new Map<string, PendingMessage>();
    private _pendingByChannel = new Map<string, PendingMessage[]>();
    /** Tier retention per channel — see the snapshot field's doc. */
    private _retentionByChannel = new Map<string, ChannelRetention>();
    /**
     * Resolver callbacks for in-flight `send()` Promises, keyed by
     * `correlationId`. NOT exposed on the snapshot (functions don't
     * belong in user-visible state) — held privately so the ack OR
     * the matching broadcast can resolve the caller's Promise even
     * when the two race or the ack gets dropped on the floor by a
     * connection blip.
     */
    private _pendingResolvers = new Map<
        string,
        { resolve: (m: Message) => void; reject: (e: Error) => void }
    >();
    /** Flipped to true once `hydrateFromIDB()` settles (whether
     *  successfully or with an IDB failure). Hooks read this off the
     *  snapshot to render "loaded empty" instead of a perpetual
     *  spinner when the user has no channels. */
    private _hydrated = false;

    private _listeners = new Set<() => void>();
    /** Monotonically increasing version. Bumped on every mutation;
     *  the snapshot embeds it so `Object.is(prev, next) === false` is
     *  guaranteed even when nothing else about the snapshot changed.
     *  This is what useSyncExternalStore checks. */
    private _version = 0;
    /** Stable snapshot reference; bumped on every mutation. */
    private _snapshot: ChannelStoreSnapshot = this._buildSnapshot();

    private _buildSnapshot(): ChannelStoreSnapshot {
        return {
            version: this._version,
            hydrated: this._hydrated,
            channels: this._channels,
            membersByChannel: this._members,
            messagesByChannel: this._messages,
            cursorsByChannel: this._cursors,
            pins: this._pins,
            flags: this._flags,
            pinByChannelId: this._pinByChannelId,
            flagByMessageId: this._flagByMessageId,
            flagsVersion: this._flagsVersion,
            reminderByMessageId: this._reminderByMessageId,
            remindersVersion: this._remindersVersion,
            channelsVersion: this._channelsVersion,
            idbHealth: {
                status: this._idbErrorCount > 0 ? "degraded" : "ok",
                lastError: this._lastIdbError,
                errorCount: this._idbErrorCount,
            },
            pendingByCorrelationId: this._pendingByCorrelationId,
            pendingByChannel: this._pendingByChannel,
            retentionByChannel: this._retentionByChannel,
        };
    }

    /**
     * Record an IDB-layer failure. Bumps the snapshot so subscribers
     * re-render with the degraded indicator visible. Also preserves
     * the existing dev-console visibility so failures don't go silent
     * for engineers running without the dev panel mounted.
     *
     * Once degraded, the cache stays that way until `resetIdbHealth()`
     * is called explicitly — a burst of failures followed by a single
     * success doesn't mean the cache is healthy.
     */
    private _recordIdbError(source: string, e: unknown): void {
        this._idbErrorCount += 1;
        this._lastIdbError = {
            source,
            message: e instanceof Error ? e.message : String(e),
            at: new Date().toISOString(),
        };
        this._notify();

        console.warn(`[ChannelService] ${source} failed:`, e);
    }

    /**
     * Reset the IDB health indicator back to `ok` / 0 errors.
     * Intended for a dev panel "Acknowledge" button. Does not
     * actually repair the cache — if the underlying problem
     * persists, the next failed write flips the state back.
     */
    resetIdbHealth(): void {
        if (this._idbErrorCount === 0 && this._lastIdbError === null) return;
        this._idbErrorCount = 0;
        this._lastIdbError = null;
        this._notify();
    }

    private _notify(): void {
        // Bump version + create a new top-level object so
        // `useSyncExternalStore`'s `Object.is(prev, next)` returns
        // false even when none of the inner Maps changed identity
        // (they're mutated in place for cheaper writes).
        this._version += 1;
        this._snapshot = this._buildSnapshot();
        for (const fn of this._listeners) fn();
    }

    /** Mark the chat-list inputs (`_channels` / `_members` / pins) as
     *  changed. Call from every mutation of those maps, BEFORE the
     *  `_notify()` that publishes it. Does not notify by itself. */
    private _bumpChannels(): void {
        this._channelsVersion += 1;
    }

    subscribe = (fn: () => void): (() => void) => {
        this._listeners.add(fn);
        return () => {
            this._listeners.delete(fn);
        };
    };

    getSnapshot = (): ChannelStoreSnapshot => this._snapshot;

    // ---- Auth + transport configuration -----------------------------------

    /**
     * Set the JWT used for `/api/v3/` REST requests. Called on auth
     * changes (login, token refresh).
     */
    setAccessToken(token: string | null) {
        this.accessToken = token;
    }

    /**
     * Whether a token has been pushed in yet. Lets callers distinguish
     * "not signed in / token still in flight" — an expected, quiet state —
     * from a REST call that genuinely failed, rather than finding out via
     * the `UNAUTHENTICATED` throw from `api()`.
     */
    hasAccessToken(): boolean {
        return this.accessToken !== null;
    }

    /**
     * Set the current user id so message handlers can distinguish
     * self-sent (don't bump my unread count) from incoming events.
     *
     * Also detects a user switch (sign-out / sign-in as a different
     * user) and wipes in-memory state so the next user doesn't render
     * the previous user's channels. The persisted IDB cache is the
     * sign-in flow's responsibility (`DatabaseUtils.clearTeamScopedStores`);
     * this method only handles the in-process maps.
     */
    setCurrentUserId(userId: string | null) {
        const next = userId || null;
        const previous = this.currentUserId;
        if (previous === next) return;
        // Real switch: we previously had a user, and we're moving away
        // from them (to null on sign-out, or to a different id on
        // sign-in as someone else). Reset BEFORE swapping the id so
        // the snapshot's `currentUserId` flips in lockstep.
        if (previous) {
            this._resetForUserSwitch();
        }
        this.currentUserId = next;
    }

    /**
     * Drop every piece of in-memory state tied to the previous user's
     * session. Called by `setCurrentUserId` when a user-switch is
     * detected; not exposed publicly to discourage misuse during
     * normal operation (resetting mid-session would invalidate every
     * open subscription).
     *
     * Pairs with `DatabaseUtils.clearTeamScopedStores`: together they
     * wipe both the in-memory snapshot AND the persisted cache so the
     * next signed-in render starts from a clean slate.
     */
    private _resetForUserSwitch(): void {
        this._channels.clear();
        this._members.clear();
        this._messages.clear();
        this._cursors.clear();
        this._pins.clear();
        this._flags.clear();
        this._pinByChannelId.clear();
        this._flagByMessageId.clear();
        this._flagsVersion += 1;
        this._reminderByMessageId.clear();
        this._remindersVersion += 1;
        // Disarms the sweep: nothing is pending, and the next user's
        // reminders arrive through their own bootstrap.
        this._scheduleReminderSweep();
        this._bumpChannels();
        this._pendingByChannel.clear();
        // Reject in-flight send promises so callers don't await forever
        // on requests that belong to the previous user's socket. The
        // pending entries get cleared right after so retries can't
        // pick them up.
        for (const { reject } of this._pendingResolvers.values()) {
            try {
                reject(
                    new ChannelServiceError(
                        "USER_SWITCHED",
                        "Session ended before this send completed."
                    )
                );
            } catch {
                /* listener threw — non-fatal, keep going */
            }
        }
        this._pendingResolvers.clear();
        this._pendingByCorrelationId.clear();
        this._idbErrorCount = 0;
        this._lastIdbError = null;
        // The next user's bootstrap will call `hydrateFromIDB` which
        // flips this back to true after reading the (already-cleared)
        // IDB. Setting it false now means hooks render their loading
        // state correctly during the brief window between user-switch
        // and the new hydration completing.
        this._hydrated = false;
        this._notify();
    }

    /**
     * Set the team whose chats should be on screen.
     *
     * A channel always belongs to exactly one team (`Channel.team` is a
     * non-null FK server-side, DMs included), but `GET /api/v3/channels/`
     * returns every team the caller is a member of unless narrowed. So
     * this id is what makes the chat list team-scoped at all — see
     * `_doListChannels`.
     *
     * On a real switch the in-memory maps are wiped for the same reason
     * `setCurrentUserId` wipes them: `DatabaseUtils.clearTeamScopedStores()`
     * (called from `useAppInitialization`) empties the PERSISTED cache,
     * but the service's own maps are process state and survive it — so
     * the sidebar kept rendering the previous team's channels from
     * memory even though IDB was clean.
     */
    setCurrentTeamId(teamId: string | null) {
        const next = teamId || null;
        const previous = this.currentTeamId;
        if (previous === next) return;
        // Only a genuine switch resets. The first assignment (null → the
        // boot team) must NOT wipe, or it would discard the rows
        // `hydrateFromIDB` just loaded and blank the sidebar on boot.
        if (previous) {
            this._resetForTeamSwitch();
        }
        this.currentTeamId = next;
    }

    /**
     * Drop the previous team's channels, messages and cursors.
     *
     * Deliberately narrower than `_resetForUserSwitch`: the user has not
     * changed, so their pending sends stay valid and the socket stays
     * up. Only the team-scoped collections are cleared.
     */
    private _resetForTeamSwitch(): void {
        this._channels.clear();
        this._members.clear();
        this._messages.clear();
        this._cursors.clear();
        this._pins.clear();
        this._pinByChannelId.clear();
        this._flags.clear();
        this._flagByMessageId.clear();
        this._flagsVersion += 1;
        // Reminders are per-message and a message belongs to one team, so
        // they are as team-scoped as the flags they ride on. Re-read by
        // `fetchReminders` in the new team's bootstrap.
        this._reminderByMessageId.clear();
        this._remindersVersion += 1;
        this._scheduleReminderSweep();
        this._bumpChannels();
        // Same reasoning as the user-switch path: hooks should render
        // their loading state until the new team's list lands, rather
        // than an empty chat list that looks like "you have no chats".
        this._hydrated = false;
        this._notify();
    }

    /**
     * Wire the `/v3` socket. The router has already attached `socket.on(...)`
     * listeners to forward inbound events into `this.handle*`. The
     * service uses the socket itself only for outbound emits.
     */
    setSocket(socket: Socket | null) {
        this.socket = socket;
    }

    /** Memoized axios instance for v3 REST. Rebuilt only when the
     *  access token actually changes — re-using the instance reduces
     *  per-call overhead and keeps the underlying keep-alive connection
     *  pool warm. */
    private _axios: ReturnType<typeof axios.create> | null = null;
    private _axiosToken: string | null = null;

    private api() {
        if (!this.accessToken) {
            throw new ChannelServiceError(
                "UNAUTHENTICATED",
                "No access token set on ChannelService."
            );
        }
        if (this._axios && this._axiosToken === this.accessToken) {
            return this._axios;
        }
        this._axios = axios.create({
            baseURL: v3BaseURL(),
            headers: { Authorization: `Bearer ${this.accessToken}` },
            withCredentials: true,
        });
        this._axiosToken = this.accessToken;
        return this._axios;
    }

    private socketEmit<TData>(
        event: string,
        payload: Record<string, unknown>,
        timeoutMs = 15000
    ): Promise<Ack<TData>> {
        const sock = this.socket;
        if (!sock || !sock.connected) {
            return Promise.reject(
                new ChannelServiceError(
                    "DISCONNECTED",
                    `Socket not connected; cannot emit ${event}.`
                )
            );
        }
        const corr = (payload.correlation_id as string) ?? randomCorrelationId();
        return new Promise<Ack<TData>>((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(
                    new ChannelServiceError(
                        "TIMEOUT",
                        `Server ack timeout on ${event} (${timeoutMs}ms).`
                    )
                );
            }, timeoutMs);
            sock.emit(event, { ...payload, correlation_id: corr }, (ack: Ack<TData>) => {
                clearTimeout(timer);
                resolve(ack);
            });
        });
    }

    private async socketEmitOrThrow<TData>(
        event: string,
        payload: Record<string, unknown>
    ): Promise<TData | undefined> {
        const ack = await this.socketEmit<TData>(event, payload);
        if (!ack.ok) {
            throw new ChannelServiceError(ack.code, ack.message);
        }
        return ack.data;
    }

    // ---- REST reads --------------------------------------------------------

    // Coalesces a burst of concurrent `listChannels` callers into a single
    // GET. On boot `funcSetAllChats` fires from several effects (mount,
    // userId-settle, the post-load re-pull) plus the background refresh, each
    // hitting `/api/v3/channels/` with identical results. In-flight-only (no
    // time cache) so a team switch can never serve a stale channel list.
    // Mirrors the per-channel `_inflightSyncByChannel` dedup used by syncChannel.
    private _listChannelsInflight: Promise<Channel[]> | null = null;

    listChannels(): Promise<Channel[]> {
        const existing = this._listChannelsInflight;
        if (existing) return existing;

        const promise = this._doListChannels();
        this._listChannelsInflight = promise;
        // Release the slot once the work settles, regardless of outcome.
        //
        // This MUST live out here rather than in a `finally` inside the
        // async body: an async function runs synchronously up to its first
        // `await`, and `api()` throws on a missing token BEFORE that await.
        // So the body's `finally` would run while the right-hand side was
        // still being evaluated — clearing the slot, and then the pending
        // assignment would immediately re-fill it with the already-rejected
        // promise. Result: a poisoned cache that replays that first failure
        // to every later caller forever, without ever issuing a request.
        //
        // Identity-compare so a replacement queued by a later call isn't
        // dropped, and swallow the derived chain's re-thrown rejection so
        // cleanup doesn't log unhandled — the ORIGINAL promise still
        // rejects normally and propagates to callers via `return`.
        promise
            .finally(() => {
                if (this._listChannelsInflight === promise) {
                    this._listChannelsInflight = null;
                }
            })
            .catch(() => {
                /* original rejection is the caller's to handle */
            });
        return promise;
    }

    private async _doListChannels(): Promise<Channel[]> {
        try {
            // `team_id` is REQUIRED for correctness, not an optimization.
            // Unnarrowed, this endpoint returns every team the caller
            // belongs to, so team-a's chats reappeared in team-b the
            // instant the post-switch refresh landed — even with the IDB
            // cache correctly wiped.
            //
            // Sent only when known. Omitting it falls back to the old
            // all-teams behaviour, which is wrong but not broken; sending
            // `team_id=undefined` would serialize as the string
            // "undefined" and match no team, blanking the sidebar.
            const res = await this.api().get<{ channels: Channel[] }>("/api/v3/channels/", {
                params: this.currentTeamId ? { team_id: this.currentTeamId } : undefined,
            });
            return res.data.channels ?? [];
        } catch (e) {
            throw unwrapAxiosError(e);
        }
    }

    /**
     * Pull the authoritative channel list and land it in the store —
     * the ingest half of `loadV3Chats`, minus the legacy adaptation.
     *
     * Why this exists separately from `loadV3Chats`: the WS reconnect
     * handler (`useChannelServiceBootstrap`) needs to re-sync read state
     * but has no access to the React `useChatManagement` layer. It runs
     * `triggerResync()`, which replays missed MESSAGES — but a read cursor
     * that advanced on ANOTHER device while this one was disconnected is
     * NOT in the resync envelope (read.advanced is a per-user broadcast the
     * server doesn't buffer). So the chat-list unread badge stayed stale
     * after a reconnect until a full page reload re-ran `funcSetAllChats`.
     *
     * `listChannels()`'s `ChannelListView` recomputes `unreadCount` from the
     * server's `ReadCursor` on every call, so a plain re-fetch + `ingestChannels`
     * full-replace is all it takes to reconcile cross-device reads. The store
     * `_notify` bumps `channelsVersion`, which the sidebar subscription in
     * `useChatManagement` reads to re-derive `unReadChatCounts` — no extra
     * wiring on the React side.
     *
     * Best-effort: on a failed fetch we neither ingest nor reconcile (a
     * partial/failed list must never evict real channels — same contract as
     * `loadV3Chats`).
     */
    async refreshChannels(): Promise<void> {
        if (!this.hasAccessToken()) return;
        try {
            const fresh = await this.listChannels();
            this.ingestChannels(fresh);
            this.reconcileChannelList(fresh);
            this.ingestListMembers(fresh);
        } catch (e) {
            console.error(
                "[ChannelService] refreshChannels failed — unread badges may be stale " +
                    "until the next successful list refresh:",
                e
            );
        }
    }

    /**
     * Drop channels the server no longer lists.
     *
     * `listChannels` only ever ADDS: callers push each row through
     * `handleChannelCreated`, so a channel that disappears server-side lives on
     * in the snapshot and in IDB forever. There is a removal path
     * (`handleChannelMemberRemoved`), but it needs a live `channel.member_removed`
     * event — and a channel can vanish without one. Deleting a project
     * soft-deletes its PM channel through a Django signal that emits nothing, so
     * the chat sat in the sidebar pointing at a project that no longer exists,
     * 404ing `sprint/config`, `milestone/list`, `messages`, `threads` and
     * `members` on every sync.
     *
     * `GET /api/v3/channels/` is the user's COMPLETE active set for the
     * CURRENT TEAM — unpaginated, filtered on `is_deleted=False` and live
     * membership. So anything held locally but absent from it is either gone
     * (deleted, or we were removed) or belongs to another team, and evicting
     * it is right in both cases.
     *
     * ⚠️ This used to say "not team-scoped", and that was true until
     * `_doListChannels` started sending `team_id`. The distinction matters
     * here specifically: reconciling an all-teams list would have been a
     * no-op across teams, whereas reconciling a team-scoped one is what
     * actually evicts the previous team's chats after a switch.
     *
     * MUST only be called with an authoritative full list. Never call it with a
     * partial or failed response — that would evict every real channel.
     */
    reconcileChannelList(fresh: Channel[]): void {
        const live = new Set(fresh.map((c) => c.id));
        const stale = [...this._channels.values()].filter((c) => !live.has(c.id));
        if (stale.length === 0) return;

        for (const channel of stale) {
            // Stop the server pushing events for a channel we no longer show.
            // Best-effort, exactly as in `handleChannelMemberRemoved`: the
            // store has already dropped it, so any ghost event finds no
            // matching entry and is ignored.
            if (this.socket?.connected) {
                void this.unsubscribeChannel(channel.id, channel.kind).catch(() => {
                    /* best-effort — store already dropped it */
                });
            }
            this._channels.delete(channel.id);
            this._messages.delete(channel.id);
            this._cursors.delete(channel.id);
            this._members.delete(channel.id);
            this._pinByChannelId.delete(channel.id);
            void this._persistChannelDelete(channel.id);
        }
        console.info(
            `[ChannelService] dropped ${stale.length} channel(s) the server no longer lists:`,
            stale.map((c) => c.id)
        );
        this._bumpChannels();
        this._notify();
    }

    async fetchMessagesDelta(
        channelId: string,
        since?: string
    ): Promise<DeltaEnvelope<MessagesDeltaData>> {
        try {
            const res = await this.api().get<DeltaEnvelope<MessagesDeltaData>>(
                `/api/v3/channels/${channelId}/messages/`,
                { params: since ? { since } : undefined }
            );
            return res.data;
        } catch (e) {
            throw unwrapAxiosError(e);
        }
    }

    async fetchThreadsDelta(
        channelId: string,
        since?: string
    ): Promise<DeltaEnvelope<MessagesDeltaData>> {
        try {
            const res = await this.api().get<DeltaEnvelope<MessagesDeltaData>>(
                `/api/v3/channels/${channelId}/threads/`,
                { params: since ? { since } : undefined }
            );
            return res.data;
        } catch (e) {
            throw unwrapAxiosError(e);
        }
    }

    /**
     * Cold-fetch the full member roster for a channel. Used by
     * `syncChannel` so the FE has a populated member list on first
     * channel open this session — before that, `_members` only
     * contained whatever `channel.member_added` events landed live.
     *
     * NOT a delta endpoint: the response is the full current set.
     * Member additions / removals during the session flow through
     * the live `channel.member_added` / `channel.member_removed`
     * socket events (which append/remove from `_members` rather than
     * replacing the whole list).
     */
    async fetchChannelMembers(channelId: string): Promise<ChannelMember[]> {
        try {
            const res = await this.api().get<{ members: ChannelMember[] }>(
                `/api/v3/channels/${channelId}/members/`
            );
            return res.data.members ?? [];
        } catch (e) {
            throw unwrapAxiosError(e);
        }
    }

    /**
     * The guest teams in an external chat, with each team's participants.
     *
     * Channel-scoped rather than team-scoped because a guest reads the
     * chat from the HOST team's shell while belonging to neither — see
     * `ChannelSharesView`. Empty for every internal channel, so callers
     * can ask unconditionally.
     */
    async fetchChannelShares(channelId: string): Promise<ChannelShare[]> {
        try {
            const res = await this.api().get<{ shares: ChannelShare[] }>(
                `/api/v3/channels/${channelId}/shares/`
            );
            return res.data.shares ?? [];
        } catch (e) {
            throw unwrapAxiosError(e);
        }
    }

    /**
     * Fetch a single message by id (`GET /api/v3/messages/{id}/`) and
     * upsert it into the store WITHOUT bumping the channel's latest /
     * unread — this is a historical back-fill (e.g. resolving a flagged
     * or pinned message whose host channel hasn't been synced this
     * session), NOT a freshly-arrived message, so `handleMessageCreated`'s
     * latest/unread side effects would be wrong here.
     *
     * Returns the message, or null on 404 (deleted / no longer a member)
     * or any error — so a single stale flag can't break the whole list.
     */
    async fetchMessageById(messageId: string): Promise<Message | null> {
        let msg: Message | undefined;
        try {
            const res = await this.api().get<Message>(`/api/v3/messages/${messageId}/`);
            msg = res.data;
        } catch {
            return null;
        }
        if (!msg) return null;
        this._upsertMessage(msg);
        this._notify();
        void this._persistMessage(msg);
        return msg;
    }

    /**
     * Replace the entire member list for a channel atomically (under
     * one notify). Used by `syncChannel`'s cold-load path. Differs
     * from `handleChannelMemberAdded` (which appends a single member)
     * because we want the live-event-driven adds that happened during
     * the fetch to NOT be overwritten — we union the fetch result with
     * anything already in `_members` keyed by member.id, so a race
     * between the REST response and a `channel.member_added` socket
     * event preserves both views.
     */
    handleChannelMembersReplaced(channelId: string, members: ChannelMember[]): void {
        const existing = this._members.get(channelId) ?? [];
        const byId = new Map<string, ChannelMember>();
        for (const m of members) byId.set(m.id, m);
        // Union with any live-event entries that arrived during the
        // fetch and aren't represented in the server snapshot.
        for (const m of existing) {
            if (!byId.has(m.id)) byId.set(m.id, m);
        }
        const next = Array.from(byId.values());
        this._members.set(channelId, next);
        this._rememberMemberIdentities(next);
        this._bumpChannels();
        this._notify();
        // Persist each row — `_persistMember` is idempotent on member.id
        // so a duplicate write from a follow-up `channel.member_added`
        // is harmless.
        for (const m of next) void this._persistMember(m, channelId);
    }

    /**
     * Re-read one channel's roster from the server, now.
     *
     * `syncChannel` fetches the roster once and then never again while the
     * cache holds anything, trusting live `channel.member_added` events to
     * keep it current. Those events only reach people who were already in
     * the channel when they fired, so anyone admitted through a share made
     * after this tab loaded is missing here — the owning team would open a
     * shared chat's profile and see their own side and nobody else.
     *
     * For surfaces that display the roster as their subject (a profile
     * modal), refresh on open instead of trusting the cache. Resolves to
     * false when the request failed, leaving the cached roster in place: a
     * stale list beats an empty one.
     */
    async refreshChannelMembers(channelId: string): Promise<boolean> {
        try {
            this.handleChannelMembersReplaced(
                channelId,
                await this.fetchChannelMembers(channelId)
            );
            return true;
        } catch {
            return false;
        }
    }

    // ---- Per-channel incremental sync ------------------------------------
    //
    // `syncChannel(channelId)` is the single entry point that callers
    // (V3ChatShell, future deep-link routes) should use. It:
    //   1. Reads the persisted `serverTime` checkpoint for both the
    //      messages stream and the threads stream from IDB.
    //   2. Fetches both deltas in parallel with `?since=<checkpoint>`.
    //   3. If the server responded with `force_full_reload`, evicts
    //      the corresponding in-memory + IDB rows for the channel BEFORE
    //      applying the payload (so a stale row doesn't survive the reset).
    //   4. Applies the payload (`messages` → handleMessageCreated,
    //      `deletes` → handleMessageHardDelete).
    //   5. ONLY THEN persists the new checkpoints. If steps 1–4 fail, the
    //      old checkpoint stays put so the next sync retries the same
    //      window (idempotent at the cost of a re-fetch).
    //
    // Concurrency: per-channel mutex via `_inflightSyncByChannel` so two
    // re-renders or a rapid select→select→select don't issue overlapping
    // requests for the same channel. Cross-channel calls run in parallel.
    private _inflightSyncByChannel = new Map<string, Promise<void>>();
    private _checkpointRepo: CheckpointRepository | null = null;

    /** Stable per-channel + per-stream checkpoint keys. The `v3:` prefix
     *  namespaces the v3 incremental keys away from the legacy ones
     *  (e.g. plain `"dm"`) that share the same IDB store. */
    private _checkpointKeyMessages(channelId: string): string {
        return `v3:msgs:${channelId}`;
    }
    private _checkpointKeyThreads(channelId: string): string {
        return `v3:thrd:${channelId}`;
    }
    /** Last-seen retention window per channel ("90" or "unlimited").
     *  Persisted so a tier change (upgrade OR downgrade) between
     *  sessions is detected on the next sync and triggers a full
     *  evict + resync — upgrades instantly restore hidden history,
     *  downgrades drop now-hidden rows from the cache. */
    private _checkpointKeyRetention(channelId: string): string {
        return `v3:retn:${channelId}`;
    }

    private _checkpoints(): CheckpointRepository {
        if (!this._checkpointRepo) this._checkpointRepo = new CheckpointRepository();
        return this._checkpointRepo;
    }

    /**
     * Incrementally sync one channel (top-level + thread streams). Idempotent;
     * safe to call repeatedly. The returned promise resolves once the store
     * has been updated AND the new checkpoint persisted.
     *
     * On network failure, the promise rejects and the old checkpoint is
     * preserved so the next attempt fetches the same window again. Callers
     * that care about "did the sync land?" should `.catch` and surface it;
     * passive callers (e.g. mount effects) can fire-and-forget.
     */
    /**
     * True while a `syncChannel` for this channel is still in flight.
     * Lets the message pane tell "this chat's history hasn't arrived
     * yet" (show a loading skeleton) apart from "this chat really has no
     * messages" (show the empty state) — indistinguishable from the
     * message array alone, which is `[]` in both cases.
     */
    isSyncingChannel(channelId: string): boolean {
        return this._inflightSyncByChannel.has(channelId);
    }

    syncChannel(channelId: string): Promise<void> {
        const existing = this._inflightSyncByChannel.get(channelId);
        if (existing) return existing;

        const promise = this._doSyncChannel(channelId);
        this._inflightSyncByChannel.set(channelId, promise);
        // Release the mutex once the work settles, regardless of outcome.
        // `.finally(...)` chains a derived promise that re-throws on
        // rejection — swallow it with `.catch` so the cleanup doesn't
        // produce an unhandled-rejection log. The ORIGINAL `promise`
        // still rejects normally and propagates to callers via `return`.
        // Identity-compare so we don't accidentally drop a replacement
        // entry queued by a later call.
        promise
            .finally(() => {
                if (this._inflightSyncByChannel.get(channelId) === promise) {
                    this._inflightSyncByChannel.delete(channelId);
                }
            })
            .catch(() => {
                /* original rejection is the caller's to handle */
            });
        return promise;
    }

    private async _doSyncChannel(
        channelId: string,
        opts?: { retentionResync?: boolean }
    ): Promise<void> {
        const repo = this._checkpoints();
        const [rawMsgsCp, rawThreadsCp] = await Promise.all([
            repo.getCheckpoint(this._checkpointKeyMessages(channelId)),
            repo.getCheckpoint(this._checkpointKeyThreads(channelId)),
        ]);
        // Normalize: an empty-string checkpoint (the `_evictChannelMessages`
        // convention for "no watermark — treat as first load") collapses
        // to undefined so the REST helper omits `?since=` entirely.
        const sinceMsgs = rawMsgsCp ? rawMsgsCp : undefined;
        const sinceThreads = rawThreadsCp ? rawThreadsCp : undefined;

        // Fetch the member roster only on the FIRST sync of the
        // session — once `_members.get(channelId)` is non-empty, live
        // `channel.member_added` / `_removed` events keep it in sync
        // without a re-fetch. Subsequent syncs skip the roster call
        // to save a Django round-trip. If the live events somehow
        // drift the roster out of sync, the user will notice on next
        // page reload (which re-syncs from scratch).
        const needsMembers = (this._members.get(channelId) ?? []).length === 0;

        const [msgsRes, threadsRes, members] = await Promise.all([
            this.fetchMessagesDelta(channelId, sinceMsgs),
            this.fetchThreadsDelta(channelId, sinceThreads),
            needsMembers
                ? this.fetchChannelMembers(channelId).catch(() => {
                      // Non-fatal: an empty roster is the existing
                      // behavior anyway. The messages still load.
                      return null;
                  })
                : Promise.resolve(null),
        ]);

        if (members) {
            this.handleChannelMembersReplaced(channelId, members);
        }

        // ---- Tier retention (hide-not-delete) --------------------------
        // The envelope stamps the viewer's history window when their plan
        // limits it. When the window CHANGES relative to what this cache
        // was built against (upgrade → server now returns older history
        // our incremental delta didn't ask for; downgrade → cached rows
        // are now out-of-window), the cached streams no longer match:
        // evict everything (which also clears the since-checkpoints) and
        // run one full resync. Guarded so a resync can't recurse.
        const newRetention = msgsRes.retention ?? null;
        const retentionVal = newRetention ? String(newRetention.days) : "unlimited";
        if (!opts?.retentionResync) {
            const retentionKey = this._checkpointKeyRetention(channelId);
            const prevRaw = await repo.getCheckpoint(retentionKey).catch(() => null);
            // No stored value on a cache that predates this feature is
            // treated as "unlimited" — exactly right for the rollout:
            // the first envelope that carries a window forces the evict
            // that drops any cached out-of-window rows.
            const prevVal = prevRaw || "unlimited";
            const hadCheckpoint = Boolean(rawMsgsCp || rawThreadsCp);
            if (prevVal !== retentionVal) {
                await repo.setCheckpoint(retentionKey, retentionVal).catch(() => undefined);
                if (hadCheckpoint) {
                    await this._evictChannelMessages(channelId, "all");
                    await this._doSyncChannel(channelId, { retentionResync: true });
                    return;
                }
            }
        }
        if (newRetention) {
            this._retentionByChannel.set(channelId, newRetention);
        } else {
            this._retentionByChannel.delete(channelId);
        }

        // force_full_reload: server is telling us our checkpoint is
        // too old (or first load). Evict the channel's matching
        // stream from the store + IDB BEFORE applying the payload
        // so a row that the server has hard-deleted in the gap
        // doesn't survive the reset.
        if (msgsRes.force_full_reload) {
            await this._evictChannelMessages(channelId, "top-level");
        }
        if (threadsRes.force_full_reload) {
            await this._evictChannelMessages(channelId, "threads");
        }

        // Apply messages in ONE batch — single notify, single IDB
        // transaction (see `ingestMessages`). The upsert is idempotent
        // (by id), so re-applying the same row from a retried sync is a
        // no-op. Soft-deleted rows arrive as tombstones (`deletedAt`
        // set) and the upsert path overwrites the local copy correctly.
        this.ingestMessages([
            ...(msgsRes.data.messages ?? []),
            ...(threadsRes.data.messages ?? []),
        ]);

        // Apply hard-deletes. `data.deletes` is reserved for rows
        // that have been purged (not just soft-deleted) — usually
        // empty, but wire the path so the day a purge job runs the
        // client doesn't strand orphan rows.
        for (const id of msgsRes.data.deletes ?? []) {
            this.handleMessageHardDelete(channelId, id);
        }
        for (const id of threadsRes.data.deletes ?? []) {
            this.handleMessageHardDelete(channelId, id);
        }

        // Persist new checkpoints last. Use the server-issued
        // `server_time` (NOT max(ts_updated_at) of returned rows)
        // because the server is the authority on "as-of when did
        // I last serve this channel" — using a server timestamp
        // makes this race-safe against concurrent writes.
        await Promise.all([
            repo.setCheckpoint(this._checkpointKeyMessages(channelId), msgsRes.server_time),
            repo.setCheckpoint(this._checkpointKeyThreads(channelId), threadsRes.server_time),
        ]);

        // Surface the (possibly first-seen) retention state to
        // subscribers — the banner reads it off the snapshot, and the
        // message writes above don't fire when a sync returns no rows.
        this._notify();
    }

    /**
     * Reset all messages for a channel (either top-level or threads),
     * both in-memory and in IDB. Used by `syncChannel` when the server
     * signals `force_full_reload`, and exposed for the dev tools panel
     * to manually evict on demand.
     *
     * Does NOT reset the channel row itself, members, read cursor,
     * pins, or flags — those are managed by their own delta paths.
     */
    async _evictChannelMessages(
        channelId: string,
        scope: "top-level" | "threads" | "all"
    ): Promise<void> {
        const arr = this._messages.get(channelId) ?? [];
        const kept = arr.filter((m) => {
            if (scope === "all") return false;
            if (scope === "threads") return !m.isThreadReply;
            return m.isThreadReply; // scope === "top-level" → keep replies
        });
        this._messages.set(channelId, kept);
        this._notify();

        try {
            const db = await initDB();
            const tx = db.transaction(STORES.MESSAGES_V3, "readwrite");
            const store = tx.objectStore(STORES.MESSAGES_V3);
            // Walk only this channel's rows via the by-channel index so
            // we don't scan the entire messages store per evict.
            const index = store.index(INDEX_NAMES.MESSAGES_V3_BY_CHANNEL);
            let cursor = await index.openCursor(IDBKeyRange.only(channelId));
            while (cursor) {
                const row = cursor.value as Message;
                const matchesScope =
                    scope === "all"
                        ? true
                        : scope === "threads"
                          ? row.isThreadReply
                          : !row.isThreadReply;
                if (matchesScope) await cursor.delete();
                cursor = await cursor.continue();
            }
            await tx.done;
        } catch (e) {
            this._recordIdbError("_evictChannelMessages", e);
        }

        // Also reset the matching checkpoint so the next sync does a
        // full reload (otherwise we'd ask the server for "everything
        // since <stale ts>" and get nothing).
        try {
            const repo = this._checkpoints();
            const keysToClear: string[] = [];
            if (scope === "top-level" || scope === "all") {
                keysToClear.push(this._checkpointKeyMessages(channelId));
            }
            if (scope === "threads" || scope === "all") {
                keysToClear.push(this._checkpointKeyThreads(channelId));
            }
            // CheckpointRepository doesn't expose a delete; setting to
            // empty string is the convention used by other v3 paths to
            // mean "no watermark — treat as first load on next sync."
            // (Empty string falsy-checks the same as null at the call site.)
            for (const k of keysToClear) await repo.setCheckpoint(k, "");
        } catch (e) {
            this._recordIdbError("checkpoint_clear", e);
        }
    }

    /**
     * Hard-delete a single message from the store + IDB. Used by the
     * delta-sync `deletes` path (purge / GDPR scrubbing) — distinct
     * from `handleMessageDeleted` which sets a tombstone via `deletedAt`.
     */
    handleMessageHardDelete(channelId: string, messageId: string): void {
        const arr = this._messages.get(channelId);
        if (arr) {
            const next = arr.filter((m) => m.id !== messageId);
            if (next.length !== arr.length) {
                this._messages.set(channelId, next);
                if (this._flagByMessageId.has(messageId)) this._flagsVersion += 1;
                this._notify();
            }
        }
        void this._persistHardDelete(messageId);
    }

    private async _persistHardDelete(messageId: string) {
        try {
            const db = await initDB();
            await db.delete(STORES.MESSAGES_V3, messageId);
        } catch (e) {
            this._recordIdbError("_persistHardDelete", e);
        }
    }

    /**
     * Upload one file as a `MessageAttachment` against an existing
     * message. The server validates that the requesting user is the
     * sender; we do not pre-check that here because the auth/permission
     * model is owned by the server and a stale cache shouldn't gate the
     * UI from trying.
     *
     * Returns the serialized `MessageAttachment`. Callers should
     * pipeline this into the channel store via `handleMessageUpdated`
     * (or just trust the next `fetchMessagesDelta` to pick it up via
     * the bumped `ts_updated_at`).
     *
     * Multi-file uploads are NOT batched server-side; callers should
     * `Promise.all` over their pending list. Partial failure on one
     * file leaves the others attached.
     */
    async uploadAttachment(messageId: string, file: File): Promise<MessageAttachment> {
        const form = new FormData();
        form.append("file", file);
        if (file.type) form.append("mime", file.type);
        try {
            // IMPORTANT: do NOT set Content-Type manually here. axios
            // (and the browser's XHR/fetch under the hood) generates a
            // `multipart/form-data; boundary=...` header automatically
            // when the body is a FormData. Manually setting
            // `Content-Type: multipart/form-data` strips the boundary,
            // and the server's multipart parser then can't split the
            // parts → 400 "Missing multipart field 'file'."
            const res = await this.api().post<MessageAttachment>(
                `/api/v3/messages/${messageId}/attachments/`,
                form
            );
            return res.data;
        } catch (e) {
            throw unwrapAxiosError(e);
        }
    }

    /**
     * Compose-time inline file upload for the chat editors.
     *
     * BlockNote's `uploadFile` callback fires while the user is still
     * composing — before any Message exists — so it can't use the
     * message-scoped `uploadAttachment`. This posts to the channel-scoped
     * `/uploads/` route (membership-gated, no DB row) and returns the
     * absolute URL the server stored the file at; the editor embeds it as
     * an image/file block in the message body. Returns the URL verbatim —
     * do NOT prepend any base (the server returns an absolute URL).
     */
    async uploadInlineFile(channelId: string, file: File): Promise<string> {
        const form = new FormData();
        form.append("file", file);
        if (file.type) form.append("mime", file.type);
        try {
            // See uploadAttachment: never set Content-Type manually for a
            // FormData body — axios sets the multipart boundary itself.
            const res = await this.api().post<{ url: string }>(
                `/api/v3/channels/${channelId}/uploads/`,
                form
            );
            return res.data.url;
        } catch (e) {
            throw unwrapAxiosError(e);
        }
    }

    // ---- Pending send queue ----------------------------------------------
    //
    // See the `PendingMessage` interface for the full contract. The
    // four helpers below keep the primary/secondary maps in lockstep
    // and notify subscribers on every mutation so consumers re-render.

    private _upsertPending(p: PendingMessage): void {
        this._pendingByCorrelationId.set(p.correlationId, p);
        const arr = this._pendingByChannel.get(p.channelId) ?? [];
        const idx = arr.findIndex((x) => x.correlationId === p.correlationId);
        const next = idx >= 0 ? arr.map((x, i) => (i === idx ? p : x)) : [...arr, p];
        // Stable ascending order by enqueuedAt so the UI renders the
        // pending strip in the same order the user clicked send.
        next.sort((a, b) => (a.enqueuedAt < b.enqueuedAt ? -1 : 1));
        this._pendingByChannel.set(p.channelId, next);
        this._notify();
    }

    private _removePending(correlationId: string): PendingMessage | undefined {
        const existing = this._pendingByCorrelationId.get(correlationId);
        if (!existing) return undefined;
        this._pendingByCorrelationId.delete(correlationId);
        const arr = this._pendingByChannel.get(existing.channelId);
        if (arr) {
            const next = arr.filter((x) => x.correlationId !== correlationId);
            if (next.length === 0) this._pendingByChannel.delete(existing.channelId);
            else this._pendingByChannel.set(existing.channelId, next);
        }
        this._notify();
        return existing;
    }

    private _settlePending(
        correlationId: string,
        outcome: { ok: true; message: Message } | { ok: false; error: Error }
    ): void {
        const resolver = this._pendingResolvers.get(correlationId);
        this._pendingResolvers.delete(correlationId);
        if (resolver) {
            if (outcome.ok) resolver.resolve(outcome.message);
            else resolver.reject(outcome.error);
        }
    }

    /**
     * Build + insert the optimistic echo row for a pending send. In-
     * memory only — never persisted to IDB (a reload must not resurrect
     * an unconfirmed message; the reconnect flush re-sends the pending
     * entry instead). The provisional `seq` is tail+1 so unread
     * arithmetic stays sane until the server row replaces it.
     */
    private _insertEchoMessage(pending: PendingMessage, sender: UserLite): void {
        const ch = this._channels.get(pending.channelId);
        // Without the channel row we can't stamp a channelKind the
        // adapters rely on — skip the echo; the ack path still renders.
        if (!ch) return;
        const arr = this._messages.get(pending.channelId) ?? [];
        const tailSeq = arr.length > 0 ? arr[arr.length - 1].seq : (ch.latestMessage?.seq ?? 0);
        const now = new Date().toISOString();
        const echo: Message = {
            id: pending.correlationId,
            channelId: pending.channelId,
            channelKind: ch.kind,
            sender,
            seq: (tailSeq || 0) + 1,
            body: pending.body,
            bodyText: pending.bodyText,
            parentId: pending.parentId,
            threadRootId: pending.parentId,
            isThreadReply: pending.parentId != null,
            replyCount: 0,
            reactions: [],
            mentions: [],
            attachments: [],
            metadata: pending.metadata,
            taskId: null,
            displayId: null,
            taskStatus: null,
            editedAt: null,
            deletedAt: null,
            tsSent: now,
            tsUpdated: now,
        };
        pending.echoMessageId = echo.id;
        this._upsertMessage(echo);
        if (!echo.isThreadReply) this._bumpChannelLatest(echo);
        // No unread bump (self-sent), no notify (the caller notifies).
    }

    /**
     * Remove a pending send's echo row, if any. `replacement` is the
     * server-issued row when the send succeeded — it takes over the
     * channel's `latestMessage` slot if the echo held it; on failure/
     * discard (no replacement) the slot falls back to the newest
     * remaining top-level row so the sidebar preview doesn't keep a
     * ghost. No notify — callers publish the whole reconcile at once.
     */
    private _clearEcho(correlationId: string, replacement?: Message): void {
        const pending = this._pendingByCorrelationId.get(correlationId);
        const echoId = pending?.echoMessageId;
        if (!pending || !echoId) return;
        pending.echoMessageId = null;
        const arr = this._messages.get(pending.channelId);
        if (arr) {
            const next = arr.filter((m) => m.id !== echoId);
            if (next.length !== arr.length) this._messages.set(pending.channelId, next);
        }
        const ch = this._channels.get(pending.channelId);
        if (ch && ch.latestMessage?.id === echoId) {
            let latest: Message | null = replacement ?? null;
            if (!latest) {
                const rest = this._messages.get(pending.channelId) ?? [];
                for (let i = rest.length - 1; i >= 0; i--) {
                    const m = rest[i];
                    if (!m.isThreadReply && !m.deletedAt) {
                        latest = m;
                        break;
                    }
                }
            }
            this._channels.set(pending.channelId, { ...ch, latestMessage: latest });
            this._bumpChannels();
        }
    }

    // ---- Socket mutations (each emits + awaits ack) ----------------------

    /**
     * Send a message.
     *
     * Three cases:
     *
     *   - Socket connected: the pending entry transitions through
     *     `queued → sending → (removed on ack)`. The returned Promise
     *     resolves with the server-issued Message when the ack lands.
     *
     *   - Socket disconnected: the pending entry stays at `queued`.
     *     No emit goes out. The returned Promise stays pending across
     *     the disconnect — when the socket reconnects, the bootstrap
     *     calls `flushPendingQueue()` which drains every queued entry
     *     in `enqueuedAt` order. The Promise then resolves like the
     *     connected case.
     *
     *   - Ack returns `ok=false`: the pending entry transitions to
     *     `failed` with `lastError` populated, and the returned Promise
     *     rejects with that error. The user can call `retryPending(corr)`
     *     to re-emit, or `discardPending(corr)` to drop it.
     *
     * The same correlation_id is used on retries (no auto-retry — the
     * server does NOT de-dup by correlation_id, so a silent retry would
     * create duplicate Message rows).
     */
    send(
        channelId: string,
        body: unknown[],
        opts: {
            bodyText?: string;
            parentId?: string;
            metadata?: Record<string, unknown>;
            /**
             * Opt-in optimistic local echo: insert a synthetic Message
             * row (id = correlationId, sender = `echo.sender`) into the
             * store immediately so the pane paints the message without
             * waiting for the server ack round-trip. Reconciled by
             * `_clearEcho` on ack/broadcast (replaced by the server
             * row) or on failure/discard (removed; the caller restores
             * the composer). Opt-in so structured sends (PM task cards,
             * milestone posts) don't render a half-formed card.
             */
            echo?: { sender: UserLite };
        } = {}
    ): Promise<Message> {
        const correlationId = randomCorrelationId();
        const pending: PendingMessage = {
            correlationId,
            channelId,
            body,
            bodyText: opts.bodyText ?? "",
            parentId: opts.parentId ?? null,
            metadata: opts.metadata ?? {},
            status: "queued",
            enqueuedAt: new Date().toISOString(),
            attempts: 0,
            lastError: null,
            echoMessageId: null,
        };
        // Insert the echo row BEFORE `_upsertPending` so its notify
        // publishes both the pending entry and the visible bubble in
        // one pass.
        if (opts.echo) this._insertEchoMessage(pending, opts.echo.sender);
        this._upsertPending(pending);

        return new Promise<Message>((resolve, reject) => {
            this._pendingResolvers.set(correlationId, { resolve, reject });
            // Fire the emit if the socket is up; otherwise leave the
            // entry queued for `flushPendingQueue` on reconnect. Either
            // way, the resolver promise is the caller's handle on the
            // eventual outcome.
            void this._emitPending(correlationId).catch(() => {
                /* `_emitPending` already settled the resolver on error */
            });
        });
    }

    /**
     * Emit the socket event for one queued entry + handle the ack.
     * Idempotent against a missing entry (no-op) so a stray call from
     * a flush race is harmless.
     */
    private async _emitPending(correlationId: string): Promise<void> {
        const pending = this._pendingByCorrelationId.get(correlationId);
        if (!pending) return;
        if (!this.socket || !this.socket.connected) {
            // Stay queued — flush on reconnect.
            return;
        }
        this._upsertPending({
            ...pending,
            status: "sending",
            attempts: pending.attempts + 1,
        });
        try {
            const ack = await this.socketEmit<Message>(
                "message.send",
                {
                    correlation_id: correlationId,
                    channel_id: pending.channelId,
                    body: pending.body,
                    body_text: pending.bodyText,
                    parent_id: pending.parentId,
                    metadata: pending.metadata,
                },
                15000
            );
            if (ack.ok) {
                const msg = ack.data as Message;
                // Swap the optimistic echo row for the server row in the
                // SAME mutation pass (clear echo silently, then upsert +
                // notify inside handleMessageCreated) so the bubble never
                // flickers out between the two. `_upsertMessage` dedups
                // by message id, so the later broadcast / resync can't
                // duplicate it. Self-sent, so no unread bump; the #17
                // thread-reply guard applies.
                this._clearEcho(correlationId, msg);
                this.handleMessageCreated(msg);
                this._removePending(correlationId);
                // The broadcast also dedupes off the correlation id, but
                // the ack data carries the same Message, so settle now
                // rather than wait for the broadcast.
                this._settlePending(correlationId, {
                    ok: true,
                    message: msg,
                });
            } else {
                const err = new ChannelServiceError(ack.code, ack.message);
                this._markPendingFailed(correlationId, ack.code, ack.message);
                this._settlePending(correlationId, { ok: false, error: err });
            }
        } catch (e) {
            const err = e as ChannelServiceError;
            const code = err?.code ?? "INTERNAL";
            const msg = err?.message ?? String(e);
            this._markPendingFailed(correlationId, code, msg);
            this._settlePending(correlationId, { ok: false, error: err });
        }
    }

    private _markPendingFailed(correlationId: string, code: string, message: string): void {
        const existing = this._pendingByCorrelationId.get(correlationId);
        if (!existing) return;
        // The send failed — drop the optimistic bubble so the pane
        // matches reality (the caller restores the composer text). The
        // `_upsertPending` below publishes the removal via its notify.
        this._clearEcho(correlationId);
        this._upsertPending({
            ...existing,
            status: "failed",
            lastError: { code, message, at: new Date().toISOString() },
        });
    }

    /**
     * Re-emit a failed pending message with the SAME correlation id.
     * The server does not de-dup by correlation_id, so the caller (or
     * a dev panel) must decide whether to retry — if a previous
     * attempt actually wrote a row on the server but the ack got
     * lost, retrying creates a duplicate.
     */
    retryPending(correlationId: string): Promise<Message> {
        const pending = this._pendingByCorrelationId.get(correlationId);
        if (!pending) {
            return Promise.reject(
                new ChannelServiceError("NOT_FOUND", `No pending message ${correlationId}.`)
            );
        }
        // Re-arm the resolver so callers awaiting `retryPending` see
        // the next outcome instead of the dead one from the prior fail.
        return new Promise<Message>((resolve, reject) => {
            this._pendingResolvers.set(correlationId, { resolve, reject });
            this._upsertPending({ ...pending, status: "queued", lastError: null });
            void this._emitPending(correlationId).catch(() => {
                /* settled by _emitPending */
            });
        });
    }

    /**
     * Drop a pending entry without sending. The pending Promise
     * rejects with `DISCARDED` so an awaiting caller can clean up.
     */
    discardPending(correlationId: string): void {
        if (!this._pendingByCorrelationId.has(correlationId)) return;
        this._clearEcho(correlationId);
        this._removePending(correlationId);
        this._settlePending(correlationId, {
            ok: false,
            error: new ChannelServiceError("DISCARDED", "Pending message discarded by user."),
        });
    }

    /**
     * Drain every queued/failed pending message via `_emitPending` in
     * enqueuedAt order. Called by the bootstrap on socket reconnect.
     * Sequential so the per-channel ordering matches what the user
     * typed during the disconnect.
     */
    async flushPendingQueue(): Promise<void> {
        const entries = Array.from(this._pendingByCorrelationId.values()).sort((a, b) =>
            a.enqueuedAt < b.enqueuedAt ? -1 : 1
        );
        for (const p of entries) {
            // Only retry queued + failed entries; `sending` ones are
            // already in flight (or the previous attempt is racing).
            if (p.status === "sending") continue;
            await this._emitPending(p.correlationId);
        }
    }

    edit(messageId: string, body: unknown[], bodyText = ""): Promise<Message | undefined> {
        return this.socketEmitOrThrow<Message>("message.edit", {
            message_id: messageId,
            body,
            body_text: bodyText,
        });
    }

    /**
     * Rewrite the PM "task card" header message for a task after the
     * task's metadata (title / status / priority / assignee / due / ...)
     * changed, so the card in the PM channel reflects the edit for every
     * viewer — live.
     *
     * Keyed by `taskId` (the server locates the card by its `task` FK),
     * NOT by message id, so it works even when the PM channel isn't
     * loaded in this client (e.g. editing from Task Home). The card body
     * is built client-side (`taskMessageTemplate`), so the caller passes
     * the freshly-built `body`.
     *
     * The server rewrites the stored row and the Flask WS proxy
     * re-broadcasts it as `message.updated` to the PM room. We ALSO apply
     * the ack's row locally right away (deduped by id in `_upsertMessage`)
     * so the editor's own PM pane updates without waiting for the room
     * broadcast round-trip.
     *
     * Resolves to the updated `Message`, or `undefined` when the task has
     * no PM card message (the server returns a `{updated:false}` sentinel
     * — not an error).
     *
     * Replaces the pre-v3 `socket.emit("message", {methodType:"PUT"})`
     * card-sync whose Flask handler was removed in the v3 migration.
     */
    async updateTaskCard(
        taskId: number,
        body: unknown[],
        bodyText: string,
        metadata: Record<string, unknown>
    ): Promise<Message | undefined> {
        const ack = await this.socketEmit<Message | { updated: false }>("task_card.updated", {
            task_id: taskId,
            body,
            body_text: bodyText,
            metadata,
        });
        if (!ack.ok) {
            throw new ChannelServiceError(ack.code, ack.message);
        }
        const data = ack.data;
        // The no-card-message sentinel (`{updated:false}`) has no `id`.
        if (data && "id" in data && data.id) {
            this.handleMessageUpdated(data);
            return data;
        }
        return undefined;
    }

    deleteMessage(messageId: string, channelId: string, channelKind: ChannelKind): Promise<void> {
        // Look up the message in the in-memory store to find out whether
        // it's a thread reply. If so, we forward `parent_id` to the
        // server so it can broadcast the parent's freshly-decremented
        // `reply_count` as a `message.updated` — closing the
        // stale-reply-count gap symmetrically with the send path.
        //
        // We don't require the caller to remember whether the message
        // is a thread reply (or to look it up themselves) — the service
        // owns the store and can derive it cheaply. Missing the lookup
        // is non-fatal: the server falls back to "no parent broadcast",
        // and the next delta sync still surfaces the new replyCount.
        const arr = this._messages.get(channelId) ?? [];
        const target = arr.find((m) => m.id === messageId);
        const parentId = target?.isThreadReply ? target.parentId : null;
        return this.socketEmitOrThrow<void>("message.delete", {
            message_id: messageId,
            channel_id: channelId,
            channel_kind: channelKind,
            parent_id: parentId,
        }) as Promise<void>;
    }

    react(
        messageId: string,
        channelId: string,
        channelKind: ChannelKind,
        emoji: string
    ): Promise<MessageReaction | undefined> {
        return this.socketEmitOrThrow<MessageReaction>("reaction.add", {
            message_id: messageId,
            channel_id: channelId,
            channel_kind: channelKind,
            emoji,
        });
    }

    unreact(
        messageId: string,
        channelId: string,
        channelKind: ChannelKind,
        emoji: string
    ): Promise<void> {
        return this.socketEmitOrThrow<void>("reaction.remove", {
            message_id: messageId,
            channel_id: channelId,
            channel_kind: channelKind,
            emoji,
        }) as Promise<void>;
    }

    /** Forward-only on the server side. Calling with a lower seq than
     *  the existing cursor is a server-side no-op.
     *
     *  Fully best-effort, unlike `send`: read.advance is idempotent and
     *  forward-only, so a failed advance is self-healing — the next
     *  scroll tick, inbound message, or chat re-open re-sends the cursor.
     *  So markRead NEVER rejects, in either failure mode:
     *    - socket down (cold-load before the handshake, or a transient
     *      reconnect — network blip, laptop sleep, mobile background):
     *      short-circuit to a resolved no-op;
     *    - emit rejects (ack timeout, or the socket server can't reach
     *      Django and returns a backend error): swallow to undefined.
     *  markRead fires on every cursor advance — constantly while the user
     *  scrolls — so letting it reject flooded the console with errors on a
     *  degraded backend, for a failure that needs no recovery and no
     *  offline queue (cf. the send queue, which exists only because sends
     *  are non-idempotent and losing one is data loss). Returns undefined
     *  on any failure; callers ignore the value. */
    markRead(
        channelId: string,
        lastReadMessageId: string,
        threadRootId?: string
    ): Promise<ReadCursor | undefined> {
        if (!this.socket?.connected) {
            return Promise.resolve(undefined);
        }
        // An unacked message is rendered from its optimistic echo, whose
        // `id` is the `corr-<random>` correlation id — not a server row.
        // Callers pick the cursor by "newest / last visible bubble", so
        // the user's own in-flight message is exactly what they hand us
        // here. Forwarding it means Django looks up a UUIDField by a
        // non-UUID string and 500s. Skip: the echo is replaced by the
        // real row on ack, and the next advance carries the real id.
        if (!isV3Uuid(lastReadMessageId)) {
            return Promise.resolve(undefined);
        }
        // Absent (main timeline) is fine; present-but-malformed is not.
        if (threadRootId != null && !isV3Uuid(threadRootId)) {
            return Promise.resolve(undefined);
        }
        return this.socketEmitOrThrow<ReadCursor>("read.advance", {
            channel_id: channelId,
            last_read_message_id: lastReadMessageId,
            thread_root_id: threadRootId ?? null,
        }).catch(() => undefined);
    }

    subscribeChannel(
        channelId: string
    ): Promise<{ channel_id: string; kind: ChannelKind } | undefined> {
        return this.socketEmitOrThrow<{ channel_id: string; kind: ChannelKind }>(
            "channel.subscribe",
            { channel_id: channelId }
        );
    }

    unsubscribeChannel(channelId: string, kind: ChannelKind): Promise<void> {
        return this.socketEmitOrThrow<void>("channel.unsubscribe", {
            channel_id: channelId,
            kind,
        }) as Promise<void>;
    }

    createChannel(payload: {
        kind: ChannelKind;
        teamId: string;
        title?: string;
        isPrivate?: boolean;
        memberUserIds?: string[];
        otherUserId?: string; // DM only
        /** GM only — make this a cross-team chat. Forces privacy on. */
        isExternal?: boolean;
        /** Connected teams to offer the new chat to. Each is offered a
         *  grant they accept once; after that their own owner/editors
         *  admit their people. `memberUserIds` stays host-side only. */
        guestTeamIds?: string[];
    }): Promise<Channel | undefined> {
        return this.socketEmitOrThrow<Channel>("channel.create", {
            kind: payload.kind,
            team_id: payload.teamId,
            title: payload.title,
            is_private: payload.isPrivate,
            member_user_ids: payload.memberUserIds,
            other_user_id: payload.otherUserId,
            is_external: payload.isExternal,
            guest_team_ids: payload.guestTeamIds,
        });
    }

    /**
     * Edit channel metadata (title / profile image / visibility).
     *
     * Authz is enforced server-side (owner-only). Pass only the fields
     * the user is changing; omitted fields stay untouched.
     *
     * DM channels can't be renamed (their identity is the user pair).
     * PM channels mirror the project's metadata: a `title`-only patch is
     * accepted and DELEGATED server-side to the project rename
     * (project-owner-only; the signal mirrors the name back onto the
     * channel), so a project rename broadcasts `channel.updated` like a
     * GM rename. Any other PM field returns 400 / `BACKEND_ERROR` — go
     * through the project edit flow.
     */
    updateChannel(
        channelId: string,
        channelKind: ChannelKind,
        patch: {
            title?: string;
            profileImageUrl?: string;
            isPrivate?: boolean;
            /** Transfer ownership to a current member. The backend
             *  validates that the target user is a current
             *  non-deleted member of this channel. */
            ownerUserId?: string;
        }
    ): Promise<Channel | undefined> {
        // Map camelCase → snake_case for the wire (matches the rest of
        // the v3 emit conventions). Skip undefined fields so the server
        // doesn't write nullable columns to empty.
        const payload: Record<string, unknown> = {
            channel_id: channelId,
            channel_kind: channelKind,
        };
        if (patch.title !== undefined) payload.title = patch.title;
        if (patch.profileImageUrl !== undefined) {
            payload.profile_image_url = patch.profileImageUrl;
        }
        if (patch.isPrivate !== undefined) payload.is_private = patch.isPrivate;
        if (patch.ownerUserId !== undefined) payload.owner_user_id = patch.ownerUserId;
        return this.socketEmitOrThrow<Channel>("channel.update", payload);
    }

    addMembers(
        channelId: string,
        userIds: string[]
    ): Promise<{ members: ChannelMember[] } | undefined> {
        return this.socketEmitOrThrow<{ members: ChannelMember[] }>("channel.member.add", {
            channel_id: channelId,
            user_ids: userIds,
        });
    }

    /**
     * Self-join a PUBLIC GM — the chat-search "click an open group you're
     * not in yet" path. Emits `channel.join`; the backend adds the current
     * user as a member and fans out `channel.created` (to our user room) +
     * `channel.member_added` (to the channel room).
     *
     * We also apply the returned channel/member to the store eagerly so the
     * caller can open the channel immediately, without racing the broadcast
     * round-trip. Both `handleChannelCreated` and `handleChannelMemberAdded`
     * are idempotent (upsert by id), so the subsequent broadcast can't
     * duplicate anything.
     *
     * Private GMs are NOT self-joinable: the backend returns 403 and this
     * rejects — callers should route those through the owner-approval
     * request flow (`ModalJoinGM`) instead of calling this.
     */
    async joinChannel(channelId: string): Promise<Channel | undefined> {
        const data = await this.socketEmitOrThrow<{ channel: Channel; member: ChannelMember }>(
            "channel.join",
            { channel_id: channelId }
        );
        if (!data?.channel) return undefined;
        this.handleChannelCreated(data.channel);
        if (data.member) {
            this.handleChannelMemberAdded({
                channelId: data.channel.id,
                channelKind: data.channel.kind,
                member: data.member,
            });
        }
        return data.channel;
    }

    removeMember(channelId: string, channelKind: ChannelKind, userId: string): Promise<void> {
        return this.socketEmitOrThrow<void>("channel.member.remove", {
            channel_id: channelId,
            channel_kind: channelKind,
            user_id: userId,
        }) as Promise<void>;
    }

    /** Raw resync emit. Used by `triggerResync` and exposed for tests/
     *  dev tools that want to fire a resync with explicit channel ids
     *  + a custom `since`. Most callers should use `triggerResync()`. */
    resync(channelIds: string[], since?: string): Promise<ResyncBatch | undefined> {
        return this.socketEmitOrThrow<ResyncBatch>("resync", {
            channel_ids: channelIds,
            since: since ?? null,
        });
    }

    /**
     * Reconnect-resync orchestrator: read the persisted per-channel
     * checkpoints, send a `resync` emit with the EARLIEST one as the
     * `since`, then apply the returned batch to the store + IDB.
     *
     * Why a single global `since` (and not a per-channel sinces map):
     *   - The backend currently takes a single `?since=` and reuses it
     *     for every channel in the batch. Sending the earliest checkpoint
     *     means no channel under-fetches; channels whose checkpoint is
     *     newer than the global since just receive a few extra (already
     *     known) rows that the store-level upsert dedupes for free.
     *   - This trades a slightly larger network response for a much
     *     simpler protocol. A per-channel `sinces` map is a follow-up if
     *     the over-fetch ever becomes measurable.
     *
     * Mutex'd via `_resyncInflight` so two rapid `connect` events
     * (e.g. socket transport upgrade firing twice) don't double-fetch.
     */
    private _resyncInflight: Promise<number> | null = null;

    triggerResync(): Promise<number> {
        if (this._resyncInflight) return this._resyncInflight;
        const promise = this._doTriggerResync();
        this._resyncInflight = promise;
        promise
            .finally(() => {
                if (this._resyncInflight === promise) this._resyncInflight = null;
            })
            .catch(() => {
                /* caller's promise still rejects; this catch just
                 * keeps the cleanup chain from logging unhandled. */
            });
        return promise;
    }

    private async _doTriggerResync(): Promise<number> {
        const channelIds = Array.from(this._channels.keys());
        if (channelIds.length === 0) return 0;

        // Pick the EARLIEST checkpoint across all channels' messages
        // AND threads checkpoints. ISO 8601 strings sort temporally
        // when normalized to UTC `Z`, which our backend always emits.
        // A missing checkpoint (channel never synced) collapses to
        // "no since" so the server returns the full backlog for it.
        const repo = this._checkpoints();
        let earliest: string | null = null;
        let anyMissing = false;
        for (const id of channelIds) {
            const cps = await Promise.all([
                repo.getCheckpoint(this._checkpointKeyMessages(id)),
                repo.getCheckpoint(this._checkpointKeyThreads(id)),
            ]);
            for (const cp of cps) {
                if (!cp) {
                    anyMissing = true;
                    continue;
                }
                if (earliest === null || cp < earliest) earliest = cp;
            }
        }
        // If ANY channel has no checkpoint, omitting `since` falls back
        // to "give me everything you have." That matches the semantics
        // the server already expects.
        const since = anyMissing ? undefined : (earliest ?? undefined);

        const batch = await this.resync(channelIds, since);
        if (!batch) return 0;
        return this.applyResyncBatch(batch);
    }

    // ---- Pin / Flag (socket emit, optimistic store update) ----------------
    //
    // Pin/Flag are per-user "bookmarks": a Pin marks a channel as a
    // favorite (top of the chat list); a Flag marks a message as worth
    // coming back to. Both are idempotent on the server.
    //
    // Wire path:
    //   1. We optimistically update the local store so the button flips
    //      instantly.
    //   2. We emit a `pin.add` / `pin.remove` / `flag.add` / `flag.remove`
    //      socket event and await the ack.
    //   3. On ack=ok: the server broadcasts `pin.added` / `pin.removed`
    //      (etc.) to the `user:<userId>` room — every tab the same user
    //      has open, INCLUDING this one, receives it and reconciles via
    //      `handlePinAdded` (which is idempotent against the optimistic
    //      row by replacing-on-channelId).
    //   4. On ack=err: we roll back the optimistic update so the UI
    //      doesn't drift from server truth.
    //
    // Cross-tab sync is the whole point of going through the socket
    // (instead of the REST endpoint directly): another tab pinning a
    // channel reaches this tab via the same broadcast loop, no reload
    // needed.

    async pinChannel(channelId: string): Promise<Pin | undefined> {
        // Optimistic placeholder — replaced by the server-issued Pin
        // when the `pin.added` broadcast comes back.
        const optimistic: Pin = {
            id: `optimistic-${channelId}`,
            channelId,
            tsCreated: new Date().toISOString(),
        };
        this._upsertPin(optimistic);
        try {
            return await this.socketEmitOrThrow<Pin>("pin.add", {
                channel_id: channelId,
            });
        } catch (e) {
            this._removePinByChannel(channelId);
            throw e;
        }
    }

    async unpinChannel(channelId: string): Promise<void> {
        const existing = this._pinByChannelId.get(channelId);
        this._removePinByChannel(channelId);
        try {
            await this.socketEmitOrThrow<void>("pin.remove", {
                channel_id: channelId,
            });
        } catch (e) {
            if (existing) this._upsertPin(existing);
            throw e;
        }
    }

    // Completed flags aren't in `_flagByMessageId` (active-only). Scan
    // `_flags` to find one by message id — used to reactivate in place.
    private _findCompletedFlagByMessage(messageId: string): Flag | undefined {
        for (const f of this._flags.values()) {
            if (f.messageId === messageId && f.completedAt) return f;
        }
        return undefined;
    }

    async flagMessage(messageId: string): Promise<Flag | undefined> {
        // Re-flagging a COMPLETED message must reactivate its existing row
        // in place (reuse its id, clear completedAt) so it doesn't briefly
        // appear in BOTH the active and past lists. The server's POST does
        // the same reset (FlagView.post), and its `flag.added` broadcast
        // reconciles the same row. A fresh flag keeps the optimistic id.
        const completed = this._findCompletedFlagByMessage(messageId);
        const optimistic: Flag = completed
            ? { ...completed, completedAt: null }
            : { id: `optimistic-${messageId}`, messageId, tsCreated: new Date().toISOString() };
        this._upsertFlag(optimistic);
        try {
            return await this.socketEmitOrThrow<Flag>("flag.add", {
                message_id: messageId,
            });
        } catch (e) {
            if (completed) this._upsertFlag(completed);
            else this._removeFlagByMessage(messageId);
            throw e;
        }
    }

    async unflagMessage(messageId: string): Promise<void> {
        // May be an active flag (in the message-keyed index) or a completed
        // one (only in `_flags`) when removing from the past view — capture
        // whichever so an ack failure restores the exact prior row/state.
        const existing =
            this._flagByMessageId.get(messageId) ?? this._findCompletedFlagByMessage(messageId);
        this._removeFlagByMessage(messageId);
        try {
            await this.socketEmitOrThrow<void>("flag.remove", {
                message_id: messageId,
            });
        } catch (e) {
            if (existing) this._upsertFlag(existing);
            throw e;
        }
    }

    // Mark an active flag done: retain the row (completedAt set) but drop
    // it from the active list + bubble icon. Distinct from unflag (which
    // hard-deletes). Optimistic; rolls back to active on ack failure.
    async completeFlag(messageId: string): Promise<void> {
        const existing = this._flagByMessageId.get(messageId);
        if (!existing) return;
        this._upsertFlag({ ...existing, completedAt: new Date().toISOString() });
        try {
            await this.socketEmitOrThrow<Flag>("flag.complete", {
                message_id: messageId,
            });
        } catch (e) {
            this._upsertFlag({ ...existing, completedAt: null });
            throw e;
        }
    }

    // Reopen a completed flag back to active. The completed row lives in
    // `_flags` (not the active index), so find it there.
    async reopenFlag(messageId: string): Promise<void> {
        const completed = this._findCompletedFlagByMessage(messageId);
        if (!completed) return;
        this._upsertFlag({ ...completed, completedAt: null });
        try {
            await this.socketEmitOrThrow<Flag>("flag.uncomplete", {
                message_id: messageId,
            });
        } catch (e) {
            this._upsertFlag(completed);
            throw e;
        }
    }

    // Load the user's COMPLETED flags from the server for the past view.
    // Completed flags are never broadcast to a fresh session and may not
    // be in the local IDB snapshot, so this GET is the only source. Merge
    // them into `_flags` (map split keeps them out of the active index)
    // and back-fill any host messages not synced this session so the
    // adapter can resolve the row (mirrors funcSetFlaggedMessages).
    async fetchCompletedFlags(): Promise<void> {
        let flags: Flag[];
        try {
            const res = await this.api().get<{ flags: Flag[] }>("/api/v3/flags/?status=completed");
            flags = res.data?.flags ?? [];
        } catch {
            return;
        }
        for (const f of flags) this._upsertFlag(f);
        const hasMessage = (messageId: string): boolean => {
            for (const msgs of this._messages.values()) {
                if (msgs.some((m) => m.id === messageId)) return true;
            }
            return false;
        };
        const missing = flags.filter((f) => !hasMessage(f.messageId));
        if (missing.length > 0) {
            await Promise.all(missing.map((f) => this.fetchMessageById(f.messageId)));
        }
        this._notify();
    }

    // ---- Message reminders ("remind me in 3 hours") -----------------------
    //
    // A reminder is a flag with a time on it, and the two are kept in step
    // in both directions:
    //   - setting one flags the message (the server does it too; the socket
    //     emit here is what tells the OTHER tabs),
    //   - losing the flag drops the reminder locally, mirroring the server's
    //     cascade, so the UI never offers to cancel something already gone.
    //
    // These go over HTTP rather than the socket the flag mutations use.
    // Reminders are per-user state with no one to broadcast to, and the
    // request carries a validated instant that can be REFUSED (past, too
    // far out) — a fire-and-forget emit has nowhere to put that answer.

    private _upsertReminder(reminder: MessageReminder): void {
        this._reminderByMessageId.set(reminder.messageId, reminder);
        this._remindersVersion += 1;
        this._scheduleReminderSweep();
        this._notify();
    }

    private _dropReminder(messageId: string): void {
        if (!this._reminderByMessageId.delete(messageId)) return;
        this._remindersVersion += 1;
        this._scheduleReminderSweep();
        this._notify();
    }

    /**
     * Arm one timer for the soonest pending reminder, so that shortly after
     * it is delivered the UI stops promising a nudge that has already come.
     *
     * Re-reads the pending set rather than expiring the row locally: the
     * server decides what fired (it may have retired the reminder as moot),
     * and the same GET picks up anything set on another device. Only ever
     * one timer, and only while the user has a reminder outstanding.
     */
    private _scheduleReminderSweep(): void {
        if (this._reminderSweep !== null) {
            clearTimeout(this._reminderSweep);
            this._reminderSweep = null;
        }
        let soonest = Number.POSITIVE_INFINITY;
        for (const r of this._reminderByMessageId.values()) {
            const at = Date.parse(r.remindAt);
            if (!Number.isNaN(at) && at < soonest) soonest = at;
        }
        if (!Number.isFinite(soonest)) return;
        const delay = Math.min(
            Math.max(soonest + REMINDER_SWEEP_GRACE_MS - Date.now(), REMINDER_SWEEP_MIN_MS),
            REMINDER_SWEEP_MAX_MS
        );
        this._reminderSweep = setTimeout(() => {
            this._reminderSweep = null;
            void this.fetchReminders();
        }, delay);
        // Node only (tests): a pending sweep must not hold the process open.
        (this._reminderSweep as unknown as { unref?: () => void }).unref?.();
    }

    /** Load the user's pending reminders. The only source: reminders are
     *  never broadcast, so without this a reminder set on another device
     *  (or before a reload) is invisible — and an invisible reminder is
     *  one the user sets twice. */
    async fetchReminders(): Promise<void> {
        let reminders: MessageReminder[];
        try {
            const res = await this.api().get<{ reminders: MessageReminder[] }>(
                "/api/v3/reminders/"
            );
            reminders = res.data?.reminders ?? [];
        } catch {
            // Offline / auth blip: keep what we have rather than claiming
            // the user has no reminders.
            return;
        }
        // Reconcile, don't merge: one cancelled elsewhere must disappear.
        this._reminderByMessageId.clear();
        for (const r of reminders) this._reminderByMessageId.set(r.messageId, r);
        this._remindersVersion += 1;
        this._scheduleReminderSweep();
        this._notify();
    }

    /**
     * Ask to be reminded about `messageId` at `remindAt` (an absolute
     * instant — see `reminderPresets`). Resolves once the server has
     * accepted it; rejects when it refuses the time, so the caller can
     * say so rather than silently dropping the request.
     */
    async setReminder(messageId: string, remindAt: Date): Promise<MessageReminder> {
        const res = await this.api().post<{ reminder: MessageReminder }>(
            `/api/v3/messages/${messageId}/reminder/`,
            { remindAt: remindAt.toISOString() }
        );
        const reminder = res.data.reminder;
        this._upsertReminder(reminder);
        // The server flagged it as part of the same request; this emit is
        // how every OTHER tab (and this one's optimistic state) finds out,
        // since the reminder endpoint broadcasts nothing. `flag.add` is
        // idempotent server-side, so re-flagging costs nothing.
        if (!this._flagByMessageId.has(messageId)) {
            void this.flagMessage(messageId).catch((e) =>
                console.error("[ChannelService] mirroring reminder flag failed:", e)
            );
        }
        return reminder;
    }

    /** Cancel the pending reminder, leaving the flag alone — "stop nagging
     *  me" is not "forget about this". Idempotent. */
    async cancelReminder(messageId: string): Promise<void> {
        const existing = this._reminderByMessageId.get(messageId);
        this._dropReminder(messageId);
        try {
            await this.api().delete(`/api/v3/messages/${messageId}/reminder/`);
        } catch (e) {
            if (existing) this._upsertReminder(existing);
            throw e;
        }
    }

    // Load the user's pinned channels from the server.
    //
    // Pins are durable server-side, but until now nothing read them back:
    // `pinChannel` POSTs, the server broadcasts `pin.added`, and the only
    // other source was this session's IDB cache. So a fresh browser, a
    // second device, or cleared site data showed NO pins even though the
    // rows existed — the data was persistent but unreachable.
    //
    // Reconciles rather than merges: a pin removed on another device must
    // disappear here too, and `_removePinByChannel` also clears the IDB
    // row so the stale entry can't come back on the next cold start.
    // `_upsertPin` persists each server pin, replacing any optimistic id.
    async fetchPins(): Promise<void> {
        let pins: Pin[];
        try {
            const res = await this.api().get<{ pins: Pin[] }>("/api/v3/pins/");
            pins = res.data?.pins ?? [];
        } catch {
            // Offline / auth blip: keep whatever IDB hydration gave us
            // rather than blanking the user's pins on a failed request.
            return;
        }
        const serverChannelIds = new Set(pins.map((p) => p.channelId));
        for (const channelId of [...this._pinByChannelId.keys()]) {
            if (!serverChannelIds.has(channelId)) this._removePinByChannel(channelId);
        }
        for (const p of pins) this._upsertPin(p);
        this._notify();
    }

    // ---- Inbound pin / flag socket handlers -------------------------------
    //
    // `pin.added` / `pin.removed` / `flag.added` / `flag.removed` arrive
    // on the `user:<userId>` room — including from this tab's own
    // emits. Re-applying our own broadcast is the reconciliation that
    // replaces the optimistic placeholder with the server-issued row.
    // The `_upsert*` helpers handle that swap idempotently by keying
    // the secondary index on channelId / messageId.

    handlePinAdded(pin: Pin): void {
        this._upsertPin(pin);
    }

    handlePinRemoved(channelId: string): void {
        this._removePinByChannel(channelId);
    }

    handleFlagAdded(flag: Flag): void {
        this._upsertFlag(flag);
    }

    handleFlagRemoved(messageId: string): void {
        this._removeFlagByMessage(messageId);
    }

    // `flag.completed` / `flag.uncompleted` carry the full server flag row
    // (with/without `completedAt`); `_upsertFlag` + the map split move it
    // between the active and past surfaces. Same in every tab (user room).
    handleFlagCompleted(flag: Flag): void {
        this._upsertFlag(flag);
    }

    handleFlagUncompleted(flag: Flag): void {
        this._upsertFlag(flag);
    }

    // ---- Inbound socket event handlers (called by socketRouter) ----------

    /**
     * Apply one created message to the in-memory store WITHOUT
     * notifying or persisting. Shared by `handleMessageCreated` (single
     * live event: notify + persist per row) and `ingestMessages` (sync/
     * resync batches: one notify + one IDB transaction for the lot).
     */
    private _applyMessageCreated(message: Message): void {
        // The broadcast payload from the v3 server includes the
        // originating `correlation_id` (see `socketio_events_v3/
        // message_handlers.py` — the broadcast envelope wraps the
        // MessageSerializer with the corr id). If the server-pushed
        // event matches one of OUR pending entries, drop it: the ack
        // path has either already settled the resolver (no-op here)
        // or this broadcast IS the catch-up after a dropped ack and
        // we settle now. Either way, the upsert below replaces the
        // optimistic bubble with the server-issued row.
        const corr = (message as Message & { correlation_id?: string }).correlation_id;
        if (corr && this._pendingByCorrelationId.has(corr)) {
            this._clearEcho(corr, message);
            this._removePending(corr);
            this._settlePending(corr, { ok: true, message });
        }

        this._upsertMessage(message);
        // Chat-list `latestMessage` + `unreadCount` reflect TOP-LEVEL
        // messages only — the server's ChannelListView computes both with
        // `is_thread_reply=False`. A thread reply arriving live must not
        // bump either, or the sidebar preview shows a reply and the unread
        // badge over-counts until the next `listChannels` refresh corrects
        // the drift.
        if (!message.isThreadReply) {
            this._bumpChannelLatest(message);
            // Self-sent messages must not bump unread (server only knows
            // we read up to `markRead`; if we just sent it, we trivially
            // saw it). The server's `unreadCount` denorm on the next
            // chat-list refresh corrects any drift; in-memory we adjust
            // optimistically only when the message is from someone else.
            if (this.currentUserId && message.sender?.userId !== this.currentUserId) {
                this._bumpUnread(message.channelId);
            }
        }
    }

    handleMessageCreated(message: Message): void {
        this._applyMessageCreated(message);
        this._notify();
        void this._persistMessage(message);
        if (!message.isThreadReply) {
            void this._persistChannelLatest(message.channelId);
        }
    }

    /**
     * Batch form of `handleMessageCreated` for sync/resync payloads.
     * Applies every row to the in-memory store, then notifies ONCE and
     * persists the lot in ONE IDB transaction — a channel sync used to
     * fire a notify (→ every store subscriber re-derived, several of
     * them writing App-root React state) plus a standalone IDB
     * transaction per row, which is what made opening a busy channel
     * stutter.
     */
    ingestMessages(messages: readonly Message[]): void {
        if (messages.length === 0) return;
        for (const m of messages) this._applyMessageCreated(m);
        this._notify();
        void this._persistMessagesBulk(messages);
    }

    handleMessageUpdated(message: Message): void {
        this._upsertMessage(message);
        // If this is the channel's currently-latest message, refresh
        // the channel's latestMessage cache. We compare by id rather
        // than seq because soft-delete-by-edit (rare) could still be
        // the same id.
        const ch = this._channels.get(message.channelId);
        if (ch && ch.latestMessage && ch.latestMessage.id === message.id) {
            this._channels.set(message.channelId, { ...ch, latestMessage: message });
            this._bumpChannels();
        }
        this._notify();
        void this._persistMessage(message);
    }

    /**
     * Apply a narrow reply-count delta to a thread's parent message.
     *
     * Replaces the old behaviour where a thread reply re-broadcast the
     * parent's FULL row as `message.updated` just to refresh the chip —
     * that carried the parent's (possibly stale) body and, via the
     * whole-object `_upsertMessage`, clobbered a concurrent edit to that
     * parent (last-write-wins, no guard). Merging ONLY `replyCount`
     * removes the stale body from the wire entirely.
     *
     * `_mutateMessage` no-ops when the parent isn't loaded — correct: the
     * count is reconciled on the parent's next delta sync, and we never
     * synthesize a body-less placeholder row (which the old upsert did).
     */
    handleReplyCountChanged(event: MessageReplyCountChangedPayload): void {
        let mutated: Message | undefined;
        this._mutateMessage(event.channelId, event.id, (m) => {
            if (m.replyCount === event.replyCount) return m; // idempotent
            mutated = { ...m, replyCount: event.replyCount };
            return mutated;
        });
        this._notify();
        if (mutated) void this._persistMessage(mutated);
    }

    /**
     * Splice a freshly uploaded attachment into the message's
     * `attachments[]` so the row updates without waiting for the next
     * delta-sync. Idempotent by attachment.id (same upload acknowledged
     * twice — won't double-attach).
     */
    handleAttachmentAdded(
        channelId: string,
        messageId: string,
        attachment: MessageAttachment
    ): void {
        this._mutateMessage(channelId, messageId, (m) => {
            if (m.attachments.some((a) => a.id === attachment.id)) return m;
            return { ...m, attachments: [...m.attachments, attachment] };
        });
        this._notify();
    }

    handleMessageDeleted(event: MessageDeletedPayload): void {
        const arr = this._messages.get(event.channelId);
        if (arr) {
            const next = arr.map((m) =>
                m.id === event.id ? { ...m, deletedAt: new Date().toISOString() } : m
            );
            this._messages.set(event.channelId, next);
            if (this._flagByMessageId.has(event.id)) this._flagsVersion += 1;
        }
        this._notify();
        void this._persistDeletedById(event.id, event.channelId);
    }

    handleReactionAdded(event: ReactionAddedPayload): void {
        this._mutateMessage(event.channelId, event.messageId, (m) => {
            // Dedup by reaction id (idempotent — same event delivered twice
            // is harmless).
            if (m.reactions.some((r) => r.id === event.reaction.id)) return m;
            return { ...m, reactions: [...m.reactions, event.reaction] };
        });
        this._notify();
        void this._persistReaction(event.reaction);
    }

    handleReactionRemoved(event: ReactionRemovedPayload): void {
        this._mutateMessage(event.channelId, event.messageId, (m) => ({
            ...m,
            reactions: m.reactions.filter(
                (r) => !(r.user.userId === event.userId && r.emoji === event.emoji)
            ),
        }));
        this._notify();
        void this._persistReactionRemoval(event.messageId, event.userId, event.emoji);
    }

    handleReadAdvanced(cursor: ReadCursor): void {
        // Forward-only — match server-side semantics. Compare by
        // lastReadMessageId presence; if the existing cursor points at
        // a higher seq we'd have to fetch the messages to compare. The
        // server already enforces forward-only; trust it.
        if (cursor.threadRootId == null) {
            this._cursors.set(cursor.channelId, cursor);
            // Recompute unreadCount from the cursor + known messages.
            //
            // The naive "set unreadCount=0" reset was a cross-tab bug:
            // if a NEW message arrived (bumping unread to N+1) in the
            // gap between Tab A's emit and Tab B's receive, Tab B
            // would zero out unread even though the new message is
            // genuinely unread. Recomputing from the known messages
            // avoids that race — any message with `seq > cursor.seq`
            // stays counted as unread.
            //
            // Three cases:
            //   (a) Cursor points at a message in our store: count
            //       non-thread-reply messages with higher seq. Exact.
            //   (b) Cursor points at a message we haven't loaded yet
            //       (cursor advanced past our local data): fall back
            //       to the optimistic 0. The next chat-list refresh
            //       corrects.
            //   (c) Cursor is null (initial state, never read anything):
            //       all known non-thread-reply messages are unread.
            const ch = this._channels.get(cursor.channelId);
            if (ch) {
                const arr = this._messages.get(cursor.channelId) ?? [];
                const topLevel = arr.filter((m) => !m.isThreadReply);
                let unread: number;
                if (cursor.lastReadMessageId == null) {
                    unread = topLevel.length;
                } else {
                    const cursorMsg = arr.find((m) => m.id === cursor.lastReadMessageId);
                    if (!cursorMsg) {
                        unread = 0;
                    } else {
                        unread = topLevel.filter((m) => m.seq > cursorMsg.seq).length;
                    }
                }
                this._channels.set(cursor.channelId, { ...ch, unreadCount: unread });
                this._bumpChannels();
            }
        }
        this._notify();
        void this._persistCursor(cursor);
    }

    handleChannelCreated(channel: Channel): void {
        this._channels.set(channel.id, channel);
        this._bumpChannels();
        if (!this._messages.has(channel.id)) this._messages.set(channel.id, []);
        // Auto-subscribe to the new channel room so subsequent message
        // events flow through. If the socket lost the auto-join (e.g.
        // race between channel.created broadcast and our handler), this
        // is the recovery path.
        if (this.socket?.connected) {
            void this.subscribeChannel(channel.id).catch(() => {
                /* room may already be joined; silent */
            });
        }
        this._notify();
        void this._persistChannel(channel);
    }

    /**
     * Batch form of `handleChannelCreated` for the chat-list refresh
     * path (`loadV3Chats`). One notify + one IDB transaction for the
     * whole list — pushing each row through `handleChannelCreated`
     * fired a notify, an IDB transaction AND a `channel.subscribe`
     * socket emit per channel on EVERY list refresh (boot, post-send,
     * chat-switch timer), N× the work for an unchanged list.
     *
     * The recovery `channel.subscribe` emit is kept, but only for
     * channels this client didn't already hold — the connect handler
     * joins every existing channel's room server-side, so only rows
     * DISCOVERED via the list (created mid-session, broadcast missed)
     * can be missing their room join.
     */
    ingestChannels(channels: readonly Channel[]): void {
        if (channels.length === 0) return;
        const discovered: Channel[] = [];
        for (const c of channels) {
            if (!this._channels.has(c.id)) discovered.push(c);
            this._channels.set(c.id, c);
            if (!this._messages.has(c.id)) this._messages.set(c.id, []);
        }
        if (this.socket?.connected) {
            for (const c of discovered) {
                void this.subscribeChannel(c.id).catch(() => {
                    /* room may already be joined; silent */
                });
            }
        }
        this._bumpChannels();
        this._notify();
        void this._persistChannelsBulk(channels);
    }

    private async _persistChannelsBulk(channels: readonly Channel[]) {
        try {
            const db = await initDB();
            const tx = db.transaction(STORES.CHANNELS, "readwrite");
            const store = tx.objectStore(STORES.CHANNELS);
            for (const c of channels) void store.put(c);
            await tx.done;
        } catch (e) {
            this._recordIdbError("_persistChannelsBulk", e);
        }
    }

    /**
     * Seed channel member rosters from the chat-list payload.
     * `GET /api/v3/channels/` now returns `members` for DM/MDM rows
     * (other kinds omit it). Without this, `membersByChannel` stays empty
     * until a channel is opened (the lazy `fetchChannelMembers` path), so
     * unopened DM rows render the partner as "?" + blank name and MDM
     * rows show no member avatars. `loadV3Chats` calls this right after
     * ingesting the channels and BEFORE adapting the snapshot, so the
     * first chat-list render already has partner identities. The list
     * payload is the full current set, so it replaces (live
     * `member_added`/`removed` events keep it current afterward). One
     * `_notify()` for the whole batch.
     */
    ingestListMembers(channels: readonly Channel[]): void {
        let changed = false;
        for (const c of channels) {
            const members = (c as Channel & { members?: ChannelMember[] }).members;
            if (members && members.length > 0) {
                this._members.set(c.id, [...members]);
                this._rememberMemberIdentities(members);
                changed = true;
            }
        }
        if (changed) {
            this._bumpChannels();
            this._notify();
        }
    }

    /**
     * Apply a `channel.updated` broadcast (title / profile / visibility
     * changed by the owner). Merge into the existing row rather than
     * full-replace so we preserve client-side denorms (`latestMessage`,
     * `unreadCount`) that the patch endpoint doesn't carry.
     *
     * If the channel isn't in the store at all, this is a no-op — we
     * don't have enough context (e.g. unread / latestMessage) to
     * synthesize a fresh row. The next `listChannels()` refresh will
     * pick it up.
     */
    handleChannelUpdated(channel: Channel): void {
        const existing = this._channels.get(channel.id);
        if (!existing) return;
        this._channels.set(channel.id, {
            ...existing,
            // Pull in the server-authoritative metadata fields. Keep
            // the existing latestMessage/unreadCount/tsCreated denorms
            // intact because the PATCH response doesn't include them
            // (they're populated by the list view's annotation, not
            // the detail view).
            title: channel.title,
            profileImageUrl: channel.profileImageUrl,
            isPrivate: channel.isPrivate,
            ownerId: channel.ownerId,
            tsUpdated: channel.tsUpdated,
        });
        this._bumpChannels();
        this._notify();
        void this._persistChannel(this._channels.get(channel.id)!);
    }

    handleChannelMemberAdded(event: ChannelMemberAddedPayload): void {
        const existing = this._members.get(event.channelId) ?? [];
        const next = existing.some((m) => m.id === event.member.id)
            ? existing
            : [...existing, event.member];
        this._members.set(event.channelId, next);
        this._rememberMemberIdentities([event.member]);
        this._bumpChannels();
        // If I'M the one being added (e.g. a peer's invite, or a
        // recovery path where `channel.created` was missed), the
        // primary subscribe path runs through `channel.created` →
        // `handleChannelCreated.subscribeChannel`. But that event can
        // be dropped on the floor between the server emit and our
        // socket receive (transport blip, double-namespace mid-handshake).
        // A redundant subscribe here closes the gap — the backend's
        // `channel.subscribe` handler is idempotent against an already-
        // joined room, so the extra emit is safe.
        if (
            this.currentUserId &&
            event.member.userId === this.currentUserId &&
            this.socket?.connected
        ) {
            void this.subscribeChannel(event.channelId).catch(() => {
                /* room may already be joined; silent */
            });
        }
        this._notify();
        void this._persistMember(event.member, event.channelId);
    }

    handleChannelMemberRemoved(event: ChannelMemberRemovedPayload): void {
        const existing = this._members.get(event.channelId) ?? [];
        const next = existing.filter((m) => m.userId !== event.userId);
        this._members.set(event.channelId, next);
        this._bumpChannels();
        // If it was ME being removed, drop the channel from the list
        // AND leave the socket room. Without the unsubscribe, the
        // backend keeps emitting `message.created` / `reaction.added`
        // etc. to the room and this client keeps receiving "ghost"
        // events for a channel it no longer shows. The unsubscribe is
        // best-effort — even if the emit fails, the in-memory store
        // already dropped the channel so the UI is correct; the
        // ghost events would just be ignored by the inbound handlers
        // (the channel id won't match any known store entry).
        if (this.currentUserId && event.userId === this.currentUserId) {
            if (this.socket?.connected) {
                void this.unsubscribeChannel(event.channelId, event.channelKind).catch(() => {
                    /* best-effort — store already dropped */
                });
            }
            this._channels.delete(event.channelId);
            this._messages.delete(event.channelId);
            this._cursors.delete(event.channelId);
            void this._persistChannelDelete(event.channelId);
        }
        this._notify();
    }

    /**
     * Apply a `resync.batch` envelope to in-memory state + IDB.
     *
     * Each entry in `batch.channels` is one channel's combined delta —
     * top-level messages, thread replies, hard-deletes — captured by
     * the backend resync handler. We:
     *
     *   1. Evict the channel's data if `envelope.force_full_reload`
     *      is true. This blows away BOTH top-level + thread stores
     *      for the channel (one of them being too stale to incrementally
     *      catch up is usually a signal both are).
     *   2. Upsert each message (top-level and thread). `handleMessageCreated`
     *      is idempotent so re-applying a row we already had is a no-op.
     *      Tombstones (soft-deletes) arrive as rows with `deletedAt` set
     *      and the upsert overwrites the local copy correctly.
     *   3. Hard-delete the ids in `data.deletes` via the same path as
     *      `syncChannel`.
     *   4. Advance BOTH per-channel checkpoints (`v3:msgs:<id>` and
     *      `v3:thrd:<id>`) to `envelope.server_time` so the next call
     *      to `syncChannel(id)` only pulls newer rows. The same value
     *      is written to both because the backend already picked the
     *      EARLIER of the two upstream server_times when merging — so
     *      no information is lost.
     *
     * Returns the count of channels successfully applied so callers
     * can log throughput / surface a "synced N channels" indicator.
     */
    async applyResyncBatch(
        batch: ResyncBatch | { channel_id: string; envelope: DeltaEnvelope<ResyncDeltaData> }
    ): Promise<number> {
        // Two producers feed this method with DIFFERENT shapes:
        //   - the explicit `resync` emit acks the batched {channels:[...]}
        //     form (resync_handlers.py + triggerResync), and
        //   - the connect-time auto-replay pushes ONE channel per
        //     `resync.batch` socket event as {channel_id, envelope}
        //     (connect_handlers.py).
        // Normalize the single-channel push to the batched form. Without
        // this, the connect-time replay hit `for (const entry of
        // batch.channels)` with `channels === undefined` → TypeError,
        // which socketRouter's `void` swallowed — so every missed message
        // on reconnect was silently dropped.
        const channels: Array<{
            channel_id: string;
            envelope: DeltaEnvelope<ResyncDeltaData>;
        }> =
            "channels" in batch && Array.isArray(batch.channels)
                ? batch.channels
                : [batch as { channel_id: string; envelope: DeltaEnvelope<ResyncDeltaData> }];
        const repo = this._checkpoints();
        let applied = 0;
        for (const entry of channels) {
            const channelId = entry.channel_id;
            const env = entry.envelope;
            if (!env) continue;

            if (env.force_full_reload) {
                // Clear both streams in one shot — see method docstring.
                // Sync evictions need to await so the next upsert doesn't
                // race a pending IDB cursor delete on the same row.
                await this._evictChannelMessages(channelId, "all");
            }

            const messages = env.data?.messages ?? [];
            const threadMessages = env.data?.thread_messages ?? [];
            const deletes = env.data?.deletes ?? [];

            // Batched: one notify + one IDB transaction per envelope
            // instead of one of each per row (see `ingestMessages`).
            this.ingestMessages([...messages, ...threadMessages]);
            for (const id of deletes) this.handleMessageHardDelete(channelId, id);

            if (env.server_time) {
                try {
                    await Promise.all([
                        repo.setCheckpoint(
                            this._checkpointKeyMessages(channelId),
                            env.server_time
                        ),
                        repo.setCheckpoint(this._checkpointKeyThreads(channelId), env.server_time),
                    ]);
                } catch (e) {
                    // IDB write failed but the in-memory store is
                    // already updated — record and move on. Next sync
                    // will refetch the window from the old checkpoint.
                    this._recordIdbError("applyResyncBatch_checkpoint", e);
                }
            }
            applied += 1;
        }
        return applied;
    }

    // ---- Hydration --------------------------------------------------------

    /**
     * Load the cached state from IDB into the in-memory store. Called
     * once on app boot so the chat list and recent messages render
     * instantly (then `listChannels()` + `fetchMessagesDelta()` fill
     * any gaps via the live socket stream).
     */
    async hydrateFromIDB(): Promise<void> {
        try {
            const db = await initDB();
            const [channelRows, memberRows, messageRows, cursorRows, pinRows, flagRows] =
                await Promise.all([
                    db.getAll(STORES.CHANNELS) as Promise<Channel[]>,
                    db.getAll(STORES.CHANNEL_MEMBERS) as Promise<
                        (ChannelMember & { channelId: string })[]
                    >,
                    db.getAll(STORES.MESSAGES_V3) as Promise<Message[]>,
                    db.getAll(STORES.READ_CURSORS) as Promise<ReadCursor[]>,
                    db.getAll(STORES.PINS) as Promise<Pin[]>,
                    db.getAll(STORES.FLAGS) as Promise<Flag[]>,
                ]);

            for (const ch of channelRows) this._channels.set(ch.id, ch);
            for (const m of memberRows) {
                const arr = this._members.get(m.channelId) ?? [];
                if (!arr.some((x) => x.id === m.id)) arr.push(m);
                this._members.set(m.channelId, arr);
            }
            this._rememberMemberIdentities(memberRows);
            // Sort messages by tsSent asc within each channel for stable
            // scroll / pagination behavior.
            const byChan = new Map<string, Message[]>();
            for (const m of messageRows) {
                const arr = byChan.get(m.channelId) ?? [];
                arr.push(m);
                byChan.set(m.channelId, arr);
            }
            for (const [chId, arr] of byChan) {
                arr.sort((a, b) => (a.tsSent < b.tsSent ? -1 : a.tsSent > b.tsSent ? 1 : 0));
                this._messages.set(chId, arr);
            }
            for (const c of cursorRows) {
                if (c.threadRootId == null) this._cursors.set(c.channelId, c);
            }
            for (const p of pinRows) {
                this._pins.set(p.id, p);
                this._pinByChannelId.set(p.channelId, p);
            }
            for (const f of flagRows) {
                this._flags.set(f.id, f);
                // Only active flags index into the message-keyed map (which
                // feeds the active list + bubble icon); completed flags stay
                // in `_flags` for the past view. See `_upsertFlag`.
                if (!f.completedAt) this._flagByMessageId.set(f.messageId, f);
            }
            if (flagRows.length > 0) this._flagsVersion += 1;
            this._bumpChannels();
        } catch (e) {
            // IDB failure is non-fatal — the app keeps working off the
            // live socket stream + REST cold reads. Record so the dev
            // panel surfaces the degraded state without the user
            // noticing only via missing cache.
            this._recordIdbError("hydrateFromIDB", e);
        } finally {
            // Always flip the hydration flag, even when IDB failed —
            // an empty in-memory store is a valid "loaded empty" state
            // that the hooks should render as such, not a perpetual
            // spinner.
            this._hydrated = true;
            this._notify();
        }
    }

    // ---- Internal: in-memory helpers --------------------------------------

    private _upsertMessage(message: Message) {
        // The sender, whoever's team they are on. A shared chat's whole
        // point is that some of the people in it are not in any roster
        // this client holds, and their bubbles carried a "?" avatar.
        if (message.sender) rememberPeople([message.sender]);
        // Always produce a NEW array reference so `useMemo([allMessages])`
        // in the hook re-derives. Mutating the existing array in place
        // would keep its identity and skip the React re-derive.
        const prev = this._messages.get(message.channelId) ?? [];
        const idx = prev.findIndex((m) => m.id === message.id);
        let next: Message[];
        if (idx === -1) {
            // Insert in ts-order. Most events arrive at the tail; do
            // the cheap append + lazy sort only when needed.
            const last = prev[prev.length - 1];
            if (!last || last.tsSent <= message.tsSent) {
                next = [...prev, message];
            } else {
                next = [...prev, message].sort((a, b) =>
                    a.tsSent < b.tsSent ? -1 : a.tsSent > b.tsSent ? 1 : 0
                );
            }
        } else {
            next = prev.map((m, i) => (i === idx ? message : m));
        }
        this._messages.set(message.channelId, next);
        // The flagged-messages derive reads message content, so a write
        // to a message that carries an active flag must re-derive it —
        // this is also what resolves a previously-orphaned flag the
        // moment its message lands in the store.
        if (this._flagByMessageId.has(message.id)) this._flagsVersion += 1;
    }

    private _mutateMessage(channelId: string, messageId: string, fn: (m: Message) => Message) {
        const arr = this._messages.get(channelId);
        if (!arr) return;
        const next = arr.map((m) => (m.id === messageId ? fn(m) : m));
        this._messages.set(channelId, next);
        if (this._flagByMessageId.has(messageId)) this._flagsVersion += 1;
    }

    private _bumpChannelLatest(message: Message) {
        if (message.isThreadReply) return; // thread replies don't drive the chat list
        const ch = this._channels.get(message.channelId);
        if (!ch) return;
        if (!ch.latestMessage || ch.latestMessage.tsSent <= message.tsSent) {
            this._channels.set(message.channelId, {
                ...ch,
                latestMessage: message,
                tsUpdated: message.tsSent,
            });
            this._bumpChannels();
        }
    }

    private _bumpUnread(channelId: string) {
        const ch = this._channels.get(channelId);
        if (!ch) return;
        this._channels.set(channelId, { ...ch, unreadCount: ch.unreadCount + 1 });
        this._bumpChannels();
    }

    // ---- Pin / Flag store helpers ---------------------------------------
    //
    // Keep both the id-keyed primary map (for IDB persistence) and the
    // secondary index (for UI lookup) in lockstep. Each helper also
    // notifies subscribers so a single mutation re-renders consumers.

    private _upsertPin(pin: Pin) {
        // If an existing pin for this channel is being replaced (e.g.
        // optimistic → server-issued), drop the old id from `_pins`
        // first so we don't leak entries.
        const previous = this._pinByChannelId.get(pin.channelId);
        if (previous && previous.id !== pin.id) this._pins.delete(previous.id);
        this._pins.set(pin.id, pin);
        this._pinByChannelId.set(pin.channelId, pin);
        this._bumpChannels();
        this._notify();
        void this._persistPin(pin, previous?.id !== pin.id ? previous?.id : undefined);
    }

    private _removePinByChannel(channelId: string) {
        const existing = this._pinByChannelId.get(channelId);
        if (!existing) return;
        this._pins.delete(existing.id);
        this._pinByChannelId.delete(channelId);
        this._bumpChannels();
        this._notify();
        void this._persistPinDelete(existing.id);
    }

    private _upsertFlag(flag: Flag) {
        const previous = this._flagByMessageId.get(flag.messageId);
        if (previous && previous.id !== flag.id) this._flags.delete(previous.id);
        this._flags.set(flag.id, flag);
        // Map split: `_flags` holds ALL flags (active + completed, for the
        // past view + IDB retention); `_flagByMessageId` holds ACTIVE only,
        // so it feeds the active list and the bubble `isFlagged` icon.
        // Completing a flag therefore drops it from the active surfaces
        // while keeping the row.
        if (flag.completedAt) this._flagByMessageId.delete(flag.messageId);
        else this._flagByMessageId.set(flag.messageId, flag);
        this._flagsVersion += 1;
        this._notify();
        void this._persistFlag(flag, previous?.id !== flag.id ? previous?.id : undefined);
        // Marking a flag done retires its reminder server-side (FlagView),
        // so drop ours too — otherwise the bubble keeps offering to cancel
        // a reminder that no longer exists.
        if (flag.completedAt) this._dropReminder(flag.messageId);
    }

    private _removeFlagByMessage(messageId: string) {
        // Collect every stored flag id for this message. Active flags are
        // in `_flagByMessageId`; COMPLETED flags live only in `_flags`
        // (map split), so scan both — otherwise removing a completed flag
        // would be a silent no-op that orphans the row in memory + IDB
        // (and reappears on reload from stale IDB).
        const ids = new Set<string>();
        const active = this._flagByMessageId.get(messageId);
        if (active) ids.add(active.id);
        for (const f of this._flags.values()) {
            if (f.messageId === messageId) ids.add(f.id);
        }
        if (ids.size === 0) return;
        for (const id of ids) this._flags.delete(id);
        this._flagByMessageId.delete(messageId);
        this._flagsVersion += 1;
        this._notify();
        for (const id of ids) void this._persistFlagDelete(id);
        // Unflagging cancels the reminder server-side (FlagView.delete) —
        // mirror it, same reason as in `_upsertFlag`.
        this._dropReminder(messageId);
    }

    private async _persistPin(pin: Pin, supersededId?: string) {
        try {
            const db = await initDB();
            if (supersededId) await db.delete(STORES.PINS, supersededId);
            await db.put(STORES.PINS, pin);
        } catch (e) {
            this._recordIdbError("_persistPin", e);
        }
    }

    private async _persistPinDelete(pinId: string) {
        try {
            const db = await initDB();
            await db.delete(STORES.PINS, pinId);
        } catch (e) {
            this._recordIdbError("_persistPinDelete", e);
        }
    }

    private async _persistFlag(flag: Flag, supersededId?: string) {
        try {
            const db = await initDB();
            if (supersededId) await db.delete(STORES.FLAGS, supersededId);
            await db.put(STORES.FLAGS, flag);
        } catch (e) {
            this._recordIdbError("_persistFlag", e);
        }
    }

    private async _persistFlagDelete(flagId: string) {
        try {
            const db = await initDB();
            await db.delete(STORES.FLAGS, flagId);
        } catch (e) {
            this._recordIdbError("_persistFlagDelete", e);
        }
    }

    // ---- Internal: IDB persistence (async, fire-and-forget) --------------
    //
    // Each method opens a transaction, performs the write, and swallows
    // errors with a console warning. We never await these inside the
    // handlers — the in-memory store is the source of truth; IDB is
    // best-effort cache for next page load.

    private async _persistMessage(message: Message) {
        try {
            const db = await initDB();
            // Project a `taskKey` field for the (channelId, taskKey)
            // index used by the PM groupByTask selector. `null` would
            // exclude the row from the index, so we coerce to "" for
            // non-PM messages.
            const taskKey =
                (message.metadata as { taskId?: string | number } | null)?.taskId != null
                    ? String((message.metadata as { taskId: string | number }).taskId)
                    : "";
            await db.put(STORES.MESSAGES_V3, { ...message, taskKey });
        } catch (e) {
            this._recordIdbError("_persistMessage", e);
        }
    }

    /**
     * Persist a batch of messages in ONE readwrite transaction (vs one
     * transaction per row via `_persistMessage`), then refresh each
     * affected channel's persisted row once so the cached `latestMessage`
     * denorm survives a reload. Same `taskKey` projection as the
     * single-row path.
     */
    private async _persistMessagesBulk(messages: readonly Message[]) {
        try {
            const db = await initDB();
            const tx = db.transaction(STORES.MESSAGES_V3, "readwrite");
            const store = tx.objectStore(STORES.MESSAGES_V3);
            for (const message of messages) {
                const taskKey =
                    (message.metadata as { taskId?: string | number } | null)?.taskId != null
                        ? String((message.metadata as { taskId: string | number }).taskId)
                        : "";
                void store.put({ ...message, taskKey });
            }
            await tx.done;
        } catch (e) {
            this._recordIdbError("_persistMessagesBulk", e);
        }
        const channelIds = new Set<string>();
        for (const m of messages) {
            if (!m.isThreadReply) channelIds.add(m.channelId);
        }
        for (const id of channelIds) void this._persistChannelLatest(id);
    }

    private async _persistDeletedById(id: string, channelId: string) {
        try {
            const db = await initDB();
            const existing = (await db.get(STORES.MESSAGES_V3, id)) as Message | undefined;
            if (existing) {
                await db.put(STORES.MESSAGES_V3, {
                    ...existing,
                    deletedAt: new Date().toISOString(),
                });
            }
            void channelId; // referenced for signature parity
        } catch (e) {
            this._recordIdbError("_persistDeletedById", e);
        }
    }

    private async _persistReaction(reaction: MessageReaction) {
        try {
            const db = await initDB();
            // The reaction row in IDB carries a denormalized `messageId`
            // so the by-message index works. The wire shape doesn't
            // include it (it's implicit from the URL), so we re-add it
            // from the parent message's id at write time.
            // We can't always know messageId from the reaction alone
            // here, so this method is only called from
            // `handleReactionAdded` which has the messageId — accept
            // the full row to keep this method narrow.
            await db.put(STORES.MESSAGE_REACTIONS, reaction);
        } catch (e) {
            this._recordIdbError("_persistReaction", e);
        }
    }

    private async _persistReactionRemoval(messageId: string, userId: string, emoji: string) {
        try {
            const db = await initDB();
            // Walk the by-message index, find the matching (user, emoji)
            // row, delete it. The id is per-row UUID so we don't have a
            // direct delete-by-key path.
            const tx = db.transaction(STORES.MESSAGE_REACTIONS, "readwrite");
            const store = tx.objectStore(STORES.MESSAGE_REACTIONS);
            const rows = (await store
                .index("MessageReactionsByMessageIndex")
                .getAll(messageId)) as MessageReaction[];
            for (const r of rows) {
                if (r.user.userId === userId && r.emoji === emoji) {
                    await store.delete(r.id);
                }
            }
            await tx.done;
        } catch (e) {
            this._recordIdbError("_persistReactionRemoval", e);
        }
    }

    private async _persistCursor(cursor: ReadCursor) {
        try {
            const db = await initDB();
            await db.put(STORES.READ_CURSORS, cursor);
        } catch (e) {
            this._recordIdbError("_persistCursor", e);
        }
    }

    private async _persistChannel(channel: Channel) {
        try {
            const db = await initDB();
            await db.put(STORES.CHANNELS, channel);
        } catch (e) {
            this._recordIdbError("_persistChannel", e);
        }
    }

    private async _persistChannelLatest(channelId: string) {
        const ch = this._channels.get(channelId);
        if (ch) await this._persistChannel(ch);
    }

    private async _persistChannelDelete(channelId: string) {
        try {
            const db = await initDB();
            await db.delete(STORES.CHANNELS, channelId);
        } catch (e) {
            this._recordIdbError("_persistChannelDelete", e);
        }
    }

    /**
     * File away the names and avatars on a member roster.
     *
     * Every member row carries `user` denormalized, and for anyone from
     * another team that payload is the ONLY place their name and avatar
     * ever appear: `teamMemberProfiles` is one team's roster, so the host
     * team's people in a shared GM — its owner included — resolved to a
     * blank row with a "?" avatar. This is also how a task in a shared
     * project gets an assignee with a face, because the project's PM chat
     * roster passes through here too.
     */
    private _rememberMemberIdentities(members: readonly ChannelMember[]): void {
        rememberPeople(
            members.map((m) => m.user).filter((u): u is NonNullable<typeof u> => u != null)
        );
    }

    private async _persistMember(member: ChannelMember, channelId: string) {
        try {
            const db = await initDB();
            // Denormalize channelId onto the row for the by-channel index.
            await db.put(STORES.CHANNEL_MEMBERS, { ...member, channelId });
        } catch (e) {
            this._recordIdbError("_persistMember", e);
        }
    }
}

// Default singleton, consumed by hooks + socketRouter.
export const channelService = new ChannelService();
