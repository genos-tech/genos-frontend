import { describe, expect, it } from "vitest";

import {
    formatStatusExpiry,
    isStatusExpired,
    msUntilStatusExpiry,
    STATUS_EXPIRY_1H,
    STATUS_EXPIRY_4H,
    STATUS_EXPIRY_30M,
    statusExpiryEndOfThisWeek,
    statusExpiryEndOfToday,
    statusExpiryIn,
    toLocalInputValue,
} from "../../services/notifications/statusExpiry";

// The same fixed reference instant the snooze tests use: 2026-08-10T12:00:00Z,
// a Monday. Asia/Tokyo (UTC+9) reads 21:00 local; America/New_York (UTC-4 in
// August, DST) reads 08:00 local — so one `now` exercises the wall-clock
// builders across zones and a day boundary.
const NOON_UTC = Date.parse("2026-08-10T12:00:00Z");

describe("statusExpiry.isStatusExpired", () => {
    it("is expired once the instant has passed", () => {
        const past = new Date(NOON_UTC - 1).toISOString();
        expect(isStatusExpired(past, NOON_UTC)).toBe(true);
    });

    it("is expired exactly at the boundary (now === expiry)", () => {
        // The status auto-clears the moment it lapses, so the boundary counts
        // as expired (the opposite half-open edge from isSnoozedNow's < until).
        const at = new Date(NOON_UTC).toISOString();
        expect(isStatusExpired(at, NOON_UTC)).toBe(true);
    });

    it("is NOT expired while the instant is still in the future", () => {
        const future = new Date(NOON_UTC + 60_000).toISOString();
        expect(isStatusExpired(future, NOON_UTC)).toBe(false);
    });

    it("treats null / undefined / empty as no expiry (never expired)", () => {
        expect(isStatusExpired(null, NOON_UTC)).toBe(false);
        expect(isStatusExpired(undefined, NOON_UTC)).toBe(false);
        expect(isStatusExpired("", NOON_UTC)).toBe(false);
    });

    it("treats a malformed instant as no expiry", () => {
        expect(isStatusExpired("not-a-date", NOON_UTC)).toBe(false);
    });
});

describe("statusExpiry.msUntilStatusExpiry", () => {
    it("returns the ms remaining until a future expiry", () => {
        const future = new Date(NOON_UTC + 90_000).toISOString();
        expect(msUntilStatusExpiry(future, NOON_UTC)).toBe(90_000);
    });

    it("returns null once the expiry has elapsed (including the boundary)", () => {
        expect(msUntilStatusExpiry(new Date(NOON_UTC - 1).toISOString(), NOON_UTC)).toBeNull();
        expect(msUntilStatusExpiry(new Date(NOON_UTC).toISOString(), NOON_UTC)).toBeNull();
    });

    it("returns null for unset / malformed values", () => {
        expect(msUntilStatusExpiry(null, NOON_UTC)).toBeNull();
        expect(msUntilStatusExpiry(undefined, NOON_UTC)).toBeNull();
        expect(msUntilStatusExpiry("nope", NOON_UTC)).toBeNull();
    });
});

describe("statusExpiry.statusExpiryIn (fixed durations, zone-independent)", () => {
    it("30m / 1h / 4h land at now + the offset", () => {
        expect(statusExpiryIn(STATUS_EXPIRY_30M, NOON_UTC)).toBe("2026-08-10T12:30:00.000Z");
        expect(statusExpiryIn(STATUS_EXPIRY_1H, NOON_UTC)).toBe("2026-08-10T13:00:00.000Z");
        expect(statusExpiryIn(STATUS_EXPIRY_4H, NOON_UTC)).toBe("2026-08-10T16:00:00.000Z");
    });
});

describe("statusExpiry.statusExpiryEndOfToday (local midnight)", () => {
    it("resolves to the coming local midnight in UTC", () => {
        // End of 2026-08-10 UTC is 2026-08-11T00:00Z.
        expect(statusExpiryEndOfToday("UTC", NOON_UTC)).toBe("2026-08-11T00:00:00.000Z");
    });

    it("resolves local midnight in Asia/Tokyo (UTC+9)", () => {
        // At NOON_UTC Tokyo reads 21:00 on the 10th; its next midnight (the
        // 11th 00:00 JST) is 2026-08-10T15:00Z.
        expect(statusExpiryEndOfToday("Asia/Tokyo", NOON_UTC)).toBe("2026-08-10T15:00:00.000Z");
    });

    it("resolves local midnight in America/New_York (UTC-4, DST)", () => {
        // NY reads 08:00 on the 10th; next midnight (11th 00:00 EDT) is
        // 2026-08-11T04:00Z.
        expect(statusExpiryEndOfToday("America/New_York", NOON_UTC)).toBe(
            "2026-08-11T04:00:00.000Z"
        );
    });

    it("is always in the future", () => {
        expect(Date.parse(statusExpiryEndOfToday("UTC", NOON_UTC))).toBeGreaterThan(NOON_UTC);
        expect(Date.parse(statusExpiryEndOfToday("Asia/Tokyo", NOON_UTC))).toBeGreaterThan(
            NOON_UTC
        );
    });
});

