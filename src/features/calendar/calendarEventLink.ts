// "Open this calendar event": the hand-off from an agent source chip (or an inline citation) to the
// dialog that shows the event (MIP-1059, AGENT_PARITY_TOOLS).
//
// The chips live in the answer turn, deep in Spotlight, the Genos page and the thread and note Ask
// dialogs; the dialog lives at the App root (`CalendarEventLinkHost`). They meet through a window
// event, the same shape as `askGenosAbout` and `calendarChanges`.
//
// The event is addressed by the chip's plain fields, never by parsing its `entity_id`: the token has no
// calendar id and is lower-cased in places.

import type { SpotlightResult } from "../spotlight/types";

export interface CalendarEventRef {
    accountId: string;
    /** Google's calendar id, or `"primary"` (what the agent's tools default to). */
    calendarId: string;
    eventId: string;
}

/** The ref of a `calendar_event` chip, or null when it is another kind or lacks an id. */
export const calendarEventRefFromSource = (source: SpotlightResult): CalendarEventRef | null => {
    if (source.entity_type !== "calendar_event") return null;
    const accountId = source.account_id?.trim();
    const eventId = source.event_id?.trim();
    if (!accountId || !eventId) return null;
    return {
        accountId,
        eventId,
        calendarId: source.calendar_id?.trim() || "primary",
    };
};

const EVENT_NAME = "genos:open-calendar-event";

export const requestOpenCalendarEvent = (ref: CalendarEventRef): void => {
    window.dispatchEvent(new CustomEvent<CalendarEventRef>(EVENT_NAME, { detail: ref }));
};

/** The listener (`CalendarEventLinkHost`). Returns the unsubscribe. */
export const onOpenCalendarEvent = (handler: (ref: CalendarEventRef) => void): (() => void) => {
    const listener = (e: Event) => {
        const ref = (e as CustomEvent<CalendarEventRef | undefined>).detail;
        if (ref) handler(ref);
    };
    window.addEventListener(EVENT_NAME, listener);
    return () => window.removeEventListener(EVENT_NAME, listener);
};
