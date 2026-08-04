/**
 * Wire-shape types for the unified `/api/v3/channels/` surface.
 *
 * These mirror the backend serializers in
 * `backend_django/origin/serializers/chat/unified_serializers.py` one
 * field at a time. Keep them in sync — both ends are the source of
 * truth for the wire contract.
 *
 * Camel-case property names; ISO 8601 string timestamps; UUIDs as
 * strings. PM-specific message fields live in `metadata`, not on the
 * top-level shape (see plan §1.4).
 */

import type { ObjectShare } from "./sharing";

export enum ChannelKind {
    DM = 1,
    GM = 2,
    PM = 3,
    MDM = 4,
}

export interface UserLite {
    userId: string;
    userName: string;
    userEmail: string;
    avatarImgPath: string | null;
    isSystemUser: boolean;
}

export interface ChannelMember {
    id: string;
    userId: string;
    /** Channel-native vocabulary, load-bearing for messaging. For the
     *  shared permission axis use `memberRole` below — do NOT read this
     *  to decide what a user may do. */
    role: "owner" | "admin" | "member" | "system";
    /** Shared permission role (editor/viewer), derived server-side from
     *  `role` ("admin" -> editor, "member" -> viewer). The OWNER is not
     *  encoded here — `Channel.ownerId` is authoritative — so always
     *  render/gate through `resolveDisplayRole` (utils/memberRoles.ts). */
    memberRole?: string;
    tsJoined: string;
    /** Denormalized user display info. Present on every member row so
     *  the FE sidebar avatar/name rendering doesn't need a parallel
     *  `/api/v2/team/getTeamMembers/` fetch. Backend populates via
     *  `select_related("user")` + `UserLiteSerializer`. */
    user: UserLite | null;
}

export interface MessageReaction {
    id: string;
    user: UserLite;
    emoji: string;
    tsSent: string;
}

export interface MessageMention {
    id: string;
    mentionedUserId: string;
    viaGroupId: string | null;
    tsCreated: string;
}

export interface MessageAttachment {
    id: string;
    fileUrl: string;
    mime: string;
    sizeBytes: number;
    uploader: UserLite | null;
    tsCreated: string;
}

/**
 * One message row. Same shape for every channel kind — PM-specific
 * fields (`taskId`, `displayId`, `taskStatus`, `taskCommentCount`) are
 * top-level, derived server-side off the `task` FK. The render-time
 * `groupByTask` selector reads `taskId` to collapse N PM messages into
 * one bubble.
 */
export interface Message {
    id: string;
    channelId: string;
    channelKind: ChannelKind;
    sender: UserLite | null;
    seq: number;
    body: unknown[]; // Blocknote-style block array
    bodyText: string;
    parentId: string | null;
    threadRootId: string | null;
    isThreadReply: boolean;
    replyCount: number;
    reactions: MessageReaction[];
    mentions: MessageMention[];
    attachments: MessageAttachment[];
    metadata: Record<string, unknown>;
    /** PM-only FK to the legacy `TaskMaster` row this message renders.
     *  Drives `MessageBubble`'s click-opens-task behavior and the
     *  task-status chip in `BubbleUnderBar`. Null on DM/GM/MDM. */
    taskId: number | null;
    /** PM-only human-readable task code ("PRJ-42"). Derived server-side
     *  from `TaskMaster.display_id`. Null on DM/GM/MDM. */
    displayId: string | null;
    /** PM-only task status string ("Open" / "Closed" / etc.). Drives the
     *  colored chip in BubbleUnderBar. Null on DM/GM/MDM. */
    taskStatus: string | null;
    /** PM-only count of LIVE (non-deleted) task comments — the number the
     *  bubble's "N comments" chip shows (matches the thread's Comments
     *  tab). Preferred over `replyCount`, which counts all thread replies.
     *  Only populated on top-level PM task-header messages; null/absent
     *  elsewhere and on pre-change rows (the chip falls back to
     *  `replyCount` then). Optional so pre-change cached rows type-check. */
    taskCommentCount?: number | null;
    editedAt: string | null;
    deletedAt: string | null;
    tsSent: string;
    tsUpdated: string;
}

export interface Channel {
    id: string;
    kind: ChannelKind;
    title: string;
    profileImageUrl: string;
    projectId: number | null;
    ownerId: string | null;
    isPrivate: boolean;
    /** A cross-team chat: one host team owns it, and one or more guest
     *  teams hold a grant on it. Always private. Server-decided at
     *  creation and never editable, so treat it as a label, not a
     *  setting — member management differs (each team admits its own
     *  people) and the sidebar badges it. */
    isExternal?: boolean;
    /** The owning team. Present because the chat list now mixes in chats
     *  another team shared with yours. */
    teamId?: string | null;
    /** The owning team's name, set only when that team is not the one you
     *  are viewing — i.e. only on the guest side of a share, which is the
     *  only side that needs telling whose room this is. */
    hostTeamName?: string | null;
    /** The legacy per-kind integer chat id this channel was backfilled
     *  from. Null for v3-native channels. Surfaced so FE entry points
     *  that still carry legacy ids (Spotlight, ChatSearch, activity /
     *  flagged sidebars) can resolve the v3 UUID by `legacyChatId === N`
     *  lookup against the cached channel list. */
    legacyChatId: number | null;
    latestMessage: Message | null;
    unreadCount: number;
    tsCreated: string;
    tsUpdated: string;
}

/**
 * One guest team's share of an external chat — the same shape a shared
 * project or note folder reports, since one grant model backs all three.
 */
export type ChannelShare = ObjectShare;

export interface ReadCursor {
    id: string;
    channelId: string;
    threadRootId: string | null;
    lastReadMessageId: string | null;
    lastReadAt: string;
}

export interface Pin {
    id: string;
    channelId: string;
    tsCreated: string;
}

export interface Flag {
    id: string;
    messageId: string;
    tsCreated: string;
    // Null/absent while the flag is active. Set (ISO ts) when the user
    // marks it done: the flag drops off the active list + bubble icon but
    // is retained for the past/completed flags view. Cleared on reopen.
    completedAt?: string | null;
}

/**
 * Tier retention window stamped on message delta envelopes when the
 * VIEWING user's plan limits chat history (hide-not-delete — upgrading
 * restores). Absent for plans with unlimited history. `truncated` is
 * true only when this channel actually has hidden history (drives the
 * "history limited" banner).
 */
export interface ChannelRetention {
    days: number;
    cutoff: string;
    truncated?: boolean;
}

/**
 * Standard delta envelope returned by every `?since=`-supporting
 * endpoint. Matches `DeltaEnvelopeSerializer` on the backend.
 */
export interface DeltaEnvelope<TData = MessagesDeltaData> {
    server_time: string;
    force_full_reload?: boolean;
    retention?: ChannelRetention;
    data: TData;
}

export interface MessagesDeltaData {
    messages: Message[];
    deletes: string[];
}

/**
 * Standard socket ack envelope (mirrors `_helpers.ok_ack` / `err_ack`
 * on the backend). Every client→server emit gets one of these back
 * via callback; silent failures are structurally impossible.
 */
export type Ack<TData = unknown> =
    | { ok: true; data?: TData; correlation_id?: string }
    | { ok: false; code: string; message: string; correlation_id?: string };

// Re-export the `PendingMessage` contract from the service so test
// fixtures and other consumers can `import { PendingMessage } from
// "../types/channel"`. Definition lives next to the queue
// implementation in `channelService.ts`.
export type { PendingMessage } from "../services/channel/channelService";
