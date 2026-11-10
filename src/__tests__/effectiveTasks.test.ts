import { describe, expect, it } from "vitest";

import { deriveEffectiveTasks } from "../features/tasks/utils/effectiveTasks";
import { TaskTableProps } from "../types/tasks";

const row = (fields: Record<string, unknown>) => fields as unknown as TaskTableProps;
const derive = (rows: TaskTableProps[]) =>
    deriveEffectiveTasks(new Map(rows.map((r) => [String(r.id), r])));
const byId = (rows: TaskTableProps[]) =>
    Object.fromEntries(
        derive(rows).map((t) => [String(t.id), [t.effectiveStatus, t.effectiveCloseDate]])
    );

describe("deriveEffectiveTasks (the dashboard's rollup, MIP-1389)", () => {
    it("keeps an open task's own status and no close date", () => {
        expect(byId([row({ id: 1, status: "WIP", updatedAt: "d1" })])).toEqual({
            1: ["WIP", null],
        });
        expect(byId([row({ id: 1, status: null })])).toEqual({ 1: ["Open", null] });
    });

    it("a Closed task keeps its own close date", () => {
        expect(byId([row({ id: 1, status: "Closed", updatedAt: "d1" })])).toEqual({
            1: ["Closed", "d1"],
        });
    });

    it("a task under a Closed parent is Closed, closed when the nearest Closed ancestor was", () => {
        expect(
            byId([
                row({ id: 1, status: "Closed", updatedAt: "top" }),
                row({ id: 2, status: "Closed", parentTaskId: 1, updatedAt: "mid" }),
                row({ id: 3, status: "Open", parentTaskId: 2, updatedAt: "leaf" }),
                row({ id: 4, status: "WIP", parentTaskId: 1, updatedAt: "other" }),
            ])
        ).toEqual({
            1: ["Closed", "top"],
            2: ["Closed", "mid"],
            3: ["Closed", "mid"],
            4: ["Closed", "top"],
        });
    });

    it("drops a Deleted task and the whole branch under a Deleted ancestor", () => {
        expect(
            byId([
                row({ id: 1, status: "Deleted" }),
                row({ id: 2, status: "Open", parentTaskId: 1 }),
                row({ id: 3, status: "Closed", parentTaskId: 2, updatedAt: "d" }),
                row({ id: 4, status: "Open" }),
            ])
        ).toEqual({ 4: ["Open", null] });
    });

    it("a Deleted ancestor above a Closed one still drops the branch", () => {
        expect(
            byId([
                row({ id: 1, status: "Deleted" }),
                row({ id: 2, status: "Closed", parentTaskId: 1, updatedAt: "d" }),
                row({ id: 3, status: "Open", parentTaskId: 2 }),
            ])
        ).toEqual({});
    });

    it("a Closed milestone closes its tasks, by milestoneId too", () => {
        expect(
            byId([
                row({
                    id: 1,
                    status: "Closed",
                    isMilestone: true,
                    milestoneId: 7,
                    updatedAt: "m",
                }),
                row({ id: 2, status: "Open", milestoneId: 7 }),
            ])
        ).toEqual({ 1: ["Closed", "m"], 2: ["Closed", "m"] });
    });

    it("survives a cycle in the parent links", () => {
        expect(
            byId([
                row({ id: 1, status: "Open", parentTaskId: 2 }),
                row({ id: 2, status: "Open", parentTaskId: 1 }),
            ])
        ).toEqual({ 1: ["Open", null], 2: ["Open", null] });
    });
});
