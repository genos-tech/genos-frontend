/**
 * v3 Channel/Message → legacy ChatProps adapter.
 *
 * Bridges the v3 unified channel/message schema back to the legacy
 * UI's `AllChatProps` / `MessageProps` shapes so existing UI surfaces
 * (MainChatPane, ChatHome, sidebar) keep rendering unchanged while
 * their data sources flip over to the v3 backend.
 *
 * The chatId migration: the v3 `Channel.id` is a UUID string; legacy
 * `ChatProps.chatId` was an integer. We dropped the integer constraint
 * (see types/chat.ts) so the UUID flows through verbatim. Call sites
 * that did arithmetic / IDB-int-keying on chatId now surface as tsc
 * errors — that error list IS the punch list for follow-on sessions.
 *
 * Scope intentionally narrow: this adapter handles only the chat-list
 * use case (AllChatProps). Per-channel detail with full message lists,
 * thread bridges, and the activity stream stay on their existing paths
 * for now.
 */

import type { UserProps } from "../../../types/admin";
import {
    ChannelKind,
    type Channel,
    type ChannelMember,
    type Flag,
    type Message,
    type MessageReaction,
} from "../../../types/channel";
import type {
    AllChatProps,
    FlaggedMessageProps,
    MDMMemberProps,
    MessageProps,
    ThreadMessageProps,
} from "../../../types/chat";
import type { ReactionProps } from "../../../types/common";
import type { ProjectProps } from "../../../types/tasks";

/** Map v3 `ChannelKind` to the legacy integer kind code. They happen
 *  to be the same integer values today (DM=1, GM=2, PM=3, MDM=4) —
 *  centralized here so a future divergence is one place to fix. */
const KIND_TO_CHAT_TYPE: Record<ChannelKind, number> = {
    [ChannelKind.DM]: 1,
    [ChannelKind.GM]: 2,
    [ChannelKind.PM]: 3,
    [ChannelKind.MDM]: 4,
};

/**
 * Normalize a v3 Message body for the legacy renderer. The legacy
 * `BnChatPreview` does `content.slice(0, -1)` to drop the trailing
 * empty paragraph the BlockNote editor auto-appends; this throws
 * if `content` isn't an array OR has fewer than 2 blocks (slicing a
 * 1-element array gives `[]` and BlockNote rejects "empty initial
 * content"). Defensive coercion + tail pad so any malformed body
 * (string, empty array, single block from a legacy import) still
 * renders instead of crashing the whole MessageBubble.
 */
const EMPTY_PARAGRAPH = { type: "paragraph", content: [] };
function normalizeBodyForLegacy(body: unknown): unknown[] {
    const arr = Array.isArray(body) ? body : [];
    if (arr.length >= 2) return arr;
    if (arr.length === 1) return [...arr, EMPTY_PARAGRAPH];
    // Empty array — give BnChatPreview two blocks so `.slice(0, -1)`
    // leaves at least one element. Renders as a blank bubble (matches
    // the legacy "deleted / empty message" rendering).
    return [EMPTY_PARAGRAPH, EMPTY_PARAGRAPH];
}

/** A best-effort empty user — used for `dmPartnerUser` on non-DM
 *  channels (the legacy shape requires the field but UI code reads
 *  it only on DM). When the v3 store has the channel member roster
 *  in memory, the DM branch of the adapter swaps the right partner
 *  in by inspecting members. */
const EMPTY_USER: UserProps = {
    userId: "",
    userName: "",
    userEmail: "",
    teamId: "",
    teamName: "",
    avatarImgPath: "",
    tsLastSeen: "",
    tsJoined: "",
};

/**
 * Resolve the DM partner from the channel's member list. For DM
 * channels, this is the *other* user in the pair. Returns
 * EMPTY_USER when the partner can't be located (no roster cached
 * yet, or the channel isn't a DM).
 */
