/**
 * The optimistic half of "moving a task moves its sub-tree".
 *
 * The server cascades milestone / sprint / root to every descendant, but
 * the drag path updates local state itself and doesn't refetch the
 * project. Milestone-scoped views filter on `milestoneId`, so a
 * descendant left on the old milestone disappears from under its own
 * parent — the tree looks broken until something forces a reload.
 */
import { describe, expect, it } from "vitest";

import {
    applyTreePositionToDescendants,
    collectDescendantIds,
} from "../features/tasks/utils/cascadeTreePosition";

type Row = {
    id: string;
    parentTaskId: string | null;
    milestoneId: number | null;
    sprintId: number | null;
    rootTaskId: number | null;
};

const row = (id: number, parentTaskId: number | null): Row => ({
    id: String(id),
    parentTaskId: parentTaskId == null ? null : String(parentTaskId),
    milestoneId: 10,
    sprintId: 100,
    rootTaskId: 1,
});

// Milestone backing 1 → task 2 → sub 3 → sub-sub 4, and sibling 5 under 2.
const TREE: Row[] = [row(1, null), row(2, 1), row(3, 2), row(4, 3), row(5, 2)];

const TARGET = { milestoneId: 20, sprintId: 200, rootTaskId: 9 };

const sorted = (ids: Set<string>): number[] => [...ids].map(Number).sort((a, b) => a - b);

describe("collectDescendantIds", () => {
    it("reaches every level below the moved task, not just direct children", () => {
        expect(sorted(collectDescendantIds(TREE, 2))).toEqual([3, 4, 5]);
    });

    it("excludes the moved task itself", () => {
        expect(collectDescendantIds(TREE, 2).has("2")).toBe(false);
    });

    it("returns nothing for a leaf", () => {
        expect(sorted(collectDescendantIds(TREE, 4))).toEqual([]);
    });

    it("matches ids across the string/number split in the two task shapes", () => {
        expect(sorted(collectDescendantIds(TREE, "2"))).toEqual([3, 4, 5]);
    });

    it("terminates on a parent cycle", () => {
        const cyclic = [row(1, null), row(2, 3), row(3, 2)];
        expect(() => collectDescendantIds(cyclic, 2)).not.toThrow();
        expect(collectDescendantIds(cyclic, 2).has("2")).toBe(false);
    });
});

describe("applyTreePositionToDescendants", () => {
    it("THE FIX: every descendant follows the moved task's new milestone", () => {
        const next = applyTreePositionToDescendants(TREE, 2, TARGET);

        for (const id of ["3", "4", "5"]) {
            const moved = next.find((r) => r.id === id)!;
            expect(moved.milestoneId).toBe(20);
            expect(moved.sprintId).toBe(200);
            expect(moved.rootTaskId).toBe(9);
        }
    });

    it("leaves the parent edges inside the sub-tree alone", () => {
        // Only the moved task's own parent changes; re-pointing the rest
        // would flatten the chain.
        const next = applyTreePositionToDescendants(TREE, 2, TARGET);

        expect(next.find((r) => r.id === "3")!.parentTaskId).toBe("2");
        expect(next.find((r) => r.id === "4")!.parentTaskId).toBe("3");
        expect(next.find((r) => r.id === "5")!.parentTaskId).toBe("2");
    });

    it("doesn't touch rows outside the sub-tree", () => {
        const next = applyTreePositionToDescendants(TREE, 2, TARGET);

        expect(next.find((r) => r.id === "1")!.milestoneId).toBe(10);
    });

    it("returns the same array when the moved task has no descendants", () => {
        // Lets callers hand this to a state setter without forcing a
        // pointless re-render, which is the common (leaf) case.
        const next = applyTreePositionToDescendants(TREE, 4, TARGET);

        expect(next).toBe(TREE);
    });

    it("carries a cleared milestone down too", () => {
        // Detaching a task unlinks its milestone; the sub-tree can't stay
        // filed under one the top has left.
        const next = applyTreePositionToDescendants(TREE, 2, {
            milestoneId: null,
            sprintId: null,
            rootTaskId: 2,
        });

        for (const id of ["3", "4", "5"]) {
            expect(next.find((r) => r.id === id)!.milestoneId).toBeNull();
            expect(next.find((r) => r.id === id)!.sprintId).toBeNull();
        }
    });
});
