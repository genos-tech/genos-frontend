// deriveDaysLeft — the fresh, client-side replacement for the stale
// server-snapshotted `task.daysLeft`. Boundaries the table/board/sort all
// depend on: the -1 "Expired" clamp and the null (no due date) case.

import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import { deriveDaysLeft } from "../features/tasks/utils/daysLeft";

const iso = (d: dayjs.Dayjs) => d.format("YYYY-MM-DD");

describe("deriveDaysLeft", () => {
    it("due today → 0", () => {
        expect(deriveDaysLeft(iso(dayjs()))).toBe(0);
    });

    it("due tomorrow → 1", () => {
        expect(deriveDaysLeft(iso(dayjs().add(1, "day")))).toBe(1);
    });

    it("due in 5 days → 5", () => {
        expect(deriveDaysLeft(iso(dayjs().add(5, "day")))).toBe(5);
    });

    it("due yesterday → -1 (Expired sentinel, not -1 as a count)", () => {
        expect(deriveDaysLeft(iso(dayjs().subtract(1, "day")))).toBe(-1);
    });

    it("due 5 days ago clamps to -1", () => {
        expect(deriveDaysLeft(iso(dayjs().subtract(5, "day")))).toBe(-1);
    });

    it("no due date → null", () => {
        expect(deriveDaysLeft(null)).toBeNull();
        expect(deriveDaysLeft(undefined)).toBeNull();
        expect(deriveDaysLeft("")).toBeNull();
    });

    it("unparseable due date → null", () => {
        expect(deriveDaysLeft("not-a-date")).toBeNull();
    });
});
