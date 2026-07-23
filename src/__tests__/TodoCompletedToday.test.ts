import { describe, expect, it } from "vitest";

import {
    countCompletedToday,
    formatCompletedAt,
    isCompletedToday,
    localDateOf,
    selectCompletedToday,
} from "../features/chat/utils/todoCompletion";
import { TodoGroupProps, TodoItemProps } from "../types/chat";

const item = (over: Partial<TodoItemProps>): TodoItemProps =>
    ({
        itemId: 1,
        title: "t",
        isCompleted: false,
        tsCompletedAt: null,
        ...over,
    }) as unknown as TodoItemProps;

const group = (localDate: string, items: TodoItemProps[]): TodoGroupProps =>
    ({ groupId: 1, localDate, isCompleted: false, items }) as unknown as TodoGroupProps;

// Local-midnight ISO strings for "today" and "yesterday" in whatever
// timezone the test runs in — the whole point is that the day boundary
// is the VIEWER's, not UTC's.
const at = (dayOffset: number, hour: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, 30, 0, 0);
    return d.toISOString();
};
const today = localDateOf(at(0, 12))!;

describe("isCompletedToday", () => {
    it("accepts an item completed today", () => {
        expect(isCompletedToday(item({ isCompleted: true, tsCompletedAt: at(0, 9) }), today)).toBe(
            true
        );
    });

    it("rejects an item completed yesterday", () => {
        expect(
            isCompletedToday(item({ isCompleted: true, tsCompletedAt: at(-1, 9) }), today)
        ).toBe(false);
    });

    it("rejects an incomplete item", () => {
        expect(isCompletedToday(item({ isCompleted: false, tsCompletedAt: null }), today)).toBe(
            false
        );
    });

    it("rejects a legacy completed item with no timestamp", () => {
        // Completed before `ts_completed_at` shipped: it can't be
        // attributed to a day, so it must not be guessed into today.
        expect(isCompletedToday(item({ isCompleted: true, tsCompletedAt: null }), today)).toBe(
            false
        );
    });

    it("uses LOCAL time, not UTC, for the day boundary", () => {
        // 00:30 and 23:30 local today are both "today" to the viewer even
        // though at least one of them falls on a different UTC date for
        // most of the world.
        expect(isCompletedToday(item({ isCompleted: true, tsCompletedAt: at(0, 0) }), today)).toBe(
            true
        );
        expect(
            isCompletedToday(item({ isCompleted: true, tsCompletedAt: at(0, 23) }), today)
        ).toBe(true);
    });
});

describe("selectCompletedToday", () => {
    it("keeps only today's completions and drops emptied groups", () => {
        // The old group is the case that matters: finishing today a task
        // you planned last week must still show up, and its GROUP date is
        // last week's — so the filter has to key on the completion
        // timestamp, not the group.
        const groups = [
            group("2020-01-01", [
                item({ itemId: 1, isCompleted: true, tsCompletedAt: at(0, 10) }),
                item({ itemId: 2, isCompleted: true, tsCompletedAt: at(-1, 10) }),
            ]),
            group("2020-01-02", [item({ itemId: 3, isCompleted: false })]),
        ];

        const result = selectCompletedToday(groups, today);
        expect(result).toHaveLength(1);
        expect(result[0].items.map((i) => i.itemId)).toEqual([1]);
    });

    it("returns nothing when today has no completions", () => {
        const groups = [group("2020-01-01", [item({ itemId: 1, isCompleted: false })])];
        expect(selectCompletedToday(groups, today)).toEqual([]);
    });

    it("does not mutate the input groups", () => {
        const groups = [
            group("2020-01-01", [
                item({ itemId: 1, isCompleted: true, tsCompletedAt: at(0, 10) }),
                item({ itemId: 2, isCompleted: false }),
            ]),
        ];
        selectCompletedToday(groups, today);
        expect(groups[0].items).toHaveLength(2);
    });
});

describe("countCompletedToday", () => {
    it("counts across every group", () => {
        const groups = [
            group("2020-01-01", [
                item({ itemId: 1, isCompleted: true, tsCompletedAt: at(0, 10) }),
                item({ itemId: 2, isCompleted: true, tsCompletedAt: at(-1, 10) }),
            ]),
            group("2020-01-02", [
                item({ itemId: 3, isCompleted: true, tsCompletedAt: at(0, 11) }),
            ]),
        ];
        expect(countCompletedToday(groups, today)).toBe(2);
    });
});

describe("formatCompletedAt", () => {
    // Date AND time: on the All tab a group's date is when the work was
    // PLANNED, so a bare clock time has nothing to anchor it to when an
    // item was ticked off days later.
    it("renders the local date followed by a zero-padded 24h HH:mm", () => {
        const d = new Date();
        d.setMonth(6, 23); // July 23 — month is 0-indexed
        d.setHours(9, 5, 0, 0);

        const out = formatCompletedAt(d.toISOString());
        const expectedDate = d.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
        });
        expect(out).toBe(`${expectedDate} 09:05`);
        // The time half stays fixed-width 24h so the stamp keeps its
        // `tabular-nums` alignment down the column — a locale clock would
        // swing between "14:05" and "2:05 PM".
        expect(out.endsWith(" 09:05")).toBe(true);
    });

    it("keeps the 24h clock past noon", () => {
        const d = new Date();
        d.setHours(14, 30, 0, 0);
        expect(formatCompletedAt(d.toISOString()).endsWith(" 14:30")).toBe(true);
    });

    it("returns empty string for an unparseable timestamp", () => {
        expect(formatCompletedAt("not-a-date")).toBe("");
    });
});
