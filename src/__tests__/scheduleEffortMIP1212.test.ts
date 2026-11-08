/**
 * MIP-1212: the pure half of the AI effort control: what is drawn, the estimate's wording and
 * what goes on the wire. The contract is genos-api #680 (`usesAi`, `effortDefault`, `effortCost`,
 * `aiEffort`, `aiEffortEffective`).
 */
import { describe, expect, it } from "vitest";

import {
    aiSwitchKey,
    asEffortLevel,
    chosenEffort,
    costText,
    rowEffort,
    showsEffort,
} from "../features/schedules/scheduleEffort";
import {
    buildCreate,
    buildPatch,
    emptyForm,
    formFromSchedule,
    paramKind,
    paramsFromForm,
    validateForm,
} from "../features/schedules/scheduleForm";
import type { EffortCost, Schedule, ScheduleJob } from "../services/schedules";

const COST: EffortCost = {
    estimate: true,
    basis: "a report listing 10 tasks with comments",
    levels: {
        low: { model: "m1", creditsMilli: [15, 23], usdMicro: [1526, 2264] },
        medium: { model: "m2", creditsMilli: [62, 93], usdMicro: [6242, 9286] },
        high: { model: "m3", creditsMilli: [89, 193], usdMicro: [8878, 19340] },
    },
};

const AI_JOB: ScheduleJob = {
    job: "what_to_do_today",
    title: "What to do today",
    description: "",
    params: {
        changed_hours: { type: "integer", minimum: 1, maximum: 168 },
        ai_sentences: { type: "boolean", description: "English only" },
    },
    usesAi: true,
    effortDefault: "low",
    effortCost: COST,
};
const PLAIN_JOB: ScheduleJob = {
    job: "what_you_did",
    title: "What you did",
    description: "",
    params: {},
    usesAi: false,
    effortDefault: null,
    effortCost: null,
};

const schedule = (over: Partial<Schedule> = {}): Schedule => ({
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
    aiEffort: null,
    aiEffortEffective: "low",
    ...over,
});

describe("which levels and jobs count", () => {
    it("reads only the three levels", () => {
        expect(["low", "medium", "high", "max", "", null, 3].map(asEffortLevel)).toEqual([
            "low",
            "medium",
            "high",
            null,
            null,
            null,
            null,
        ]);
    });

    it("shows the member's choice, else the job's default", () => {
        expect(chosenEffort(AI_JOB, "")).toBe("low");
        expect(chosenEffort(AI_JOB, "high")).toBe("high");
        expect(chosenEffort(AI_JOB, "bogus")).toBe("low");
        expect(chosenEffort(PLAIN_JOB, "")).toBeNull();
    });

    it("draws the control only for a job that uses AI, and not while its AI switch is off", () => {
        expect(showsEffort(AI_JOB, {})).toBe(true);
        expect(showsEffort(AI_JOB, { ai_sentences: "true" })).toBe(true);
        expect(showsEffort(AI_JOB, { ai_sentences: "false" })).toBe(false);
        expect(showsEffort(PLAIN_JOB, {})).toBe(false);
        // A server that predates the field says nothing: no control.
        expect(showsEffort({ ...AI_JOB, usesAi: undefined }, {})).toBe(false);
        expect(showsEffort(undefined, {})).toBe(false);
        expect(aiSwitchKey(AI_JOB)).toBe("ai_sentences");
        expect(aiSwitchKey(PLAIN_JOB)).toBeUndefined();
    });
});

describe("the estimate", () => {
    it("reads thousandths of a credit at the hundredth, as Plan & usage does", () => {
        expect(costText(COST, "low")).toEqual({ kind: "about", credits: "0.02" });
        expect(costText(COST, "medium")).toEqual({ kind: "range", from: "0.06", to: "0.09" });
        expect(costText(COST, "high")).toEqual({ kind: "range", from: "0.09", to: "0.19" });
    });

    it("says less than a hundredth rather than printing 0", () => {
        const tiny: EffortCost = { estimate: true, levels: { low: { creditsMilli: [1, 4] } } };
        expect(costText(tiny, "low")).toEqual({ kind: "tiny" });
    });

    it("prints a whole number without decimals", () => {
        const big: EffortCost = {
            estimate: true,
            levels: { high: { creditsMilli: [2000, 2000] } },
        };
        expect(costText(big, "high")).toEqual({ kind: "about", credits: "2" });
    });

    it("draws nothing it was not given or cannot trust", () => {
        expect(costText(null, "low")).toBeNull();
        expect(costText(undefined, "low")).toBeNull();
        expect(costText({ estimate: true, levels: {} }, "low")).toBeNull();
        for (const bad of [[5, 1], [-1, 3], ["a", "b"], [1], null]) {
            const cost = { estimate: true, levels: { low: { creditsMilli: bad } } } as never;
            expect(costText(cost, "low")).toBeNull();
        }
    });
});