function resolveDmPartner(
    members: readonly ChannelMember[] | undefined,
    currentUserId: string | null
): UserProps {
    if (!members || !currentUserId) return EMPTY_USER;
    // For self-DMs (talking to yourself), every member is the current
    // user — `find(m => m.userId !== currentUserId)` returns undefined.
    // Fall through to the first member, which IS the current user.
    // The downstream UI (`ChatListItemTitle`, `MainChatPaneHeader`,
    // `ChatListItemAvatar`) detects the self-DM via
    // `dmPartnerUser.userId === myself.userId` and renders the
    // "(You)" badge + the user's own avatar — but only when we
    // populate this field with a real user row instead of EMPTY_USER.
    const partner = members.find((m) => m.userId !== currentUserId) ?? members[0];
    if (!partner) return EMPTY_USER;
    // `member.user` (a `UserLite`) is denormalized into the v3
    // ChannelMember row by the backend so we get name + avatar
    // without a parallel `getTeamMembers` fetch. If the field is
    // absent (older cached row pre-serializer-update, or the user
    // got deleted), fall back to the userId-only shape.
    const u = partner.user;
    return {
        userId: partner.userId,
        userName: u?.userName ?? "",
        userEmail: u?.userEmail ?? "",
        teamId: "",
        teamName: "",
        avatarImgPath: u?.avatarImgPath ?? "",
        tsLastSeen: "",
        tsJoined: partner.tsJoined ?? "",
    };
}

/**
 * Adapter for the chat list's `latestMessage` slot. The legacy
 * `MessageProps` shape carries integer ids that the v3 backend
 * doesn't have direct equivalents for — we leave those as a tsc
 * inventory item rather than fabricating fake integers (see
 * `messageId: 0` placeholder below). Real per-channel message lists
 * are migrated in follow-on sessions and will need MessageProps to
 * flip to string ids the same way ChatProps did.
 */
function v3MessageToLegacyPreview(m: Message): MessageProps {
    return {
        chatType: KIND_TO_CHAT_TYPE[m.channelKind as ChannelKind] ?? 0,
        // PUNCH LIST: MessageProps.chatId is still typed `number`.
        // tsc surfaces this — fix when MessageProps migrates.
        chatId: 0,
        messageId: m.seq ?? 0,
        content: normalizeBodyForLegacy(m.body),
        contentText: m.bodyText ?? "",
        sender: {
            userId: m.sender?.userId ?? "",
            userName: m.sender?.userName ?? "",
            userEmail: m.sender?.userEmail ?? "",
            teamId: "",
            teamName: "",
            avatarImgPath: m.sender?.avatarImgPath ?? "",
            tsLastSeen: "",
            tsJoined: "",
            // Propagate the system-user flag. PM (and MDM) bubbles
            // hide the avatar slot + skip the username header when the
            // sender is the per-project system user that posts the
            // task-card headers — MessageBubble reads
            // `message.sender.isSystemUser === true` to do that.
            isSystemUser: m.sender?.isSystemUser ?? false,
        },
        tsSent: m.tsSent,
        tsUpdated: m.tsUpdated,
        numReplies: m.replyCount ?? 0,
        taskExist: false,
        taskId: null,
        taskStatus: null,
    };
}

/**
 * Empty latestMessage stub for a channel that has no messages yet.
 * The legacy shape requires `latestMessage` to be present (not
 * optional), so we fabricate a structurally-valid empty row.
 * `tsSent` is set to the channel's creation time so sort-by-recency
 * still places freshly-created channels reasonably.
 */
function emptyLatestMessage(channel: Channel): MessageProps {
    return {
        chatType: KIND_TO_CHAT_TYPE[channel.kind] ?? 0,
        chatId: 0,
        messageId: 0,
        content: [],
        contentText: "",
        sender: EMPTY_USER,
        tsSent: channel.tsCreated ?? "",
        tsUpdated: channel.tsUpdated ?? "",
        numReplies: 0,
        taskExist: false,
        taskId: null,
        taskStatus: null,
    };
}

