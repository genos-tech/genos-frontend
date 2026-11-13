// The pure half of the schedule form (MIP-1150): what the form holds, what
// makes it valid, and what goes on the wire. No React in here, so the rules
// that matter are testable without rendering anything.
//
// Two guarantees live in this file and are pinned by tests:
//   - only the parameters the SELECTED job declares are ever sent, whatever the
//     form or the old schedule happened to carry;
//   - an edit sends only what changed, so renaming a schedule whose job has
//     since been removed never re-sends the dead job.

import type {
    JobParam,
    ParamValue,
    Schedule,
    ScheduleChange,
    ScheduleFields,
    ScheduleFrequency,
    ScheduleJob,
} from "../../services/schedules";
import { asEffortLevel, showsEffort } from "./scheduleEffort";
import { isRequiredParam } from "./scheduleParams";

export const FREQUENCIES: ScheduleFrequency[] = ["daily", "weekdays", "weekly", "monthly", "once"];

/** 0 = Monday ... 6 = Sunday, as the API numbers them. */
export const WEEKDAY_NUMBERS = [0, 1, 2, 3, 4, 5, 6] as const;

export const NAME_MAX = 100;
export const DEFAULT_TIME = "09:00";

export interface ScheduleForm {
    name: string;
    job: string;
    /** What is typed in each declared parameter's input; "" = not set. */
    params: Record<string, string>;
    frequency: ScheduleFrequency;
    timeOfDay: string;
    weekdays: number[];
    monthDay: string;
    runDate: string;
    deliverPush: boolean;
    /** "" = the job's own default (MIP-1212); else the member's own level. */
    aiEffort: string;
}

export const emptyForm = (jobs: ScheduleJob[]): ScheduleForm => ({
    name: "",
    job: jobs[0]?.job ?? "",
    params: {},
    frequency: "daily",
    timeOfDay: DEFAULT_TIME,
    weekdays: [],
    monthDay: "1",
    runDate: "",
    // On for a new schedule (MIP-1374): a report nobody is told about goes unread.
    deliverPush: true,
    aiEffort: "",
});

/** Only the keys the job declares, as text for the inputs. */
const declaredAsText = (
    job: ScheduleJob | undefined,
    params: Record<string, ParamValue>
): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const key of Object.keys(job?.params ?? {})) {
        const v = params[key];
        if (v !== undefined && v !== null) out[key] = String(v);
    }
    return out;
};

export const formFromSchedule = (s: Schedule, jobs: ScheduleJob[]): ScheduleForm => ({
    name: s.name,
    job: s.job,
    params: declaredAsText(
        jobs.find((j) => j.job === s.job),
        s.params ?? {}
    ),
    frequency: s.frequency,
    timeOfDay: s.timeOfDay,
    weekdays: [...(s.weekdays ?? [])].sort((a, b) => a - b),
    monthDay: s.monthDay === undefined ? "1" : String(s.monthDay),
    runDate: s.runDate ?? "",
    deliverPush: s.deliverPush,
    aiEffort: asEffortLevel(s.aiEffort) ?? "",
});

/** "9:30" -> "09:30"; anything that is not a 24-hour time -> null. */
export const normalizeTime = (raw: string): string | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return `${String(h).padStart(2, "0")}:${m[2]}`;
};

export type ParamKind = "integer" | "enum" | "boolean" | "text";

/** How a declared parameter is entered: an integer (number input, min/max), a
 *  string with an enum (a select), anything else as text. The wire type
 *  follows the declared type, never the widget. */
export const paramKind = (p: JobParam): ParamKind => {
    if (Array.isArray(p.enum) && p.enum.length > 0) return "enum";
    if (p.type === "boolean") return "boolean";
    if (p.type === "integer" || p.type === "number") return "integer";
    return "text";
};

/** Nothing typed -> nothing sent, so the server's default applies. A value that
 *  does not parse as the declared number type is left to validation (null). */
const wireValue = (p: JobParam, raw: string): ParamValue | null | undefined => {
    const text = raw.trim();
    if (text === "") return undefined;
    if (p.type === "boolean") return text === "true" ? true : text === "false" ? false : null;
    if (p.type === "integer") return /^-?\d+$/.test(text) ? Number(text) : null;
    if (p.type === "number")
        return text !== "" && Number.isFinite(Number(text)) ? Number(text) : null;
    if (Array.isArray(p.enum) && p.enum.some((e) => String(e) === text)) {
        return p.enum.find((e) => String(e) === text);
    }
    if (Array.isArray(p.enum) && p.enum.length > 0) return null;
    return text;
};

/** The parameters to send: declared by `job`, set, and valid. */
export const paramsFromForm = (
    job: ScheduleJob | undefined,
    typed: Record<string, string>
): Record<string, ParamValue> => {
    const out: Record<string, ParamValue> = {};
    for (const [key, spec] of Object.entries(job?.params ?? {})) {
        const v = wireValue(spec, typed[key] ?? "");
        if (v !== undefined && v !== null) out[key] = v;
    }
    return out;
};

export type FieldProblem = "required" | "format" | "range" | "tooLong";

