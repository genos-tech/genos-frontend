import { describe, expect, it } from "vitest";

import {
    buildCreate,
    buildPatch,
    emptyForm,
    formFromSchedule,
    hasProblems,
    normalizeTime,
    paramKind,
    paramsFromForm,
    ScheduleForm,
    validateForm,
} from "../features/schedules/scheduleForm";
import { humanizeKey, weekdayName } from "../features/schedules/scheduleFormat";
import type { Schedule, ScheduleJob } from "../services/schedules";

const WHAT_YOU_DID: ScheduleJob = {
    job: "what_you_did",
    title: "What you did",
    description: "Your day",
    params: { day: { type: "string", enum: ["today", "yesterday"] } },
};
const WHAT_TO_DO: ScheduleJob = {
    job: "what_to_do_today",
    title: "What to do today",
    description: "Your plan",
    params: {
        changed_hours: { type: "integer", minimum: 1, maximum: 168 },
        project_id: { type: "integer" },
        note: { type: "string" },
    },
};
const JOBS = [WHAT_YOU_DID, WHAT_TO_DO];

const SCHEDULE: Schedule = {
    id: "s1",
    name: "Morning",
    job: "what_to_do_today",
    jobTitle: "What to do today",
    params: { changed_hours: 24 },
    when: "every day at 09:00",
    frequency: "daily",
    timeOfDay: "09:00",
    enabled: true,
    deliverPush: false,
    nextRun: null,
    lastRun: null,
    lastStatus: null,
};

const form = (over: Partial<ScheduleForm> = {}): ScheduleForm => ({
    ...emptyForm(JOBS),
    name: "Plan",
    job: "what_to_do_today",
    ...over,
});

describe("how a declared parameter is entered", () => {
    it("an integer is a number input, an enum a select, anything else text", () => {
        expect(paramKind({ type: "integer", minimum: 1, maximum: 168 })).toBe("integer");
        expect(paramKind({ type: "integer" })).toBe("integer");
        expect(paramKind({ type: "string", enum: ["a", "b"] })).toBe("enum");
        expect(paramKind({ type: "string" })).toBe("text");
        expect(paramKind({ type: "boolean" })).toBe("boolean"); // a switch (MIP-1212)
        expect(paramKind({})).toBe("text");
    });

    it("goes on the wire by its declared type, not by its widget", () => {
        // project_id has no range, so it is not "a ranged integer", yet it is
        // still sent as a number.
        expect(
            paramsFromForm(WHAT_TO_DO, { changed_hours: "48", project_id: "7", note: "7" })
        ).toEqual({ changed_hours: 48, project_id: 7, note: "7" });
    });

    it("sends nothing for an empty input, so the server default applies", () => {
        expect(paramsFromForm(WHAT_TO_DO, { changed_hours: "", project_id: "  " })).toEqual({});
    });
});

describe("only declared parameters are ever sent", () => {
    it("drops a typed key the job does not declare", () => {
        expect(paramsFromForm(WHAT_YOU_DID, { day: "today", changed_hours: "24" })).toEqual({
            day: "today",
        });
    });

    it("a create carries only the chosen job's declared keys", () => {
        const body = buildCreate(
            form({ job: "what_you_did", params: { day: "yesterday", changed_hours: "5" } }),
            WHAT_YOU_DID
        );
        expect(body.params).toEqual({ day: "yesterday" });
    });

    it("editing never copies keys over from the old params", () => {
        const old = { ...SCHEDULE, params: { changed_hours: 24, stale_key: "x" } };
        const patch = buildPatch(old, form({ params: { changed_hours: "30" } }), WHAT_TO_DO);
        expect(patch.params).toEqual({ changed_hours: 30 });
    });

    it("switching job sends the new job's params alone, even when empty", () => {
        const old = { ...SCHEDULE, params: { changed_hours: 24 } };
        const patch = buildPatch(old, form({ job: "what_you_did", params: {} }), WHAT_YOU_DID);
        expect(patch.job).toBe("what_you_did");
        expect(patch.params).toEqual({});
    });

    it("a stale key in the old params does not count as a change", () => {
        const old = { ...SCHEDULE, params: { changed_hours: 24, stale_key: "x" } };
        expect(buildPatch(old, formFromSchedule(old, JOBS), WHAT_TO_DO)).toEqual({});
    });

    it("the edit form starts from the declared keys only", () => {
        const old = { ...SCHEDULE, params: { changed_hours: 24, stale_key: "x" } };
        expect(formFromSchedule(old, JOBS).params).toEqual({ changed_hours: "24" });
    });
});

