import { describe, expect, it } from "vitest";

import { selectClosedByAncestor } from "../features/tasks/utils/closedByAncestor";
import { TaskTableProps } from "../types/tasks";

const row = (fields: Record<string, unknown>) => fields as unknown as TaskTableProps;

describe("selectClosedByAncestor", () => {
    it("marks a child of a Closed task, at any depth", () => {
        const ids = selectClosedByAncestor([
            row({ id: 1, status: "Closed" }),
            row({ id: 2, status: "Open", parentTaskId: 1 }),
            row({ id: 3, status: "WIP", parentTaskId: 2 }),
        ]);
        expect([...ids].sort()).toEqual(["2", "3"]);
    });

    it("marks the tasks of a Closed milestone, by parent link or by milestoneId", () => {
        const ids = selectClosedByAncestor([
            row({ id: 1, status: "Closed", isMilestone: true, milestoneId: 7 }),
            row({ id: 2, status: "Open", parentTaskId: 1, milestoneId: 7 }),
            row({ id: 3, status: "Open", milestoneId: 7 }),
        ]);
        expect([...ids].sort()).toEqual(["2", "3"]);
    });

    it("leaves the Closed row itself out, and everything under an open parent", () => {
        const ids = selectClosedByAncestor([
            row({ id: 1, status: "Closed" }),
            row({ id: 2, status: "Open" }),
            row({ id: 3, status: "Closed", parentTaskId: 2 }),
            row({ id: 4, status: "Open", parentTaskId: 2 }),
        ]);
        expect(ids.size).toBe(0);
    });

    it("ignores a parent that is not loaded, and survives a cycle", () => {
        const ids = selectClosedByAncestor([
            row({ id: 1, status: "Open", parentTaskId: 99 }),
            row({ id: 2, status: "Open", parentTaskId: 3 }),
            row({ id: 3, status: "Open", parentTaskId: 2 }),
        ]);
        expect(ids.size).toBe(0);
    });
});