/**
 * Convert one v3 Channel into a legacy AllChatProps row.
 *
 * `members` is the cached roster from `channelService.snapshot.
 * membersByChannel.get(channel.id)`. Pass it (or undefined) — the
 * adapter falls back to EMPTY_USER for DM partners when absent.
 *
 * `isPinned` is the boolean readout of
 * `channelService.snapshot.pinByChannelId.has(channel.id)` — kept as
 * a parameter so the caller can batch the pin-map lookup once instead
 * of resubscribing inside the adapter for every row.
 *
 * `currentUserId` is the viewer's user id; needed for DM partner
 * resolution. Pass `null` if pre-auth — the adapter will safely
 * return EMPTY_USER.
 */
export function channelToLegacyChat(args: {
    channel: Channel;
    members?: readonly ChannelMember[];
    isPinned: boolean;
    currentUserId: string | null;
}): AllChatProps {
    const { channel, members, isPinned, currentUserId } = args;
    const latest = channel.latestMessage
        ? v3MessageToLegacyPreview(channel.latestMessage)
        : emptyLatestMessage(channel);
    // DM channels store no title (it's structurally redundant — the
    // partner's name IS the title). Surface the partner's userName as
    // chatName so the chat-list row and MainChatPaneHeader render
    // something instead of "". Non-DM channels use their stored title.
    const dmPartner =
        channel.kind === ChannelKind.DM ? resolveDmPartner(members, currentUserId) : EMPTY_USER;
    const chatName =
        channel.kind === ChannelKind.DM
            ? dmPartner.userName || channel.title || ""
            : channel.title || "";
    // `countUnreadChats` in useChatManagement compares
    // `Number(lastReadMessageId) < latestMessage.messageId` to decide
    // whether the chat is unread. The v3 cursor stores the read
    // position as a UUID (`ReadCursor.lastReadMessageId`), which doesn't
    // map to the legacy integer seq comparison. The Channel already
    // carries `unreadCount` (kept current by `handleReadAdvanced` +
    // `handleMessageCreated`), so derive the legacy `lastReadMessageId`
    // from that: when unread == 0, emit the latest seq so the comparison
    // returns false; when unread > 0, emit "0" so it returns true. The
    // exact per-message read position isn't needed by the sidebar; only
    // the boolean "is there anything new" matters.
    const latestSeq = channel.latestMessage?.seq ?? 0;
    const lastReadForLegacy = channel.unreadCount === 0 ? String(latestSeq) : "0";
    return {
        chatType: KIND_TO_CHAT_TYPE[channel.kind] ?? 0,
        chatId: channel.id,
        chatName,
        dmPartnerUser: dmPartner,
        lastReadMessageId: lastReadForLegacy,
        latestMessage: latest,
        latestMessageText: latest.contentText,
        TSLastMessage: latest.tsSent,
        isPrivate: channel.isPrivate,
        profileImagePath: channel.profileImageUrl || undefined,
        isPinned,
        // PM channels carry `project` on the legacy shape. We only
        // have the `projectId` + project-derived `title` on the v3
        // Channel — the rest of `ProjectProps` (tags, system user,
        // owner) lives on a separate `ProjectMaster` row that the FE
        // hydrates lazily via `useProjectManagement`. Populate the
        // minimal pair so call sites that only need the id (image
        // upload in ModalProjectProfile, task-click → preview) work
        // without an extra fetch. Other consumers that read full
        // tag / role fields get an empty list rather than `undefined`.
        project:
            channel.kind === ChannelKind.PM && channel.projectId != null
                ? ({
                      projectId: channel.projectId,
                      projectName: channel.title || "",
                      projectTags: [],
                  } as ProjectProps)
                : undefined,
        // For MDM channels, map the v3 ChannelMember[] roster to the
        // legacy `MDMMemberProps[]` shape — populates `MDMAvatar`'s
        // overlapping member-avatar render in the sidebar / header.
        // Other kinds don't read this field, so leave it undefined.
        mdmMembers: channel.kind === ChannelKind.MDM ? membersToMdmMembers(members) : undefined,
    };
}

