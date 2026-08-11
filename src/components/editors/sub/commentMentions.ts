import { Socket } from "socket.io-client";

// ─────────────────────────────────────────────────────────────────────────
// Mention → activity plumbing for BlockNote *inline comments* (the
// AddCommentButton → FloatingComposer → threads feature), NOT the
// task-comment feature.
//
// Django never sees a comment's content — comments live only in the collab
// server's opaque Yjs document — so, unlike a task/note *body* save (where
// the backend PUT computes the mention delta and the FE just relays it), the
// mention set for a comment has to be extracted CLIENT-SIDE from the comment
// body the author just wrote, then emitted over a socket event that mirrors
// the body-mention path (`task_body_mention` / `note_mention`).
//
// The comment body is a BlockNote document (an array of blocks with the same
// `mention` / `mentionGroup` inline-content shape as an editor body), so the
// walk below is the FE twin of the backend's `mention_extractor._walk`
// (genos-api). Keep the two in sync: they must agree on which nodes count as
// a mention or the activity a recipient gets stops matching the chip they see.
// ─────────────────────────────────────────────────────────────────────────

export type CommentMentionSets = {
    /** Direct `@user` mention target ids (from `mention` inline nodes). */
    userIds: string[];
    /** `@group` ids (from `mentionGroup` inline nodes) — the Flask handler
     *  expands these to member user ids server-side, exactly as the
     *  `task_body_mention` path does, so a stale FE group cache can't skew
     *  who gets the activity. */
    groupIds: string[];
};

// Recurse a BlockNote tree, collecting `props[propKey]` for every inline
// node whose `type === nodeType`. Walks both `content` (inline array) and
// `children` (nested blocks) like the backend twin. Defensive against the
// malformed / partially-built bodies a live collaborative doc can hand us:
// non-object nodes, missing `props`, and empty ids are skipped, never thrown.
const collect = (node: unknown, nodeType: string, propKey: string, sink: Set<string>): void => {
    if (Array.isArray(node)) {
        for (const item of node) collect(item, nodeType, propKey, sink);
        return;
    }
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;

    if (n.type === nodeType && n.props && typeof n.props === "object") {
        const value = (n.props as Record<string, unknown>)[propKey];
        if (value !== undefined && value !== null && value !== "") {
            sink.add(String(value));
        }
    }

    const content = n.content;
    if (Array.isArray(content)) {
        for (const c of content) collect(c, nodeType, propKey, sink);
    }
    const children = n.children;
    if (Array.isArray(children)) {
        for (const c of children) collect(c, nodeType, propKey, sink);
    }
};

/**
 * Extract the direct user-mention ids and group-mention ids from a comment
 * body (a BlockNote block array). Returns stable, de-duplicated arrays.
 */
export const extractCommentMentions = (body: unknown): CommentMentionSets => {
    const userIds = new Set<string>();
    const groupIds = new Set<string>();
    collect(body, "mention", "userId", userIds);
    collect(body, "mentionGroup", "groupId", groupIds);
    return { userIds: [...userIds], groupIds: [...groupIds] };
};

/**
 * First non-empty line of plain text in a comment body, for the activity
 * feed row / push body. Cheap best-effort walk over the top-level blocks'
 * inline text — comments are short and flat (paragraph-only schema), so a
 * shallow scan is enough; falls back to "" when there's no text (e.g. an
 * emoji-only or mention-only comment).
 */
export const commentFirstLine = (body: unknown): string => {
    if (!Array.isArray(body)) return "";
    for (const block of body) {
        if (!block || typeof block !== "object") continue;
        const content = (block as Record<string, unknown>).content;
        if (!Array.isArray(content)) continue;
        let line = "";
        for (const node of content) {
            if (node && typeof node === "object") {
                const nn = node as Record<string, unknown>;
                if (nn.type === "text" && typeof nn.text === "string") line += nn.text;
                else if (nn.type === "mention" && nn.props && typeof nn.props === "object") {
                    const name = (nn.props as Record<string, unknown>).userName;
                    if (typeof name === "string") line += `@${name}`;
                }
            }
        }
        const trimmed = line.trim();
        if (trimmed) return trimmed;
    }
    return "";
};

// The host surface a comment lives on. Mirrors the surface_type namespace
// used by body mentions (5=task body, 6=personal note, 7=task note,
// 8=chat note) so a comment mention routes, displays, and deep-links exactly
// like a body mention — the only distinguishing mark is `is_comment` (drives
// the "in a comment" push wording) and the per-comment `comment_id` (keeps
// each comment's activity rows idempotent, independent of the body's).
export type CommentHostContext = {
    surfaceType: 5 | 6 | 7 | 8;
    /** note id for surfaces 6/7/8; unused for 5. */
    noteId?: number;
    /** task id for surfaces 5/7. */
    taskId?: number;
    /** project id for surfaces 5/7 (best-effort; Django backfills from the
     *  task FK when absent, e.g. the task-body editor only knows its taskId). */
    projectId?: number;
    /** note/task title, for the feed row + push. */
    title?: string;
    /** chat-note (surface 8) parent-chat routing, for deep-linking. */
    chatType?: number;
    chatId?: number;
    threadId?: number;
};

