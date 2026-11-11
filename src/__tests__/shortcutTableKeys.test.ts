/**
 * The task table's grid keys are listed in the registry as display-only entries (MIP-1313),
 * so Settings can show them. They are not matched through the registry: `intentForKey`
 * (gridNav.ts) is the code. This pins the two together: every key the registry prints is a
 * key the grid handles, and a key the grid handles is printed.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { intentForKey } from "../features/tasks/components/table/gridNav";
import { SHORTCUT_IDS, shortcutParts, SHORTCUTS, type ShortcutId } from "../shortcuts";

type Press = { key: string; ctrlKey?: boolean };

/** What each registry entry says, as the key presses that must reach the grid. */
const PRESSES: Partial<Record<ShortcutId, Press[]>> = {
    "table.move": ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].map((key) => ({ key })),
    "table.rowEdges": [{ key: "Home" }, { key: "End" }],
    "table.gridEdges": [
        { key: "Home", ctrlKey: true },
        { key: "End", ctrlKey: true },
    ],
    "table.page": [{ key: "PageUp" }, { key: "PageDown" }],
};

const tableIds = SHORTCUT_IDS.filter((id) => SHORTCUTS[id].scope === "taskTable");

describe("task table keys in the registry", () => {
    it("are display-only entries in the table group, the same on both platforms", () => {
        expect(tableIds.length).toBeGreaterThan(0);
        for (const id of tableIds) {
            expect(SHORTCUTS[id].kind, id).toBe("gesture");
            expect(SHORTCUTS[id].group, id).toBe("table");
            expect(shortcutParts(id, "mac"), id).toEqual(shortcutParts(id, "other"));
            expect(shortcutParts(id, "mac").length, id).toBeGreaterThan(0);
        }
    });

    it.each(Object.entries(PRESSES))("%s: every key it names moves the grid", (id, presses) => {
        for (const press of presses!) {
            for (const rtl of [false, true])
                expect(intentForKey(press, rtl), `${id} ${press.key}`).not.toBeNull();
        }
    });

    it("the printed caps name those keys", () => {
        expect(shortcutParts("table.move", "mac")).toEqual(["← ↑ ↓ →"]);
        expect(shortcutParts("table.rowEdges", "mac")).toEqual(["Home / End"]);
        expect(shortcutParts("table.gridEdges", "mac")).toEqual(["Ctrl", "Home / End"]);
        expect(shortcutParts("table.page", "mac")).toEqual(["PageUp / PageDown"]);
    });

    it("a key the grid does not handle is not claimed (Tab leaves the table)", () => {
        for (const key of ["Tab", "Enter", " ", "Escape", "a"])
            expect(intentForKey({ key }, false), key).toBeNull();
        // Home/End with a modifier other than Ctrl are the browser's.
        expect(
            intentForKey({ key: "Home", ctrlKey: true, shiftKey: true } as never, false)
        ).toBeNull();
    });

    it("Enter / Space and Escape are what the cell code does", () => {
        const read = (rel: string) =>
            fs.readFileSync(
                path.resolve(__dirname, "../features/tasks/components/table", rel),
                "utf8"
            );
        expect(read("cellEditors.tsx")).toMatch(/key === "Enter" \|\| event\.key === " "/);
        expect(read("cellEditors.tsx")).toMatch(/key !== "Escape"/);
    });
});
