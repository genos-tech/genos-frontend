/**
 * Same-topic activity aggregation.
 *
 * A 100-reply burst in one thread must land as ONE sidebar row (the
 * latest), with the collapsed members recoverable via `aggregatedIds`
 * so the mark-read paths can clear the whole run. Topics partition by
 * activity type + surface (thread / task comments / note / reacted
 * message / channel) — a mention must never hide behind a plain reply.
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

    it("effective isRead is false while ANY member is unread", () => {
        const latestRead = threadReply({ tsSent: "2026-07-14 12:00:00", isRead: true });
        const olderUnread = threadReply({ tsSent: "2026-07-14 10:00:00", isRead: false });
        const rows = aggregateActivityMessages([latestRead, olderUnread]);
        expect(rows[0].isRead).toBe(false);
        expect(rows[0].aggregatedUnreadCount).toBe(1);
        // The stored rows are untouched — display-only annotation.
        expect(latestRead.isRead).toBe(true);
        expect((latestRead as { aggregatedIds?: string[] }).aggregatedIds).toBeUndefined();
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

    it("'unread only' keeps a topic whose latest row is read but has unread members", () => {
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
        expect(visible[0].activityId).toBe(latestRead.activityId);
        expect(visible[0].isRead).toBe(false);
    });
});
