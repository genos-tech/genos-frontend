import { en } from "@blocknote/core/locales";
import { describe, expect, it } from "vitest";

import { previewDictionary } from "../features/notes/templates/previewDictionary";

// MIP-2337 follow-up: the picker's read-only preview showed BlockNote's English placeholder
// ("List") on an empty checklist row, in every language. A preview needs no editing hint.
describe("note template preview dictionary", () => {
    it("blanks every placeholder, keeping the same keys", () => {
        const keys = Object.keys(en.placeholders);
        expect(keys.length).toBeGreaterThan(3);
        expect(Object.keys(previewDictionary.placeholders)).toEqual(keys);
        for (const value of Object.values(previewDictionary.placeholders)) {
            expect(value).toBe("");
        }
    });

    it("leaves the rest of the dictionary untouched", () => {
        expect(previewDictionary.slash_menu).toBe(en.slash_menu);
    });
});
