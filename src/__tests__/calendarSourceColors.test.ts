/**
 * Per-source colors for the multi-account calendar.
 *
 * Once a work account, a personal account, and calendars shared by
 * teammates are all overlaid on one grid, color is the ONLY thing that
 * tells the user which calendar an event belongs to. That puts three
 * real requirements on this module:
 *
 *  - **Google's own color wins.** The user already assigned colors in
 *    Google Calendar; reusing them means the two UIs agree and nothing
 *    has to be re-learned.
 *  - **The fallback is stable.** The same calendar must land on the same
 *    color across reloads, or the legend means nothing.
 *  - **Untrusted color strings never reach CSS.** `background_color`
 *    comes off the wire and goes straight into a style value.
 */

import { describe, expect, it } from "vitest";

import {
    assignSourceColors,
    buildSourcePalette,
    hexToRgbTriple,
    paletteForEvent,
    resolveSourceColor,
} from "../features/calendar/utils/sourceColors";
import { sourceKey } from "../features/integrations/services/calendar";

const ACCOUNT_A = "11111111-1111-1111-1111-111111111111";
const ACCOUNT_B = "22222222-2222-2222-2222-222222222222";

describe("sourceKey", () => {
    it("puts the account id first so the server can split on the first colon", () => {
        // Calendar ids can themselves contain ":", so the account id
        // (a UUID, never containing one) has to lead.
        expect(sourceKey(ACCOUNT_A, "primary")).toBe(`${ACCOUNT_A}:primary`);
    });

    it("distinguishes the same calendar id under different accounts", () => {
        // Every Google account has a calendar called "primary" — the
        // whole reason a bare calendar id can't be a selection key.
        expect(sourceKey(ACCOUNT_A, "primary")).not.toBe(sourceKey(ACCOUNT_B, "primary"));
    });
});

