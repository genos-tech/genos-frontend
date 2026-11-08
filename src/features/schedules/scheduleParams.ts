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

export type ParamPicker = "project" | "milestone";

export interface KnownParam {
    label: keyof ScheduleStrings;
    hint: keyof ScheduleStrings;
    picker?: ParamPicker;
    /** The catalog does not say which parameters a job requires (the server
     *  enforces it), so the one the form must not send without is named here. */
    required?: boolean;
    /** A true/false parameter, drawn as a switch. `defaultOn`: what "not set" means, because the
     *  catalog states no default (`ai_sentences` is on unless turned off). */
    boolean?: { defaultOn: boolean };
    /** This switch turns the job's AI step off: the AI effort control is hidden while it is off. */
    aiSwitch?: boolean;
    /** Show our own localized hint even when the server sends a description: the server's is
     *  English only, and for the AI switch it must stay neutral about whether AI is running. */
    preferOwnHint?: boolean;
}

export const KNOWN_PARAMS: Record<string, KnownParam> = {
    changed_hours: { label: "paramChangedHours", hint: "paramChangedHoursHint" },
    project_id: { label: "paramProject", hint: "paramProjectHint", picker: "project" },
    day: { label: "paramDay", hint: "paramDayHint" },
    days: { label: "paramDays", hint: "paramDaysHint" },
    milestone_id: {
        label: "paramMilestone",
        hint: "paramMilestoneHint",
        picker: "milestone",
        required: true,
    },
    hours: { label: "paramHours", hint: "paramHoursHint" },
    ai_sentences: {
        label: "paramAiSentences",
        hint: "paramAiSentencesHint",
        boolean: { defaultOn: true },
        aiSwitch: true,
        preferOwnHint: true,
    },
};

// Own-property lookups only: a key that arrives from the API must never read
// "constructor" or "toString" off the prototype.
export const knownParam = (key: string): KnownParam | undefined =>
    Object.prototype.hasOwnProperty.call(KNOWN_PARAMS, key) ? KNOWN_PARAMS[key] : undefined;

export const isRequiredParam = (key: string, spec: JobParam & { required?: boolean }): boolean =>
    spec.required === true || knownParam(key)?.required === true;

/** The values a job's enum offers, in the member's language. Unknown value: the caller falls back. */
export const ENUM_LABELS = {
    today: "paramDayToday",
    yesterday: "paramDayYesterday",
} as const satisfies Record<string, keyof ScheduleStrings>;

export const enumLabelKey = (value: string): keyof ScheduleStrings | undefined =>
    Object.prototype.hasOwnProperty.call(ENUM_LABELS, value)
        ? ENUM_LABELS[value as keyof typeof ENUM_LABELS]
        : undefined;
