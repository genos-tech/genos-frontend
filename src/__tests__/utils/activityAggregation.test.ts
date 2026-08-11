/**
 * Same-topic activity aggregation.
 *
 * A 100-reply burst in one thread must land as ONE sidebar row (the
 * latest), with the collapsed members recoverable via `aggregatedIds`
 * so the mark-read paths can clear the whole run. Topics partition by
 * activity type + surface (thread / task comments / note / reacted
 * message / channel) — a mention must never hide behind a plain reply.
 *
 * Each topic is split by READ-STATE: all UNREAD members collapse to a
 * single "while you were away" row regardless of age, while READ history
 * is bounded by a TIME WINDOW (buckets anchored at their newest member)
 * so a topic read over weeks yields one row per window, never a single
 * "+800 earlier" row for its whole history.
 */

import { describe, expect, it } from "vitest";

import {
    activityTopicKey,
    aggregateActivityMessages,
    countUnreadActivityTopics,
} from "../../features/chat/utils/activityAggregation";
import {
    EMPTY_CHIP_SET,
    EMPTY_GROUP_ID_SET,
    EMPTY_INSTANCE_SET,
    selectVisibleActivityMessages,
} from "../../features/chat/utils/activityChipFilters";
import { ActivityMessageProps } from "../../types/chat";

let seq = 0;
const mk = (over: Partial<ActivityMessageProps>): ActivityMessageProps =>
    ({
        activityId: `a-${++seq}`,
        activityType: 1,
        chatType: 1,
        chatId: "ch-1",
        threadId: "",
        isThread: false,
        taskId: 0,
        messageId: 2,
        messageUniqueKey: `m-${seq}`,
        isRead: false,
        tsSent: "2026-07-14 10:00:00",
        ...over,
    }) as unknown as ActivityMessageProps;

const threadReply = (over: Partial<ActivityMessageProps> = {}) =>
    mk({ isThread: true, threadId: "th-1" as unknown as number, ...over });

// A READ thread reply. The time window governs the READ partition only
// (unread collapses to one bucket regardless of age), so window tests
// operate on read members.
const readReply = (over: Partial<ActivityMessageProps> = {}) =>
    threadReply({ isRead: true, ...over });

describe("activityTopicKey — topic partitioning", () => {
    it("groups replies in the same thread; separates other threads", () => {
        const a = threadReply();
        const b = threadReply();
        const other = threadReply({ threadId: "th-2" as unknown as number });
        expect(activityTopicKey(a)).toBe(activityTopicKey(b));
        expect(activityTopicKey(a)).not.toBe(activityTopicKey(other));
    });

    it("keeps a mention and a reply in the same thread apart", () => {
        const reply = threadReply({ activityType: 1 });
        const mention = threadReply({ activityType: 3 });
        expect(activityTopicKey(reply)).not.toBe(activityTopicKey(mention));
    });

    it("groups v3 task comments by task, not by thread root", () => {
        const c1 = mk({ chatType: 3, isThread: true, isTaskComment: true, taskId: 42 });
        const c2 = mk({
            chatType: 3,
            isThread: true,
            isTaskComment: true,
            taskId: 42,
            threadId: "different" as unknown as number,
        });
        const otherTask = mk({ chatType: 3, isThread: true, isTaskComment: true, taskId: 43 });
        expect(activityTopicKey(c1)).toBe(activityTopicKey(c2));
        expect(activityTopicKey(c1)).not.toBe(activityTopicKey(otherTask));
    });

    it("groups note mentions by note; task-body mentions by task", () => {
        const n1 = mk({ chatType: 7, chatId: 9 as unknown as number, activityType: 3 });
        const n2 = mk({ chatType: 7, chatId: 9 as unknown as number, activityType: 3 });
        const otherNote = mk({ chatType: 7, chatId: 10 as unknown as number, activityType: 3 });
        expect(activityTopicKey(n1)).toBe(activityTopicKey(n2));
        expect(activityTopicKey(n1)).not.toBe(activityTopicKey(otherNote));

        const tb1 = mk({ chatType: 5, taskId: 42, activityType: 3 });
        const tb2 = mk({ chatType: 5, taskId: 42, activityType: 3 });
        expect(activityTopicKey(tb1)).toBe(activityTopicKey(tb2));
    });

    it("groups reactions by the reacted-to message", () => {
        const r1 = mk({ activityType: 2, messageUniqueKey: "msg-1" });
        const r2 = mk({ activityType: 2, messageUniqueKey: "msg-1" });
        const otherMsg = mk({ activityType: 2, messageUniqueKey: "msg-2" });
        expect(activityTopicKey(r1)).toBe(activityTopicKey(r2));
        expect(activityTopicKey(r1)).not.toBe(activityTopicKey(otherMsg));
    });

    it("groups main-pane messages by channel", () => {
        const m1 = mk({ chatId: "ch-1" as unknown as number });
        const m2 = mk({ chatId: "ch-1" as unknown as number });
        const otherChannel = mk({ chatId: "ch-2" as unknown as number });
        expect(activityTopicKey(m1)).toBe(activityTopicKey(m2));
        expect(activityTopicKey(m1)).not.toBe(activityTopicKey(otherChannel));
    });
});

