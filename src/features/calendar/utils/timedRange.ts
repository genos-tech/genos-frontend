/**
 * Keeping a timed event's start and end in step while the user edits
 * them.
 *
 * Two rules, both of which fall out of ONE idea — the event keeps the
 * length it already had:
 *
 *   - Move the start, and the end follows. 9pm→10pm becomes 10pm→11pm,
 *     and a 30-minute meeting stays 30 minutes instead of being silently
 *     rounded to an hour.
 *   - Set an end at or before the start, and the start backs up instead.
 *     Start 9pm, end retyped to 8pm, gives 7pm→8pm: the user moved the
 *     event, they didn't ask for a negative one.
 *
 * Everything here works on `datetime-local` input strings
 * ("YYYY-MM-DDTHH:mm") and is pure, so the modal's handlers stay one
 * line each.
 *
 * ALL-DAY IS OUT OF SCOPE. Those inputs hold date-only values, and
 * `new Date("2026-07-29")` parses as UTC midnight — timezone-shifted
 * math that would move dates for anyone west of Greenwich. The all-day
 * branch keeps its `min={startISO}` input constraint and the submit-time
 * clamp.
 */

/** Used when the current pair gives no usable duration (a fresh form, a
 *  half-typed value, or an end that isn't after its start). Matches the
 *  1-hour default the create paths seed. */
const FALLBACK_DURATION_MS = 60 * 60 * 1000;

const LOCAL_INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/**
 * Parse a `datetime-local` value into a local-time Date, or null.
 *
 * Built from components deliberately: `new Date("2026-07-29T21:00")`
 * has had implementation-defined timezone handling, whereas the
 * component form is unambiguously local — which is what the input means.
 *
 * Returns null for the empty and half-typed values a `datetime-local`
 * fires `onChange` with as the user types or clears the field. Callers
 * treat null as "no-op", so a cleared field can't poison its partner.
 */
export const parseLocalInput = (value: string): Date | null => {
    const match = LOCAL_INPUT_RE.exec(value);
    if (!match) return null;
    const date = new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5])
    );
    return Number.isNaN(date.getTime()) ? null : date;
};

/** Format a Date back into a `datetime-local` value (local time). */
export const formatLocalInput = (date: Date): string => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
};

/** The event's current length, falling back to an hour when the pair
 *  doesn't describe a positive one. */
const durationMs = (start: string, end: string): number => {
    const from = parseLocalInput(start);
    const to = parseLocalInput(end);
    if (!from || !to) return FALLBACK_DURATION_MS;
    const span = to.getTime() - from.getTime();
    return span > 0 ? span : FALLBACK_DURATION_MS;
};

/**
 * The end that should accompany a newly-picked start: the same distance
 * after it as the old end was after the old start.
 *
 * Returns null when `nextStart` isn't a complete value — mid-typing, the
 * end must not lurch around.
 */
export const endForNewStart = (
    prevStart: string,
    prevEnd: string,
    nextStart: string
): string | null => {
    const start = parseLocalInput(nextStart);
    if (!start) return null;
    return formatLocalInput(new Date(start.getTime() + durationMs(prevStart, prevEnd)));
};

/**
 * The start that should accompany a newly-picked end, or null to leave
 * it alone.
 *
 * Only fires when the new end is at or before the start: an end that
 * still sits after its start is simply a longer or shorter event and
 * must be taken at face value. Zero-length counts as needing the shift —
 * it's degenerate, and moving the start is friendlier than saving it.
 */
export const startForNewEnd = (
    prevStart: string,
    prevEnd: string,
    nextEnd: string
): string | null => {
    const end = parseLocalInput(nextEnd);
    const start = parseLocalInput(prevStart);
    if (!end || !start) return null;
    if (end.getTime() > start.getTime()) return null;
    return formatLocalInput(new Date(end.getTime() - durationMs(prevStart, prevEnd)));
};
