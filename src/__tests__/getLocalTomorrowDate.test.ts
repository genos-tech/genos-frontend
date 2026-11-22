/**
 * `getLocalTomorrowDate` — the date a to-do moved to "tomorrow" is filed
 * under.
 *
 * To-do groups are keyed by the date the CLIENT says it is, and the server
 * takes that string verbatim, so this function's only job is to be exactly
 * one day after `getLocalCurrentDate`. `getFormattedNDaysAfterDateStr(1)`
 * used to format in UTC and disagree with it; it is local now, and the two
 * are compared here in forced zones, since a regression would be silent: the
 * to-do just lands on the wrong day.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

    // `getFormattedNDaysAfterDateStr` used to format through `toISOString()` (UTC) and
    // disagreed with this function for most of the day outside UTC. It now formats through
    // `localCalendarIso`, so the two must agree in every zone at every hour. The zone is
    // forced per case with `process.env.TZ` (Node re-reads it on assignment), so this runs
    // the same on a UTC CI box and on a Tokyo laptop instead of silently skipping at UTC+0.
    describe.each(["UTC", "Asia/Tokyo", "America/Los_Angeles", "Pacific/Kiritimati"])(
        "in %s",
        (zone) => {
            const originalTz = process.env.TZ;
            beforeEach(() => {
                process.env.TZ = zone;
            });
            afterEach(() => {
                if (originalTz === undefined) delete process.env.TZ;
                else process.env.TZ = originalTz;
            });

            it("agrees with getFormattedNDaysAfterDateStr(1) at every hour", () => {
                for (const hour of [0, 1, 9, 13, 22, 23]) {
                    freezeLocal(2026, 6, 15, hour, 30);
                    expect(getLocalCurrentDate(), `hour ${hour}`).toBe("2026-06-15");
                    expect(getLocalTomorrowDate(), `hour ${hour}`).toBe("2026-06-16");
                    expect(getFormattedNDaysAfterDateStr(1), `hour ${hour}`).toBe(
                        getLocalTomorrowDate()
                    );
                    vi.useRealTimers();
                }
            });
        }
    );
});
