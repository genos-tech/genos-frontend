// @vitest-environment node
/**
 * MIP-1230: the keyboard model of the task table (pure, no DOM).
 *
 * Given the rows and columns that exist, a key and the reading direction, which
 * cell is next. The table has ONE tab stop (the active cell) and the arrow keys
 * do the rest, so these rules are the whole of "how do I get around the table".
 */
import { describe, expect, it } from "vitest";

import {
    closestCol,
    defaultPosition,
    intentForKey,
    nextPosition,
    resolvePosition,
    type GridModel,
} from "../features/tasks/components/table/gridNav";

const ORDER = ["__drag", "__graph", "__add", "__expand", "id", "status", "title", "due"];

/** A header, a root row with children, a nested leaf and a root leaf. */
const ROWS: Record<string, string[]> = {
    __header: ["id", "status", "title", "due"],
    root: ["__drag", "__graph", "__add", "__expand", "id", "status", "title", "due"],
    leaf: ["__drag", "id", "status", "title", "due"],
    other: ["__drag", "__graph", "__add", "id", "status", "title", "due"],
};

const model = (rows: Record<string, string[]> = ROWS): GridModel => ({
    colOrder: ORDER,
    rowIds: Object.keys(rows),
    colsOf: (id) => rows[id] ?? [],
});

const from = (rowId: string, col: string) => ({ rowId, col });
const go = (rowId: string, col: string, key: string, rtl = false, page = 10, m = model()) => {
    const intent = intentForKey({ key }, rtl);
    return intent ? nextPosition(m, from(rowId, col), intent, page) : "no-intent";
};

describe("intentForKey", () => {
    it("maps the grid keys", () => {
        const intents = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].map(
            (k) => intentForKey({ key: k }, false)
        );
        expect(intents).toEqual([
            "prevCell",
            "nextCell",
            "prevRow",
            "nextRow",
            "rowStart",
            "rowEnd",
        ]);
        expect(intentForKey({ key: "PageUp" }, false)).toBe("pageUp");
        expect(intentForKey({ key: "PageDown" }, false)).toBe("pageDown");
        expect(intentForKey({ key: "Home", ctrlKey: true }, false)).toBe("gridStart");
        expect(intentForKey({ key: "End", ctrlKey: true }, false)).toBe("gridEnd");
    });

    it("mirrors Left and Right in RTL, not Up and Down", () => {
        expect(intentForKey({ key: "ArrowLeft" }, true)).toBe("nextCell");
        expect(intentForKey({ key: "ArrowRight" }, true)).toBe("prevCell");
        expect(intentForKey({ key: "ArrowDown" }, true)).toBe("nextRow");
        expect(intentForKey({ key: "Home" }, true)).toBe("rowStart");
    });

    it("leaves every other key, and any modified arrow, to the browser", () => {
        for (const key of ["Enter", " ", "Escape", "Tab", "a", "F2"]) {
            expect(intentForKey({ key }, false)).toBeNull();
        }
        expect(intentForKey({ key: "ArrowRight", altKey: true }, false)).toBeNull();
        expect(intentForKey({ key: "ArrowRight", metaKey: true }, false)).toBeNull();
        expect(intentForKey({ key: "ArrowRight", shiftKey: true }, false)).toBeNull();
        expect(intentForKey({ key: "ArrowRight", ctrlKey: true }, false)).toBeNull();
        expect(intentForKey({ key: "PageDown", ctrlKey: true }, false)).toBeNull();
    });
});

