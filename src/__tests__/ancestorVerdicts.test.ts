import { describe, expect, it } from "vitest";

import {
    effectiveStatusOf,
    selectAncestorVerdicts,
} from "../features/tasks/utils/closedByAncestor";
import { TaskTableProps } from "../types/tasks";

const row = (fields: Record<string, unknown>) => fields as unknown as TaskTableProps;

const statuses = (rows: TaskTableProps[]) =>
    Object.fromEntries(
        [...selectAncestorVerdicts(rows)].map(([id, verdict]) => [id, verdict.status])
    );

describe("selectAncestorVerdicts (MIP-1382 / MIP-1389)", () => {
    it("marks a child of a Closed task, at any depth", () => {
        expect(
            statuses([
                row({ id: 1, status: "Closed" }),
                row({ id: 2, status: "Open", parentTaskId: 1 }),
                row({ id: 3, status: "WIP", parentTaskId: 2 }),
            ])
        ).toEqual({ 2: "Closed", 3: "Closed" });
    });

    it("marks a child of a Deleted task, at any depth", () => {
        expect(
            statuses([
                row({ id: 1, status: "Deleted" }),
                row({ id: 2, status: "Open", parentTaskId: 1 }),
                row({ id: 3, status: "Closed", parentTaskId: 2 }),
            ])
        ).toEqual({ 2: "Deleted", 3: "Deleted" });
    });

    it("Deleted beats Closed, wherever each sits above the row", () => {
        expect(
            statuses([
                row({ id: 1, status: "Deleted" }),
                row({ id: 2, status: "Closed", parentTaskId: 1 }),
                row({ id: 3, status: "Open", parentTaskId: 2 }),
            ])
        ).toEqual({ 2: "Deleted", 3: "Deleted" });
        expect(
            statuses([
                row({ id: 1, status: "Closed" }),
                row({ id: 2, status: "Deleted", parentTaskId: 1 }),
                row({ id: 3, status: "Open", parentTaskId: 2 }),
            ])
        ).toEqual({ 2: "Closed", 3: "Deleted" });
    });

    it("names the nearest Closed ancestor", () => {
        const verdicts = selectAncestorVerdicts([
            row({ id: 1, status: "Closed" }),
            row({ id: 2, status: "Closed", parentTaskId: 1 }),
            row({ id: 3, status: "Open", parentTaskId: 2 }),
        ]);
        expect(String(verdicts.get("3")?.ancestor.id)).toBe("2");
        expect(String(verdicts.get("2")?.ancestor.id)).toBe("1");
    });

    it("marks the tasks of a Closed milestone, by parent link or by milestoneId", () => {
        expect(
            statuses([
                row({ id: 1, status: "Closed", isMilestone: true, milestoneId: 7 }),
                row({ id: 2, status: "Open", parentTaskId: 1, milestoneId: 7 }),
                row({ id: 3, status: "Open", milestoneId: 7 }),
            ])
        ).toEqual({ 2: "Closed", 3: "Closed" });
    });

    it("marks the tasks of a Deleted milestone", () => {
        expect(
            statuses([
                row({ id: 1, status: "Deleted", isMilestone: true, milestoneId: 7 }),
                row({ id: 3, status: "Open", milestoneId: 7 }),
            ])
        ).toEqual({ 3: "Deleted" });
    });

    it("leaves the Closed row itself out, and everything under an open parent", () => {
        expect(
            selectAncestorVerdicts([
                row({ id: 1, status: "Closed" }),
                row({ id: 2, status: "Open" }),
                row({ id: 3, status: "Closed", parentTaskId: 2 }),
                row({ id: 4, status: "Open", parentTaskId: 2 }),
            ]).size
        ).toBe(0);
    });

    it("ignores a parent that is not loaded, and survives a cycle", () => {
        expect(
            selectAncestorVerdicts([
                row({ id: 1, status: "Open", parentTaskId: 99 }),
                row({ id: 2, status: "Open", parentTaskId: 3 }),
                row({ id: 3, status: "Open", parentTaskId: 2 }),
            ]).size
        ).toBe(0);
    });

    // MIP-1398. These two pin what the memoised walk used to get wrong: it remembered a
    // result computed while its loop guard had cut the walk short, so the answer for the
    // other members of a loop depended on which row was asked first.
    it("a Closed task inside a loop of parent links: every OTHER member is under it, whichever row is asked first", () => {
        // 1 -> 3 -> 5 (Closed) -> 2 -> 1
        const loop = [
            row({ id: 1, status: "Open", parentTaskId: 3 }),
            row({ id: 2, status: "WIP", parentTaskId: 1 }),
            row({ id: 3, status: "Pending", parentTaskId: 5 }),
            row({ id: 5, status: "Closed", parentTaskId: 2 }),
        ];
        const orders = [
            [0, 1, 2, 3],
            [3, 2, 1, 0],
            [1, 3, 0, 2],
            [2, 0, 3, 1],
        ];
        for (const order of orders) {
            const verdicts = statuses(order.map((i) => loop[i]));
            expect(verdicts).toEqual({ 1: "Closed", 2: "Closed", 3: "Closed" });
        }
    });

    it("names WHICH ancestor: the parent link before the milestone link, and a parent's own ancestors before the milestone", () => {
        // Row 4 has a parent chain 4 -> 3 -> 2 (Closed) and a milestone whose backing row 1
        // is Closed too. Every ancestor is Closed; the one named is the first in the order
        // "parent, what is above the parent, then the milestone".
        const rows = [
            row({
                id: 1,
                status: "Closed",
                parentTaskId: null,
                isMilestone: true,
                milestoneId: 7,
            }),
            row({ id: 2, status: "Closed", parentTaskId: null }),
            row({ id: 3, status: "Open", parentTaskId: 2 }),
            row({ id: 4, status: "Open", parentTaskId: 3, milestoneId: 7 }),
        ];
        expect(selectAncestorVerdicts(rows).get("4")?.ancestor.id).toBe(2);
        // Row 5 is directly under Closed 2 AND in Closed milestone 7: the parent link wins.
        const direct = [...rows, row({ id: 5, status: "Open", parentTaskId: 2, milestoneId: 7 })];
        expect(selectAncestorVerdicts(direct).get("5")?.ancestor.id).toBe(2);
        // Row 8 is under Open 7, which is itself both under Closed 2 (parent link) and in
        // Closed milestone 7's backing row 1 (milestone link): 7's parent link comes first.
        const above = [
            ...rows,
            row({ id: 7, status: "Open", parentTaskId: 2, milestoneId: 7 }),
            row({ id: 8, status: "Open", parentTaskId: 7 }),
        ];
        expect(selectAncestorVerdicts(above).get("8")?.ancestor.id).toBe(2);
    });

    it("a loop that does not contain the row itself ends the walk", () => {
        // 1 -> 2 -> 3 -> 2: row 1 is outside the loop, so the walk must not circle in it.
        const rho = [
            row({ id: 1, status: "Open", parentTaskId: 2 }),
            row({ id: 2, status: "Open", parentTaskId: 3 }),
            row({ id: 3, status: "Closed", parentTaskId: 2 }),
        ];
        expect(statuses(rho)).toEqual({ 1: "Closed", 2: "Closed" });
    });

    it("a task is never its own ancestor, through a self-parent or a loop", () => {
        expect(statuses([row({ id: 1, status: "Closed", parentTaskId: 1 })])).toEqual({});
        expect(
            statuses([
                row({ id: 1, status: "Closed", parentTaskId: 2 }),
                row({ id: 2, status: "Open", parentTaskId: 1 }),
            ])
        ).toEqual({ 2: "Closed" });
    });

    it("effectiveStatusOf reads the override, else the row's own status", () => {
        const rows = [
            row({ id: 1, status: "Closed" }),
            row({ id: 2, status: "Open", parentTaskId: 1 }),
            row({ id: 3, status: "WIP" }),
        ];
        const verdicts = selectAncestorVerdicts(rows);
        expect(effectiveStatusOf(rows[1], verdicts)).toBe("Closed");
        expect(effectiveStatusOf(rows[2], verdicts)).toBe("WIP");
        expect(effectiveStatusOf(rows[0], verdicts)).toBe("Closed");
    });
});
