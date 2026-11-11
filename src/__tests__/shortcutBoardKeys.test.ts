/**
 * The task board's keys are listed in the registry as display-only entries (MIP-1402), so
 * Settings can show them. They are not matched through the registry: `columnMove` and
 * `intentForKey` (hooks/common/roving), the card's `Clickable` (Enter) and the drag library
 * (Space) are the code. This pins the two together, like `shortcutTableKeys` does for the table.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { columnMove, intentForKey, type RovingModel } from "../hooks/common/roving/rovingMoves";
import { SHORTCUT_IDS, shortcutParts, SHORTCUTS, type ShortcutId } from "../shortcuts";

type Press = { key: string; ctrlKey?: boolean };

const PRESSES: Partial<Record<ShortcutId, Press[]>> = {
    "board.move": ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].map((key) => ({ key })),
    "board.columnEdges": [{ key: "Home" }, { key: "End" }],
    "board.boardEdges": [
        { key: "Home", ctrlKey: true },
        { key: "End", ctrlKey: true },
    ],
};

const boardIds = SHORTCUT_IDS.filter((id) => SHORTCUTS[id].scope === "taskBoard");

// Two columns of two cards: every key a row names must move from the first card of the first
// column or from the last card of the last one (the edges answer with themselves otherwise).
const model: RovingModel = {
    groups: ["a", "b"],
    itemsOf: (g) => (g === "a" ? ["a1", "a2"] : ["b1", "b2"]),
};

describe("task board keys in the registry", () => {
    it("are display-only entries in the board group, the same on both platforms", () => {
        expect(boardIds.length).toBeGreaterThan(0);
        for (const id of boardIds) {
            expect(SHORTCUTS[id].kind, id).toBe("gesture");
            expect(SHORTCUTS[id].group, id).toBe("board");
            expect(shortcutParts(id, "mac"), id).toEqual(shortcutParts(id, "other"));
            expect(shortcutParts(id, "mac").length, id).toBeGreaterThan(0);
        }
    });

    it.each(Object.entries(PRESSES))("%s: every key it names moves the board", (id, presses) => {
        for (const press of presses!) {
            for (const rtl of [false, true]) {
                const intent = intentForKey(press, rtl);
                expect(intent, `${id} ${press.key}`).not.toBeNull();
                const moves = [
                    columnMove(model, { group: "a", item: "a1" }, intent!),
                    columnMove(model, { group: "b", item: "b2" }, intent!),
                    columnMove(model, { group: "a", item: "a2" }, intent!),
                    columnMove(model, { group: "b", item: "b1" }, intent!),
                ];
                expect(
                    moves.some((m) => m !== null),
                    `${id} ${press.key}`
                ).toBe(true);
            }
        }
    });

    it("the printed caps name those keys", () => {
        expect(shortcutParts("board.move", "mac")).toEqual(["← ↑ ↓ →"]);
        expect(shortcutParts("board.columnEdges", "mac")).toEqual(["Home / End"]);
        expect(shortcutParts("board.boardEdges", "mac")).toEqual(["Ctrl", "Home / End"]);
        expect(shortcutParts("board.open", "mac")).toEqual(["Enter"]);
        expect(shortcutParts("board.lift", "mac")).toEqual(["Space"]);
    });

    it("the page keys, Tab and a bare letter are not the board's", () => {
        for (const key of ["PageUp", "PageDown"]) {
            const intent = intentForKey({ key }, false)!;
            expect(columnMove(model, { group: "a", item: "a1" }, intent), key).toBeNull();
        }
        for (const key of ["Tab", "Escape", "a"])
            expect(intentForKey({ key }, false), key).toBeNull();
    });

    it("Enter opens and Space is left to the drag handle: the card's own code says so", () => {
        const card = fs.readFileSync(
            path.resolve(__dirname, "../features/tasks/components/board/SprintBoardCard.tsx"),
            "utf8"
        );
        expect(card).toMatch(/keys=\{\["Enter"\]\}/);
        expect(card).toMatch(/\{\.\.\.provided\.dragHandleProps\}/);
    });
});
