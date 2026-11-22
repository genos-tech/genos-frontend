/**
 * MIP-1898: "today" is the viewer's calendar day, not the UTC date (MIP-1816's twin for the
 * places that build today as a string). Zone forced per case with `process.env.TZ`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sprintBucketOf } from "../features/tasks/sprint-milestone/utils/sprintBucket";
import { todayCalendarIso } from "../utils/calendarDate";
import { getFormattedNDaysAfterDateStr, getFormattedTodayDateStr } from "../utils/dateUtils";

const ORIGINAL_TZ = process.env.TZ;

const inZone = (zone: string, now: Date) => {
    process.env.TZ = zone;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
};

afterEach(() => {
    vi.useRealTimers();
    if (ORIGINAL_TZ === undefined) delete process.env.TZ;
    else process.env.TZ = ORIGINAL_TZ;
});

describe("today in the viewer's time zone", () => {
    beforeEach(() => undefined);

    it("Los Angeles, 20:00 on Nov 25: a sprint ending today is current, not past", () => {
        inZone("America/Los_Angeles", new Date(2026, 10, 25, 20, 0, 0));
        expect(todayCalendarIso()).toBe("2026-11-25");
        expect(
            sprintBucketOf({ startDate: "2026-11-16", endDate: "2026-11-25" }, todayCalendarIso())
        ).toBe("current");
    });

    it("Tokyo, 07:00 on Nov 25: today is Nov 25 (the due-date picker minimum) and a sprint starting today is current", () => {
        inZone("Asia/Tokyo", new Date(2026, 10, 25, 7, 0, 0));
        expect(getFormattedTodayDateStr()).toBe("2026-11-25");
        expect(getFormattedNDaysAfterDateStr(2)).toBe("2026-11-27");
        expect(
            sprintBucketOf({ startDate: "2026-11-25", endDate: "2026-12-08" }, todayCalendarIso())
        ).toBe("current");
    });
});

describe("no UTC date taken as a calendar day", () => {
    // These build a date from a calendar string with UTC arithmetic, or a file name / cutoff:
    // they mean UTC (or are day arithmetic on a string) and stay.
    const ALLOWED = new Set([
        "features/tasks/sprint-milestone/components/SprintConfigDialog.tsx",
        "features/calendar/utils/eventWhen.ts",
        "features/admin/services/accountLifecycle.ts",
        "features/agentQA/mentions/useAgentMentionSources.ts",
        "utils/dateUtils.ts",
    ]);
    const walk = (dir: string): string[] =>
        readdirSync(dir).flatMap((name) => {
            const p = join(dir, name);
            if (statSync(p).isDirectory()) return name === "__tests__" ? [] : walk(p);
            return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
        });

    it('`toISOString().slice(0, 10)` / `.split("T")[0]` appears only in the allow-list', () => {
        const src = resolve(__dirname, "..");
        const offenders = walk(src)
            .filter((f) =>
                /toISOString\(\)\s*\.(slice\(0, 10\)|split\("T"\)\[0\])/.test(
                    readFileSync(f, "utf8")
                )
            )
            .map((f) => f.slice(src.length + 1))
            .filter((f) => !ALLOWED.has(f));
        expect(offenders).toEqual([]);
    });
});
