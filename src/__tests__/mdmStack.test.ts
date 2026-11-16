/**
 * The geometry of the multi-person DM's stack of faces: one source for the avatar that draws it
 * and the report row that reserves room for it.
 */

import { describe, expect, it } from "vitest";

import { MDM_MAX_VISIBLE, mdmStackWidth } from "../components/ui/avatars/mdmStack";

describe("mdmStackWidth", () => {
    it("one face is one face wide; each further face adds 55% of a face", () => {
        expect(mdmStackWidth(1, 20)).toBe(20);
        expect(mdmStackWidth(2, 20)).toBe(31);
        expect(mdmStackWidth(3, 20)).toBe(42);
        expect(mdmStackWidth(3, 28)).toBeCloseTo(58.8);
    });

    it("an empty stack is the single people glyph, one face wide", () => {
        expect(mdmStackWidth(0, 20)).toBe(20);
    });

    it("never wider than the faces it draws (three)", () => {
        expect(MDM_MAX_VISIBLE).toBe(3);
        expect(mdmStackWidth(9, 20)).toBe(mdmStackWidth(3, 20));
    });
});