/**
 * Map v3 ChannelMember[] → legacy MDMMemberProps[]. The denormalized
 * `user` field on each member carries name + avatar (added in Track D
 * to the ChannelMemberSerializer), so this is a 1:1 projection.
 *
 * Returns `undefined` instead of `[]` when there are no members so
 * downstream `Array.isArray && length > 0` guards match the legacy
 * "no roster" shape.
 */
function membersToMdmMembers(
    members: readonly ChannelMember[] | undefined
): MDMMemberProps[] | undefined {
    if (!members || members.length === 0) return undefined;
    return members.map((m) => ({
        userId: m.userId,
        userName: m.user?.userName ?? "",
        userEmail: m.user?.userEmail ?? "",
        avatarImgPath: m.user?.avatarImgPath ?? "",
        teamId: "",
        teamName: "",
    }));
}

/**
 * Map a snapshot of v3 channels to the legacy `AllChatProps[]`. The
 * input is the values of `channelService.snapshot.channels`; the
 * caller supplies the `pinByChannelId` and `membersByChannel`
 * lookups so the adapter doesn't need a service reference.
 *
 * Sort: recency desc on `latestMessage.tsSent` (falling back to
 * `tsUpdated`) — mirrors the legacy `sortByTSLastMessageDesc` order.
 */
export function v3ChannelsToLegacyChats(args: {
    channels: Iterable<Channel>;
    pinByChannelId: ReadonlySet<string> | { has(id: string): boolean };
    membersByChannel: ReadonlyMap<string, readonly ChannelMember[]>;
    currentUserId: string | null;
}): AllChatProps[] {
    const { channels, pinByChannelId, membersByChannel, currentUserId } = args;
    const out: AllChatProps[] = [];
    for (const c of channels) {
        out.push(
            channelToLegacyChat({
                channel: c,
                members: membersByChannel.get(c.id),
                isPinned: pinByChannelId.has(c.id),
                currentUserId,
            })
        );
    }
    out.sort((a, b) => {
        const ta = a.TSLastMessage || "";
        const tb = b.TSLastMessage || "";
        return tb.localeCompare(ta);
    });
    return out;
}

/**
 * v3 `MessageReaction` → legacy `ReactionProps`. The legacy `id` field
 * is `number` (DB row PK from the per-type reaction tables); v3 uses
 * UUIDs. We emit `0` — no UI surface keys by it (reactions are grouped
 * by `emoji` + `sender.userId` for collapse rendering).
 */
function v3ReactionToLegacy(r: MessageReaction): ReactionProps {
    return {
        id: 0,
        emoji: r.emoji,
        sender: {
            userId: r.user?.userId ?? "",
            userName: r.user?.userName ?? "",
            userEmail: r.user?.userEmail ?? "",
            teamId: "",
            teamName: "",
            avatarImgPath: r.user?.avatarImgPath ?? "",
            tsLastSeen: "",
            tsJoined: "",
        },
        tsSent: r.tsSent,
    };
}

/**
 * Full-shape v3 `Message` → legacy `MessageProps`. Used when a channel
 * is opened (via `useChatManagement.moveToSpecificChat`) and we need
 * to populate `ChatProps.messages`.
 *
 * Differences from `v3MessageToLegacyPreview` (the chat-list adapter):
 *
 *   - `messageIdWithChatId` is the v3 UUID directly. Globally unique
 *     across channels, so the legacy `messageIdKey` index in
 *     `useMessageManagement.indexMap` stays a one-to-one lookup. The
 *     legacy format was `${chatId}-${seq}`; the new one drops the
 *     chatId prefix because v3 message UUIDs are already unique.
 *
 *   - `chatId` carries the channel UUID through the legacy `number`
 *     slot via a structural cast. The legacy type is mid-migration
 *     (see `ChatProps.chatId: string` flip in `types/chat.ts`).
 *
 *   - `reactions` / `taskExist` / PM-specific fields are read from
 *     v3 `metadata` JSON where the backend stashes them (`taskId`,
 *     `displayId`, `taskStatus`, `taskCommentCount`).
 */
