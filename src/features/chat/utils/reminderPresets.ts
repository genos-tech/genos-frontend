/**
 * When "remind me later" actually means.
 *
 * Every preset resolves to an ABSOLUTE instant here, in the browser, and
 * that instant is what the server stores. The server deliberately does not
 * compute "tomorrow 9am": it knows the user's timezone only as a
 * best-effort capture that can be missing, and a reminder that fires at
 * the wrong 9am is worse than no reminder at all. The browser always knows.
 *
 * Pure functions taking `from` / `now` so the tests can pin a clock.
 */

/** What "morning" means for the day-based presets, in local hours. */
export const MORNING_HOUR = 9;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export type ReminderPresetId = "in20m" | "in1h" | "in3h" | "tomorrow" | "nextWeek";

/** Menu order — soonest first, so the common case is the shortest reach. */
export const REMINDER_PRESET_IDS: readonly ReminderPresetId[] = [
    "in20m",
    "in1h",
    "in3h",
    "tomorrow",
    "nextWeek",
];

const atLocalMorning = (day: Date): Date => {
    const at = new Date(day);
    at.setHours(MORNING_HOUR, 0, 0, 0);
    return at;
};

/** The instant a preset resolves to, relative to `from`. */
export const presetTime = (id: ReminderPresetId, from: Date = new Date()): Date => {
    switch (id) {
        case "in20m":
            return new Date(from.getTime() + 20 * MINUTE);
        case "in1h":
            return new Date(from.getTime() + HOUR);
        case "in3h":
            return new Date(from.getTime() + 3 * HOUR);
        case "tomorrow": {
            const day = new Date(from);
            day.setDate(day.getDate() + 1);
            return atLocalMorning(day);
        }
        case "nextWeek": {
            // The coming Monday. Already Monday means the NEXT one — "next
            // week" on a Monday morning cannot mean four minutes ago.
            const day = new Date(from);
            const daysUntilMonday = ((8 - day.getDay()) % 7 || 7) as number;
            day.setDate(day.getDate() + daysUntilMonday);
            return atLocalMorning(day);
        }
    }
};

/** Every preset with its resolved instant, in menu order. */
export const reminderPresets = (
    from: Date = new Date()
): ReadonlyArray<{ id: ReminderPresetId; at: Date }> =>
    REMINDER_PRESET_IDS.map((id) => ({ at: presetTime(id, from), id }));

/**
 * How a reminder time reads in the menu, the bubble, and the flagged row.
 *
 * Only as much date as the reader needs: the time alone today, a weekday
 * within the coming week, a date beyond that. Delegated to
 * `toLocaleString` so each locale gets its own ordering and clock (12h vs
 * 24h) rather than an English shape with translated words in it.
 */
export const formatReminderTime = (at: Date, locale: string, now: Date = new Date()): string => {
    const time: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
    const sameDay =
        at.getFullYear() === now.getFullYear() &&
        at.getMonth() === now.getMonth() &&
        at.getDate() === now.getDate();
    if (sameDay) return at.toLocaleString(locale, time);

    const withinAWeek = at.getTime() - now.getTime() < 7 * 24 * HOUR;
    if (withinAWeek) return at.toLocaleString(locale, { weekday: "short", ...time });

    return at.toLocaleString(locale, { day: "numeric", month: "short", ...time });
};

/**
 * The `datetime-local` value for a custom pick — that input has no
 * timezone, so it wants local wall-clock digits, which `toISOString`
 * (always UTC) does not give.
 */
export const toDatetimeLocalValue = (at: Date): string => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
        `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
        `T${pad(at.getHours())}:${pad(at.getMinutes())}`
    );
};

/**
 * Parse a `datetime-local` value into an instant, or null when it is
 * unusable. Local by definition (no offset in the string), which is
 * exactly what the user typed into a calendar in front of them.
 */
export const fromDatetimeLocalValue = (value: string): Date | null => {
    if (!value) return null;
    const at = new Date(value);
    return Number.isNaN(at.getTime()) ? null : at;
};

/** Furthest ahead the server will accept (`MAX_HORIZON` there). */
export const MAX_REMINDER_DAYS = 365;

export const isUsableReminderTime = (at: Date | null, now: Date = new Date()): boolean => {
    if (!at) return false;
    const ms = at.getTime() - now.getTime();
    return ms > 0 && ms <= MAX_REMINDER_DAYS * 24 * HOUR;
};
