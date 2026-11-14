import type { EventFormInitial } from "../components/CalendarEventModal";
import type { CalendarEvent } from "../services/calendar";

/**
 * What the event dialog is seeded with to EDIT `event`: the one place an event becomes form fields,
 * for the calendar grid (a click on an event) and for the dialog an agent chip opens.
 *
 * `fallback` is where the event is known to live when it did not arrive from the aggregate endpoint
 * (which is what stamps `_source`): a single-event read does not. Event ids are unique per calendar,
 * not globally, and the account decides which credential the PATCH is authenticated with; without
 * both, an edit on a second account would be sent to the default one and 404.
 */
export const eventToFormInitial = (
    event: CalendarEvent,
    fallback?: { accountId?: string; calendarId?: string }
): EventFormInitial => {
    // All-day events carry `start.date`/`end.date` (no `dateTime`). Pass the date strings + the flag so
    // the dialog opens in all-day mode instead of showing empty datetime fields.
    const isAllDay = !!event.start?.date && !event.start?.dateTime;
    return {
        account_id: event._source?.account_id ?? fallback?.accountId,
        calendar_id: event._source?.calendar_id ?? fallback?.calendarId,
        // Present only on an occurrence of a repeating series; it's what lets the dialog offer
        // "this event / all events".
        recurring_event_id: event.recurringEventId,
        add_meet: !!event.hangoutLink,
        all_day: isAllDay,
        // Pre-populate the attendee picker so the user sees who's already invited and can prune / add.
        // We drop `self`-flagged entries (Google echoes the organizer back) so the dialog doesn't
        // insist on re-inviting the current user. External attendees without a team-member match
        // still appear, with email used as displayName.
        attendees: (event.attendees ?? [])
            .filter((a) => !a.self && !!a.email)
            .map((a) => ({ email: a.email, displayName: a.displayName })),
        description: event.description,
        end: isAllDay ? event.end?.date : event.end?.dateTime,
        start: isAllDay ? event.start?.date : event.start?.dateTime,
        summary: event.summary,
    };
};