describe("aggregateActivityMessages", () => {
    it("collapses a same-topic run to its latest row, keeping member ids", () => {
        const latest = threadReply({ tsSent: "2026-07-14 12:00:00" });
        const mid = threadReply({ tsSent: "2026-07-14 11:00:00" });
        const oldest = threadReply({ tsSent: "2026-07-14 10:00:00" });
        const rows = aggregateActivityMessages([latest, mid, oldest]);
        expect(rows).toHaveLength(1);
        expect(rows[0].activityId).toBe(latest.activityId);
        expect(rows[0].aggregatedCount).toBe(3);
        expect(rows[0].aggregatedIds).toEqual([
            latest.activityId,
            mid.activityId,
            oldest.activityId,
        ]);
    });

    it("picks the latest by tsSent even if the input isn't sorted", () => {
        const older = threadReply({ tsSent: "2026-07-14 10:00:00" });
        const newer = threadReply({ tsSent: "2026-07-14 12:00:00" });
        const rows = aggregateActivityMessages([older, newer]);
        expect(rows[0].activityId).toBe(newer.activityId);
    });

    it("splits a topic into a read row and an unread row (never mixed)", () => {
        const latestRead = threadReply({ tsSent: "2026-07-14 12:00:00", isRead: true });
        const olderUnread = threadReply({ tsSent: "2026-07-14 10:00:00", isRead: false });
        const rows = aggregateActivityMessages([latestRead, olderUnread]);
        // Read-state partition: the read member and the unread member land
        // in separate buckets — a row is never a read/unread mix. Feed
        // order is newest-rep-first, so the read row (12:00) sorts ahead
        // of the unread row (10:00).
        expect(rows).toHaveLength(2);
        const [readRow, unreadRow] = rows;
        expect(readRow.activityId).toBe(latestRead.activityId);
        expect(readRow.isRead).toBe(true);
        expect(readRow.aggregatedUnreadCount).toBe(0);
        expect(unreadRow.activityId).toBe(olderUnread.activityId);
        expect(unreadRow.isRead).toBe(false);
        expect(unreadRow.aggregatedUnreadCount).toBe(1);
        // The stored rows are untouched — display-only annotation.
        expect(latestRead.isRead).toBe(true);
        expect((latestRead as { aggregatedIds?: string[] }).aggregatedIds).toBeUndefined();
    });

    it("collapses ALL unread members of a topic into one row, ignoring the window", () => {
        // The "while you were away" bucket: unread replies spanning days
        // must NOT fragment by the 24h window the way read history does.
        const u1 = threadReply({ tsSent: "2026-07-14 12:00:00", isRead: false });
        const u2 = threadReply({ tsSent: "2026-07-11 12:00:00", isRead: false });
        const u3 = threadReply({ tsSent: "2026-07-07 12:00:00", isRead: false });
        const rows = aggregateActivityMessages([u1, u2, u3]);
        expect(rows).toHaveLength(1);
        expect(rows[0].activityId).toBe(u1.activityId);
        expect(rows[0].aggregatedCount).toBe(3);
        expect(rows[0].isRead).toBe(false);
        expect(rows[0].aggregatedUnreadCount).toBe(3);
    });

    it("keeps distinct topics as distinct rows in feed order", () => {
        const t1 = threadReply({ tsSent: "2026-07-14 12:00:00" });
        const other = threadReply({
            threadId: "th-2" as unknown as number,
            tsSent: "2026-07-14 11:30:00",
        });
        const t1old = threadReply({ tsSent: "2026-07-14 11:00:00" });
        const rows = aggregateActivityMessages([t1, other, t1old]);
        expect(rows.map((r) => r.activityId)).toEqual([t1.activityId, other.activityId]);
    });

    it("does NOT collapse same-topic READ history across the time window", () => {
        const today = readReply({ tsSent: "2026-07-14 12:00:00" });
        const lastWeek = readReply({ tsSent: "2026-07-07 12:00:00" });
        const rows = aggregateActivityMessages([today, lastWeek]);
        expect(rows).toHaveLength(2);
        expect(rows[0].activityId).toBe(today.activityId);
        expect(rows[0].aggregatedIds).toEqual([today.activityId]);
        expect(rows[1].activityId).toBe(lastWeek.activityId);
        expect(rows[1].aggregatedIds).toEqual([lastWeek.activityId]);
    });

    it("anchors each READ bucket at its newest member (chained, not calendar days)", () => {
        // 23h gap joins the newest bucket; the next 23h-older row is
        // >24h from THAT bucket's anchor, so it starts a second bucket.
        const newest = readReply({ tsSent: "2026-07-14 12:00:00" });
        const within = readReply({ tsSent: "2026-07-13 13:00:00" });
        const beyond = readReply({ tsSent: "2026-07-12 14:00:00" });
        const rows = aggregateActivityMessages([newest, within, beyond]);
        expect(rows).toHaveLength(2);
        expect(rows[0].aggregatedIds).toEqual([newest.activityId, within.activityId]);
        expect(rows[1].aggregatedIds).toEqual([beyond.activityId]);
    });

    it("interleaves an older READ bucket at its chronological feed position", () => {
        const t1today = readReply({ tsSent: "2026-07-14 12:00:00" });
        const otherTopic = readReply({
            threadId: "th-2" as unknown as number,
            tsSent: "2026-07-10 12:00:00",
        });
        const t1lastWeek = readReply({ tsSent: "2026-07-07 12:00:00" });
        const rows = aggregateActivityMessages([t1today, otherTopic, t1lastWeek]);
        expect(rows.map((r) => r.activityId)).toEqual([
            t1today.activityId,
            otherTopic.activityId,
            t1lastWeek.activityId,
        ]);
    });

    it("respects a custom window size (read history)", () => {
        const a = readReply({ tsSent: "2026-07-14 12:00:00" });
        const b = readReply({ tsSent: "2026-07-14 11:00:00" });
        const oneHalfHourMs = 90 * 60 * 1000;
        const thirtyMinMs = 30 * 60 * 1000;
        expect(aggregateActivityMessages([a, b], oneHalfHourMs)).toHaveLength(1);
        expect(aggregateActivityMessages([a, b], thirtyMinMs)).toHaveLength(2);
    });
});

