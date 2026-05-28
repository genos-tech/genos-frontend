/**
 * Unified channel/message service.
 *
 * One class, one wire contract, one IDB path. Replaces ~60 per-chat-type
 * service files (loadDMChats, loadGMChats, sendDMMessage, etc.) with a
 * single set of methods that work for every channel kind (DM/GM/PM/MDM).
 *
 * Architecture:
 *   - REST mutations + reads go through `/api/v3/...` via this service.
 *   - Real-time events go through the socket router (see ./socketRouter)
 *     which is also routed into this service's `handle*` methods.
 *   - IDB writes are centralized so the per-mutation writer logic is
 *     in one place — no more "PM bubbles get a different key shape"
 *     class of bug.
 *
 * This file is the FE entry point for everything chat-related in the
 * v3 architecture. The hooks (`useChannel`, `useChannelList`) and the
 * socket router both delegate to it.
 *
 * Phase 4 scope: skeleton + a few load/read methods that exercise the
 * REST surface. Mutation methods + IDB write paths arrive in
 * subsequent commits — the type contracts and method signatures are
 * stable from this commit forward so the hooks can be built against
 * them in parallel.
 */

import axios from "axios";

import type {
    Ack,
    Channel,
    ChannelKind,
    DeltaEnvelope,
    Message,
    MessagesDeltaData,
} from "../../types/channel";
import { authApi } from "../api";

/**
 * Errors raised by `ChannelService` REST methods.
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
 * Single ChannelService instance per app lifetime. Hooks and the
 * socket router consume it via the default export.
 */
export class ChannelService {
    private accessToken: string | null = null;

    /**
     * Set the JWT used for `/api/v3/` requests. Called on auth changes
     * (login, token refresh). Keeping this on the service lets every
     * method use it without threading the token through every signature.
     */
    setAccessToken(token: string | null) {
        this.accessToken = token;
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

    // ---- Channel reads -----------------------------------------------------

    /**
     * GET /api/v3/channels/ — list channels the requesting user is a
     * member of, with `latestMessage` and `unreadCount` denormalized.
     * Used to populate the chat-list sidebar.
     */
    async listChannels(): Promise<Channel[]> {
        try {
            const res = await this.api().get<{ channels: Channel[] }>("/api/v3/channels/");
            return res.data.channels ?? [];
        } catch (e) {
            throw unwrapAxiosError(e);
        }
    }

    /**
     * GET /api/v3/channels/{id}/messages/?since= — delta sync of
     * top-level messages. Returns the canonical envelope; the caller
     * applies it to IDB and persists `server_time` as the next `since`.
     */
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

    /**
     * GET /api/v3/channels/{id}/threads/?since= — delta sync of
     * thread replies. Same shape as messagesDelta but filtered to
     * `is_thread_reply=true` rows.
     */
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

    // ---- Socket event handlers (called by socketRouter) -------------------
    //
    // These methods exist as placeholder hooks so the router can wire
    // them in. The bodies are no-ops for now; the IDB write logic
    // arrives in a follow-up commit alongside the live-query hooks
    // (`useChannel` reads from IDB; without the writes the hooks have
    // nothing to render). Keeping the surface stable from this commit
    // forward means the router file doesn't need to change when the
    // bodies fill in.

    /* eslint-disable @typescript-eslint/no-unused-vars */
    handleMessageCreated(message: Message): void {
        // TODO: write to IDB MESSAGES_V3 store; update channel
        // tsLastMessage; bump unread count if not sender.
    }

    handleMessageUpdated(message: Message): void {
        // TODO: replace IDB row by id; if it's the latest in channel,
        // update channels.latestMessage.
    }

    handleMessageDeleted(event: {
        id: string;
        channelId: string;
        channelKind: ChannelKind;
    }): void {
        // TODO: mark IDB row deleted (set deletedAt), decrement parent
        // replyCount if it's a thread reply.
    }

    handleReactionAdded(event: {
        messageId: string;
        channelId: string;
        channelKind: ChannelKind;
        reaction: import("../../types/channel").MessageReaction;
    }): void {
        // TODO: write to MESSAGE_REACTIONS store; bump the parent
        // message's reactions array if cached.
    }

    handleReactionRemoved(event: {
        messageId: string;
        channelId: string;
        channelKind: ChannelKind;
        userId: string;
        emoji: string;
    }): void {
        // TODO: delete from MESSAGE_REACTIONS; remove from parent
        // message's cached reactions array.
    }

    handleReadAdvanced(cursor: import("../../types/channel").ReadCursor): void {
        // TODO: write to READ_CURSORS by id; this powers cross-tab
        // sync of unread badges (see plan §4.5).
    }

    handleChannelCreated(channel: Channel): void {
        // TODO: write to CHANNELS store; cause useChannelList to
        // surface the new channel without a page reload.
    }

    handleChannelMemberAdded(event: {
        channelId: string;
        channelKind: ChannelKind;
        member: import("../../types/channel").ChannelMember;
    }): void {
        // TODO: write to CHANNEL_MEMBERS store.
    }

    handleChannelMemberRemoved(event: {
        channelId: string;
        channelKind: ChannelKind;
        userId: string;
    }): void {
        // TODO: soft-delete from CHANNEL_MEMBERS; if it's ME being
        // removed, drop the channel from CHANNELS entirely.
    }

    /**
     * Apply a resync.batch envelope to IDB.
     *
     * The batch comes back as `{ channels: [{channel_id, envelope}, ...] }`
     * from the `resync` socket event. We treat each per-channel envelope
     * the same way `fetchMessagesDelta`'s result is treated.
     */
    applyResyncBatch(batch: {
        channels: Array<{ channel_id: string; envelope: DeltaEnvelope<MessagesDeltaData> }>;
    }): void {
        for (const entry of batch.channels) {
            // TODO: apply messages, deletes; advance the per-channel
            // sync checkpoint to envelope.server_time.
            void entry;
        }
    }
    /* eslint-enable @typescript-eslint/no-unused-vars */
}

// Default singleton, consumed by hooks + socketRouter.
export const channelService = new ChannelService();
