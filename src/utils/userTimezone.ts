/**
 * Turning a person's timezone into "where are they" and "what time is it
 * there" — the two questions the profile card's location and local-time
 * rows exist to answer.
 *
 * The picker's option list is the IANA zone database, read out of the
 * runtime with `Intl.supportedValuesOf`. That choice is doing real work:
 * every zone in it IS a city, so one pick answers both questions at once
 * and the mapping between them can't drift. A bundled city dataset would
 * be a megabyte of dependency that still has to be joined to a zone, and
 * the join is exactly where a "Vancouver is on Toronto time" bug lives.
 *
 * The trade is that only zone-representative cities are offered — someone
 * in Osaka picks Tokyo, someone in Manchester picks London. That is the
 * same trade every calendar app makes, and it is the correct one here:
 * the field's purpose is "don't call me at 3am", which is a question
 * about zones and not about cities.
 */

/** A zone the user can pick, pre-split for display and search. */
export type ZoneOption = {
    /** The IANA name, and the value that gets stored: "Asia/Tokyo". */
    id: string;
    /** The city, humanised: "Tokyo", "Buenos Aires", "Port-au-Prince". */
    city: string;
    /** The leading region, humanised: "Asia", "America". */
    region: string;
};

/**
 * The city part of a zone id, or "" if there isn't one.
 *
 * Zones are `Region/City` or `Region/Sub/City` ("America/Argentina/
 * Buenos_Aires"), so the city is the LAST segment rather than the second.
 * A handful are single-segment ("UTC"), which have no city at all.
 */
const cityOf = (zoneId: string): string => {
    const segments = zoneId.split("/");
    if (segments.length < 2) return "";
    return segments[segments.length - 1].replace(/_/g, " ");
};

const regionOf = (zoneId: string): string => zoneId.split("/")[0].replace(/_/g, " ");

/**
 * Every zone this browser knows, as pickable options.
 *
 * `Intl.supportedValuesOf` is late enough (Chrome 99, Safari 15.4,
 * Firefox 93) that it can be missing in an old embedding, and this is a
 * profile field rather than anything load-bearing — so an environment
 * without it gets an empty list and a picker with nothing to offer,
 * rather than a crash on the way to rendering someone's profile.
 *
 * Zones with no city component are dropped: "UTC" is not a location, and
 * offering it as one invites an answer to "where are you" that isn't.
 */
export const listZoneOptions = (): ZoneOption[] => {
    let ids: string[];
    try {
        ids = Intl.supportedValuesOf("timeZone");
    } catch {
        return [];
    }
    return ids
        .map((id) => ({ id, city: cityOf(id), region: regionOf(id) }))
        .filter((option) => option.city !== "")
        .sort((a, b) => a.city.localeCompare(b.city));
};

/**
 * Which zone speaks for this person.
 *
 * An explicit choice beats a detected one. `currentLocation` is what they
 * picked; `timezone` is whatever their browser last reported, which
 * `useReportBrowserTimezone` overwrites on every boot — so if a manual
 * pick didn't win here it would survive only until the user next opened
 * the app from somewhere else, which is precisely when they'd most want
 * it to hold.
 *
 * `null` when we know neither, which is the signal to render nothing:
 * there is no sensible default for "where is this person", and guessing
 * UTC would state something false with the same confidence as a fact.
 */
export const resolveDisplayZone = (user: {
    currentLocation?: string;
    timezone?: string;
}): string | null => user.currentLocation || user.timezone || null;

/** Is this a zone name the runtime can actually format with? */
export const isValidZone = (zoneId: string): boolean => {
    if (!zoneId) return false;
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: zoneId });
        return true;
    } catch {
        return false;
    }
};

/**
 * The current wall-clock time in `zoneId`, e.g. "14:05".
 *
 * `null` for a zone this runtime won't format — a stored name can outlive
 * the tzdata that knew it (zones do get renamed and merged), and a
 * profile card is not the place to throw over it.
 */
export const formatTimeInZone = (
    zoneId: string,
    locale: string,
    now: Date = new Date()
): string | null => {
    try {
        return new Intl.DateTimeFormat(locale, {
            timeZone: zoneId,
            hour: "2-digit",
            minute: "2-digit",
        }).format(now);
    } catch {
        return null;
    }
};

/**
 * How far `zoneId` is from the viewer's own zone, in whole hours.
 *
 * This is the number the local-time row is really for: "15:00" means
 * nothing until you know it's four hours behind you. `null` when either
 * zone won't format.
 *
 * Computed by formatting one instant in both zones and differencing the
 * results, because that is the only way to get an offset that respects
 * daylight saving on the date in question — a fixed per-zone offset is
 * wrong for half the year.
 */
export const hoursFromViewer = (zoneId: string, now: Date = new Date()): number | null => {
    const asUtcMillis = (zone: string): number | null => {
        try {
            // "en-CA" gives an ISO-shaped date, which `Date.parse`
            // understands unambiguously in a way locale-formatted output
            // does not.
            const parts = new Intl.DateTimeFormat("en-CA", {
                timeZone: zone,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
            }).formatToParts(now);
            const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
            // `hour` comes back as "24" at midnight in some runtimes.
            const hour = get("hour") === "24" ? "00" : get("hour");
            return Date.parse(
                `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}:${get("second")}Z`
            );
        } catch {
            return null;
        }
    };

    const theirs = asUtcMillis(zoneId);
    const mine = asUtcMillis(Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (theirs === null || mine === null || Number.isNaN(theirs) || Number.isNaN(mine)) {
        return null;
    }
    return Math.round((theirs - mine) / 3_600_000);
};
