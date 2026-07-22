/**
 * "Top by Weight" ordering (dashboard section F).
 *
 * The panel's shortlist is always the highest-weight active tasks; these
 * controls only reorder it. The tests pin that contract — every sort is a
 * permutation of the same rows — plus the two modes the panel now shares with
 * the My-Tasks "Up Next" list:
 *   - "weight": heaviest first, then soonest due (undated last), then status.
 *   - "urgency": overdue first, then priority, then soonest due, then recent.
 */

import { describe, expect, it } from "vitest";

import { compareByUrgency, sortTopWeightRows } from "../features/tasks/utils/topWeightSort";

// Noon UTC on 2026-07-23: due dates a day or more away land unambiguously
// before/after it regardless of the local timezone the test runs in.
const TODAY_MS = new Date("2026-07-23T12:00:00Z").getTime();

const row = (
    id: string,
    weight: number,
    dueDate: string | null,
    effectiveStatus = "Open",
    priority: string | null = null,
    updatedAt: string | null = null
) => ({
    id,
    weight,
    task: { dueDate, effectiveStatus, priority, updatedAt },
});

const ids = (sorted: { id: string }[]) => sorted.map((r) => r.id);

describe("sortTopWeightRows — By weight", () => {
    // Deliberately mixed: weights out of order, one undated task, four statuses.
    const rows = [
        row("a", 25, "2026-07-20", "WIP"),
        row("b", 12, "2026-07-28", "Open"),
        row("c", 20, null, "Blocked"),
        row("d", 12, "2026-07-22", "Pending"),
    ];

    it("reorders without adding or dropping rows, and doesn't mutate the input", () => {
        const before = [...rows];
        for (const mode of ["weight", "urgency"] as const) {
            const out = sortTopWeightRows(rows, mode, TODAY_MS);
            expect(ids(out).slice().sort()).toEqual(["a", "b", "c", "d"]);
        }
        expect(rows).toEqual(before);
    });

    it("orders heaviest first, then soonest due date within a weight tie", () => {
        // a(25), c(20), then b & d tie at 12 → due date breaks the tie:
        // d (07-22) before b (07-28).
        expect(ids(sortTopWeightRows(rows, "weight", TODAY_MS))).toEqual(["a", "c", "d", "b"]);
    });

    it("keeps undated tasks last within a weight tie", () => {
        const tie = [row("dated", 12, "2026-07-25"), row("undated", 12, null)];
        expect(ids(sortTopWeightRows(tie, "weight", TODAY_MS))).toEqual(["dated", "undated"]);
    });

    it("treats an unparseable due date as undated", () => {
        const tie = [row("broken", 12, "not-a-date"), row("dated", 12, "2026-07-25")];
        expect(ids(sortTopWeightRows(tie, "weight", TODAY_MS))).toEqual(["dated", "broken"]);
    });

    it("breaks weight+due ties by status rank (Open → WIP → Blocked → Pending)", () => {
        const tie = [
            row("pending", 12, "2026-07-25", "Pending"),
            row("open", 12, "2026-07-25", "Open"),
            row("wip", 12, "2026-07-25", "WIP"),
        ];
        expect(ids(sortTopWeightRows(tie, "weight", TODAY_MS))).toEqual([
            "open",
            "wip",
            "pending",
        ]);
    });
});

describe("sortTopWeightRows — By urgency", () => {
    it("puts overdue tasks first (most overdue first), then priority, then soonest due", () => {
        const rows = [
            row("fut2", 30, "2026-07-30", "Open", "Normal"),
            row("over2", 5, "2026-07-20", "Open", "Critical"),
            row("undated", 40, null, "Open", "High"),
            row("over1", 5, "2026-07-18", "Open", "Normal"),
            row("fut1", 30, "2026-07-25", "Open", "Critical"),
        ];
        // Overdue first, earliest-due (most overdue) leading: over1, over2.
        // Then non-overdue by priority: fut1 (Critical), undated (High),
        // fut2 (Normal).
        expect(ids(sortTopWeightRows(rows, "urgency", TODAY_MS))).toEqual([
            "over1",
            "over2",
            "fut1",
            "undated",
            "fut2",
        ]);
    });

    it("falls back to heaviest-first when the urgency rule can't separate two rows", () => {
        const rows = [
            row("light", 10, null, "Open", "Normal", "2026-07-01"),
            row("heavy", 20, null, "Open", "Normal", "2026-07-01"),
        ];
        expect(ids(sortTopWeightRows(rows, "urgency", TODAY_MS))).toEqual(["heavy", "light"]);
    });
});

describe("compareByUrgency", () => {
    it("orders an overdue task ahead of a future one", () => {
        const overdue = { dueDate: "2026-07-20", effectiveStatus: "Open" };
        const future = { dueDate: "2026-07-30", effectiveStatus: "Open" };
        expect(compareByUrgency(overdue, future, TODAY_MS)).toBeLessThan(0);
        expect(compareByUrgency(future, overdue, TODAY_MS)).toBeGreaterThan(0);
    });
});
