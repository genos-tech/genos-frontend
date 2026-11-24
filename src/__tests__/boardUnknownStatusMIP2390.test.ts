/**
 * MIP-2390: documents what the sprint board does with a status it has no column for. This is the
 * CURRENT behaviour, pinned so a later change (custom statuses, MIP-1467) is a visible decision:
 *
 *  - a card whose status is not one of the five columns' keys (a custom name such as
 *    "In Review", a typo, any other string) is NOT drawn: it is dropped without an error;
 *  - "Deleted" is dropped on purpose;
 *  - a card with no status counts as Open;
 *  - matching is by lowercased status, so "wip" and "WIP" land in the same column.
 */

import { describe, expect, it } from "vitest";

import { bucketBoardColumns } from "../features/tasks/utils/sprintBoardDisplay";
import type { TaskTableProps } from "../types/tasks";

const card = (id: string, status: string | null): TaskTableProps =>
    ({
        id,
        title: `Task ${id}`,
        status,
        tags: [],
        projectId: 1,
        parentTaskId: null,
        isMilestone: false,
    }) as unknown as TaskTableProps;

describe("the board and a status it has no column for", () => {
    it("drops the card silently", () => {
        const rows = [
            card("1", "Open"),
            card("2", "In Review"),
            card("3", "Deleted"),
            card("4", "Closed"),
            card("5", "Ready to start"),
        ];
        const columns = bucketBoardColumns(rows, rows);
        const drawn = Object.values(columns)
            .flat()
            .map((t) => String(t.id))
            .sort();
        expect(drawn).toEqual(["1", "4"]);
    });

    it("counts a card with no status as Open", () => {
        const rows = [card("1", null), card("2", "")];
        const columns = bucketBoardColumns(rows, rows);
        expect(columns.open.map((t) => String(t.id))).toEqual(["1", "2"]);
    });

    it("matches by lowercased status", () => {
        const rows = [card("1", "wip"), card("2", "WIP"), card("3", "BLOCKED")];
        const columns = bucketBoardColumns(rows, rows);
        expect(columns.wip.map((t) => String(t.id))).toEqual(["1", "2"]);
        expect(columns.blocked.map((t) => String(t.id))).toEqual(["3"]);
    });
});