export type CommentMentionEmit = {
    host: CommentHostContext;
    /** id of the comment thread the comment belongs to. */
    commentThreadId: string;
    /** id of the individual comment — the idempotency key for its rows. */
    commentId: string;
    newlyMentionedUserIds: string[];
    allMentionedUserIds: string[];
    removedUserIds: string[];
    mentionedGroupIds: string[];
    firstLineContent: string;
    tsMentionedAt: string;
};

/**
 * Emit the `comment_mention` socket event. The Flask handler forwards it to
 * the v3 activity surface endpoint with the comment's host `surface_type`,
 * keyed per-comment so re-saves stay idempotent. Gated on
 * `newly || removed > 0` so an edit that didn't touch mentions stays silent —
 * matching `emitNoteMention`.
 */
export const emitCommentMention = (socket: Socket | null, evt: CommentMentionEmit): void => {
    if (!socket) return;
    if (evt.newlyMentionedUserIds.length === 0 && evt.removedUserIds.length === 0) return;

    socket.emit("comment_mention", {
        surface_type: evt.host.surfaceType,
        comment_id: evt.commentId,
        comment_thread_id: evt.commentThreadId,
        newly_mentioned_user_ids: evt.newlyMentionedUserIds,
        all_mentioned_user_ids: evt.allMentionedUserIds,
        removed_user_ids: evt.removedUserIds,
        mentioned_group_ids: evt.mentionedGroupIds,
        first_line_content: evt.firstLineContent,
        ts_mentioned_at: evt.tsMentionedAt,
        // Host routing — the handler packs these into the activity `meta`
        // so the FE routes the mention to the note/task it was left on.
        ...(evt.host.noteId !== undefined ? { note_id: evt.host.noteId } : {}),
        ...(evt.host.taskId !== undefined ? { task_id: evt.host.taskId } : {}),
        ...(evt.host.projectId !== undefined ? { project_id: evt.host.projectId } : {}),
        ...(evt.host.title !== undefined ? { host_title: evt.host.title } : {}),
        ...(evt.host.chatType !== undefined ? { chat_type: evt.host.chatType } : {}),
        ...(evt.host.chatId !== undefined ? { chat_id: evt.host.chatId } : {}),
        ...(evt.host.threadId !== undefined ? { thread_id: evt.host.threadId } : {}),
    });
};

export type CommentActivityEmit = {
    host: CommentHostContext;
    /** id of the individual comment — the idempotency key for its rows. */
    commentId: string;
    /** The comment's `@user` mention ids, forwarded so the backend can
     *  EXCLUDE them from the owner+stakeholder fan-out (they receive the
     *  more-specific mention activity via `emitCommentMention`). */
    mentionedUserIds: string[];
    /** `@group` ids — expanded to member ids + excluded server-side too. */
    mentionedGroupIds: string[];
    firstLineContent: string;
    tsMentionedAt: string;
};

/**
 * Emit the `comment_activity` socket event — the general-comment fan-out
 * that tells a surface's OWNER + STAKEHOLDERS a comment was left on it, even
 * when it @-mentions no one (the note owner / task assignee hears about a
 * comment the same way they hear about a mention).
 *
 * Fires on comment CREATE only (new thread / added comment), NOT on edit — a
 * comment already announced its author's presence; re-paging everyone on an
 * edit would be noise. Unlike `emitCommentMention` it is NOT gated on a
 * mention delta: the whole point is to notify when there is no mention.
 * Recipients are resolved server-side from the surface's authoritative id;
 * this only forwards the surface coordinates + the mention set to exclude.
 */
export const emitCommentActivity = (socket: Socket | null, evt: CommentActivityEmit): void => {
    if (!socket) return;

    socket.emit("comment_activity", {
        surface_type: evt.host.surfaceType,
        comment_id: evt.commentId,
        mentioned_user_ids: evt.mentionedUserIds,
        mentioned_group_ids: evt.mentionedGroupIds,
        first_line_content: evt.firstLineContent,
        ts_mentioned_at: evt.tsMentionedAt,
        // Host routing — packed into the activity `meta` so the FE routes
        // the comment activity to the note/task it was left on, identically
        // to a comment mention.
        ...(evt.host.noteId !== undefined ? { note_id: evt.host.noteId } : {}),
        ...(evt.host.taskId !== undefined ? { task_id: evt.host.taskId } : {}),
        ...(evt.host.projectId !== undefined ? { project_id: evt.host.projectId } : {}),
        ...(evt.host.title !== undefined ? { host_title: evt.host.title } : {}),
        ...(evt.host.chatType !== undefined ? { chat_type: evt.host.chatType } : {}),
        ...(evt.host.chatId !== undefined ? { chat_id: evt.host.chatId } : {}),
        ...(evt.host.threadId !== undefined ? { thread_id: evt.host.threadId } : {}),
    });
};
