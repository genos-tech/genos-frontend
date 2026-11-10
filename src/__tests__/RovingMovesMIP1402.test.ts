import { describe, expect, it } from "vitest";

import {
    columnMove,
    dayId,
    monthMove,
    type GridIntent,
    type RovingModel,
} from "../hooks/common/roving/rovingMoves";

// MIP-1402: where a key goes on a board / in a calendar. Pure, no DOM.

const model = (cols: Record<string, string[]>): RovingModel => ({
    groups: Object.keys(cols),
    itemsOf: (g) => cols[g] ?? [],
});

describe("columnMove (the board, the timeline)", () => {
    // open has 4 cards, wip 1, blocked 0, closed 2.
    const board = model({
        open: ["a", "b", "c", "d"],
        wip: ["e"],
        blocked: [],
        closed: ["f", "g"],
    });
    const go = (g: string, i: string, intent: GridIntent) =>
        columnMove(board, { group: g, item: i }, intent);

    it("Up / Down move inside the column and stop at its ends", () => {
        expect(go("open", "b", "nextRow")).toEqual({ group: "open", item: "c" });
        expect(go("open", "b", "prevRow")).toEqual({ group: "open", item: "a" });
        expect(go("open", "d", "nextRow")).toEqual({ group: "open", item: "d" });
        expect(go("open", "a", "prevRow")).toEqual({ group: "open", item: "a" });
    });

    it("Home / End are the column's first / last card", () => {
        expect(go("open", "b", "rowStart")).toEqual({ group: "open", item: "a" });
        expect(go("open", "b", "rowEnd")).toEqual({ group: "open", item: "d" });
    });

    it("Left / Right go to the next column that has cards, at the same index or its last", () => {
        expect(go("open", "c", "nextCell")).toEqual({ group: "wip", item: "e" });
        // blocked is empty: skipped.
        expect(go("wip", "e", "nextCell")).toEqual({ group: "closed", item: "f" });
        expect(go("open", "d", "nextCell")).toEqual({ group: "wip", item: "e" });
        expect(go("closed", "g", "prevCell")).toEqual({ group: "wip", item: "e" });
        expect(go("closed", "g", "prevCell")).toEqual({ group: "wip", item: "e" });
        expect(go("wip", "e", "prevCell")).toEqual({ group: "open", item: "a" });
    });

    it("does not wrap at the edges: the position is unchanged", () => {
        expect(go("closed", "g", "nextCell")).toEqual({ group: "closed", item: "g" });
        expect(go("open", "a", "prevCell")).toEqual({ group: "open", item: "a" });
    });

    it("Ctrl+Home / Ctrl+End are the first / last card of the board", () => {
        expect(go("wip", "e", "gridStart")).toEqual({ group: "open", item: "a" });
        expect(go("wip", "e", "gridEnd")).toEqual({ group: "closed", item: "g" });
    });

    it("leaves the page keys to the browser and unknown positions to nobody", () => {
        expect(go("open", "a", "pageDown")).toBeNull();
        expect(go("open", "a", "pageUp")).toBeNull();
        expect(go("open", "zzz", "nextRow")).toBeNull();
        expect(go("nope", "a", "nextRow")).toBeNull();
    });

    it("an empty board answers with the position it was given", () => {
        const empty = model({ open: ["a"], wip: [] });
        expect(columnMove(empty, { group: "open", item: "a" }, "gridEnd")).toEqual({
            group: "open",
            item: "a",
        });
    });
});

describe("monthMove (the date grid)", () => {
    // November 2026 as the grid shows it (Sunday first): Nov 1 is a Sunday, 42 cells to Dec 12.
    const days: string[] = [];
    for (let i = 0; i < 42; i++) days.push(dayId(new Date(2026, 10, 1 + i)));
    const grid = model({ month: days });
    const go = (item: string, intent: GridIntent) =>
        monthMove(grid, { group: "month", item }, intent);

    it("Left / Right a day, Up / Down a week", () => {
        expect(go("2026-11-11", "nextCell")).toEqual({ group: "month", item: "2026-11-12" });
        expect(go("2026-11-11", "prevCell")).toEqual({ group: "month", item: "2026-11-10" });
        expect(go("2026-11-11", "nextRow")).toEqual({ group: "month", item: "2026-11-18" });
        expect(go("2026-11-11", "prevRow")).toEqual({ group: "month", item: "2026-11-04" });
    });

    it("Home / End are the start / end of the week", () => {
        // Nov 11 2026 is a Wednesday: the week is Sun Nov 8 .. Sat Nov 14.
        expect(go("2026-11-11", "rowStart")).toEqual({ group: "month", item: "2026-11-08" });
        expect(go("2026-11-11", "rowEnd")).toEqual({ group: "month", item: "2026-11-14" });
    });

    it("PageUp / PageDown are a month, a short month clamps to its last day, and the host always shows it", () => {
        // Dec 11 is on the 6-week November grid too, but it is December's: the host switches month.
        expect(go("2026-11-11", "pageDown")).toEqual({
            group: "month",
            item: "2026-12-11",
            outside: true,
        });
        expect(go("2026-11-11", "pageUp")).toEqual({
            group: "month",
            item: "2026-10-11",
            outside: true,
        });
        const jan = model({ month: [dayId(new Date(2027, 0, 31))] });
        expect(monthMove(jan, { group: "month", item: "2027-01-31" }, "pageDown")).toEqual({
            group: "month",
            item: "2027-02-28",
            outside: true,
        });
        expect(go("2026-12-31", "pageDown")).toBeNull(); // not a day of this grid: no position
    });

    it("a day outside the grid is returned as such, for the host to show its month", () => {
        expect(go("2026-11-01", "prevCell")).toEqual({
            group: "month",
            item: "2026-10-31",
            outside: true,
        });
        expect(go("2026-11-01", "prevRow")).toEqual({
            group: "month",
            item: "2026-10-25",
            outside: true,
        });
        const last = days[41];
        expect(go(last, "nextCell")).toMatchObject({ outside: true });
        expect(go(last, "nextRow")).toMatchObject({ outside: true });
    });

    it("claims nothing for the board's Ctrl+Home / Ctrl+End", () => {
        expect(go("2026-11-11", "gridStart")).toBeNull();
        expect(go("2026-11-11", "gridEnd")).toBeNull();
    });
});
