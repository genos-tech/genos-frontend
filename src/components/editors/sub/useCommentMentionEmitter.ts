import { useEffect } from "react";
import { Socket } from "socket.io-client";

import {
    commentFirstLine,
    CommentHostContext,
    emitCommentMention,
    extractCommentMentions,
} from "./commentMentions";

// ─────────────────────────────────────────────────────────────────────────
// Wraps a BlockNote `YjsThreadStore`'s write methods so that committing a
// comment (new thread, reply, or edit) fans its `@`/`#` mentions out to the
// activity system — the comment twin of the body-mention emit in
// `sendUpdatedSpecificTask` / `emitNoteMention`.
//
// Why wrap the store rather than diff the Yjs `threads` map: `createThread` /
// `addComment` / `updateComment` are instance arrow-fn properties that the
// CommentsExtension invokes by property lookup at call time (see
// `@blocknote/core` comments plugin), and they run ONLY on the authoring
// client with the exact committed body in hand. A `subscribe()` diff would
// instead fire on every connected client and force author-gating + body
// reconstruction. Wrapping is exactly-once, author-only, and body-in-hand.
//
// The store is the source of truth for a comment's PRIOR mentions, so an
// edit computes its newly/removed delta by reading the pre-edit comment via
// `getThread` — no local ref-tracking that could drift across reloads.
// ─────────────────────────────────────────────────────────────────────────

type WritableThreadStore = {
    createThread: (options: {
        initialComment: { body: unknown; metadata?: unknown };
        metadata?: unknown;
    }) => Promise<{ id: string; comments: { id: string }[] }>;
    addComment: (options: {
        comment: { body: unknown; metadata?: unknown };
        threadId: string;
    }) => Promise<{ id: string }>;
    updateComment: (options: {
        comment: { body: unknown; metadata?: unknown };
        threadId: string;
        commentId: string;
    }) => Promise<void>;
    getThread: (threadId: string) => {
        comments?: { id: string; body?: unknown }[];
    } | null;
};

type EmitterArgs = {
    /** The store returned by `useCollaborativeBlockNote`. Null until the
     *  collaborative provider connects (comments disabled / not yet ready). */
    threadStore: unknown;
    socket: Socket | null;
    /** Resolves the host surface for a mention emit. A function (not a value)
     *  so the effect can stay keyed on the stable store identity while always
     *  reading the CURRENT host coordinates — a note editor swaps notes
     *  without the store being torn down. Returns null to suppress emits
     *  (e.g. host ids not ready yet). */
    getHost: () => CommentHostContext | null;
};

// Type guard: only wrap once the store is present and exposes the write API.
const isWritableStore = (s: unknown): s is WritableThreadStore => {
    if (!s || typeof s !== "object") return false;
    const st = s as Record<string, unknown>;
    return (
        typeof st.createThread === "function" &&
        typeof st.addComment === "function" &&
        typeof st.updateComment === "function" &&
        typeof st.getThread === "function"
    );
};

export const useCommentMentionEmitter = ({ threadStore, socket, getHost }: EmitterArgs): void => {
    useEffect(() => {
        if (!isWritableStore(threadStore)) return;
        const store = threadStore;

        // A mention emit never blocks or breaks a comment write: the comment
        // is already committed to the Yjs doc by the time we get here, and a
        // failed activity is strictly less bad than a lost comment.
        const emit = (args: {
            commentId: string;
            commentThreadId: string;
            body: unknown;
            prevBody?: unknown;
        }) => {
            try {
                const host = getHost();
                if (!host) return;
                const { userIds, groupIds } = extractCommentMentions(args.body);
                const prev = args.prevBody ? extractCommentMentions(args.prevBody).userIds : [];
                const prevSet = new Set(prev);
                const currSet = new Set(userIds);
                const newly = userIds.filter((u) => !prevSet.has(u));
                const removed = prev.filter((u) => !currSet.has(u));
                if (newly.length === 0 && removed.length === 0) return;
                emitCommentMention(socket, {
                    host,
                    commentId: args.commentId,
                    commentThreadId: args.commentThreadId,
                    newlyMentionedUserIds: newly,
                    allMentionedUserIds: userIds,
                    removedUserIds: removed,
                    mentionedGroupIds: groupIds,
                    firstLineContent: commentFirstLine(args.body),
                    tsMentionedAt: new Date().toISOString(),
                });
            } catch {
                // Extraction / emit failure must not surface to the writer.
            }
        };

        const origCreateThread = store.createThread;
        const origAddComment = store.addComment;
        const origUpdateComment = store.updateComment;

        store.createThread = async (options) => {
            const thread = await origCreateThread(options);
            // The initial comment is the first (only) comment on the new
            // thread; its id comes back on the returned ThreadData.
            const commentId = thread.comments?.[0]?.id ?? thread.id;
            emit({
                commentId,
                commentThreadId: thread.id,
                body: options.initialComment?.body,
            });
            return thread;
        };

        store.addComment = async (options) => {
            const comment = await origAddComment(options);
            emit({
                commentId: comment.id,
                commentThreadId: options.threadId,
                body: options.comment?.body,
            });
            return comment;
        };

        store.updateComment = async (options) => {
            // Snapshot the pre-edit body BEFORE the write so we can diff the
            // mention set (newly-added get a row, removed get theirs deleted).
            const prevBody = store
                .getThread(options.threadId)
                ?.comments?.find((c) => c.id === options.commentId)?.body;
            await origUpdateComment(options);
            emit({
                commentId: options.commentId,
                commentThreadId: options.threadId,
                body: options.comment?.body,
                prevBody,
            });
        };

        return () => {
            // Restore originals so a store that outlives this effect (or a
            // double-invoked Strict-Mode mount) isn't left double-wrapped.
            store.createThread = origCreateThread;
            store.addComment = origAddComment;
            store.updateComment = origUpdateComment;
        };
        // Keyed on the store identity + socket only. `getHost` is read fresh
        // on each emit, so swapping the host note doesn't need a re-wrap and
        // won't tear down the wrappers mid-session.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [threadStore, socket]);
};
