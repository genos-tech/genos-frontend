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
import type { SettingGuideId } from "../../manual/settingsMap";
import type { JobParam, ScheduleJob } from "../../services/schedules";

type ScheduleStrings = Messages["settings"]["schedules"];
/** The keys whose value is one sentence (not a group such as `jobCatalog`). */
type TextKey = {
    [K in keyof ScheduleStrings]: ScheduleStrings[K] extends string ? K : never;
}[keyof ScheduleStrings];

export type ParamPicker = "project" | "milestone" | "skill" | "chat" | "folder";

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
    /** The settings-map id of this field (the manual's "Settings A-Z"), set on the form control
     *  as `data-guide-id`. */
    guideId?: SettingGuideId;
    /** Show our own localized hint even when the server sends a description: the server's is
     *  English only, and for the AI switch it must stay neutral about whether AI is running. */
    preferOwnHint?: boolean;
    /** Kept in the form and sent, never drawn: the server's own bookkeeping that the member has no
     *  words for (`version_no`, the published version a schedule is pinned to, MIP-2045). */
    hidden?: boolean;
    /** Drawn, sent and required only while another parameter of the same job has this value: a
     *  dashboard's milestone belongs to `kind = milestone` alone, and the API refuses it with any
     *  other kind. A job that does not declare that other parameter is not gated (`project_id`
     *  of the project reports). Several gates must ALL hold (a milestone is for a built-in page of
     *  kind milestone, MIP-2399). */
    onlyWhen?: ParamGate | ParamGate[];
    /** With `onlyWhen`: it is drawn and sent only then, but a member may leave it empty. (A gated
     *  parameter is otherwise required while it is shown: a dashboard's milestone.) */
    optionalWhenShown?: boolean;
    /** What an enum select shows while nothing is typed: the value the server uses by default. */
    defaultValue?: string;
}

/** `value`: what the other parameter must be. `unset`: what an EMPTY other parameter counts as
 *  (a dashboard with no `source` is a built-in one). */
export interface ParamGate {
    param: string;
    value: string;
    unset?: string;
}

const TEMPLATE_SOURCE: ParamGate = { param: "source", value: "template", unset: "template" };
const SKILL_SOURCE: ParamGate = { param: "source", value: "skill" };

const gatesOf = (known: KnownParam | undefined): ParamGate[] =>
    known?.onlyWhen === undefined
        ? []
        : Array.isArray(known.onlyWhen)
          ? known.onlyWhen
          : [known.onlyWhen];

export const KNOWN_PARAMS: Record<string, KnownParam> = {
    changed_hours: { label: "paramChangedHours", hint: "paramChangedHoursHint" },
    project_id: {
        label: "paramProject",
        hint: "paramProjectHint",
        requiredHint: "paramProjectRequiredHint",
        picker: "project",
        onlyWhen: [TEMPLATE_SOURCE, { param: "kind", value: "project" }],
    },
    day: { label: "paramDay", hint: "paramDayHint" },
    days: { label: "paramDays", hint: "paramDaysHint" },
    milestone_id: {
        label: "paramMilestone",
        hint: "paramMilestoneHint",
        picker: "milestone",
        onlyWhen: [TEMPLATE_SOURCE, { param: "kind", value: "milestone" }],
    },
    hours: { label: "paramHours", hint: "paramHoursHint" },
    ai_sentences: {
        label: "scheduleModeLabel",
        hint: "scheduleModeAiHint",
        boolean: { defaultOn: false },
        aiSwitch: true,
        guideId: "spotlight.scheduleMode",
        preferOwnHint: true,
        onlyWhen: TEMPLATE_SOURCE,
        optionalWhenShown: true,
    },
    // A schedule that runs a skill (MIP-2045). The skill is picked by name; the version it runs
    // is the published one, pinned by the server when the schedule is saved, so it is carried
    // along untouched and never drawn (a member who picks another skill drops it).
    skill_id: {
        label: "paramSkill",
        hint: "paramSkillHint",
        picker: "skill",
        onlyWhen: SKILL_SOURCE,
    },
    // The server pins it: carried and sent, never drawn, never asked for.
    version_no: {
        label: "paramSkill",
        hint: "paramSkillHint",
        hidden: true,
        onlyWhen: SKILL_SOURCE,
        optionalWhenShown: true,
    },

    // The one group chat a catch-up covers (MIP-2348); empty means every busy chat.
    channel_id: { label: "paramChat", hint: "paramChatHint", picker: "chat" },
    input: {
        label: "paramSkillInput",
        hint: "paramSkillInputHint",
        onlyWhen: SKILL_SOURCE,
        optionalWhenShown: true,
    },
    // What makes a dashboard page (MIP-2399): the built-in pages, or one of the member's skills.
    source: { label: "paramSource", hint: "paramSourceHint", defaultValue: "template" },
    // Where the page is saved (MIP-2357): ONE picker draws `folder_id` and sets it together with
    // `save_to`, which is therefore never drawn on its own.
    save_to: { label: "paramSaveTo", hint: "paramSaveToHint", hidden: true },
    folder_id: { label: "paramSaveTo", hint: "paramSaveToHint", picker: "folder" },
    // The dashboard page (MIP-2357): what it covers, over which window, and what to look at.
    kind: {
        label: "paramKind",
        hint: "paramKindHint",
        guideId: "spotlight.scheduleDashboardKind",
        onlyWhen: TEMPLATE_SOURCE,
    },
    period: {
        label: "paramPeriod",
        hint: "paramPeriodHint",
        guideId: "spotlight.scheduleDashboardPeriod",
        onlyWhen: TEMPLATE_SOURCE,
        optionalWhenShown: true,
    },
    focus: {
        label: "paramFocus",
        hint: "paramFocusHint",
        guideId: "spotlight.scheduleDashboardFocus",
        onlyWhen: TEMPLATE_SOURCE,
        optionalWhenShown: true,
    },
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
    if (!job) return true;
    // Every gate whose other parameter the job declares must hold.
    return gatesOf(knownParam(key)).every((gate) => {
        if (!Object.prototype.hasOwnProperty.call(job.params, gate.param)) return true;
        const have = typed[gate.param] ?? "";
        return (have === "" ? (gate.unset ?? "") : have) === gate.value;
    });
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
    const known = knownParam(key);
    if (known?.optionalWhenShown) return false;
    // Gated and shown: required, when the job declares at least one of its gates.
    return (
        !!job &&
        gatesOf(known).some((gate) =>
            Object.prototype.hasOwnProperty.call(job.params, gate.param)
        ) &&
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
    template: "sourceTemplate",
    skill: "sourceSkill",
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
