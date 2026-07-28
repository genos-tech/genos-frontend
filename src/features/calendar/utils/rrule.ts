/**
 * Building and reading back the RRULE that makes an event repeat.
 *
 * Kept as a pure module because every rule here is an off-by-one waiting
 * to happen and a table test is a far better check than clicking through
 * a browser:
 *
 *  - **UNTIL is INCLUSIVE**, unlike Google's all-day `end.date`, which is
 *    exclusive. Reusing `inclusiveToGoogleEnd` here (the obvious move,
 *    since it sits right next door) yields one occurrence too many.
 *  - **UNTIL's form must match the start's form.** A date-only start
 *    needs `UNTIL=20261231`; a timed start needs a UTC instant with a
 *    trailing `Z`. Mismatching them is a Google 400.
 *  - **COUNT and UNTIL are mutually exclusive.** Sending both is invalid.
 *  - **An explicit BYDAY that excludes the start day** shifts the first
 *    occurrence off the date the user picked, which reads as the app
 *    ignoring them.
 */

import dayjs from "dayjs";

export type RepeatFrequency = "none" | "daily" | "weekly" | "monthly" | "yearly";

export type RepeatEnd =
    | { kind: "never" }
    /** Inclusive last date the series may occur on, "YYYY-MM-DD". */
    | { kind: "onDate"; date: string }
    | { kind: "afterCount"; count: number };

export interface RecurrenceSpec {
    frequency: RepeatFrequency;
    /** "every N days/weeks/…". Always >= 1. */
    interval: number;
    /** Weekday numbers (0 = Sunday … 6 = Saturday). Weekly only; empty
     *  means "the same weekday the event starts on", which is what
     *  Google infers when BYDAY is omitted. */
    byWeekday: number[];
    end: RepeatEnd;
}

export const DEFAULT_RECURRENCE: RecurrenceSpec = {
    frequency: "none",
    interval: 1,
    byWeekday: [],
    end: { kind: "never" },
};

/** RRULE weekday codes, indexed to match `dayjs().day()`. */
export const RRULE_WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

const FREQ_BY_VALUE: Record<Exclude<RepeatFrequency, "none">, string> = {
    daily: "DAILY",
    weekly: "WEEKLY",
    monthly: "MONTHLY",
    yearly: "YEARLY",
};

const VALUE_BY_FREQ: Record<string, RepeatFrequency> = {
    DAILY: "daily",
    WEEKLY: "weekly",
    MONTHLY: "monthly",
    YEARLY: "yearly",
};

/** "YYYY-MM-DD" → "20261231", the date-only UNTIL form. */
const toUntilDate = (date: string): string => dayjs(date).format("YYYYMMDD");

/**
 * "YYYY-MM-DD" → a UTC instant at the END of that local day, as
 * "20261231T145959Z".
 *
 * End-of-day rather than midnight because UNTIL is inclusive: anchoring
 * at 00:00 would exclude every occurrence later in the user's final day,
 * silently dropping the last one they asked for.
 */
const toUntilDateTime = (date: string): string => {
    const localEndOfDay = new Date(`${date}T23:59:59`);
    if (isNaN(localEndOfDay.getTime())) return "";
    return `${localEndOfDay.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
};

export interface BuildOptions {
    /** All-day events take the date-only UNTIL form. */
    allDay: boolean;
}

/**
 * Turn a spec into the `recurrence` array Google expects.
 *
 * Returns `[]` for a non-repeating event, which is also exactly what the
 * API needs to END an existing repetition — the two cases coincide, so
 * callers don't special-case them.
 */
export const buildRecurrence = (spec: RecurrenceSpec, { allDay }: BuildOptions): string[] => {
    if (spec.frequency === "none") return [];

    const parts = [`FREQ=${FREQ_BY_VALUE[spec.frequency]}`];

    // INTERVAL=1 is the default; emitting it is noise in a field users
    // can see in Google's own UI.
    if (spec.interval > 1) parts.push(`INTERVAL=${Math.floor(spec.interval)}`);

    if (spec.frequency === "weekly" && spec.byWeekday.length > 0) {
        const days = [...new Set(spec.byWeekday)]
            .filter((d) => d >= 0 && d <= 6)
            .sort((a, b) => a - b)
            .map((d) => RRULE_WEEKDAYS[d]);
        if (days.length > 0) parts.push(`BYDAY=${days.join(",")}`);
    }

    // COUNT and UNTIL are mutually exclusive, so this is an either/or.
    if (spec.end.kind === "afterCount" && spec.end.count > 0) {
        parts.push(`COUNT=${Math.floor(spec.end.count)}`);
    } else if (spec.end.kind === "onDate" && spec.end.date) {
        const until = allDay ? toUntilDate(spec.end.date) : toUntilDateTime(spec.end.date);
        if (until) parts.push(`UNTIL=${until}`);
    }

    return [`RRULE:${parts.join(";")}`];
};

/** Read a Google `recurrence` array back into a spec, for showing the
 *  current rule when editing an existing series. Anything unparseable
 *  degrades to "does not repeat" rather than throwing — a rule we can't
 *  represent in the picker (a monthly BYSETPOS, say) shouldn't stop the
 *  modal from opening. */
export const parseRecurrence = (recurrence: string[] | undefined | null): RecurrenceSpec => {
    const rule = (recurrence ?? []).find((line) => line.toUpperCase().startsWith("RRULE:"));
    if (!rule) return DEFAULT_RECURRENCE;

    const params = new Map<string, string>();
    for (const chunk of rule.slice("RRULE:".length).split(";")) {
        const [key, value] = chunk.split("=");
        if (key && value) params.set(key.trim().toUpperCase(), value.trim());
    }

    const frequency = VALUE_BY_FREQ[(params.get("FREQ") ?? "").toUpperCase()];
    if (!frequency) return DEFAULT_RECURRENCE;

    const rawInterval = parseInt(params.get("INTERVAL") ?? "1", 10);
    const interval = Number.isFinite(rawInterval) && rawInterval > 0 ? rawInterval : 1;

    const byWeekday = (params.get("BYDAY") ?? "")
        .split(",")
        .map((code) => RRULE_WEEKDAYS.indexOf(code.trim().toUpperCase() as never))
        .filter((index) => index >= 0);

    let end: RepeatEnd = { kind: "never" };
    const count = parseInt(params.get("COUNT") ?? "", 10);
    const until = params.get("UNTIL");
    if (Number.isFinite(count) && count > 0) {
        end = { kind: "afterCount", count };
    } else if (until) {
        // Both forms reduce to a date for the picker: "20261231" and
        // "20261231T145959Z" share the same leading 8 digits. Reassembled
        // with dashes because dayjs needs a parse format otherwise, and
        // the plugin for that isn't loaded here.
        const parsed = dayjs(`${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}`);
        if (parsed.isValid()) {
            end = { kind: "onDate", date: parsed.format("YYYY-MM-DD") };
        }
    }

    return { frequency, interval, byWeekday, end };
};

/** True when the spec would produce a repeating event. */
export const isRepeating = (spec: RecurrenceSpec): boolean => spec.frequency !== "none";

/**
 * Whether an event is one occurrence of a series.
 *
 * Our list endpoints request `singleEvents=true`, so a repeating event
 * always arrives EXPANDED into instances — we never see the master
 * directly. An instance carries `recurringEventId` (the master's id) and
 * no `recurrence` of its own, which is why editing the series needs a
 * separate fetch of the master.
 */
export const seriesMasterId = (event: { recurringEventId?: string; id?: string }): string | null =>
    event.recurringEventId ?? null;
