/**
 * MIP-1816: a task due TODAY is not overdue, in any time zone (MIP-1811's twin, for the
 * comparisons against "today"). `new Date("2026-11-25")` is UTC midnight = Nov 24 local west of
 * UTC, so before the fix a task due today was already overdue / expired / sorted as past in the
 * Americas. Zone forced per case with `process.env.TZ`; Asia/Tokyo is the east-of-UTC control.
 * "Now" is Nov 25 2026, noon local.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { computeAssigneeStats, computeUpNext } from "../features/tasks/utils/dashboardStats";
import {
    isDueWithin,
    isExpiredDue,
    isOverdueDate,
    sprintWindowMs,
} from "../features/tasks/utils/dueWindow";
import { compareByUrgency } from "../features/tasks/utils/topWeightSort";
import { startOfTodayMs } from "../utils/calendarDate";

const ZONES = ["America/Los_Angeles", "Pacific/Honolulu", "Asia/Tokyo"] as const;
const ORIGINAL_TZ = process.env.TZ;

const task = (id: string, dueDate: string | null, extra: object = {}) =>
    ({
        id,
        dueDate,
        effectiveStatus: "Open",
        priority: "Normal",
        ...extra,
    }) as never;

describe.each(ZONES)("due today is not overdue in %s", (zone) => {
    beforeEach(() => {
        process.env.TZ = zone;
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 10, 25, 12, 0, 0));
    });
    afterEach(() => {
        vi.useRealTimers();
        if (ORIGINAL_TZ === undefined) delete process.env.TZ;
        else process.env.TZ = ORIGINAL_TZ;
    });

    it("isOverdueDate / isDueWithin: yesterday overdue, today and +7 upcoming, +8 later", () => {
        expect(isOverdueDate("2026-11-24")).toBe(true);
        expect(isOverdueDate("2026-11-25")).toBe(false);
        expect(isOverdueDate("2026-11-26")).toBe(false);
        expect(isOverdueDate(null)).toBe(false);
        expect(isOverdueDate("soon")).toBe(false);
        expect(isDueWithin("2026-11-24")).toBe(false);
        expect(isDueWithin("2026-11-25")).toBe(true);
        expect(isDueWithin("2026-12-02")).toBe(true);
        expect(isDueWithin("2026-12-03")).toBe(false);
    });

    it("dashboard KPI counts (computeAssigneeStats)", () => {
        const stats = computeAssigneeStats([
            task("1", "2026-11-24"),
            task("2", "2026-11-25"),
            task("3", "2026-12-02"),
            task("4", "2026-12-03"),
            task("5", "2026-11-20", { effectiveStatus: "Closed" }),
        ] as never);
        expect(stats.overdueCount).toBe(1);
        expect(stats.dueThisWeekCount).toBe(2);
    });

    it("compareByUrgency: only yesterday sorts as overdue", () => {
        const todayMs = startOfTodayMs();
        const today = task("t", "2026-11-25", { priority: "Low" });
        const high = task("h", "2026-11-30", { priority: "High" });
        const yesterday = task("y", "2026-11-24", { priority: "Low" });
        // Not overdue -> priority decides: High before the due-today Low.
        expect(compareByUrgency(high, today, todayMs)).toBeLessThan(0);
        // Overdue always first.
        expect(compareByUrgency(yesterday, high, todayMs)).toBeLessThan(0);
        const ids = computeUpNext([today, high, yesterday] as never, "urgency").map((t) => t.id);
        expect(ids).toEqual(["y", "h", "t"]);
    });

    it('the "expired" filter: yesterday yes, today no', () => {
        const todayStart = startOfTodayMs();
        expect(isExpiredDue("2026-11-24", todayStart)).toBe(true);
        expect(isExpiredDue("2026-11-25", todayStart)).toBe(false);
        expect(isExpiredDue("2026-11-26", todayStart)).toBe(false);
        expect(isExpiredDue("garbage", todayStart)).toBe(false);
    });

    it("sprint window runs from local midnight of day one to the end of the last day", () => {
        const { start, end } = sprintWindowMs("2026-11-16", "2026-11-25");
        expect(start).toBe(new Date(2026, 10, 16, 0, 0, 0).getTime());
        expect(end).toBe(new Date(2026, 10, 25, 23, 59, 59, 999).getTime());
        // A task closed at 20:00 local on the sprint's last day is inside the window.
        const closed = new Date(2026, 10, 25, 20, 0, 0).getTime();
        expect(closed >= start && closed <= end).toBe(true);
    });
});