describe("the list row", () => {
    it("shows what a run uses, held to the plan", () => {
        expect(
            rowEffort(AI_JOB, schedule({ aiEffort: "high", aiEffortEffective: "medium" }))
        ).toBe("medium");
    });

    it("shows nothing for a plain job or a schedule with no effort", () => {
        expect(rowEffort(PLAIN_JOB, schedule({ aiEffortEffective: "low" }))).toBeNull();
        expect(rowEffort(AI_JOB, schedule({ aiEffortEffective: undefined }))).toBeNull();
        expect(rowEffort(undefined, schedule())).toBeNull();
    });

    it("shows nothing once the AI switch is off: the report is plain", () => {
        expect(rowEffort(AI_JOB, schedule({ params: { ai_sentences: false } }))).toBeNull();
        expect(rowEffort(AI_JOB, schedule({ params: { ai_sentences: true } }))).toBe("low");
    });
});

describe("a true/false parameter", () => {
    it("is its own kind and goes on the wire as a boolean, or not at all", () => {
        expect(paramKind({ type: "boolean" })).toBe("boolean");
        expect(paramsFromForm(AI_JOB, { ai_sentences: "false" })).toEqual({ ai_sentences: false });
        expect(paramsFromForm(AI_JOB, { ai_sentences: "true" })).toEqual({ ai_sentences: true });
        // Not set: nothing sent, so the server's default applies.
        expect(paramsFromForm(AI_JOB, { ai_sentences: "" })).toEqual({});
        // Never the string "false": the server would read it as on.
        expect(paramsFromForm(AI_JOB, { ai_sentences: "no" })).toEqual({});
    });

    it("is read back from a saved schedule", () => {
        const form = formFromSchedule(schedule({ params: { ai_sentences: false } }), [AI_JOB]);
        expect(form.params.ai_sentences).toBe("false");
        expect(validateForm(form, AI_JOB).params).toEqual({});
    });

    it("rejects a value that is neither", () => {
        const form = { ...emptyForm([AI_JOB]), name: "x", params: { ai_sentences: "maybe" } };
        expect(validateForm(form, AI_JOB).params.ai_sentences).toBe("format");
    });
});

describe("what is sent", () => {
    const base = { ...emptyForm([AI_JOB]), name: "Morning plan" };

    it("sends no effort on a create until the member chooses one", () => {
        expect(buildCreate(base, AI_JOB)).not.toHaveProperty("aiEffort");
        expect(buildCreate({ ...base, aiEffort: "medium" }, AI_JOB).aiEffort).toBe("medium");
    });

    it("never sends an effort for a job with no AI, whatever the form holds", () => {
        const form = { ...base, job: "what_you_did", aiEffort: "high" };
        expect(buildCreate(form, PLAIN_JOB)).not.toHaveProperty("aiEffort");
        const patch = buildPatch(schedule({ job: "what_you_did" }), form, PLAIN_JOB);
        expect(patch).not.toHaveProperty("aiEffort");
    });

    it("sends nothing about effort while the control is hidden (AI sentences off)", () => {
        const off = { ...base, aiEffort: "high", params: { ai_sentences: "false" } };
        expect(buildCreate(off, AI_JOB)).not.toHaveProperty("aiEffort");
        const saved = schedule({ aiEffort: "medium", aiEffortEffective: "medium" });
        const form = { ...formFromSchedule(saved, [AI_JOB]), aiEffort: "high" };
        expect(buildPatch(saved, form, AI_JOB)).toEqual({ aiEffort: "high" });
        expect(buildPatch(saved, { ...form, params: { ai_sentences: "false" } }, AI_JOB)).toEqual({
            params: { ai_sentences: false },
        });
    });

    it("sends only a change, and null to go back to the job's default", () => {
        const saved = schedule({ aiEffort: "high", aiEffortEffective: "high" });
        const same = formFromSchedule(saved, [AI_JOB]);
        expect(buildPatch(saved, same, AI_JOB)).toEqual({});
        expect(buildPatch(saved, { ...same, aiEffort: "medium" }, AI_JOB)).toEqual({
            aiEffort: "medium",
        });
        expect(buildPatch(saved, { ...same, aiEffort: "" }, AI_JOB)).toEqual({ aiEffort: null });
        // A schedule on the default stays out of a patch that changes nothing.
        const dflt = schedule();
        expect(buildPatch(dflt, formFromSchedule(dflt, [AI_JOB]), AI_JOB)).toEqual({});
    });

    it("treats a level the catalog dropped as no choice", () => {
        const saved = schedule({ aiEffort: "max" as never });
        const form = formFromSchedule(saved, [AI_JOB]);
        expect(form.aiEffort).toBe("");
        expect(buildPatch(saved, form, AI_JOB)).toEqual({});
    });
});
