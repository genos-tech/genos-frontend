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

import { STORES } from "../../db/config/constants";
import { initDB } from "../../db/config/schema";
import type {
    Ack,
    Channel,
    ChannelKind,
    ChannelMember,
    DeltaEnvelope,
    Flag,
    Message,
    MessageAttachment,
    MessageReaction,
    MessagesDeltaData,
    Pin,
    ReadCursor,
} from "../../types/channel";

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
type ResyncBatch = {
    channels: Array<{ channel_id: string; envelope: DeltaEnvelope<MessagesDeltaData> }>;
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
        };
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
     * Set the current user id so message handlers can distinguish
     * self-sent (don't bump my unread count) from incoming events.
     */
    setCurrentUserId(userId: string | null) {
        this.currentUserId = userId;
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

    async listChannels(): Promise<Channel[]> {
        try {
            const res = await this.api().get<{ channels: Channel[] }>("/api/v3/channels/");
            return res.data.channels ?? [];
        } catch (e) {
            throw unwrapAxiosError(e);
        }
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

    // ---- Socket mutations (each emits + awaits ack) ----------------------

    /** Send a message. Optimistic UI lives in the caller (a thin pending
     *  map keyed by correlation_id, dropped when `message.created`
     *  arrives back). */
    send(
        channelId: string,
        body: unknown[],
        opts: { bodyText?: string; parentId?: string; metadata?: Record<string, unknown> } = {}
    ): Promise<Message | undefined> {
        return this.socketEmitOrThrow<Message>("message.send", {
            channel_id: channelId,
            body,
            body_text: opts.bodyText ?? "",
            parent_id: opts.parentId ?? null,
            metadata: opts.metadata ?? {},
        });
    }

    edit(messageId: string, body: unknown[], bodyText = ""): Promise<Message | undefined> {
        return this.socketEmitOrThrow<Message>("message.edit", {
            message_id: messageId,
            body,
            body_text: bodyText,
        });
    }

    deleteMessage(messageId: string, channelId: string, channelKind: ChannelKind): Promise<void> {
        return this.socketEmitOrThrow<void>("message.delete", {
            message_id: messageId,
            channel_id: channelId,
            channel_kind: channelKind,
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
     *  the existing cursor is a server-side no-op. */
    markRead(
        channelId: string,
        lastReadMessageId: string,
        threadRootId?: string
    ): Promise<ReadCursor | undefined> {
        return this.socketEmitOrThrow<ReadCursor>("read.advance", {
            channel_id: channelId,
            last_read_message_id: lastReadMessageId,
            thread_root_id: threadRootId ?? null,
        });
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
    }): Promise<Channel | undefined> {
        return this.socketEmitOrThrow<Channel>("channel.create", {
            kind: payload.kind,
            team_id: payload.teamId,
            title: payload.title,
            is_private: payload.isPrivate,
            member_user_ids: payload.memberUserIds,
            other_user_id: payload.otherUserId,
        });
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

    removeMember(channelId: string, channelKind: ChannelKind, userId: string): Promise<void> {
        return this.socketEmitOrThrow<void>("channel.member.remove", {
            channel_id: channelId,
            channel_kind: channelKind,
            user_id: userId,
        }) as Promise<void>;
    }

    resync(channelIds: string[], since?: string): Promise<ResyncBatch | undefined> {
        return this.socketEmitOrThrow<ResyncBatch>("resync", {
            channel_ids: channelIds,
            since: since ?? null,
        });
    }

    // ---- Pin / Flag (REST, optimistic store update) -----------------------
    //
    // Pin/Flag are per-user "bookmarks": a Pin marks a channel as a
    // favorite (typically rendered at the top of the chat list); a Flag
    // marks a specific message as worth coming back to. Both are
    // idempotent on the server. We update the store optimistically and
    // roll back on failure so the button feels instant.

    async pinChannel(channelId: string): Promise<Pin> {
        // Optimistic placeholder so the button flips instantly. The
        // server-issued Pin replaces it on success.
        const optimistic: Pin = {
            id: `optimistic-${channelId}`,
            channelId,
            tsCreated: new Date().toISOString(),
        };
        this._upsertPin(optimistic);
        try {
            const res = await this.api().post<Pin>(`/api/v3/channels/${channelId}/pin/`);
            this._removePinByChannel(channelId);
            this._upsertPin(res.data);
            return res.data;
        } catch (e) {
            this._removePinByChannel(channelId);
            throw unwrapAxiosError(e);
        }
    }

    async unpinChannel(channelId: string): Promise<void> {
        const existing = this._pinByChannelId.get(channelId);
        // Optimistic removal so the button flips instantly.
        this._removePinByChannel(channelId);
        try {
            await this.api().delete(`/api/v3/channels/${channelId}/pin/`);
        } catch (e) {
            // Restore on failure so the UI doesn't drift from server state.
            if (existing) this._upsertPin(existing);
            throw unwrapAxiosError(e);
        }
    }

    async flagMessage(messageId: string): Promise<Flag> {
        const optimistic: Flag = {
            id: `optimistic-${messageId}`,
            messageId,
            tsCreated: new Date().toISOString(),
        };
        this._upsertFlag(optimistic);
        try {
            const res = await this.api().post<Flag>(`/api/v3/messages/${messageId}/flag/`);
            this._removeFlagByMessage(messageId);
            this._upsertFlag(res.data);
            return res.data;
        } catch (e) {
            this._removeFlagByMessage(messageId);
            throw unwrapAxiosError(e);
        }
    }

    async unflagMessage(messageId: string): Promise<void> {
        const existing = this._flagByMessageId.get(messageId);
        this._removeFlagByMessage(messageId);
        try {
            await this.api().delete(`/api/v3/messages/${messageId}/flag/`);
        } catch (e) {
            if (existing) this._upsertFlag(existing);
            throw unwrapAxiosError(e);
        }
    }

    // ---- Inbound socket event handlers (called by socketRouter) ----------

    handleMessageCreated(message: Message): void {
        this._upsertMessage(message);
        this._bumpChannelLatest(message);
        // Self-sent messages must not bump unread (server only knows
        // we read up to `markRead`; if we just sent it, we trivially
        // saw it). The server's `unreadCount` denorm on the next
        // chat-list refresh corrects any drift; in-memory we adjust
        // optimistically only when the message is from someone else.
        if (this.currentUserId && message.sender?.userId !== this.currentUserId) {
            this._bumpUnread(message.channelId);
        }
        this._notify();
        void this._persistMessage(message);
        void this._persistChannelLatest(message.channelId);
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
        }
        this._notify();
        void this._persistMessage(message);
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
            // Reset unread to 0 for the main timeline — the precise
            // count flows through on the next chat-list refresh.
            const ch = this._channels.get(cursor.channelId);
            if (ch) {
                this._channels.set(cursor.channelId, { ...ch, unreadCount: 0 });
            }
        }
        this._notify();
        void this._persistCursor(cursor);
    }

    handleChannelCreated(channel: Channel): void {
        this._channels.set(channel.id, channel);
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

    handleChannelMemberAdded(event: ChannelMemberAddedPayload): void {
        const existing = this._members.get(event.channelId) ?? [];
        const next = existing.some((m) => m.id === event.member.id)
            ? existing
            : [...existing, event.member];
        this._members.set(event.channelId, next);
        this._notify();
        void this._persistMember(event.member, event.channelId);
    }

    handleChannelMemberRemoved(event: ChannelMemberRemovedPayload): void {
        const existing = this._members.get(event.channelId) ?? [];
        const next = existing.filter((m) => m.userId !== event.userId);
        this._members.set(event.channelId, next);
        // If it was ME being removed, drop the channel from the list
        // entirely — my unread badge / chat list shouldn't show it.
        if (this.currentUserId && event.userId === this.currentUserId) {
            this._channels.delete(event.channelId);
            this._messages.delete(event.channelId);
            this._cursors.delete(event.channelId);
            void this._persistChannelDelete(event.channelId);
        }
        this._notify();
    }

    /** Apply a `resync.batch` envelope to in-memory state + IDB. */
    applyResyncBatch(batch: ResyncBatch): void {
        let dirty = false;
        for (const entry of batch.channels) {
            const env = entry.envelope;
            const messages = env?.data?.messages ?? [];
            const deletes = env?.data?.deletes ?? [];
            for (const m of messages) {
                this._upsertMessage(m);
                this._bumpChannelLatest(m);
                dirty = true;
                void this._persistMessage(m);
            }
            for (const id of deletes) {
                const arr = this._messages.get(entry.channel_id);
                if (arr) {
                    this._messages.set(
                        entry.channel_id,
                        arr.map((m) =>
                            m.id === id ? { ...m, deletedAt: new Date().toISOString() } : m
                        )
                    );
                    dirty = true;
                    void this._persistDeletedById(id, entry.channel_id);
                }
            }
        }
        if (dirty) this._notify();
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
                this._flagByMessageId.set(f.messageId, f);
            }
        } catch (e) {
            // IDB failure is non-fatal — the app keeps working off the
            // live socket stream + REST cold reads. Log loudly so the
            // problem doesn't go unnoticed.
            // eslint-disable-next-line no-console
            console.warn("[ChannelService] hydrateFromIDB failed:", e);
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
    }

    private _mutateMessage(channelId: string, messageId: string, fn: (m: Message) => Message) {
        const arr = this._messages.get(channelId);
        if (!arr) return;
        const next = arr.map((m) => (m.id === messageId ? fn(m) : m));
        this._messages.set(channelId, next);
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
        }
    }

    private _bumpUnread(channelId: string) {
        const ch = this._channels.get(channelId);
        if (!ch) return;
        this._channels.set(channelId, { ...ch, unreadCount: ch.unreadCount + 1 });
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
        this._notify();
        void this._persistPin(pin, previous?.id !== pin.id ? previous?.id : undefined);
    }

    private _removePinByChannel(channelId: string) {
        const existing = this._pinByChannelId.get(channelId);
        if (!existing) return;
        this._pins.delete(existing.id);
        this._pinByChannelId.delete(channelId);
        this._notify();
        void this._persistPinDelete(existing.id);
    }

    private _upsertFlag(flag: Flag) {
        const previous = this._flagByMessageId.get(flag.messageId);
        if (previous && previous.id !== flag.id) this._flags.delete(previous.id);
        this._flags.set(flag.id, flag);
        this._flagByMessageId.set(flag.messageId, flag);
        this._notify();
        void this._persistFlag(flag, previous?.id !== flag.id ? previous?.id : undefined);
    }

    private _removeFlagByMessage(messageId: string) {
        const existing = this._flagByMessageId.get(messageId);
        if (!existing) return;
        this._flags.delete(existing.id);
        this._flagByMessageId.delete(messageId);
        this._notify();
        void this._persistFlagDelete(existing.id);
    }

    private async _persistPin(pin: Pin, supersededId?: string) {
        try {
            const db = await initDB();
            if (supersededId) await db.delete(STORES.PINS, supersededId);
            await db.put(STORES.PINS, pin);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("[ChannelService] _persistPin failed:", e);
        }
    }

    private async _persistPinDelete(pinId: string) {
        try {
            const db = await initDB();
            await db.delete(STORES.PINS, pinId);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("[ChannelService] _persistPinDelete failed:", e);
        }
    }

    private async _persistFlag(flag: Flag, supersededId?: string) {
        try {
            const db = await initDB();
            if (supersededId) await db.delete(STORES.FLAGS, supersededId);
            await db.put(STORES.FLAGS, flag);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("[ChannelService] _persistFlag failed:", e);
        }
    }

    private async _persistFlagDelete(flagId: string) {
        try {
            const db = await initDB();
            await db.delete(STORES.FLAGS, flagId);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("[ChannelService] _persistFlagDelete failed:", e);
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
            // eslint-disable-next-line no-console
            console.warn("[ChannelService] _persistMessage failed:", e);
        }
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
            // eslint-disable-next-line no-console
            console.warn("[ChannelService] _persistDeletedById failed:", e);
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
            // eslint-disable-next-line no-console
            console.warn("[ChannelService] _persistReaction failed:", e);
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
            // eslint-disable-next-line no-console
            console.warn("[ChannelService] _persistReactionRemoval failed:", e);
        }
    }

    private async _persistCursor(cursor: ReadCursor) {
        try {
            const db = await initDB();
            await db.put(STORES.READ_CURSORS, cursor);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("[ChannelService] _persistCursor failed:", e);
        }
    }

    private async _persistChannel(channel: Channel) {
        try {
            const db = await initDB();
            await db.put(STORES.CHANNELS, channel);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("[ChannelService] _persistChannel failed:", e);
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
            // eslint-disable-next-line no-console
            console.warn("[ChannelService] _persistChannelDelete failed:", e);
        }
    }

    private async _persistMember(member: ChannelMember, channelId: string) {
        try {
            const db = await initDB();
            // Denormalize channelId onto the row for the by-channel index.
            await db.put(STORES.CHANNEL_MEMBERS, { ...member, channelId });
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("[ChannelService] _persistMember failed:", e);
        }
    }
}

// Default singleton, consumed by hooks + socketRouter.
export const channelService = new ChannelService();
