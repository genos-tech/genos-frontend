import { describe, expect, it } from "vitest";

import {
    buildComparator,
    buildTierComparator,
    sortTableTasks,
    SortTier,
} from "../features/tasks/utils/sortTask";
import { TaskTableProps } from "../types/tasks";

// Minimal row factory — the comparators only touch the sort fields, so
// the rest of the (large) TaskTableProps surface is irrelevant here.
const task = (props: Partial<TaskTableProps> & { id: string }): TaskTableProps =>
    props as unknown as TaskTableProps;

describe("buildTierComparator", () => {
    it("returns 0 when every tier ties, so callers can apply their own fallback", () => {
        // This is the contract the task table's milestone group depends
        // on: it falls back to its due-date rule only on a real tie.
        const cmp = buildTierComparator([{ field: "priority", direction: "desc" }]);
        expect(cmp(task({ id: "1", priority: "High" }), task({ id: "2", priority: "High" }))).toBe(
            0
        );
    });

    it("returns 0 for every pair when no tiers are configured", () => {
        const cmp = buildTierComparator([]);
        expect(
            cmp(task({ id: "1", priority: "Low" }), task({ id: "2", priority: "Critical" }))
        ).toBe(0);
    });

    it("ranks categorical fields semantically rather than alphabetically", () => {
        // "Normal" would beat "Low" under localeCompare; the rank map is
        // what makes Priority desc mean "Critical first".
        const cmp = buildTierComparator([{ field: "priority", direction: "desc" }]);
        expect(
            cmp(task({ id: "1", priority: "Critical" }), task({ id: "2", priority: "Low" }))
        ).toBeLessThan(0);
    });

    it("falls through to the second tier when the first ties", () => {
        const tiers: SortTier[] = [
            { field: "priority", direction: "desc" },
            { field: "title", direction: "asc" },
        ];
        const cmp = buildTierComparator(tiers);
        expect(
            cmp(
                task({ id: "1", priority: "High", title: "beta" }),
                task({ id: "2", priority: "High", title: "alpha" })
            )
        ).toBeGreaterThan(0);
    });

    it("sinks rows missing the sort value regardless of direction", () => {
        for (const direction of ["asc", "desc"] as const) {
            const cmp = buildTierComparator([{ field: "dueDate", direction }]);
            expect(
                cmp(task({ id: "1", dueDate: null }), task({ id: "2", dueDate: "2026-01-01" }))
            ).toBeGreaterThan(0);
        }
    });
});

describe("buildComparator", () => {
    it("tie-breaks on id so equal rows keep a deterministic order", () => {
        const cmp = buildComparator([{ field: "priority", direction: "desc" }]);
        expect(
            cmp(task({ id: "7", priority: "High" }), task({ id: "3", priority: "High" }))
        ).toBeGreaterThan(0);
    });

    it("orders an unsorted list by the configured tiers", () => {
        const rows = [
            task({ id: "1", priority: "Low" }),
            task({ id: "2", priority: "Critical" }),
            task({ id: "3", priority: "Normal" }),
        ];
        const sorted = [...rows].sort(buildComparator([{ field: "priority", direction: "desc" }]));
        expect(sorted.map((r) => r.id)).toEqual(["2", "3", "1"]);
    });

    it("sorts by id alone when no tiers are configured", () => {
        const rows = [task({ id: "3" }), task({ id: "1" }), task({ id: "2" })];
        const sorted = [...rows].sort(buildComparator([]));
        expect(sorted.map((r) => r.id)).toEqual(["1", "2", "3"]);
    });
});

describe("sortTableTasks", () => {
    const milestone = (props: Partial<TaskTableProps> & { id: string }) =>
        task({ ...props, isMilestone: true });

    it("orders milestones by the user's condition, not just the built-in due-date rule", () => {
        // The bug: milestones were pinned on top AND ordered by a
        // hardcoded daysLeft rule, so the top of the table never moved
        // however the user configured the sort.
        const rows = [
            milestone({ id: "1", priority: "Low", daysLeft: 1 }),
            milestone({ id: "2", priority: "Critical", daysLeft: 90 }),
        ];
        const sorted = sortTableTasks(rows, [{ field: "priority", direction: "desc" }]);
        expect(sorted.map((r) => r.id)).toEqual(["2", "1"]);
    });

    it("falls back to the due-date rule for milestones the tiers leave tied", () => {
        const rows = [
            milestone({ id: "1", priority: "High", daysLeft: 30 }),
            milestone({ id: "2", priority: "High", daysLeft: 2 }),
        ];
        const sorted = sortTableTasks(rows, [{ field: "priority", direction: "desc" }]);
        expect(sorted.map((r) => r.id)).toEqual(["2", "1"]);
    });

    it("keeps the built-in milestone rule as the whole ordering when no tier is set", () => {
        const rows = [
            milestone({ id: "1", daysLeft: 30 }),
            milestone({ id: "2", daysLeft: null }),
            milestone({ id: "3", daysLeft: 2 }),
        ];
        const sorted = sortTableTasks(rows, []);
        expect(sorted.map((r) => r.id)).toEqual(["3", "1", "2"]);
    });

    it("pins milestones above tasks even when a task wins on the sort field", () => {
        const rows = [
            task({ id: "1", priority: "Critical" }),
            milestone({ id: "2", priority: "Minimal", daysLeft: 5 }),
        ];
        const sorted = sortTableTasks(rows, [{ field: "priority", direction: "desc" }]);
        expect(sorted.map((r) => r.id)).toEqual(["2", "1"]);
    });

    it("applies the same ordering to a subtask group as to root rows", () => {
        // Subtask groups render straight out of `childrenByParent`, which
        // used to preserve raw `allTasks` order — parents reordered on a
        // sort change while every expanded child group sat still.
        const children = [
            task({ id: "1", parentTaskId: "9", priority: "Low" }),
            task({ id: "2", parentTaskId: "9", priority: "Critical" }),
            task({ id: "3", parentTaskId: "9", priority: "Normal" }),
        ];
        expect(
            sortTableTasks(children, [{ field: "priority", direction: "desc" }]).map((r) => r.id)
        ).toEqual(["2", "3", "1"]);
        expect(
            sortTableTasks(children, [{ field: "priority", direction: "asc" }]).map((r) => r.id)
        ).toEqual(["1", "3", "2"]);
    });

    it("does not mutate the input array", () => {
        const rows = [task({ id: "2", priority: "Low" }), task({ id: "1", priority: "Critical" })];
        sortTableTasks(rows, [{ field: "priority", direction: "desc" }]);
        expect(rows.map((r) => r.id)).toEqual(["2", "1"]);
    });
});