export function v3MessageToLegacy(args: {
    message: Message;
    /** The host channel's UUID — assigned to `MessageProps.chatId` via
     *  a structural cast (legacy slot was `number`). */
    channelId: string;
    /** Legacy integer chat-type code (1=DM, 2=GM, 3=PM, 4=MDM). */
    chatType: number;
    /** Optional flag-membership lookup. Caller usually passes
     *  `channelService.snapshot.flagByMessageId` directly — the adapter
     *  only needs `.has(messageId)`. Omit to default `isFlagged` to
     *  false (call sites that don't care about flag state). */
    flaggedMessageIds?: { has(id: string): boolean };
}): MessageProps {
    const { message: m, channelId, chatType, flaggedMessageIds } = args;
    const meta = (m.metadata ?? {}) as Record<string, unknown>;
    // Prefer top-level fields (sourced server-side from the linked
    // `TaskMaster` row via the v3 `MessageSerializer.displayId /
    // taskStatus / taskId` methods). Fall back to `metadata.*` for
    // messages written before the serializer changes shipped, in case
    // any IDB-cached row still carries the older shape.
    const taskId =
        typeof m.taskId === "number"
            ? m.taskId
            : typeof meta.taskId === "number"
              ? (meta.taskId as number)
              : null;
    const displayId =
        typeof m.displayId === "string"
            ? m.displayId
            : typeof meta.displayId === "string"
              ? (meta.displayId as string)
              : undefined;
    const taskStatus =
        typeof m.taskStatus === "string"
            ? m.taskStatus
            : typeof meta.taskStatus === "string"
              ? (meta.taskStatus as string)
              : null;
    const taskCommentCount =
        typeof meta.taskCommentCount === "number" ? (meta.taskCommentCount as number) : undefined;
    return {
        chatType,
        // PUNCH LIST: legacy slot is `number`; we carry the v3 UUID
        // through. Same migration shim as `ChatProps.chatId`.
        chatId: channelId as unknown as number,
        messageIdWithChatId: m.id,
        // PUNCH LIST: legacy slot is `number`; emit `seq` (per-channel
        // monotonic int) so existing scroll-by-message and unread-count
        // arithmetic keeps working. The v3 UUID `m.id` is also carried
        // on `messageIdWithChatId` above.
        messageId: m.seq,
        content: normalizeBodyForLegacy(m.body),
        contentText: m.bodyText ?? "",
        sender: {
            userId: m.sender?.userId ?? "",
            userName: m.sender?.userName ?? "",
            userEmail: m.sender?.userEmail ?? "",
            teamId: "",
            teamName: "",
            avatarImgPath: m.sender?.avatarImgPath ?? "",
            tsLastSeen: "",
            tsJoined: "",
            // Required for PM (and MDM) bubbles to hide the avatar
            // slot + skip the username header when a task-card header
            // posted by the per-project system user lands in the
            // pane — `MessageBubble` reads
            // `message.sender.isSystemUser === true` to do that.
            isSystemUser: m.sender?.isSystemUser ?? false,
        },
        tsSent: m.tsSent,
        tsUpdated: m.tsUpdated,
        numReplies: m.replyCount ?? 0,
        taskCommentCount,
        // The legacy `taskExist` is "this PM message is linked to a
        // task" — proxied through `metadata.taskId !== null`. Non-PM
        // channels never set the metadata so this falls to false.
        taskExist: taskId != null,
        taskId,
        displayId,
        taskStatus,
        reactions: (m.reactions ?? []).map(v3ReactionToLegacy),
        isFlagged: flaggedMessageIds?.has(m.id) ?? false,
    };
}

