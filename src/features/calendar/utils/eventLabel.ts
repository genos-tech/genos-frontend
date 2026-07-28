/**
 * The single place an event's display title is decided.
 *
 * Two fallbacks, and they mean different things:
 *
 *   - **"Busy"** — the event came from a calendar shared at Google's
 *     *free/busy* level. Google deliberately strips the title before it
 *     ever reaches us, so there is nothing to show and nothing is
 *     missing. Rendering "(no title)" here reads as a bug in Genos when
 *     it's actually the sharing setting working as intended.
 *   - **"(no title)"** — the event genuinely has an empty summary on a
 *     calendar we can read fully. That one IS the user's own doing.
 *
 * Centralised because the title was previously inlined in four places
 * (month chips, the +N popover, and both timeline branches); adding a
 * second fallback to each of them independently is how they drift.
 */

import { CalendarEvent, sourceKey } from "../../integrations/services/calendar";

export const UNTITLED_LABEL = "(no title)";

/** Google access roles that hide event details. `freeBusyReader` is the
 *  one Google's UI calls "See only free/busy (hide details)". */
export const FREE_BUSY_ROLES = new Set(["freeBusyReader"]);

/** True when this event's calendar only exposes free/busy, so an empty
 *  summary is expected rather than anomalous. */
export const isFreeBusyEvent = (
    event: CalendarEvent,
    freeBusySourceKeys: Set<string>
): boolean => {
    if (!event._source) return false;
    return freeBusySourceKeys.has(sourceKey(event._source.account_id, event._source.calendar_id));
};

/**
 * Title to render for an event.
 *
 * `busyText` is passed in rather than read from the i18n dictionary
 * here so this module stays a pure function the tests can drive without
 * standing up a translation provider.
 */
export const eventLabel = (
    event: CalendarEvent,
    freeBusySourceKeys: Set<string>,
    busyText: string
): string => {
    const summary = event.summary?.trim();
    if (summary) return summary;
    return isFreeBusyEvent(event, freeBusySourceKeys) ? busyText : UNTITLED_LABEL;
};