describe("an edit sends only what changed", () => {
    it("is empty when nothing changed", () => {
        expect(buildPatch(SCHEDULE, formFromSchedule(SCHEDULE, JOBS), WHAT_TO_DO)).toEqual({});
    });

    it("a rename alone sends the name alone", () => {
        const patch = buildPatch(
            SCHEDULE,
            { ...formFromSchedule(SCHEDULE, JOBS), name: "  Renamed " },
            WHAT_TO_DO
        );
        expect(patch).toEqual({ name: "Renamed" });
    });

    it("renaming a schedule whose job was removed does not resend the dead job", () => {
        const dead: Schedule = { ...SCHEDULE, job: "gone_job", jobTitle: null, params: { x: 1 } };
        const f = { ...formFromSchedule(dead, JOBS), name: "Renamed" };
        expect(buildPatch(dead, f, undefined)).toEqual({ name: "Renamed" });
        // and it can still be saved with the job left alone
        expect(hasProblems(validateForm(f, undefined, true))).toBe(false);
        expect(hasProblems(validateForm(f, undefined, false))).toBe(true);
    });

    it("changing the frequency sends the fields the new one uses", () => {
        const patch = buildPatch(
            SCHEDULE,
            { ...formFromSchedule(SCHEDULE, JOBS), frequency: "weekly", weekdays: [2, 0] },
            WHAT_TO_DO
        );
        expect(patch).toEqual({ frequency: "weekly", weekdays: [0, 2] });
    });

    it("normalises the time before comparing and sending", () => {
        const patch = buildPatch(
            SCHEDULE,
            { ...formFromSchedule(SCHEDULE, JOBS), timeOfDay: "7:05" },
            WHAT_TO_DO
        );
        expect(patch).toEqual({ timeOfDay: "07:05" });
    });

    it("sends the push switch when it flips", () => {
        const patch = buildPatch(
            SCHEDULE,
            { ...formFromSchedule(SCHEDULE, JOBS), deliverPush: true },
            WHAT_TO_DO
        );
        expect(patch).toEqual({ deliverPush: true });
    });
});

describe("a create sends only the fields its frequency uses", () => {
    it("daily has no weekdays, month day or date", () => {
        const body = buildCreate(
            form({ weekdays: [1], monthDay: "5", runDate: "2026-12-01" }),
            WHAT_TO_DO
        );
        expect(body).toEqual({
            name: "Plan",
            job: "what_to_do_today",
            params: {},
            frequency: "daily",
            timeOfDay: "09:00",
            deliverPush: true,
        });
    });

    it("a member who switched push off sends false (MIP-1374)", () => {
        expect(buildCreate(form({ deliverPush: false }), WHAT_TO_DO)).toMatchObject({
            deliverPush: false,
        });
    });

    it("weekly sends sorted weekdays, monthly the day as a number, once the date", () => {
        expect(
            buildCreate(form({ frequency: "weekly", weekdays: [4, 0] }), WHAT_TO_DO)
        ).toMatchObject({
            frequency: "weekly",
            weekdays: [0, 4],
        });
        expect(
            buildCreate(form({ frequency: "monthly", monthDay: "31" }), WHAT_TO_DO)
        ).toMatchObject({
            frequency: "monthly",
            monthDay: 31,
        });
        expect(
            buildCreate(form({ frequency: "once", runDate: "2026-12-01" }), WHAT_TO_DO)
        ).toMatchObject({ frequency: "once", runDate: "2026-12-01" });
    });
});

