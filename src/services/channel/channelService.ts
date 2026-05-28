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
    MessageReaction,
    MessagesDeltaData,
    Pin,
    ReadCursor,
} from "../../types/channel";
import { authApi } from "../api";

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
interface ChannelStoreSnapshot {
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

    private _listeners = new Set<() => void>();
    /** Stable snapshot reference; bumped on every mutation. */
    private _snapshot: ChannelStoreSnapshot = this._buildSnapshot();

    private _buildSnapshot(): ChannelStoreSnapshot {
        return {
            channels: this._channels,
            membersByChannel: this._members,
            messagesByChannel: this._messages,
            cursorsByChannel: this._cursors,
            pins: this._pins,
            flags: this._flags,
        };
    }

    private _notify(): void {
        // New top-level reference so React's useSyncExternalStore
        // re-renders. The inner Maps are mutated in place (cheaper
        // than reconstructing every time), so the snapshot identity
        // is what carries the change signal.
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

    private api() {
        const inst = authApi(this.accessToken);
        if (!inst) {
            throw new ChannelServiceError(
                "UNAUTHENTICATED",
                "No access token set on ChannelService."
            );
        }
        return inst;
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
            for (const p of pinRows) this._pins.set(p.id, p);
            for (const f of flagRows) this._flags.set(f.id, f);

            this._notify();
        } catch (e) {
            // IDB failure is non-fatal — the app keeps working off the
            // live socket stream + REST cold reads. Log loudly so the
            // problem doesn't go unnoticed.
            // eslint-disable-next-line no-console
            console.warn("[ChannelService] hydrateFromIDB failed:", e);
        }
    }

    // ---- Internal: in-memory helpers --------------------------------------

    private _upsertMessage(message: Message) {
        const arr = this._messages.get(message.channelId) ?? [];
        const idx = arr.findIndex((m) => m.id === message.id);
        if (idx === -1) {
            // Insert in ts-order. Most events arrive at the tail; do
            // the cheap append + lazy sort only when needed.
            const last = arr[arr.length - 1];
            if (!last || last.tsSent <= message.tsSent) {
                arr.push(message);
            } else {
                arr.push(message);
                arr.sort((a, b) => (a.tsSent < b.tsSent ? -1 : a.tsSent > b.tsSent ? 1 : 0));
            }
        } else {
            arr[idx] = message;
        }
        this._messages.set(message.channelId, arr);
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