/**
 * Plural form. Filters thread replies out (the legacy `ChatProps.messages`
 * slot is top-level only; thread replies render through a different
 * surface). Sorts by `tsSent` asc to mirror the legacy delta ordering.
 */
export function v3MessagesToLegacy(args: {
    messages: readonly Message[];
    channelId: string;
    chatType: number;
    flaggedMessageIds?: { has(id: string): boolean };
}): MessageProps[] {
    const { messages, channelId, chatType, flaggedMessageIds } = args;
    // For PM channels, top-level messages are task-card headers — one
    // per task. Anything without a `taskId` is an orphan row (legacy
    // junk: task was deleted via `on_delete=SET_NULL`, or a non-task
    // PM message slipped through some pre-task-feature path). Hide
    // them so the PM pane only renders real task cards. Other kinds
    // (DM/GM/MDM) keep every top-level non-deleted row.
    const isPm = chatType === 3;
    const out: MessageProps[] = [];
    for (const m of messages) {
        if (m.isThreadReply) continue;
        if (m.deletedAt) continue;
        // Adapt FIRST, then filter on the *resolved* taskId. The server
        // only fills the top-level `taskId` column when the `task` FK is
        // linked, but task-create messages carry the id in
        // `metadata.taskId` (see `uploadNewTask.ts` — the create path in
        // `message_views._allocate_seq_and_create_message` stores
        // `metadata` but never sets the FK, so `MessageSerializer.taskId`
        // comes back null). Filtering on the raw `m.taskId` here dropped
        // those bubbles entirely — both live and after a refresh — even
        // though `v3MessageToLegacy` already coalesces `m.taskId ??
        // metadata.taskId`. Reusing the adapter's resolved value keeps
        // the filter and the resolver from ever diverging again.
        const adapted = v3MessageToLegacy({ message: m, channelId, chatType, flaggedMessageIds });
        if (isPm && adapted.taskId == null) continue;
        out.push(adapted);
    }
    out.sort((a, b) => (a.tsSent || "").localeCompare(b.tsSent || ""));
    return out;
}

/**
 * Full-shape v3 thread reply → legacy `ThreadMessageProps`. Carries
 * the v3 message UUID through `messageIdWithChatIdAndThreadId` so the
 * thread-pane click handlers (delete / edit / react) can reach it
 * without re-parsing the legacy `${chatId}-${threadId}-${messageId}`
 * composite string format.
 *
 * `chatId` and `threadId` are still `number` in the legacy type but
 * we carry the v3 UUIDs through them via `as unknown as number` casts
 * — same migration shim as the top-level adapter. Runtime consumers
 * that compare them as strings keep working; consumers doing integer
 * arithmetic fail loudly and are punch-list items.
 */
export function v3ThreadMessageToLegacy(args: {
    message: Message;
    channelId: string;
    threadRootUuid: string;
    chatType: number;
    flaggedMessageIds?: { has(id: string): boolean };
}): ThreadMessageProps {
    const { message: m, channelId, threadRootUuid, chatType, flaggedMessageIds } = args;
    const meta = (m.metadata ?? {}) as Record<string, unknown>;
    const taskId =
        typeof m.taskId === "number"
            ? m.taskId
            : typeof meta.taskId === "number"
              ? (meta.taskId as number)
              : null;
    const displayId =
        typeof m.displayId === "string"
            ? m.displayId
            : typeof meta.displayId === "string"
              ? (meta.displayId as string)
              : undefined;
    return {
        chatType,
        messageIdWithChatIdAndThreadId: m.id,
        chatId: channelId as unknown as number,
        threadId: threadRootUuid as unknown as number,
        messageId: m.seq,
        content: normalizeBodyForLegacy(m.body),
        contentText: m.bodyText ?? "",
        sender: {
            userId: m.sender?.userId ?? "",
            userName: m.sender?.userName ?? "",
            userEmail: m.sender?.userEmail ?? "",
            teamId: "",
            teamName: "",
            avatarImgPath: m.sender?.avatarImgPath ?? "",
            tsLastSeen: "",
            tsJoined: "",
            isSystemUser: m.sender?.isSystemUser ?? false,
        },
        taskId,
        displayId,
        tsSent: m.tsSent,
        tsUpdated: m.tsUpdated,
        reactions: (m.reactions ?? []).map(v3ReactionToLegacy),
        taskExist: taskId != null,
        isFlagged: flaggedMessageIds?.has(m.id) ?? false,
    };
}