describe("a required parameter comes from the catalog (MIP-1473)", () => {
    // A job the client has never heard of, with a parameter it must have.
    const NEW_JOB: ScheduleJob = {
        job: "brand_new_job",
        title: "Brand new",
        description: "A job added on the server after this client was built.",
        params: {
            workspace_code: { type: "string", required: true },
            note: { type: "string" },
        },
    };

    it("marks it required with no client-side list, and the optional one is not", () => {
        const f = form({ job: "brand_new_job", params: {} });
        const p = validateForm(f, NEW_JOB);
        expect(p.params.workspace_code).toBe("required");
        expect(p.params.note).toBeUndefined();
        expect(hasProblems(validateForm({ ...f, params: { workspace_code: "x" } }, NEW_JOB))).toBe(
            false
        );
    });

    it("no longer guesses from the parameter's name: milestone_id is required only when the catalog says so", () => {
        const optional: ScheduleJob = {
            ...NEW_JOB,
            params: { milestone_id: { type: "integer", minimum: 1 } },
        };
        expect(validateForm(form({ params: {} }), optional).params.milestone_id).toBeUndefined();
        const required: ScheduleJob = {
            ...NEW_JOB,
            params: { milestone_id: { type: "integer", minimum: 1, required: true } },
        };
        expect(validateForm(form({ params: {} }), required).params.milestone_id).toBe("required");
    });
});

describe("validation", () => {
    it("accepts a good form", () => {
        expect(hasProblems(validateForm(form(), WHAT_TO_DO))).toBe(false);
    });

    it("needs a name and a job", () => {
        const p = validateForm(form({ name: "  ", job: "" }), undefined);
        expect(p.name).toBe("required");
        expect(p.job).toBe("required");
        expect(validateForm(form({ name: "x".repeat(101) }), WHAT_TO_DO).name).toBe("tooLong");
    });

    it("holds an integer parameter to its declared range", () => {
        expect(validateForm(form({ params: { changed_hours: "0" } }), WHAT_TO_DO).params).toEqual({
            changed_hours: "range",
        });
        expect(
            validateForm(form({ params: { changed_hours: "169" } }), WHAT_TO_DO).params
        ).toEqual({
            changed_hours: "range",
        });
        expect(
            validateForm(form({ params: { changed_hours: "2.5" } }), WHAT_TO_DO).params
        ).toEqual({
            changed_hours: "format",
        });
        expect(
            hasProblems(validateForm(form({ params: { changed_hours: "168" } }), WHAT_TO_DO))
        ).toBe(false);
        // no range declared: any whole number
        expect(
            hasProblems(validateForm(form({ params: { project_id: "99999" } }), WHAT_TO_DO))
        ).toBe(false);
    });

    it("refuses an enum value the job does not list", () => {
        expect(
            validateForm(form({ job: "what_you_did", params: { day: "tomorrow" } }), WHAT_YOU_DID)
                .params
        ).toEqual({ day: "format" });
    });

    it("wants 24-hour HH:MM", () => {
        expect(normalizeTime("09:00")).toBe("09:00");
        expect(normalizeTime("9:05")).toBe("09:05");
        expect(normalizeTime("24:00")).toBeNull();
        expect(normalizeTime("12:60")).toBeNull();
        expect(normalizeTime("9am")).toBeNull();
        expect(validateForm(form({ timeOfDay: "25:00" }), WHAT_TO_DO).timeOfDay).toBe("format");
        expect(validateForm(form({ timeOfDay: "" }), WHAT_TO_DO).timeOfDay).toBe("required");
    });

    it("weekly needs a day, monthly a day 1-31, once a date", () => {
        expect(validateForm(form({ frequency: "weekly" }), WHAT_TO_DO).weekdays).toBe("required");
        expect(
            validateForm(form({ frequency: "monthly", monthDay: "0" }), WHAT_TO_DO).monthDay
        ).toBe("range");
        expect(
            validateForm(form({ frequency: "monthly", monthDay: "32" }), WHAT_TO_DO).monthDay
        ).toBe("range");
        expect(validateForm(form({ frequency: "once", runDate: "" }), WHAT_TO_DO).runDate).toBe(
            "required"
        );
        // a field the frequency does not use is never a problem
        expect(
            hasProblems(
                validateForm(form({ frequency: "daily", monthDay: "99", runDate: "" }), WHAT_TO_DO)
            )
        ).toBe(false);
    });
});

describe("display helpers", () => {
    it("names weekdays Monday-first in the page's language", () => {
        expect(weekdayName(0, "en", "short")).toBe("Mon");
        expect(weekdayName(6, "en", "long")).toBe("Sunday");
        expect(weekdayName(0, "ja", "short")).toBe("月");
    });

    it("makes a label from a key as a fallback", () => {
        expect(humanizeKey("changed_hours")).toBe("Changed hours");
    });
});
