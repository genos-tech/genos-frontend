import { describe, expect, it } from "vitest";

import { selectDependencyCandidates } from "../features/tasks/utils/dependencyCandidates";
import { TaskTableProps } from "../types/tasks";

const row = (fields: Record<string, unknown>) => fields as unknown as TaskTableProps;
const ids = (rows: TaskTableProps[]) => rows.map((r) => String(r.id));

describe("selectDependencyCandidates (MIP-1389)", () => {
    const all = [
        row({ id: "1", status: "Open" }),
        row({ id: "2", status: "Closed" }),
        row({ id: "3", status: "Open", parentTaskId: "2" }),
        row({ id: "4", status: "WIP", parentTaskId: "3" }),
        row({ id: "5", status: "Deleted" }),
        row({ id: "6", status: "Open", parentTaskId: "5" }),
        row({ id: "7", status: "Open", parentTaskId: "1" }),
        row({ id: "8", status: "Open" }),
    ];

    it("offers live work only: not Closed, not Deleted, nothing under either", () => {
        expect(ids(selectDependencyCandidates(all, new Set()))).toEqual(["1", "7", "8"]);
    });

    it("keeps dropping the excluded ids", () => {
        expect(ids(selectDependencyCandidates(all, new Set([1, 8])))).toEqual(["7"]);
    });

    it("drops a task of a Closed milestone", () => {
        const rows = [
            row({ id: "70", status: "Closed", isMilestone: true, milestoneId: 7 }),
            row({ id: "71", status: "Open", milestoneId: 7 }),
            row({ id: "72", status: "Open" }),
        ];
        expect(ids(selectDependencyCandidates(rows, new Set()))).toEqual(["72"]);
    });
});