describe("countUnreadActivityTopics — badge units", () => {
    it("counts unread TOPICS, not unread rows", () => {
        const burst = Array.from({ length: 100 }, () => threadReply({ isRead: false }));
        const otherTopic = mk({ chatId: "ch-9" as unknown as number, isRead: false });
        const readTopic = mk({ chatId: "ch-8" as unknown as number, isRead: true });
        expect(countUnreadActivityTopics([...burst, otherTopic, readTopic])).toBe(2);
    });

    it("ignores the synthetic thread-root placeholder", () => {
        const placeholder = mk({ isThread: true, messageId: 1, isRead: false });
        expect(countUnreadActivityTopics([placeholder])).toBe(0);
    });
});

describe("selectVisibleActivityMessages — aggregation end to end", () => {
    it("renders one row per topic (the latest), after filters", () => {
        const latest = threadReply({ tsSent: "2026-07-14 12:00:00" });
        const older = threadReply({ tsSent: "2026-07-14 11:00:00" });
        const otherTopic = mk({ chatId: "ch-9" as unknown as number });
        const visible = selectVisibleActivityMessages(
            [latest, older, otherTopic],
            0,
            EMPTY_CHIP_SET,
            EMPTY_INSTANCE_SET,
            EMPTY_GROUP_ID_SET,
            "me",
            false
        );
        expect(visible.map((v) => v.activityId)).toEqual([
            latest.activityId,
            otherTopic.activityId,
        ]);
        expect(visible[0].aggregatedIds).toEqual([latest.activityId, older.activityId]);
    });

    it("'unread only' surfaces the unread bucket of a partially-read topic", () => {
        // Read-state partition: the read latest and the unread older
        // member split into two rows. The "unread only" toggle keeps the
        // unread bucket (repped by its own newest member) and drops the
        // read history row.
        const latestRead = threadReply({ tsSent: "2026-07-14 12:00:00", isRead: true });
        const olderUnread = threadReply({ tsSent: "2026-07-14 10:00:00", isRead: false });
        const visible = selectVisibleActivityMessages(
            [latestRead, olderUnread],
            0,
            EMPTY_CHIP_SET,
            EMPTY_INSTANCE_SET,
            EMPTY_GROUP_ID_SET,
            "me",
            true
        );
        expect(visible).toHaveLength(1);
        expect(visible[0].activityId).toBe(olderUnread.activityId);
        expect(visible[0].isRead).toBe(false);
        expect(visible[0].aggregatedUnreadCount).toBe(1);
    });

    it("full feed keeps read history alongside the unread bucket", () => {
        // A DM read in waves: some unread scattered through a day of read
        // messages. The full feed (unread toggle off) shows BOTH the
        // unread "while you were away" row and the read history row, so a
        // read topic stays findable.
        const readA = mk({ tsSent: "2026-07-14 09:00:00", isRead: true });
        const unread = mk({ tsSent: "2026-07-14 10:00:00", isRead: false });
        const readB = mk({ tsSent: "2026-07-14 11:00:00", isRead: true });
        const visible = selectVisibleActivityMessages(
            [readA, unread, readB],
            0,
            EMPTY_CHIP_SET,
            EMPTY_INSTANCE_SET,
            EMPTY_GROUP_ID_SET,
            "me",
            false
        );
        expect(visible).toHaveLength(2);
        const unreadRow = visible.find((v) => v.isRead === false);
        const readRow = visible.find((v) => v.isRead === true);
        expect(unreadRow?.aggregatedIds).toEqual([unread.activityId]);
        // The two read members (same day, one topic) collapse together.
        expect(readRow?.aggregatedCount).toBe(2);
        expect(readRow?.aggregatedIds).toEqual([readB.activityId, readA.activityId]);
    });
});
