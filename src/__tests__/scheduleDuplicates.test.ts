/**
 * The client-side "you already have this" check (MIP-1200). It asks the list on
 * screen the question the API asks (MIP-1201): same job + same parameters + same
 * recurrence and time, or the same name ignoring case.
 */
import { describe, expect, it } from "vitest";

import {
    findDuplicate,
    isSameSchedule,
    type ScheduleShape,
} from "../features/schedules/scheduleDuplicates";
import type { Schedule } from "../services/schedules";

const existing = (over: Partial<Schedule> = {}): Schedule => ({
    id: "s1",
    name: "Morning plan",
    job: "what_to_do_today",
    jobTitle: "What to do today",
    params: {},
    when: "every day at 09:00",
    frequency: "daily",
    timeOfDay: "09:00",
    enabled: true,
    deliverPush: false,
    nextRun: null,
    lastRun: null,
    lastStatus: null,
    ...over,
});

const shape = (over: Partial<ScheduleShape> = {}): ScheduleShape => ({
    name: "Another name",
    job: "what_to_do_today",
    params: {},
    frequency: "daily",
    timeOfDay: "09:00",
    ...over,
});

describe("findDuplicate", () => {
    it("finds the same job, parameters, recurrence and time under another name", () => {
        expect(findDuplicate(shape(), [existing()])).toEqual({
            kind: "same",
            schedule: existing(),
        });
    });

    it("finds the same name ignoring case and spaces, at another time", () => {
        const dup = findDuplicate(shape({ name: "  MORNING plan ", timeOfDay: "10:00" }), [
            existing(),
        ]);
        expect(dup?.kind).toBe("name");
        expect(dup?.schedule.id).toBe("s1");
    });

    it("says 'same' ahead of 'name' when both hold", () => {
        expect(findDuplicate(shape({ name: "morning plan" }), [existing()])?.kind).toBe("same");
    });

    it("is not fooled by a different time, job, frequency or parameter", () => {
        const list = [existing()];
        expect(findDuplicate(shape({ timeOfDay: "09:01" }), list)).toBeNull();
        expect(findDuplicate(shape({ job: "what_you_did" }), list)).toBeNull();
        expect(findDuplicate(shape({ frequency: "weekdays" }), list)).toBeNull();
        expect(findDuplicate(shape({ params: { changed_hours: 48 } }), list)).toBeNull();
    });

    it("compares parameters regardless of key order, and an unset one as not there", () => {
        const a = shape({ params: { project_id: 4, changed_hours: 48 } });
        const b = shape({ params: { changed_hours: 48, project_id: 4 } });
        expect(isSameSchedule(a, b)).toBe(true);
        expect(isSameSchedule(shape({ params: { project_id: "" } }), shape())).toBe(true);
    });

    it("compares the days that count for the frequency, in any order", () => {
        const weekly = (weekdays: number[]) => shape({ frequency: "weekly", weekdays, name: "x" });
        expect(isSameSchedule(weekly([2, 0]), weekly([0, 2]))).toBe(true);
        expect(isSameSchedule(weekly([0]), weekly([0, 2]))).toBe(false);
        // a day list on a DAILY schedule is ignored, as the API ignores it
        expect(isSameSchedule(shape({ weekdays: [1] }), shape({ weekdays: [3] }))).toBe(true);
        expect(
            isSameSchedule(
                shape({ frequency: "monthly", monthDay: 3 }),
                shape({ frequency: "monthly", monthDay: 4 })
            )
        ).toBe(false);
        expect(
            isSameSchedule(
                shape({ frequency: "once", runDate: "2026-12-01" }),
                shape({ frequency: "once", runDate: "2026-12-02" })
            )
        ).toBe(false);
    });

    it("never calls the schedule being edited a duplicate of itself", () => {
        expect(findDuplicate(shape({ name: "Morning plan" }), [existing()], "s1")).toBeNull();
    });

    it("finds nothing for an empty list or an empty name", () => {
        expect(findDuplicate(shape(), [])).toBeNull();
        expect(findDuplicate(shape({ name: "  ", timeOfDay: "10:00" }), [existing()])).toBeNull();
    });
});
