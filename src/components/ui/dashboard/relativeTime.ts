/**
 * "3 days ago" / "in 2 hours" in the app's language through Intl.RelativeTimeFormat
 * (MIP-1963). Replaces the dashboard's hard-coded English `formatRelativeTime`.
 * `numeric: "auto"` gives "yesterday" / "today" where the language has a word for it.
 * Empty string for a value that is not a time.
 */
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 86_400_000],
    ["month", 30 * 86_400_000],
    ["week", 7 * 86_400_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
];

export const formatRelativeTime = (
    timestampMs: number | null | undefined,
    locale: string,
    now: number = Date.now()
): string => {
    if (timestampMs == null || Number.isNaN(timestampMs)) return "";
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const diff = timestampMs - now;
    for (const [unit, ms] of UNITS) {
        if (Math.abs(diff) >= ms) return rtf.format(Math.trunc(diff / ms), unit);
    }
    return rtf.format(0, "minute");
};