/**
 * Plural form for thread messages. The legacy `ThreadProps.messages`
 * shape includes the thread root (the parent message) as `messages[0]`
 * followed by replies — that's the invariant the existing
 * `ThreadChatPane` / `ThreadMessageBubble` UI is built around (every
 * thread is non-empty, the first row IS the root, the rest are replies).
 *
 * v3 stores the root as a top-level row (`isThreadReply=false`,
 * `id === threadRootUuid`) and replies as `isThreadReply=true,
 * parentId === threadRootUuid`. Adapter rebuilds the legacy shape by
 * prepending the root and appending replies in tsSent order.
 *
 * Returns an empty array only when the root itself isn't in the
 * snapshot (channel not synced yet, hard-deleted, etc.). A thread with
 * no replies still returns `[root]` — that matches legacy "fresh
 * task opened, nothing replied yet" behavior and lets `moveToSpecific
 * ThreadChat` succeed instead of silently dropping out.
 */
export function v3ThreadMessagesToLegacy(args: {
    messages: readonly Message[];
    channelId: string;
    threadRootUuid: string;
    chatType: number;
    flaggedMessageIds?: { has(id: string): boolean };
}): ThreadMessageProps[] {
    const { messages, channelId, threadRootUuid, chatType, flaggedMessageIds } = args;
    // Find the root first. If absent, the thread can't render at all.
    let root: Message | undefined;
    for (const m of messages) {
        if (m.id === threadRootUuid) {
            root = m;
            break;
        }
    }
    if (!root || root.deletedAt) return [];

    const replies: ThreadMessageProps[] = [];
    for (const m of messages) {
        if (!m.isThreadReply) continue;
        if (m.parentId !== threadRootUuid) continue;
        if (m.deletedAt) continue;
        replies.push(
            v3ThreadMessageToLegacy({
                channelId,
                chatType,
                flaggedMessageIds,
                message: m,
                threadRootUuid,
            })
        );
    }
    replies.sort((a, b) => (a.tsSent || "").localeCompare(b.tsSent || ""));
    return [
        v3ThreadMessageToLegacy({
            channelId,
            chatType,
            flaggedMessageIds,
            message: root,
            threadRootUuid,
        }),
        ...replies,
    ];
}

/**
 * Locate the channel + message a v3 `Flag` points at. Scans every
 * channel's messagesByChannel slice; bails on first hit. O(N) over
 * total cached messages, but flagged messages are rare so the outer
 * caller (`v3FlagsToLegacy`) keeps the perf bound at "small N".
 *
 * Returns `null` when the message isn't in the snapshot (channel not
 * synced yet, or row was hard-deleted on the server). Callers should
 * skip such flags rather than render a half-populated row.
 */
function locateFlaggedMessage(
    flag: Flag,
    channels: ReadonlyMap<string, Channel>,
    messagesByChannel: ReadonlyMap<string, readonly Message[]>
): { channel: Channel; message: Message } | null {
    for (const [channelId, messages] of messagesByChannel) {
        const m = messages.find((msg) => msg.id === flag.messageId);
        if (!m) continue;
        const ch = channels.get(channelId);
        if (!ch) return null;
        return { channel: ch, message: m };
    }
    return null;
}

