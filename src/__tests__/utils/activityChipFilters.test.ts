import { describe, expect, it } from "vitest";

import {
    ACTIVITY_PRIMARY_FILTERS,
    CHIP_PREDICATES,
    EMPTY_CHIP_SET,
    EMPTY_GROUP_ID_SET,
    EMPTY_INSTANCE_SET,
    isTaskCommentActivity,
    makeChipFilter,
    selectVisibleActivityMessages,
} from "../../features/chat/utils/activityChipFilters";
import { ActivityMessageProps } from "../../types/chat";

// Minimal fixture builder — the chip predicates only read a handful of
// fields, so cast a partial to the full props shape.
const mk = (over: Partial<ActivityMessageProps>): ActivityMessageProps =>
    ({
        activityType: 1,
        chatType: 1,
        chatId: 1,
        isThread: false,
        taskId: 0,
        isRead: false,
        ...over,
    }) as ActivityMessageProps;

// The shape that regressed both filters: a v3 task comment is a PM
// (chatType 3) thread reply with `isTaskComment` set and a taskId — NOT
// the legacy chatType-4 shape the old predicate assumed.
const v3TaskComment = mk({
    chatType: 3,
    isThread: true,
    isTaskComment: true,
    taskId: 42,
    projectName: "Kraken",
    activityType: 1,
});

// Legacy pre-v3 task comment (chatType 4 + taskId) — the fallback the
// `isTaskComment` flag replaced. Must still be recognised.
const legacyTaskComment = mk({
    chatType: 4,
    isThread: true,
    taskId: 42,
    activityType: 1,
});

describe("isTaskCommentActivity", () => {
    it("recognises v3 task comments via the isTaskComment flag", () => {
        expect(isTaskCommentActivity(v3TaskComment)).toBe(true);
    });

    it("recognises the legacy chatType-4 + taskId shape", () => {
        expect(isTaskCommentActivity(legacyTaskComment)).toBe(true);
    });

    it("does not flag an MDM (chatType 4 without a taskId)", () => {
        expect(isTaskCommentActivity(mk({ chatType: 4, taskId: 0 }))).toBe(false);
    });

    it("does not flag a plain PM message", () => {
        expect(isTaskCommentActivity(mk({ chatType: 3, isTaskComment: false }))).toBe(false);
    });
});

describe("CHIP_PREDICATES — a v3 task comment", () => {
    it("matches ONLY the Task Comment and Task categories", () => {
        // Bug #2: the dedicated filter now finds it.
        expect(CHIP_PREDICATES.taskComment(v3TaskComment)).toBe(true);
        // Already worked (taskId-based) and should keep working.
        expect(CHIP_PREDICATES.task(v3TaskComment)).toBe(true);
    });

    it("is NOT treated as Thread (bug #1)", () => {
        expect(CHIP_PREDICATES.thread(v3TaskComment)).toBe(false);
    });

    it("is NOT treated as Reply (bug #1)", () => {
        expect(CHIP_PREDICATES.reply(v3TaskComment)).toBe(false);
    });

    it("is NOT treated as PM (its surface chip is 'Task Comment', not 'PM')", () => {
        expect(CHIP_PREDICATES.pm(v3TaskComment)).toBe(false);
    });

    it("is NOT treated as DM", () => {
        expect(CHIP_PREDICATES.dm(v3TaskComment)).toBe(false);
    });
});

describe("CHIP_PREDICATES — regressions guard for non-task-comment rows", () => {
    it("a genuine DM thread reply is still a Thread and a Reply", () => {
        const dmThreadReply = mk({ chatType: 1, isThread: true, activityType: 1 });
        expect(CHIP_PREDICATES.thread(dmThreadReply)).toBe(true);
        expect(CHIP_PREDICATES.reply(dmThreadReply)).toBe(true);
        expect(CHIP_PREDICATES.taskComment(dmThreadReply)).toBe(false);
    });

    it("a plain PM message is still PM and Reply", () => {
        const pmMessage = mk({ chatType: 3, isThread: false, activityType: 1 });
        expect(CHIP_PREDICATES.pm(pmMessage)).toBe(true);
        expect(CHIP_PREDICATES.reply(pmMessage)).toBe(true);
        expect(CHIP_PREDICATES.taskComment(pmMessage)).toBe(false);
    });

    it("the legacy chatType-4 task comment is a Task Comment, not a Thread/Reply", () => {
        expect(CHIP_PREDICATES.taskComment(legacyTaskComment)).toBe(true);
        expect(CHIP_PREDICATES.thread(legacyTaskComment)).toBe(false);
        expect(CHIP_PREDICATES.reply(legacyTaskComment)).toBe(false);
    });
});

describe("ACTIVITY_PRIMARY_FILTERS — the primary 'Threads' button", () => {
    it("excludes task comments (type 1), so they don't show under Threads", () => {
        expect(ACTIVITY_PRIMARY_FILTERS[1](v3TaskComment)).toBe(false);
        expect(ACTIVITY_PRIMARY_FILTERS[1](legacyTaskComment)).toBe(false);
    });

    it("still includes a genuine thread reply", () => {
        expect(ACTIVITY_PRIMARY_FILTERS[1](mk({ chatType: 1, isThread: true }))).toBe(true);
    });

    it("still includes task comments under the primary 'Tasks' button (type 2)", () => {
        expect(ACTIVITY_PRIMARY_FILTERS[2](v3TaskComment)).toBe(true);
    });
});

describe("selectVisibleActivityMessages — primary 'Threads' filter end to end", () => {
    it("does not surface task comments when the Threads button is active", () => {
        const dmThreadReply = mk({ chatType: 1, isThread: true, messageId: 2 });
        const visible = selectVisibleActivityMessages(
            [v3TaskComment, dmThreadReply],
            1, // currentActivityMessageType = Threads
            EMPTY_CHIP_SET,
            EMPTY_INSTANCE_SET,
            EMPTY_GROUP_ID_SET,
            "me",
            false
        );
        // Rows come back aggregation-annotated (aggregatedIds etc.), so
        // match on content rather than strict equality.
        expect(visible).toHaveLength(1);
        expect(visible[0]).toMatchObject(dmThreadReply);
    });
});

describe("makeChipFilter — task comment via the Task Comment chip", () => {
    it("returns v3 task comments when the taskComment chip is selected", () => {
        const rows = [v3TaskComment, mk({ chatType: 1, activityType: 1 })];
        const filtered = rows.filter(makeChipFilter(new Set(["taskComment"])));
        expect(filtered).toEqual([v3TaskComment]);
    });

    it("does NOT return task comments under the Thread chip", () => {
        const rows = [v3TaskComment, mk({ chatType: 1, isThread: true })];
        const filtered = rows.filter(makeChipFilter(new Set(["thread"])));
        expect(filtered).not.toContain(v3TaskComment);
    });
});
