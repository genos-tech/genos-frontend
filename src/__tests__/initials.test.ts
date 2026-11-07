/**
 * The letter an avatar shows (MIP-1133). It is the first LETTER of the name,
 * not the first character: "(DY) Ken Kamiya" used to show "(".
 */
import { describe, expect, it } from "vitest";

import { initialOf } from "../utils/initials";

describe("initialOf", () => {
    it("skips leading punctuation: the reported '(DY) Ken Kamiya' case", () => {
        expect(initialOf("(DY) Ken Kamiya")).toBe("D");
        expect(initialOf("  @ken")).toBe("K");
        expect(initialOf("#general")).toBe("G");
        expect(initialOf("[WIP] design")).toBe("W");
    });

    it("upper-cases a plain Latin name", () => {
        expect(initialOf("ken kamiya")).toBe("K");
        expect(initialOf("Ken")).toBe("K");
    });

    it("keeps a CJK name's first letter, not half a code point", () => {
        expect(initialOf("神谷 健")).toBe("神");
        expect(initialOf("田中太郎")).toBe("田");
        expect(initialOf("김민수")).toBe("김");
        expect(initialOf("ひらがな")).toBe("ひ");
        // CJK after punctuation, as in a prefixed team tag.
        expect(initialOf("（営業）田中")).toBe("営");
    });

    it("treats an astral-plane letter as one letter", () => {
        // U+20BB7 is a CJK ideograph outside the BMP: two UTF-16 units.
        expect(initialOf("\u{20BB7}野家")).toBe("\u{20BB7}");
    });

    it("handles accents, other scripts and digits", () => {
        expect(initialOf("élodie")).toBe("É");
        expect(initialOf("Ørjan")).toBe("Ø");
        expect(initialOf("مريم")).toBe("م");
        expect(initialOf("राहुल")).toBe("र");
        expect(initialOf("42 team")).toBe("4");
    });

    it("never returns more than one code point (ß upper-cases to SS)", () => {
        expect(Array.from(initialOf("ßeta"))).toHaveLength(1);
    });

    it("falls back to the first visible character, then to '?'", () => {
        expect(initialOf("🙂 smile")).toBe("S");
        expect(initialOf("🙂")).toBe("🙂");
        expect(initialOf("(*)")).toBe("(");
        expect(initialOf("")).toBe("?");
        expect(initialOf("   ")).toBe("?");
        expect(initialOf(null)).toBe("?");
        expect(initialOf(undefined)).toBe("?");
        expect(initialOf("", "-")).toBe("-");
    });
});
