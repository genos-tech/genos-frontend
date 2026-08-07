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
 * The browser's IANA timezone name, or `null` if it can't be determined.
 *
 * `resolvedOptions().timeZone` is the only way to get this; it is
 * universally supported in the browsers this app targets, but it can
 * legitimately return `undefined` in odd embeddings, so the caller must
 * handle `null` rather than assume a string.
 *
 * Lives here rather than beside `useReportBrowserTimezone`, which is
 * where it started, so that the display path can reach it without
 * dragging in that hook's auth and axios imports.
 */
export const detectBrowserTimezone = (): string | null => {
    try {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return zone && typeof zone === "string" ? zone : null;
    } catch {
        return null;
    }
};

/** Where a resolved zone came from, which is what the UI labels. */
export type ZoneSource = "manual" | "detected";

export type ResolvedZone = {
    id: string;
    source: ZoneSource;
};

/**
 * Which zone speaks for this person, and whether they said so themselves.
 *
 * Three sources in falling order of authority:
 *
 * 1. `currentLocation` — what they picked. An explicit choice has to beat
 *    a detected one, because `timezone` is overwritten on every boot; if
 *    a manual pick didn't win here it would survive only until the user
 *    next opened the app from somewhere else, which is precisely when
 *    they'd most want it to hold.
 * 2. `timezone` — what their browser last reported to the server. This is
 *    the one that makes the field work with nobody configuring anything,
 *    and it is why the common case needs no interaction at all.
 * 3. This browser, but ONLY when the person being displayed is the viewer
 *    (`isSelf`). Your own row would otherwise sit empty until the boot-
 *    time report round-trips. Applying it to anyone else would be a lie
 *    with a confident face: it would claim every colleague whose zone
 *    hasn't synced yet is sitting in the reader's own timezone.
 *
 * `null` when none of them answer, which is the signal to render nothing.
 * Guessing UTC would state something false as though it were a fact.
 */
export const resolveZone = (
    user: { currentLocation?: string; timezone?: string },
    isSelf = false
): ResolvedZone | null => {
    if (user.currentLocation) return { id: user.currentLocation, source: "manual" };
    if (user.timezone) return { id: user.timezone, source: "detected" };
    if (isSelf) {
        const browser = detectBrowserTimezone();
        if (browser) return { id: browser, source: "detected" };
    }
    return null;
};

/** `resolveZone` when only the id is wanted. */
export const resolveDisplayZone = (
    user: { currentLocation?: string; timezone?: string },
    isSelf = false
): string | null => resolveZone(user, isSelf)?.id ?? null;

/**
 * How to label a zone: its city, humanised.
 *
 * Falls back to the raw id in two cases. A zone with no city part ("UTC")
 * has nothing else to show. A zone this runtime's tzdata doesn't know is
 * left intact rather than split for a city, because a name that outlived
 * the data that knew it is not reliably `Region/City` at all — and the
 * stored string is still the truest thing we have about where they are.
 */
export const zoneLabel = (zoneId: string): string =>
    isValidZone(zoneId) ? cityOf(zoneId) || zoneId : zoneId;

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
