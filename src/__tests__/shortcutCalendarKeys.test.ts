/**
 * The calendar's keys are listed in the registry as display-only entries (MIP-1402), so Settings
 * can show them. The code is `monthMove` (the month grid) and `columnMove` (the week / 3-day /
 * day views) behind `useRovingNav`; this pins the two together, like `shortcutBoardKeys`.
 */
import { describe, expect, it } from "vitest";

import {
    columnMove,
    dayId,
    intentForKey,
    monthMove,
    type RovingModel,
} from "../hooks/common/roving/rovingMoves";
import { SHORTCUT_IDS, shortcutParts, SHORTCUTS } from "../shortcuts";

const calendarIds = SHORTCUT_IDS.filter((id) => SHORTCUTS[id].scope === "calendar");

const days = Array.from({ length: 42 }, (_, i) => dayId(new Date(2026, 10, 1 + i)));
const month: RovingModel = { groups: ["month"], itemsOf: () => days };
const week: RovingModel = {
    groups: ["a", "b"],
    itemsOf: (g) => (g === "a" ? ["a1", "a2"] : ["b1", "b2"]),
};
const press = (key: string, rtl = false) => intentForKey({ key }, rtl);

describe("calendar keys in the registry", () => {
    it("are display-only entries in the calendar group, the same on both platforms", () => {
        expect(calendarIds.length).toBe(4);
        for (const id of calendarIds) {
            expect(SHORTCUTS[id].kind, id).toBe("gesture");
            expect(SHORTCUTS[id].group, id).toBe("calendar");
            expect(shortcutParts(id, "mac"), id).toEqual(shortcutParts(id, "other"));
        }
    });

    it("the arrows, Home / End move both the month grid and the day columns", () => {
        for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]) {
            for (const rtl of [false, true]) {
                const intent = press(key, rtl)!;
                expect(intent, key).not.toBeNull();
                const m = monthMove(month, { group: "month", item: "2026-11-11" }, intent);
                expect(m, `month ${key}`).not.toBeNull();
                const w = columnMove(week, { group: "a", item: "a1" }, intent);
                expect(w, `week ${key}`).not.toBeNull();
            }
        }
    });

    it("PageUp / PageDown are the month's (the day columns leave them to the browser)", () => {
        for (const key of ["PageUp", "PageDown"]) {
            expect(
                monthMove(month, { group: "month", item: "2026-11-11" }, press(key)!)
            ).not.toBeNull();
            expect(columnMove(week, { group: "a", item: "a1" }, press(key)!)).toBeNull();
        }
    });

    it("the printed caps name those keys", () => {
        expect(shortcutParts("calendar.move", "mac")).toEqual(["← ↑ ↓ →"]);
        expect(shortcutParts("calendar.edges", "mac")).toEqual(["Home / End"]);
        expect(shortcutParts("calendar.page", "mac")).toEqual(["PageUp / PageDown"]);
        expect(shortcutParts("calendar.open", "mac")).toEqual(["Enter"]);
    });
});
