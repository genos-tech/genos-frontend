import { ActivityMessageProps } from "../../../types/chat";

// ---------------------------------------------------------------------
// Same-topic activity aggregation
// ---------------------------------------------------------------------
// A burst of activity on one "topic" (a thread someone replies to 100
// times while you're offline, a task that collects a dozen comments, a
// note edited by a mention-happy teammate) used to land as one sidebar
// row PER activity, burying everything else in the feed. The feed only
// needs the LATEST row per topic; the earlier ones carry no extra
// information once the latest is shown.
//
// Aggregation is a pure DISPLAY concern: every activity row is still
// stored (IDB + server) and still fans out to web notifications
// individually. `selectVisibleActivityMessages` collapses same-topic
// runs to their latest row; the mark-read paths expand a collapsed row
// back to its members via `aggregatedIds` so hidden rows can't get
// stuck unread behind their representative.

// Task-comment detection — MUST mirror `ActivityTypeChips.isTaskComment`
// (keep the two in sync). v3 task comments arrive as PM (chatType 3)
// thread replies carrying the `isTaskComment` flag (set on the v3 mirror
// from `message.metadata.taskCommentId`); the `chatType === 4 && taskId`
// shape is the pre-v3 legacy fallback. Lives here (not in
// `activityChipFilters`) so the aggregation module stays import-cycle
// free; `activityChipFilters` re-exports it for its existing consumers.
export const isTaskCommentActivity = (a: ActivityMessageProps): boolean =>
    a.isTaskComment === true || (a.chatType === 4 && !!a.taskId);

/** An activity row that survived aggregation, annotated with the ids of
 *  every member it represents (itself included). `isRead` is the
 *  EFFECTIVE read state — false while ANY member is unread — so the
 *  unread indicator / "Unread" toggle keep working when the latest
 *  member happens to be read but older hidden ones aren't. */
export type AggregatedActivityMessage = ActivityMessageProps & {
    aggregatedIds: string[];
    aggregatedCount: number;
    aggregatedUnreadCount: number;
};

/** Member-id accessor that tolerates plain (un-aggregated) rows — the
 *  mark-read paths accept both shapes. */
export const getAggregatedIds = (a: ActivityMessageProps): string[] =>
    (a as Partial<AggregatedActivityMessage>).aggregatedIds ?? [a.activityId];

/**
 * Grouping key: which rows count as "the same topic".
 *
 * `activityType` is always part of the key so a mention in a thread
 * never collapses into (or hides behind) a plain reply in the same
 * thread — the categories filter differently and carry different
 * urgency. Within a type, the topic is the surface the activity lives
 * on:
 *   - note mentions (chatType 6/7/8)  → the note (`chatId` is the note id)
 *   - task-body mentions (chatType 5) → the task
 *   - task comments                   → the task (all of a task's
 *     comment activity is one conversation; keyed by task, not comment)
 *   - reactions (activityType 2)      → the reacted-to message
 *   - thread replies / thread mentions→ the thread (channel + root)
 *   - main-pane messages / mentions   → the channel
 *
 * The task-comment check runs BEFORE the thread check on purpose: v3
 * task comments are structurally thread replies (`isThread === true`)
 * but belong to the task topic, mirroring how `activityChipFilters`
 * partitions them.
 */
export const activityTopicKey = (a: ActivityMessageProps): string => {
    const t = a.activityType;
    if (a.chatType >= 6 && a.chatType <= 8) return `${t}|note:${a.chatType}:${String(a.chatId)}`;
    if (a.chatType === 5) return `${t}|taskbody:${a.taskId}`;
    if (isTaskCommentActivity(a)) return `${t}|taskcomment:${a.taskId}`;
    if (t === 2) return `2|reaction:${String(a.chatId)}:${a.messageUniqueKey || a.messageId}`;
    if (a.isThread === true) return `${t}|thread:${String(a.chatId)}:${String(a.threadId)}`;
    return `${t}|channel:${String(a.chatId)}`;
};

/**
 * Collapse same-topic runs to one representative row per topic — the
 * member with the latest `tsSent` (defensive compare; the feed arrives
 * sorted newest-first, in which case the representative is also the
 * first member seen and output order is unchanged).
 *
 * Pure; input rows are not mutated (representatives are copies).
 */
export const aggregateActivityMessages = (
    rows: ActivityMessageProps[]
): AggregatedActivityMessage[] => {
    type Bucket = { ids: string[]; rep: ActivityMessageProps; unread: number };
    const byKey = new Map<string, Bucket>();
    const order: string[] = [];
    for (const a of rows) {
        const key = activityTopicKey(a);
        const bucket = byKey.get(key);
        if (!bucket) {
            byKey.set(key, { ids: [a.activityId], rep: a, unread: a.isRead === false ? 1 : 0 });
            order.push(key);
            continue;
        }
        bucket.ids.push(a.activityId);
        if (a.isRead === false) bucket.unread += 1;
        if (new Date(a.tsSent).getTime() > new Date(bucket.rep.tsSent).getTime()) {
            bucket.rep = a;
        }
    }
    return order.map((key) => {
        const bucket = byKey.get(key) as Bucket;
        return {
            ...bucket.rep,
            aggregatedCount: bucket.ids.length,
            aggregatedIds: bucket.ids,
            aggregatedUnreadCount: bucket.unread,
            isRead: bucket.unread === 0,
        };
    });
};

/**
 * Unread count for the Activity-tab badge, in AGGREGATED units: the
 * number of topics with at least one unread member. Keeps the badge
 * consistent with what the feed renders — 100 unread replies in one
 * thread are ONE unread feed row, so the badge says 1, and clearing
 * that row (which marks all members read) zeroes it. Drops the
 * synthetic thread-root placeholder the same way
 * `selectVisibleActivityMessages` does.
 */
export const countUnreadActivityTopics = (rows: ActivityMessageProps[]): number =>
    aggregateActivityMessages(
        rows.filter((a) => !(a.isThread === true && a.messageId === 1))
    ).reduce((acc, a) => (a.isRead === false ? acc + 1 : acc), 0);
