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
import type { JobParam } from "../../services/schedules";

type ScheduleStrings = Messages["settings"]["schedules"];

export type ParamPicker = "project" | "milestone" | "skill";

export interface KnownParam {
    label: keyof ScheduleStrings;
    hint: keyof ScheduleStrings;
    /** The hint when the job REQUIRES the parameter, if the optional one's wording would
     *  mislead (the project hint tells the member to leave it on "All projects"). */
    requiredHint?: keyof ScheduleStrings;
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
}

export const KNOWN_PARAMS: Record<string, KnownParam> = {
    changed_hours: { label: "paramChangedHours", hint: "paramChangedHoursHint" },
    project_id: {
        label: "paramProject",
        hint: "paramProjectHint",
        requiredHint: "paramProjectRequiredHint",
        picker: "project",
    },
    day: { label: "paramDay", hint: "paramDayHint" },
    days: { label: "paramDays", hint: "paramDaysHint" },
    milestone_id: {
        label: "paramMilestone",
        hint: "paramMilestoneHint",
        picker: "milestone",
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
    input: { label: "paramSkillInput", hint: "paramSkillInputHint" },
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
export const paramHintKey = (known: KnownParam, required: boolean): keyof ScheduleStrings =>
    required && known.requiredHint ? known.requiredHint : known.hint;

/** The values a job's enum offers, in the member's language. Unknown value: the caller falls back. */
export const ENUM_LABELS = {
    today: "paramDayToday",
    yesterday: "paramDayYesterday",
} as const satisfies Record<string, keyof ScheduleStrings>;

export const enumLabelKey = (value: string): keyof ScheduleStrings | undefined =>
    Object.prototype.hasOwnProperty.call(ENUM_LABELS, value)
        ? ENUM_LABELS[value as keyof typeof ENUM_LABELS]
        : undefined;
