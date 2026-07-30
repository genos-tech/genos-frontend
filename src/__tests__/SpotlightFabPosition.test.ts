import { afterEach, describe, expect, it } from "vitest";

import {
    clampFabTop,
    FAB_EDGE_GAP,
    FAB_SIZE,
    isFabTap,
    readStoredFabPosition,
    resolveFabDrop,
    writeStoredFabPosition,
} from "../components/layout/spotlightFabPosition";

// A 390 x 844 phone (iPhone 14) with the 60px tab bar up.
const phone = { bottomInset: 60, viewportHeight: 844, viewportWidth: 390 };
// Highest legal `top`: 844 - 60 - 38 - 16 = 730.
const PHONE_MAX_TOP = 730;

describe("resolveFabDrop", () => {
    it("snaps to the left edge when the button's centre lands left of the midpoint", () => {
        // Centre at 100 + 19 = 119 < 195.
        expect(resolveFabDrop({ x: 100, y: 400 }, phone)).toEqual({ side: "left", top: 400 });
    });

    it("snaps to the right edge when the centre lands right of the midpoint", () => {
        expect(resolveFabDrop({ x: 250, y: 400 }, phone)).toEqual({ side: "right", top: 400 });
    });

    it("decides the side on the button's centre, not its left edge", () => {
        // Left edge (180) is left of the 195 midpoint, but the centre
        // (199) is not — so this belongs on the right.
        expect(resolveFabDrop({ x: 180, y: 300 }, phone).side).toBe("right");
    });

    it("clamps a drop above the top edge", () => {
        expect(resolveFabDrop({ x: 300, y: -50 }, phone).top).toBe(FAB_EDGE_GAP);
    });

    it("clamps a drop into the bottom inset so the button never hides under the tab bar", () => {
        expect(resolveFabDrop({ x: 300, y: 2000 }, phone).top).toBe(PHONE_MAX_TOP);
    });
});

describe("clampFabTop", () => {
    it("leaves a position inside the visible band alone", () => {
        expect(clampFabTop(400, phone)).toBe(400);
    });

    it("pulls a stored position up when the keyboard shrinks the usable area", () => {
        // Keyboard up: 336px of inset. Max top becomes 844-336-38-16 = 454.
        expect(clampFabTop(700, { ...phone, bottomInset: 336 })).toBe(454);
    });

    it("pulls a position up after rotating to a shorter viewport", () => {
        expect(clampFabTop(700, { ...phone, viewportHeight: 390 })).toBe(390 - 60 - FAB_SIZE - 16);
    });

    it("falls back to the top gap when nothing fits", () => {
        // Landscape phone with the keyboard up — the arithmetic goes
        // negative and would otherwise pin the button off the top edge.
        expect(clampFabTop(200, { ...phone, viewportHeight: 300, bottomInset: 336 })).toBe(
            FAB_EDGE_GAP
        );
    });
});

describe("isFabTap", () => {
    it("treats a still press as a tap", () => {
        expect(isFabTap(0, 0)).toBe(true);
    });

    it("tolerates a slightly sloppy tap", () => {
        expect(isFabTap(3, 4)).toBe(true); // 5px
    });

    it("treats real movement as a drag", () => {
        expect(isFabTap(0, 40)).toBe(false);
        expect(isFabTap(30, 30)).toBe(false);
    });
});

describe("stored position", () => {
    afterEach(() => localStorage.clear());

    it("round-trips a parked position", () => {
        writeStoredFabPosition({ side: "left", top: 220 });
        expect(readStoredFabPosition()).toEqual({ side: "left", top: 220 });
    });

    it("returns null when the user has never moved it", () => {
        expect(readStoredFabPosition()).toBeNull();
    });

    it("ignores junk rather than throwing at render time", () => {
        // The value is read during the initial `useState`, so a bad shape
        // here would blank the whole app instead of one button.
        for (const junk of ["not json", "null", '{"side":"up","top":10}', '{"side":"left"}']) {
            localStorage.setItem("mobile:spotlightFabPosition", junk);
            expect(readStoredFabPosition()).toBeNull();
        }
    });
});
