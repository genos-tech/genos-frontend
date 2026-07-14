import { ActivityMessageProps } from "../../../types/chat";

// ---------------------------------------------------------------------
// Same-topic activity aggregation
// ---------------------------------------------------------------------
// A burst of activity on one "topic" (a thread someone replies to 100
// times while you're offline, a task that collects a dozen comments, a
// note edited by a mention-happy teammate) used to land as one sidebar
// row PER activity, burying everything else in the feed. The feed only
// needs the LATEST row per topic per time window (see
// `ACTIVITY_AGGREGATION_WINDOW_MS`); the earlier ones carry no extra
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
 * first member seen).
 *
 * TIME WINDOW: a topic is not collapsed across its whole history — a
 * thread that's active for weeks must not compress into a single
 * "+800 earlier" row (the IDB store retains 30 days). Members chain
 * into buckets anchored at each bucket's NEWEST member: walking a
 * topic newest→oldest, an activity joins the current bucket while it's
 * within `windowMs` of that bucket's newest member; anything older
 * starts a new bucket anchored at itself. So a burst collapses to one
 * row regardless of clock boundaries, while a continuously-active
 * topic yields roughly one row per window of activity. Rows for older
 * buckets keep their own `aggregatedIds` / unread state, so mark-read
 * stays scoped to the bucket the user actually clicked.
 *
 * Output is feed-ordered (newest representative first).
 *
 * Pure; input rows are not mutated (representatives are copies).
 */
export const ACTIVITY_AGGREGATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export const aggregateActivityMessages = (
    rows: ActivityMessageProps[],
    windowMs: number = ACTIVITY_AGGREGATION_WINDOW_MS
): AggregatedActivityMessage[] => {
    const byKey = new Map<string, ActivityMessageProps[]>();
    for (const a of rows) {
        const key = activityTopicKey(a);
        const members = byKey.get(key);
        if (members) members.push(a);
        else byKey.set(key, [a]);
    }

    const out: AggregatedActivityMessage[] = [];
    for (const members of byKey.values()) {
        // Newest first (defensive — the feed already arrives sorted
        // desc; stable sort keeps input order on ties).
        const sorted = [...members].sort(
            (x, y) => new Date(y.tsSent).getTime() - new Date(x.tsSent).getTime()
        );
        let bucket: ActivityMessageProps[] = [];
        let anchorTs = 0;
        const flush = () => {
            if (bucket.length === 0) return;
            const rep = bucket[0];
            const unread = bucket.reduce((n, a) => (a.isRead === false ? n + 1 : n), 0);
            out.push({
                ...rep,
                aggregatedCount: bucket.length,
                aggregatedIds: bucket.map((a) => a.activityId),
                aggregatedUnreadCount: unread,
                isRead: unread === 0,
            });
        };
        for (const a of sorted) {
            const ts = new Date(a.tsSent).getTime();
            // NaN timestamps fail the `>` check and fall into the open
            // bucket rather than fragmenting the topic.
            if (bucket.length === 0 || anchorTs - ts > windowMs) {
                flush();
                bucket = [a];
                anchorTs = ts;
            } else {
                bucket.push(a);
            }
        }
        flush();
    }

    // Feed order: newest representative first. Buckets from different
    // topics (and older buckets of the same topic) interleave at their
    // natural chronological position.
    return out.sort((x, y) => new Date(y.tsSent).getTime() - new Date(x.tsSent).getTime());
};

/**
 * Unread count for the Activity-tab badge, in AGGREGATED units: the
 * number of topic BUCKETS (topic × time window) with at least one
 * unread member. Keeps the badge consistent with what the feed
 * renders — 100 unread replies in one thread are ONE unread feed row,
 * so the badge says 1, and clearing that row (which marks all members
 * read) zeroes it. Drops the synthetic thread-root placeholder the
 * same way `selectVisibleActivityMessages` does.
 */
export const countUnreadActivityTopics = (rows: ActivityMessageProps[]): number =>
    aggregateActivityMessages(
        rows.filter((a) => !(a.isThread === true && a.messageId === 1))
    ).reduce((acc, a) => (a.isRead === false ? acc + 1 : acc), 0);
