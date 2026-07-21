/**
 * "Top by Weight" ordering (dashboard section F).
 *
 * The panel's shortlist is always the highest-weight active tasks; these
 * controls only reorder it. The tests pin that contract — every sort is a
 * permutation of the same rows — plus the two rules that aren't obvious:
 * undated tasks never float to the top when the arrow flips, and ties fall
 * back to the panel's own weight ranking.
 */

import { describe, expect, it } from "vitest";

import {
    nextTopWeightSort,
    sortTopWeightRows,
    TOP_WEIGHT_DEFAULT_DIR,
} from "../features/tasks/utils/topWeightSort";

const row = (id: string, weight: number, dueDate: string | null, effectiveStatus = "Open") => ({
    id,
    weight,
    task: { dueDate, effectiveStatus },
});

// Deliberately mixed: weights out of order, one undated task, four statuses.
const rows = [
    row("a", 25, "2026-07-20", "WIP"),
    row("b", 12, "2026-07-28", "Open"),
    row("c", 20, null, "Blocked"),
    row("d", 12, "2026-07-22", "Pending"),
];
const ids = (sorted: { id: string }[]) => sorted.map((r) => r.id);

describe("nextTopWeightSort", () => {
    it("flips direction when the active field is picked again", () => {
        expect(nextTopWeightSort({ field: "weight", dir: "desc" }, "weight")).toEqual({
            field: "weight",
            dir: "asc",
        });
        expect(nextTopWeightSort({ field: "weight", dir: "asc" }, "weight")).toEqual({
            field: "weight",
            dir: "desc",
        });
    });

    it("starts a newly picked field on its default direction", () => {
        // Switching away and back must not inherit the previous field's
        // direction — due date opens latest-first however weight was left.
        expect(nextTopWeightSort({ field: "weight", dir: "asc" }, "dueDate")).toEqual({
            field: "dueDate",
            dir: TOP_WEIGHT_DEFAULT_DIR.dueDate,
        });
        expect(nextTopWeightSort({ field: "dueDate", dir: "asc" }, "status")).toEqual({
            field: "status",
            dir: TOP_WEIGHT_DEFAULT_DIR.status,
        });
    });
});

describe("sortTopWeightRows", () => {
    it("reorders without adding or dropping rows, and doesn't mutate the input", () => {
        const before = [...rows];
        for (const field of ["weight", "dueDate", "status"] as const) {
            for (const dir of ["asc", "desc"] as const) {
                const out = sortTopWeightRows(rows, { field, dir });
                expect(ids(out).slice().sort()).toEqual(["a", "b", "c", "d"]);
            }
        }
        expect(rows).toEqual(before);
    });

    it("orders by weight in both directions", () => {
        expect(ids(sortTopWeightRows(rows, { field: "weight", dir: "desc" }))).toEqual([
            "a",
            "c",
            "b",
            "d",
        ]);
        // b and d tie at 12 — the heaviest-first fallback can't separate
        // them, so they keep their relative order.
        expect(ids(sortTopWeightRows(rows, { field: "weight", dir: "asc" }))).toEqual([
            "b",
            "d",
            "c",
            "a",
        ]);
    });

    it("orders by due date, keeping undated tasks last in BOTH directions", () => {
        // desc = latest deadline first (the requested default).
        expect(ids(sortTopWeightRows(rows, { field: "dueDate", dir: "desc" }))).toEqual([
            "b",
            "d",
            "a",
            "c",
        ]);
        // Flipping to soonest-first must not hoist the undated task.
        expect(ids(sortTopWeightRows(rows, { field: "dueDate", dir: "asc" }))).toEqual([
            "a",
            "d",
            "b",
            "c",
        ]);
    });

    it("treats an unparseable due date as undated", () => {
        const broken = [row("x", 5, "not-a-date"), row("y", 5, "2026-07-25")];
        expect(ids(sortTopWeightRows(broken, { field: "dueDate", dir: "desc" }))).toEqual([
            "y",
            "x",
        ]);
    });

    it("orders by status rank, not alphabetically", () => {
        // Open → WIP → Blocked → Pending.
        expect(ids(sortTopWeightRows(rows, { field: "status", dir: "asc" }))).toEqual([
            "b",
            "a",
            "c",
            "d",
        ]);
        expect(ids(sortTopWeightRows(rows, { field: "status", dir: "desc" }))).toEqual([
            "d",
            "c",
            "a",
            "b",
        ]);
    });

    it("breaks ties by weight so the panel's ranking still shows through", () => {
        const sameDay = [
            row("light", 4, "2026-07-20"),
            row("heavy", 25, "2026-07-20"),
            row("mid", 12, "2026-07-20"),
        ];
        expect(ids(sortTopWeightRows(sameDay, { field: "dueDate", dir: "asc" }))).toEqual([
            "heavy",
            "mid",
            "light",
        ]);
    });
});
