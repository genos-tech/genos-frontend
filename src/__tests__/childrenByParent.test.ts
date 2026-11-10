import { describe, expect, it } from "vitest";

import { selectChildrenByParent } from "../features/tasks/utils/childrenByParent";
import { TaskTableProps } from "../types/tasks";

const row = (fields: Record<string, unknown>) => fields as unknown as TaskTableProps;
const idsOf = (map: Map<string, TaskTableProps[]>) =>
    Object.fromEntries([...map].map(([parent, kids]) => [parent, kids.map((k) => String(k.id))]));

const all = [
    row({ id: "1", status: "Open" }),
    row({ id: "2", status: "Open", parentTaskId: "1" }),
    row({ id: "3", status: "Deleted", parentTaskId: "1" }),
    row({ id: "4", status: "Open", parentTaskId: "3" }),
    row({ id: "5", status: "WIP", parentTaskId: "4" }),
    row({ id: "6", status: "Closed" }),
    row({ id: "7", status: "Open", parentTaskId: "6" }),
];

describe("selectChildrenByParent (the table's sub-task index)", () => {
    it("before the filter pass has run: drops a Deleted row and everything under it", () => {
        expect(idsOf(selectChildrenByParent(all, null))).toEqual({
            "1": ["2"],
            "6": ["7"],
        });
    });

    it("before the filter pass: a Closed parent still lists its children (it is the filter's call)", () => {
        expect(idsOf(selectChildrenByParent(all, null))["6"]).toEqual(["7"]);
    });

    it("after the filter pass: exactly the children it let through", () => {
        expect(idsOf(selectChildrenByParent(all, new Set(["2", "7"])))).toEqual({
            "1": ["2"],
            "6": ["7"],
        });
        expect(selectChildrenByParent(all, new Set()).size).toBe(0);
    });
});
