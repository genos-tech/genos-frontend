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
