import { afterEach, describe, expect, it, vi } from "vitest";

import {
    formatTimeInZone,
    hoursFromViewer,
    isValidZone,
    listZoneOptions,
    resolveDisplayZone,
} from "../utils/userTimezone";

describe("resolveDisplayZone", () => {
    it("prefers the zone the user picked over the one their browser reported", () => {
        // The whole reason `current_location` is a separate column. If the
        // detected zone won here, a manual choice would last only until
        // the user next opened the app from somewhere else.
        expect(
            resolveDisplayZone({ currentLocation: "Asia/Tokyo", timezone: "Europe/Paris" })
        ).toBe("Asia/Tokyo");
    });

    it("falls back to the detected zone when nothing was picked", () => {
        expect(resolveDisplayZone({ timezone: "Europe/Paris" })).toBe("Europe/Paris");
    });

    it("treats an empty picked zone as not picked", () => {
        // Clearing the location writes "", not null.
        expect(resolveDisplayZone({ currentLocation: "", timezone: "Europe/Paris" })).toBe(
            "Europe/Paris"
        );
    });

    it("returns null when neither is known, so callers render nothing", () => {
        expect(resolveDisplayZone({})).toBeNull();
    });
});

describe("listZoneOptions", () => {
    it("splits a zone id into a searchable city and region", () => {
        const tokyo = listZoneOptions().find((option) => option.id === "Asia/Tokyo");
        expect(tokyo).toEqual({ id: "Asia/Tokyo", city: "Tokyo", region: "Asia" });
    });

    it("uses the LAST segment for three-part zone ids", () => {
        // "America/Argentina/San_Luis" and friends. Taking the second
        // segment would label a dozen Argentine cities "Argentina" and
        // file them all under A. Asserted over whatever three-part zones
        // this runtime ships rather than a hardcoded one, since the set
        // changes between tzdata releases.
        const threePart = listZoneOptions().filter((option) => option.id.split("/").length === 3);
        expect(threePart.length).toBeGreaterThan(0);
        for (const option of threePart) {
            const lastSegment = option.id.split("/")[2].replace(/_/g, " ");
            expect(option.city).toBe(lastSegment);
        }
    });

    it("replaces the underscores in a city name", () => {
        const newYork = listZoneOptions().find((option) => option.id === "America/New_York");
        expect(newYork?.city).toBe("New York");
    });

    it("drops zones that name no city", () => {
        // "UTC" is not somewhere a person is.
        expect(listZoneOptions().some((option) => option.id === "UTC")).toBe(false);
    });

    it("is sorted by city so the picker reads alphabetically", () => {
        const cities = listZoneOptions().map((option) => option.city);
        expect(cities).toEqual([...cities].sort((a, b) => a.localeCompare(b)));
    });

    it("returns an empty list rather than throwing where Intl lacks the API", () => {
        // Old embeddings predate `supportedValuesOf`. A profile field is
        // not worth crashing a render over.
        const spy = vi.spyOn(Intl, "supportedValuesOf").mockImplementation(() => {
            throw new TypeError("not a function");
        });
        expect(listZoneOptions()).toEqual([]);
        spy.mockRestore();
    });
});

describe("isValidZone", () => {
    it("accepts a real zone and rejects invented ones", () => {
        expect(isValidZone("Asia/Tokyo")).toBe(true);
        expect(isValidZone("Middle/Earth")).toBe(false);
        expect(isValidZone("")).toBe(false);
    });
});

describe("formatTimeInZone", () => {
    afterEach(() => vi.useRealTimers());

    it("formats the instant in the target zone, not the viewer's", () => {
        // 2026-06-01T00:00:00Z is 09:00 in Tokyo and 02:00 in Paris.
        const instant = new Date("2026-06-01T00:00:00Z");
        expect(formatTimeInZone("Asia/Tokyo", "en-GB", instant)).toBe("09:00");
        expect(formatTimeInZone("Europe/Paris", "en-GB", instant)).toBe("02:00");
    });

    it("returns null for a zone this runtime can't format", () => {
        // Zone names do get retired; a stale one must not throw on a
        // profile card.
        expect(formatTimeInZone("Middle/Earth", "en-GB")).toBeNull();
    });
});

// These assert relationships rather than absolute offsets, because the
// suite doesn't pin TZ: the machine running it is in Tokyo, CI is in UTC,
// and a test that only holds in one of those is worse than no test.
describe("hoursFromViewer", () => {
    afterEach(() => vi.useRealTimers());

    it("is zero for the viewer's own zone", () => {
        expect(hoursFromViewer(Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(0);
    });

    it("puts the right distance between two zones whoever is looking", () => {
        // Tokyo is UTC+9 and New York UTC-4 in June: 13 hours apart. The
        // viewer's own zone cancels out of the difference.
        const instant = new Date("2026-06-01T00:00:00Z");
        const tokyo = hoursFromViewer("Asia/Tokyo", instant);
        const newYork = hoursFromViewer("America/New_York", instant);
        expect(tokyo! - newYork!).toBe(13);
    });

    it("is signed — east of you is positive, west negative", () => {
        const instant = new Date("2026-06-01T00:00:00Z");
        const auckland = hoursFromViewer("Pacific/Auckland", instant)!;
        const honolulu = hoursFromViewer("Pacific/Honolulu", instant)!;
        expect(auckland).toBeGreaterThan(honolulu);
    });

    it("respects daylight saving rather than using a fixed offset", () => {
        // New York is UTC-5 in January and UTC-4 in June, so it moves one
        // hour closer to a viewer who doesn't observe the same change.
        // Tokyo has no DST, which makes it a stable reference point.
        const winter = new Date("2026-01-15T12:00:00Z");
        const summer = new Date("2026-06-15T12:00:00Z");
        const gapInWinter =
            hoursFromViewer("Asia/Tokyo", winter)! - hoursFromViewer("America/New_York", winter)!;
        const gapInSummer =
            hoursFromViewer("Asia/Tokyo", summer)! - hoursFromViewer("America/New_York", summer)!;
        expect(gapInWinter).toBe(14);
        expect(gapInSummer).toBe(13);
    });

    it("returns null for an unformattable zone", () => {
        expect(hoursFromViewer("Middle/Earth")).toBeNull();
    });
});