/**
 * v3 `Flag[]` → legacy `FlaggedMessageProps[]`. Each row is rebuilt by
 * resolving the flagged message + its host channel in the snapshot.
 * Flags whose channel/message hasn't synced yet are skipped (would
 * render as a broken row otherwise).
 *
 * Slots typed `number` (chatId, threadId, messageId, taskId) carry the
 * v3 UUID via `as unknown as number` casts — same migration shim used
 * across the FE. Downstream consumers compare them as strings (chatId
 * comparisons), look them up in indexMap, or pass through to v3
 * mutation calls — none does integer arithmetic, so the cast is safe.
 *
 * `threadId`: thread membership for a flag is derived from whether
 * the underlying Message is a thread reply. If `parentId` is set, the
 * flagged row carries the parent's UUID as `threadId`; otherwise zero
 * (a sentinel the legacy sidebar treats as "top-level message").
 */
export function v3FlagsToLegacy(args: {
    flags: ReadonlyMap<string, Flag>;
    channels: ReadonlyMap<string, Channel>;
    membersByChannel: ReadonlyMap<string, readonly ChannelMember[]>;
    messagesByChannel: ReadonlyMap<string, readonly Message[]>;
    currentUserId: string | null;
}): FlaggedMessageProps[] {
    const { flags, channels, membersByChannel, messagesByChannel, currentUserId } = args;
    const out: FlaggedMessageProps[] = [];
    for (const flag of flags.values()) {
        const located = locateFlaggedMessage(flag, channels, messagesByChannel);
        if (!located) continue;
        const { channel, message } = located;
        const meta = (message.metadata ?? {}) as Record<string, unknown>;
        const taskId =
            typeof message.taskId === "number"
                ? message.taskId
                : typeof meta.taskId === "number"
                  ? (meta.taskId as number)
                  : 0;
        const displayId =
            typeof message.displayId === "string"
                ? message.displayId
                : typeof meta.displayId === "string"
                  ? (meta.displayId as string)
                  : undefined;
        const dmPartner =
            channel.kind === ChannelKind.DM
                ? resolveDmPartner(membersByChannel.get(channel.id), currentUserId)
                : EMPTY_USER;
        const chatName =
            channel.kind === ChannelKind.DM
                ? dmPartner.userName || channel.title || ""
                : channel.title || "";
        const threadIdSlot =
            message.isThreadReply && message.parentId
                ? (message.parentId as unknown as number)
                : 0;
        out.push({
            flaggedMessageId: flag.id,
            chatType: KIND_TO_CHAT_TYPE[channel.kind] ?? 0,
            chatName,
            chatId: channel.id as unknown as number,
            threadId: threadIdSlot,
            messageId: message.id as unknown as number,
            contentText: message.bodyText ?? "",
            sender: {
                userId: message.sender?.userId ?? "",
                userName: message.sender?.userName ?? "",
                userEmail: message.sender?.userEmail ?? "",
                teamId: "",
                teamName: "",
                avatarImgPath: message.sender?.avatarImgPath ?? "",
                tsLastSeen: "",
                tsJoined: "",
                isSystemUser: message.sender?.isSystemUser ?? false,
            },
            dmPartnerUser: dmPartner,
            project:
                channel.kind === ChannelKind.PM && channel.projectId != null
                    ? ({
                          projectId: channel.projectId,
                          projectName: channel.title || "",
                          projectTags: [],
                      } as ProjectProps)
                    : undefined,
            taskId,
            displayId,
            tsSent: message.tsSent,
        });
    }
    // Most-recent flag first — matches legacy sidebar ordering.
    out.sort((a, b) => (b.tsSent || "").localeCompare(a.tsSent || ""));
    return out;
}
