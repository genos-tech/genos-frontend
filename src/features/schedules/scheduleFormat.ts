// Display helpers for the schedules page (MIP-1150): dates in the member's own
// time zone, weekday names from the browser's own locale data, and a label for
// a job parameter the catalog only names by key.

import type { ScheduleStatus } from "../../services/schedules";

/** A moment as the member reads it: "Mon, Nov 9, 09:00", in THEIR zone (the API
 *  already sends it with that zone's offset, but the browser's zone may
 *  differ). A zone the browser doesn't know falls back to the offset it was
 *  sent with. */
export const formatMoment = (iso: string, timeZone: string, locale: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const options: Intl.DateTimeFormatOptions = {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    };
    try {
        return new Intl.DateTimeFormat(locale, {
            ...options,
            ...(timeZone ? { timeZone } : {}),
        }).format(date);
    } catch {
        return new Intl.DateTimeFormat(locale, options).format(date);
    }
};

/** 0 = Monday ... 6 = Sunday, in the page's language. 2024-01-01 was a Monday. */
export const weekdayName = (day: number, locale: string, width: "short" | "long"): string => {
    const date = new Date(Date.UTC(2024, 0, 1 + day));
    try {
        return new Intl.DateTimeFormat(locale, { weekday: width, timeZone: "UTC" }).format(date);
    } catch {
        return String(day + 1);
    }
};

/** "changed_hours" -> "Changed hours". Only a fallback for a parameter that
 *  carries no title of its own. */
export const humanizeKey = (key: string): string => {
    const words = key.replace(/[_-]+/g, " ").trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
};

export const STATUS_KEYS = {
    ok: "statusOk",
    failed: "statusFailed",
    skipped_late: "statusSkippedLate",
    skipped_access: "statusSkippedAccess",
} as const satisfies Record<ScheduleStatus, string>;

export const statusColor = (s: ScheduleStatus): "success" | "danger" | "warning" =>
    s === "ok" ? "success" : s === "failed" ? "danger" : "warning";