describe("statusExpiry.statusExpiryEndOfThisWeek (end of coming Friday, local)", () => {
    it("from a Monday, lands on the end of that week's Friday (Sat 00:00 local)", () => {
        // NOON_UTC is Monday 2026-08-10. End of Friday the 14th = Sat 15th
        // 00:00 UTC.
        expect(statusExpiryEndOfThisWeek("UTC", NOON_UTC)).toBe("2026-08-15T00:00:00.000Z");
    });

    it("respects the zone (Asia/Tokyo Sat 00:00 local = Fri 15:00Z)", () => {
        // Sat 2026-08-15 00:00 JST = 2026-08-14T15:00Z.
        expect(statusExpiryEndOfThisWeek("Asia/Tokyo", NOON_UTC)).toBe("2026-08-14T15:00:00.000Z");
    });

    it("when today IS Friday, means end of today (not a week away)", () => {
        // Friday 2026-08-14T12:00Z -> end of Friday = Sat 15th 00:00 UTC.
        const friNoon = Date.parse("2026-08-14T12:00:00Z");
        expect(statusExpiryEndOfThisWeek("UTC", friNoon)).toBe("2026-08-15T00:00:00.000Z");
    });

    it("on Saturday, the coming Friday is next week's", () => {
        // Saturday 2026-08-15T12:00Z -> next Friday is the 21st; end = Sat 22nd.
        const satNoon = Date.parse("2026-08-15T12:00:00Z");
        expect(statusExpiryEndOfThisWeek("UTC", satNoon)).toBe("2026-08-22T00:00:00.000Z");
    });

    it("is always in the future", () => {
        expect(Date.parse(statusExpiryEndOfThisWeek("UTC", NOON_UTC))).toBeGreaterThan(NOON_UTC);
    });
});

describe("statusExpiry.formatStatusExpiry", () => {
    it("returns '' for missing / malformed values", () => {
        expect(formatStatusExpiry(null)).toBe("");
        expect(formatStatusExpiry(undefined)).toBe("");
        expect(formatStatusExpiry("")).toBe("");
        expect(formatStatusExpiry("not-a-date")).toBe("");
    });

    it("omits the weekday when the instant is later today", () => {
        // A fixed reference "now" (see NOON_UTC above), not the real clock —
        // this used to be `Date.now() + 2h`, which flipped to a different
        // calendar day (and flaked) whenever the suite happened to run
        // within 2h of local midnight.
        const laterToday = new Date(NOON_UTC + 2 * STATUS_EXPIRY_1H).toISOString();
        const out = formatStatusExpiry(laterToday, NOON_UTC);
        expect(out).not.toBe("");
        // No three-letter weekday abbreviation when it's today.
        expect(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/.test(out)).toBe(false);
    });

    it("includes the weekday when the instant is on another day", () => {
        // Eight days out is guaranteed a different calendar day regardless of
        // the local clock the test runs under.
        const nextWeek = new Date(NOON_UTC + 8 * 24 * STATUS_EXPIRY_1H).toISOString();
        const out = formatStatusExpiry(nextWeek, NOON_UTC);
        expect(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/.test(out)).toBe(true);
    });
});

describe("statusExpiry.toLocalInputValue", () => {
    it("renders a datetime-local YYYY-MM-DDTHH:MM string in local wall-clock", () => {
        // Build from local components so the assertion is zone-agnostic: the
        // output must read back the same wall-clock the Date was made with.
        const d = new Date(2026, 7, 11, 9, 5); // Aug 11 2026, 09:05 local
        expect(toLocalInputValue(d)).toBe("2026-08-11T09:05");
    });

    it("zero-pads month, day, hour, and minute", () => {
        const d = new Date(2026, 0, 2, 3, 4); // Jan 2 2026, 03:04 local
        expect(toLocalInputValue(d)).toBe("2026-01-02T03:04");
    });
});