export interface FormProblems {
    name?: FieldProblem;
    job?: FieldProblem;
    params: Record<string, FieldProblem>;
    timeOfDay?: FieldProblem;
    weekdays?: FieldProblem;
    monthDay?: FieldProblem;
    runDate?: FieldProblem;
}

export const hasProblems = (p: FormProblems): boolean =>
    Boolean(p.name || p.job || p.timeOfDay || p.weekdays || p.monthDay || p.runDate) ||
    Object.keys(p.params).length > 0;

/** `keepsUnknownJob`: editing a schedule whose job was removed, with the job
 *  left alone. It can still be renamed or moved to another time. */
export const validateForm = (
    form: ScheduleForm,
    job: ScheduleJob | undefined,
    keepsUnknownJob = false
): FormProblems => {
    const problems: FormProblems = { params: {} };
    const name = form.name.trim();
    if (name === "") problems.name = "required";
    else if (name.length > NAME_MAX) problems.name = "tooLong";
    if (!job && !keepsUnknownJob) problems.job = "required";

    for (const [key, spec] of Object.entries(job?.params ?? {})) {
        const raw = (form.params[key] ?? "").trim();
        if (raw === "") {
            // A parameter the report cannot run without (the milestone one).
            if (isRequiredParam(key, spec)) problems.params[key] = "required";
            continue;
        }
        const v = wireValue(spec, raw);
        if (v === null) {
            problems.params[key] = "format";
        } else if (typeof v === "number") {
            if (spec.minimum !== undefined && v < spec.minimum) problems.params[key] = "range";
            if (spec.maximum !== undefined && v > spec.maximum) problems.params[key] = "range";
        }
    }

    if (normalizeTime(form.timeOfDay) === null) {
        problems.timeOfDay = form.timeOfDay.trim() === "" ? "required" : "format";
    }
    if (form.frequency === "weekly" && form.weekdays.length === 0) problems.weekdays = "required";
    if (form.frequency === "monthly") {
        const d = form.monthDay.trim();
        if (d === "") problems.monthDay = "required";
        else if (!/^\d+$/.test(d)) problems.monthDay = "format";
        else if (Number(d) < 1 || Number(d) > 31) problems.monthDay = "range";
    }
    if (form.frequency === "once") {
        if (form.runDate === "") problems.runDate = "required";
        else if (!/^\d{4}-\d{2}-\d{2}$/.test(form.runDate)) problems.runDate = "format";
    }
    return problems;
};

/** The recurrence fields the chosen frequency uses; the rest are not sent. */
const recurrence = (form: ScheduleForm): Partial<ScheduleFields> => {
    const out: Partial<ScheduleFields> = {
        frequency: form.frequency,
        timeOfDay: normalizeTime(form.timeOfDay) ?? form.timeOfDay.trim(),
    };
    if (form.frequency === "weekly") {
        out.weekdays = [...form.weekdays].sort((a, b) => a - b);
    }
    if (form.frequency === "monthly") out.monthDay = Number(form.monthDay);
    if (form.frequency === "once") out.runDate = form.runDate;
    return out;
};

/** The whole schedule, for a create. */
export const buildCreate = (form: ScheduleForm, job: ScheduleJob | undefined): ScheduleFields => {
    const effort = showsEffort(job, form.params) ? asEffortLevel(form.aiEffort) : null;
    return {
        name: form.name.trim(),
        job: form.job,
        params: paramsFromForm(job, form.params),
        deliverPush: form.deliverPush,
        ...(effort ? { aiEffort: effort } : {}),
        ...(recurrence(form) as Pick<ScheduleFields, "frequency" | "timeOfDay">),
    };
};

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Only what differs from `original`. An empty object means nothing changed.
 *  When the job changes, its parameters are always sent, rebuilt from the new
 *  job's declared keys alone (an empty object clears the old ones). */
export const buildPatch = (
    original: Schedule,
    form: ScheduleForm,
    job: ScheduleJob | undefined
): ScheduleChange => {
    const patch: ScheduleChange = {};
    if (form.name.trim() !== original.name) patch.name = form.name.trim();
    if (form.deliverPush !== original.deliverPush) patch.deliverPush = form.deliverPush;

    const jobChanged = form.job !== original.job;
    if (jobChanged) patch.job = form.job;
    if (job) {
        const params = paramsFromForm(job, form.params);
        const before = paramsFromForm(job, declaredAsText(job, original.params ?? {}));
        if (jobChanged || !same(params, before)) patch.params = params;
    }

    // The effort belongs to AI jobs only; a plain job's schedule never sends it, and neither does a
    // form whose control is hidden (the AI switch is off): what the member cannot see is left as it
    // was. "" goes back to the job's default (null on the wire).
    if (showsEffort(job, form.params)) {
        const chosen = asEffortLevel(form.aiEffort) ?? "";
        if (chosen !== (asEffortLevel(original.aiEffort) ?? "")) patch.aiEffort = chosen || null;
    }

    const now = recurrence(form);
    const was = recurrence(formFromSchedule(original, job ? [job] : []));
    const rec = now as Record<string, unknown>;
    const old = was as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
        if (!same(rec[key], old[key])) (patch as Record<string, unknown>)[key] = rec[key];
    }
    return patch;
};