describe("resolveSourceColor", () => {
    it("prefers the color Google reports for the calendar", () => {
        expect(resolveSourceColor(ACCOUNT_A, "primary", "#33B679")).toBe("#33B679");
    });

    it("is stable for the same source across calls", () => {
        const first = resolveSourceColor(ACCOUNT_A, "primary");
        const second = resolveSourceColor(ACCOUNT_A, "primary");
        expect(first).toBe(second);
    });

    it("gives different calendars on the same account different colors", () => {
        // Not guaranteed in general (the palette is finite), but these
        // two specific keys must not collide or the most common
        // two-calendar setup is unreadable.
        const primary = resolveSourceColor(ACCOUNT_A, "primary");
        const other = resolveSourceColor(ACCOUNT_A, "team@group.calendar.google.com");
        expect(primary).not.toBe(other);
    });

    it("always returns a valid 6-digit hex", () => {
        for (const calendarId of ["primary", "a", "b", "c", "d", "e", "f", "g", "h", "i"]) {
            expect(resolveSourceColor(ACCOUNT_A, calendarId)).toMatch(/^#[0-9a-fA-F]{6}$/);
        }
    });

    describe("rejects untrusted color values", () => {
        // These land in a CSS property. A malformed value would break
        // the rule it sits in; a crafted one could escape the property.
        const bad = [
            "red",
            "#abc",
            "#12345",
            "#1234567",
            "rgb(1,2,3)",
            "#12345g",
            "red; background: url(x)",
            "",
        ];
        for (const value of bad) {
            it(`falls back for ${JSON.stringify(value)}`, () => {
                const resolved = resolveSourceColor(ACCOUNT_A, "primary", value);
                expect(resolved).toMatch(/^#[0-9a-fA-F]{6}$/);
                expect(resolved).not.toBe(value);
            });
        }

        it("falls back for null and undefined", () => {
            expect(resolveSourceColor(ACCOUNT_A, "primary", null)).toMatch(/^#[0-9a-fA-F]{6}$/);
            expect(resolveSourceColor(ACCOUNT_A, "primary", undefined)).toMatch(
                /^#[0-9a-fA-F]{6}$/
            );
        });
    });
});

describe("hexToRgbTriple", () => {
    it("expands a hex color into an rgba-usable triple", () => {
        expect(hexToRgbTriple("#4285F4")).toBe("66, 133, 244");
        expect(hexToRgbTriple("#000000")).toBe("0, 0, 0");
        expect(hexToRgbTriple("#ffffff")).toBe("255, 255, 255");
    });
});

describe("buildSourcePalette", () => {
    it("derives every surface from the one base color", () => {
        const palette = buildSourcePalette("#4285F4", false);
        expect(palette.base).toBe("#4285F4");
        for (const surface of [palette.fill, palette.fillHover, palette.border]) {
            expect(surface).toContain("66, 133, 244");
        }
    });

    it("makes hover stronger than the resting fill", () => {
        const { fill, fillHover } = buildSourcePalette("#4285F4", false);
        const alpha = (v: string) => Number(v.match(/,\s*([\d.]+)\)$/)?.[1]);
        expect(alpha(fillHover)).toBeGreaterThan(alpha(fill));
    });

    it("uses a heavier fill in dark mode", () => {
        const alpha = (v: string) => Number(v.match(/,\s*([\d.]+)\)$/)?.[1]);
        expect(alpha(buildSourcePalette("#4285F4", true).fill)).toBeGreaterThan(
            alpha(buildSourcePalette("#4285F4", false).fill)
        );
    });
});

describe("paletteForEvent", () => {
    const colorBySource = {
        [sourceKey(ACCOUNT_A, "primary")]: "#4285F4",
        [sourceKey(ACCOUNT_B, "primary")]: "#F5A623",
    };

    it("colors an event by the account it came from", () => {
        const work = paletteForEvent(
            { account_id: ACCOUNT_A, calendar_id: "primary" },
            colorBySource,
            false
        );
        const personal = paletteForEvent(
            { account_id: ACCOUNT_B, calendar_id: "primary" },
            colorBySource,
            false
        );
        expect(work.base).toBe("#4285F4");
        expect(personal.base).toBe("#F5A623");
    });

    it("still renders an event with no source", () => {
        // Single-source fetches and payloads cached before this feature
        // carry no `_source`. Those must fall back to a real color
        // rather than producing `undefined` in a style value, which
        // would drop the fill and make the event invisible.
        const palette = paletteForEvent(undefined, colorBySource, false);
        expect(palette.base).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(palette.fill).toContain("rgba(");
    });

    it("falls back when the source isn't in the color map", () => {
        // Happens between ticking a newly-appeared calendar and the
        // list refreshing.
        const palette = paletteForEvent(
            { account_id: "unknown-account", calendar_id: "primary" },
            colorBySource,
            false
        );
        expect(palette.base).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
});

describe("assignSourceColors", () => {
    const src = (accountId: string, calendarId: string, googleColor?: string | null) => ({
        accountId,
        calendarId,
        googleColor,
    });

    it("never gives two sources the same fallback color", () => {
        // The reason this function exists. Hashing each source
        // independently let a work "primary" and a personal "primary"
        // collide, which is precisely the pair the user reads every day
        // — and with an 8-colour palette it happened 1 time in 8.
        const colors = assignSourceColors([src(ACCOUNT_A, "primary"), src(ACCOUNT_B, "primary")]);
        expect(new Set(Object.values(colors)).size).toBe(2);
    });

    it("keeps every fallback distinct up to the palette size", () => {
        const sources = Array.from({ length: 8 }, (_, i) => src(ACCOUNT_A, `cal-${i}`));
        const colors = assignSourceColors(sources);
        expect(new Set(Object.values(colors)).size).toBe(8);
    });

    it("honours Google's own colors", () => {
        const colors = assignSourceColors([
            src(ACCOUNT_A, "primary", "#33B679"),
            src(ACCOUNT_B, "primary"),
        ]);
        expect(colors[sourceKey(ACCOUNT_A, "primary")]).toBe("#33B679");
    });

    it("does not hand a fallback the same color Google already used", () => {
        const googleColor = "#4285F4"; // also the first palette entry
        const colors = assignSourceColors([
            src(ACCOUNT_A, "primary", googleColor),
            src(ACCOUNT_B, "primary"),
            src(ACCOUNT_B, "other"),
        ]);
        const fallbacks = [
            colors[sourceKey(ACCOUNT_B, "primary")],
            colors[sourceKey(ACCOUNT_B, "other")],
        ];
        expect(fallbacks).not.toContain(googleColor);
    });

    it("ignores an invalid Google color and still assigns a real one", () => {
        const colors = assignSourceColors([src(ACCOUNT_A, "primary", "not-a-color")]);
        expect(colors[sourceKey(ACCOUNT_A, "primary")]).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it("is stable across calls with the same input", () => {
        const sources = [src(ACCOUNT_A, "primary"), src(ACCOUNT_B, "primary")];
        expect(assignSourceColors(sources)).toEqual(assignSourceColors(sources));
    });

    it("does not recolor existing calendars when a new account is appended", () => {
        // Connecting a second account must not reshuffle the colors the
        // user has already learned for the first.
        const before = assignSourceColors([src(ACCOUNT_A, "primary"), src(ACCOUNT_A, "other")]);
        const after = assignSourceColors([
            src(ACCOUNT_A, "primary"),
            src(ACCOUNT_A, "other"),
            src(ACCOUNT_B, "primary"),
        ]);
        expect(after[sourceKey(ACCOUNT_A, "primary")]).toBe(
            before[sourceKey(ACCOUNT_A, "primary")]
        );
        expect(after[sourceKey(ACCOUNT_A, "other")]).toBe(before[sourceKey(ACCOUNT_A, "other")]);
    });

    it("still assigns a color when there are more calendars than palette entries", () => {
        const sources = Array.from({ length: 20 }, (_, i) => src(ACCOUNT_A, `cal-${i}`));
        const colors = assignSourceColors(sources);
        expect(Object.keys(colors)).toHaveLength(20);
        for (const c of Object.values(colors)) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
});