describe("nextPosition", () => {
    it("moves along a row in reading order and stops at the edges", () => {
        expect(go("root", "id", "ArrowRight")).toEqual(from("root", "status"));
        expect(go("root", "status", "ArrowLeft")).toEqual(from("root", "id"));
        expect(go("root", "due", "ArrowRight")).toEqual(from("root", "due"));
        expect(go("root", "__drag", "ArrowLeft")).toEqual(from("root", "__drag"));
    });

    it("skips the cells a row does not have", () => {
        // The leaf has no graph / add / expand cell: the drag handle is next to the ID.
        expect(go("leaf", "__drag", "ArrowRight")).toEqual(from("leaf", "id"));
        expect(go("root", "__add", "ArrowRight")).toEqual(from("root", "__expand"));
    });

    it("mirrors in RTL", () => {
        expect(go("root", "id", "ArrowLeft", true)).toEqual(from("root", "status"));
        expect(go("root", "status", "ArrowRight", true)).toEqual(from("root", "id"));
    });

    it("moves between rows keeping the column, and stops at the first and last row", () => {
        expect(go("root", "title", "ArrowDown")).toEqual(from("leaf", "title"));
        expect(go("leaf", "title", "ArrowUp")).toEqual(from("root", "title"));
        expect(go("__header", "title", "ArrowUp")).toEqual(from("__header", "title"));
        expect(go("other", "title", "ArrowDown")).toEqual(from("other", "title"));
    });

    it("lands on the nearest column when the next row has not the one you were in", () => {
        // From the graph button down to a row without one: the closest cell, not a jump to the start.
        expect(go("root", "__graph", "ArrowDown")).toEqual(from("leaf", "__drag"));
        expect(go("root", "__expand", "ArrowDown")).toEqual(from("leaf", "id"));
        // The header has no gutter: Up from a gutter cell lands on its first column.
        expect(go("root", "__add", "ArrowUp", false, 10)).toEqual(from("__header", "id"));
    });

    it("Home / End go to the first / last cell of the row", () => {
        expect(go("root", "title", "Home")).toEqual(from("root", "__drag"));
        expect(go("root", "title", "End")).toEqual(from("root", "due"));
        expect(go("leaf", "title", "Home")).toEqual(from("leaf", "__drag"));
    });

    it("Ctrl+Home / Ctrl+End go to the first / last cell of the table", () => {
        const intentHome = intentForKey({ key: "Home", ctrlKey: true }, false)!;
        const intentEnd = intentForKey({ key: "End", ctrlKey: true }, false)!;
        expect(nextPosition(model(), from("leaf", "title"), intentHome)).toEqual(
            from("__header", "id")
        );
        expect(nextPosition(model(), from("leaf", "title"), intentEnd)).toEqual(
            from("other", "due")
        );
    });

    it("PageUp / PageDown jump a page and clamp", () => {
        const rows: Record<string, string[]> = { __header: ["title"] };
        for (let i = 1; i <= 30; i++) rows[`r${i}`] = ["title"];
        const m = model(rows);
        expect(go("r1", "title", "PageDown", false, 10, m)).toEqual(from("r11", "title"));
        expect(go("r25", "title", "PageDown", false, 10, m)).toEqual(from("r30", "title"));
        expect(go("r15", "title", "PageUp", false, 10, m)).toEqual(from("r5", "title"));
        expect(go("r3", "title", "PageUp", false, 10, m)).toEqual(from("__header", "title"));
        expect(go("r1", "title", "PageDown", false, 0, m)).toEqual(from("r2", "title"));
    });

    it("returns null for a position that is not in the model", () => {
        expect(go("gone", "title", "ArrowDown")).toBeNull();
        expect(go("root", "nope", "ArrowRight")).toBeNull();
    });
});

describe("closestCol", () => {
    it("prefers the same column, then the nearest, the earlier on a tie", () => {
        expect(closestCol(model(), "root", "title")).toBe("title");
        expect(closestCol(model(), "leaf", "__expand")).toBe("id");
        expect(closestCol(model(), "__header", "__drag")).toBe("id");
        expect(closestCol(model({ r: [] }), "r", "title")).toBeNull();
        // A column the order does not know falls back to the row's first.
        expect(closestCol(model(), "leaf", "mystery")).toBe("__drag");
    });
});

describe("resolvePosition (the active cell survives)", () => {
    it("keeps the cell while its row exists", () => {
        expect(resolvePosition(model(), from("leaf", "title"), 2)).toEqual(from("leaf", "title"));
    });

    it("falls back to the nearest row when the row vanished (filtered out)", () => {
        const after = model({ __header: ROWS.__header, root: ROWS.root, other: ROWS.other });
        // `leaf` was row index 2; the row now at index 2 is `other`.
        expect(resolvePosition(after, from("leaf", "title"), 2)).toEqual(from("other", "title"));
    });

    it("clamps to the last row when the list got shorter", () => {
        const shorter = model({ __header: ROWS.__header, root: ROWS.root });
        expect(resolvePosition(shorter, from("other", "due"), 3)).toEqual(from("root", "due"));
    });

    it("keeps the row but moves to the nearest column when the column went away", () => {
        const noDue = model({
            __header: ["id", "status", "title"],
            leaf: ["id", "status", "title"],
        });
        expect(resolvePosition(noDue, from("leaf", "due"), 1)).toEqual(from("leaf", "title"));
    });

    it("is null when there is nothing left", () => {
        expect(resolvePosition(model({}), from("leaf", "title"), 1)).toBeNull();
    });
});

describe("defaultPosition", () => {
    it("is the first row's title, so Tab lands where the work is", () => {
        expect(defaultPosition(model())).toEqual(from("root", "title"));
    });

    it("falls back to the header when there are no rows yet", () => {
        expect(defaultPosition(model({ __header: ["id", "title"] }))).toEqual(
            from("__header", "title")
        );
        expect(defaultPosition(model({}))).toBeNull();
    });
});
