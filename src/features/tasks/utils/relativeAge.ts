import { fmt } from "../../../i18n";

// The strings `formatRelativeAge` needs: `t.tasks.activity`'s age wording.
export type RelativeAgeMessages = {
    justNow: string;
    minuteAgo: string;
    minutesAgo: string;
    hourAgo: string;
    hoursAgo: string;
    dayAgo: string;
    daysAgo: string;
};

// A server time as epoch milliseconds, or null.
//
// The API writes task times as Python's `str(datetime)`
// ("2026-11-09 07:35:50.694921+00:00"): a space, microseconds and an offset.
// `Date.parse` takes that in Chrome but not in every Safari, so it is rebuilt as
// ISO 8601 (milliseconds, `T`) first. ISO strings and the app's zone-less local
// form ("2026-11-09 07:35:50", read as local time) go through the same door.
const SERVER_TIME =
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d+))?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/;

export const parseServerTime = (value: unknown): number | null => {
    if (typeof value !== "string") return null;
    const m = SERVER_TIME.exec(value.trim());
    if (!m) return null;
    const [, date, time, fraction = "", zone] = m;
    let offset = "";
    if (zone === "Z") offset = "Z";
    else if (zone) {
        const digits = zone.slice(1).replace(":", "").padEnd(4, "0");
        offset = `${zone[0]}${digits.slice(0, 2)}:${digits.slice(2)}`;
    }
    const ms = Date.parse(`${date}T${time}.${`${fraction}000`.slice(0, 3)}${offset}`);
    return Number.isNaN(ms) ? null : ms;
};

// "just now" / "5 minutes ago" / "2 days ago", and from a week on the date.
// Smaller than Intl.RelativeTimeFormat so no dependency is pulled in; the
// activity feed uses the same wording. Empty for a value that is not a time.
export const formatRelativeAge = (
    value: unknown,
    messages: RelativeAgeMessages,
    now: number = Date.now()
): string => {
    const ts = parseServerTime(value);
    if (ts === null) return "";
    const minutes = Math.floor((now - ts) / 60_000);
    if (minutes < 1) return messages.justNow;
    if (minutes < 60) {
        return fmt(minutes === 1 ? messages.minuteAgo : messages.minutesAgo, { count: minutes });
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return fmt(hours === 1 ? messages.hourAgo : messages.hoursAgo, { count: hours });
    }
    const days = Math.floor(hours / 24);
    if (days < 7) {
        return fmt(days === 1 ? messages.dayAgo : messages.daysAgo, { count: days });
    }
    return new Date(ts).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};
