/**
 * `getLocalTomorrowDate` — the date a to-do moved to "tomorrow" is filed
 * under.
 *
 * To-do groups are keyed by the date the CLIENT says it is, and the server
 * takes that string verbatim, so this function's only job is to be exactly
 * one day after `getLocalCurrentDate`. The reason it exists at all is that
 * the pre-existing `getFormattedNDaysAfterDateStr(1)` formats through
 * `toISOString()` — UTC — which disagrees with `getLocalCurrentDate`'s local
 * fields for most of the day in most timezones. Those two are compared
 * directly here, since a regression would be silent: the to-do just lands on
 * the wrong day.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    getFormattedNDaysAfterDateStr,
    getLocalCurrentDate,
    getLocalTomorrowDate,
} from "../utils/dateUtils";

/** Freeze the clock at a local wall-clock time. Constructing the Date from
 *  local components (not an ISO string) is what makes "22:30 on the 14th" mean
 *  22:30 in whatever zone the test process runs in. */
const freezeLocal = (y: number, m: number, d: number, h = 12, min = 0) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(y, m - 1, d, h, min, 0));
};

afterEach(() => vi.useRealTimers());

describe("getLocalTomorrowDate", () => {
    it("is one day after getLocalCurrentDate", () => {
        freezeLocal(2026, 9, 23);
        expect(getLocalCurrentDate()).toBe("2026-09-23");
        expect(getLocalTomorrowDate()).toBe("2026-09-24");
    });

    it("rolls over the end of a month", () => {
        freezeLocal(2026, 9, 30);
        expect(getLocalTomorrowDate()).toBe("2026-10-01");
    });

    it("rolls over the end of a year", () => {
        freezeLocal(2026, 12, 31);
        expect(getLocalTomorrowDate()).toBe("2027-01-01");
    });

    it("handles a leap day", () => {
        freezeLocal(2028, 2, 28);
        expect(getLocalTomorrowDate()).toBe("2028-02-29");
    });

    it("pads single-digit months and days", () => {
        // A bare `${month}` would give "2026-1-8", which the server's
        // `strptime("%Y-%m-%d")` rejects outright.
        freezeLocal(2026, 1, 7);
        expect(getLocalTomorrowDate()).toBe("2026-01-08");
    });

    it("stays exactly one day ahead of today at both ends of the day", () => {
        // The interesting hours: late evening and early morning are when a
        // local date and a UTC date are most likely to disagree, and this
        // function has to track `getLocalCurrentDate` at every hour.
        for (const hour of [0, 1, 9, 13, 22, 23]) {
            freezeLocal(2026, 3, 14, hour, 30);
            const today = new Date(`${getLocalCurrentDate()}T00:00:00`);
            const tomorrow = new Date(`${getLocalTomorrowDate()}T00:00:00`);
            const deltaDays = (tomorrow.getTime() - today.getTime()) / 86_400_000;
            expect(deltaDays, `hour ${hour}`).toBe(1);
            vi.useRealTimers();
        }
    });

    it("does not inherit the UTC skew of getFormattedNDaysAfterDateStr", () => {
        // The trap this function was written to avoid, pinned at the hour
        // where it actually bites. `getTimezoneOffset()` is (UTC - local) in
        // minutes, so it's POSITIVE for zones behind UTC — there, late local
        // evening is already the next day in UTC and the UTC-formatted helper
        // returns today+2. For zones ahead of UTC it's the small hours, where
        // UTC is still on yesterday and the helper returns today. The hour is
        // chosen from the offset rather than hardcoded so this asserts the
        // real divergence wherever CI runs; at UTC+0 there is none to find,
        // and the case has nothing to say.
        const offsetMinutes = new Date(2026, 5, 15).getTimezoneOffset();
        if (offsetMinutes === 0) return;
        freezeLocal(2026, 6, 15, offsetMinutes > 0 ? 23 : 0, 30);

        expect(getLocalCurrentDate()).toBe("2026-06-15");
        expect(getLocalTomorrowDate()).toBe("2026-06-16");
        expect(getFormattedNDaysAfterDateStr(1)).not.toBe(getLocalTomorrowDate());
    });
});
