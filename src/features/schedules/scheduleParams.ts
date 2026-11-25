// What a member sees for a job's parameters (MIP-1200).
//
// The catalog names a parameter only by key ("changed_hours", "project_id"),
// and the label made from the key ("Changed hours", "Project id") tells nobody
// what to type: a member does not know a project's number. The four built-in
// jobs' parameters get a plain label, a one-line hint, and, for the two that
// are ids, a picker by NAME. The value that is stored and sent stays the id.
//
// Keyed by parameter name, not by job: no two jobs use one name for different
// things. A parameter that is not listed here (a job added on the server) keeps
// the label made from its key, so it still shows up with no change to this file.

import type { Messages } from "../../i18n";
import type { JobParam, ScheduleJob } from "../../services/schedules";

type ScheduleStrings = Messages["settings"]["schedules"];
/** The keys whose value is one sentence (not a group such as `jobCatalog`). */
type TextKey = {
    [K in keyof ScheduleStrings]: ScheduleStrings[K] extends string ? K : never;
}[keyof ScheduleStrings];

export type ParamPicker = "project" | "milestone" | "skill" | "chat";

export interface KnownParam {
    label: TextKey;
    hint: TextKey;
    /** The hint when the job REQUIRES the parameter, if the optional one's wording would
     *  mislead (the project hint tells the member to leave it on "All projects"). */
    requiredHint?: TextKey;
    picker?: ParamPicker;
    /** A true/false parameter, drawn as a switch. `defaultOn`: what "not set" means, because the
     *  catalog states no default (`ai_sentences` is OFF unless turned on, MIP-1969). */
    boolean?: { defaultOn: boolean };
    /** This switch turns the job's AI step off: the AI effort control is hidden while it is off. */
    aiSwitch?: boolean;
    /** Show our own localized hint even when the server sends a description: the server's is
     *  English only, and for the AI switch it must stay neutral about whether AI is running. */
    preferOwnHint?: boolean;
    /** Kept in the form and sent, never drawn: the server's own bookkeeping that the member has no
     *  words for (`version_no`, the published version a schedule is pinned to, MIP-2045). */
    hidden?: boolean;
    /** Drawn, sent and required only while another parameter of the same job has this value: a
     *  dashboard's milestone belongs to `kind = milestone` alone, and the API refuses it with any
     *  other kind. A job that does not declare that other parameter is not gated (`project_id`
     *  of the project reports). */
    onlyWhen?: { param: string; value: string };
}

export const KNOWN_PARAMS: Record<string, KnownParam> = {
    changed_hours: { label: "paramChangedHours", hint: "paramChangedHoursHint" },
    project_id: {
        label: "paramProject",
        hint: "paramProjectHint",
        requiredHint: "paramProjectRequiredHint",
        picker: "project",
        onlyWhen: { param: "kind", value: "project" },
    },
    day: { label: "paramDay", hint: "paramDayHint" },
    days: { label: "paramDays", hint: "paramDaysHint" },
    milestone_id: {
        label: "paramMilestone",
        hint: "paramMilestoneHint",
        picker: "milestone",
        onlyWhen: { param: "kind", value: "milestone" },
    },
    hours: { label: "paramHours", hint: "paramHoursHint" },
    ai_sentences: {
        label: "scheduleModeLabel",
        hint: "scheduleModeAiHint",
        boolean: { defaultOn: false },
        aiSwitch: true,
        preferOwnHint: true,
    },
    // A schedule that runs a skill (MIP-2045). The skill is picked by name; the version it runs
    // is the published one, pinned by the server when the schedule is saved, so it is carried
    // along untouched and never drawn (a member who picks another skill drops it).
    skill_id: { label: "paramSkill", hint: "paramSkillHint", picker: "skill" },
    version_no: { label: "paramSkill", hint: "paramSkillHint", hidden: true },
    // The one group chat a catch-up covers (MIP-2348); empty means every busy chat.
    channel_id: { label: "paramChat", hint: "paramChatHint", picker: "chat" },
    input: { label: "paramSkillInput", hint: "paramSkillInputHint" },
    // The dashboard page (MIP-2357): what it covers, over which window, and what to look at.
    kind: { label: "paramKind", hint: "paramKindHint" },
    period: { label: "paramPeriod", hint: "paramPeriodHint" },
    focus: { label: "paramFocus", hint: "paramFocusHint" },
};

// Own-property lookups only: a key that arrives from the API must never read
// "constructor" or "toString" off the prototype.
export const knownParam = (key: string): KnownParam | undefined =>
    Object.prototype.hasOwnProperty.call(KNOWN_PARAMS, key) ? KNOWN_PARAMS[key] : undefined;

/** Whether the job requires the parameter: the catalog says so (`required: true`, MIP-1216), so a
 *  job added on the server needs no change here. */
export const isRequiredParam = (spec: JobParam): boolean => spec.required === true;

/** The hint's string key for a known parameter: the required wording when the job requires it
 *  and there is one, else the plain one. */
export const paramHintKey = (known: KnownParam, required: boolean): TextKey =>
    required && known.requiredHint ? known.requiredHint : known.hint;

/** Whether a parameter applies to the form as it is now: false only for a gated parameter
 *  (`onlyWhen`) of a job that declares the gating one, while that one has another value. */
export const paramApplies = (
    job: ScheduleJob | undefined,
    key: string,
    typed: Record<string, string>
): boolean => {
    const gate = knownParam(key)?.onlyWhen;
    if (!gate || !job || !Object.prototype.hasOwnProperty.call(job.params, gate.param))
        return true;
    return (typed[gate.param] ?? "") === gate.value;
};

/** Whether the form must have a value for it: the catalog says so, or it is a gated parameter
 *  that applies (a project dashboard cannot be saved without its project). */
export const paramRequiredNow = (
    job: ScheduleJob | undefined,
    key: string,
    spec: JobParam,
    typed: Record<string, string>
): boolean => {
    if (isRequiredParam(spec)) return true;
    const gate = knownParam(key)?.onlyWhen;
    return (
        !!gate &&
        !!job &&
        Object.prototype.hasOwnProperty.call(job.params, gate.param) &&
        paramApplies(job, key, typed)
    );
};

/** The values a job's enum offers, in the member's language. Unknown value: the caller falls back. */
export const ENUM_LABELS = {
    today: "paramDayToday",
    yesterday: "paramDayYesterday",
    milestone: "kindMilestone",
    project: "kindProject",
    mine: "kindMine",
    week: "periodWeek",
    month: "periodMonth",
    quarter: "periodQuarter",
    year: "periodYear",
} as const satisfies Record<string, TextKey>;

export const enumLabelKey = (value: string): TextKey | undefined =>
    Object.prototype.hasOwnProperty.call(ENUM_LABELS, value)
        ? ENUM_LABELS[value as keyof typeof ENUM_LABELS]
        : undefined;

/** A report's name and description in the member's language. The catalog (`schedule_views._job`)
 *  sends English only; the built-in reports are worded in `settings.schedules.jobCatalog`, keyed
 *  by job key, as the parameters above are. A job the server added that is not listed keeps the
 *  catalog's own words, so it still shows up with no change to this file. */
export const localizeJob = (job: ScheduleJob, s: ScheduleStrings): ScheduleJob => {
    const words = Object.prototype.hasOwnProperty.call(s.jobCatalog, job.job)
        ? s.jobCatalog[job.job as keyof ScheduleStrings["jobCatalog"]]
        : undefined;
    return words ? { ...job, title: words.title, description: words.description } : job;
};
