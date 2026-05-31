import axios from "axios";

import { authApi } from "../../../services/api";

export interface CalendarSummary {
    id: string;
    summary: string | null;
    primary: boolean;
    background_color?: string | null;
}

export interface CalendarEventDateTime {
    dateTime?: string;
    date?: string;
    timeZone?: string;
}

export interface CalendarConferenceEntryPoint {
    entryPointType?: string;
    label?: string;
    uri?: string;
}

export interface CalendarConferenceData {
    /** Present when Meet generation is in progress; see
     *  `status.statusCode === "pending"`. */
    createRequest?: {
        requestId?: string;
        status?: { statusCode?: "pending" | "success" | "failure" };
    };
    /** Present on already-created Meet conferences. */
    entryPoints?: CalendarConferenceEntryPoint[];
}

export interface CalendarEventAttendee {
    email: string;
    displayName?: string;
    /** Google-side RSVP. Read-only on the wire from our perspective
     *  — the modal doesn't surface it for v1; only used as a tag
     *  for future "going / maybe / declined" rendering. */
    responseStatus?: "needsAction" | "declined" | "tentative" | "accepted";
    /** Self attendees can be flagged so the UI dedupes the user
     *  out of attendee chips. */
    self?: boolean;
}

export interface CalendarEvent {
    /** Populated by Google when an event has invited attendees. The
     *  organizer is implicit and may or may not appear here
     *  depending on the calendar; never relied on as the source of
     *  truth for "who created this". */
    attendees?: CalendarEventAttendee[];
    conferenceData?: CalendarConferenceData;
    description?: string;
    end?: CalendarEventDateTime;
    /** Populated by Google when an event has an attached Meet. May be
     *  absent on the create response if generation is still pending —
     *  poll `getEvent` to await population. */
    hangoutLink?: string;
    htmlLink?: string;
    id: string;
    start?: CalendarEventDateTime;
    status?: string;
    summary?: string;
}

interface ErrorResponse {
    detail?: string;
}

export type CalendarErrorKind =
    | "google_not_connected"
    | "calendar_scope_missing"
    | "google_reauth_required"
    | "other";

// Connection-state discriminators a caller may want to branch on (vs.
// the catch-all "other"). Shared so each service function's return
// union and `errorReturn` allow-list stay in sync.
type CalendarConnectionError =
    | "google_not_connected"
    | "calendar_scope_missing"
    | "google_reauth_required";

const surfaceError = (
    error: unknown,
    setErrorMessage?: (value: string) => void
): CalendarErrorKind => {
    if (axios.isAxiosError(error)) {
        const detail = (error.response?.data as ErrorResponse | undefined)?.detail;
        if (detail === "google_not_connected") {
            setErrorMessage?.("Google account is not connected.");
            return "google_not_connected";
        }
        if (detail === "calendar_scope_missing") {
            // Frontend can present a "Grant Calendar access" button
            // that re-runs the connect-intent OAuth flow.
            setErrorMessage?.("Calendar access not granted yet.");
            return "calendar_scope_missing";
        }
        if (detail === "google_reauth_required") {
            // The Google account row still exists (and may still carry
            // the calendar scope), but its refresh token is revoked or
            // expired. Callers present a "Reconnect Google Calendar"
            // button that re-runs the connect-intent OAuth flow, which
            // mints a fresh refresh token.
            setErrorMessage?.("Google Calendar connection expired. Please reconnect.");
            return "google_reauth_required";
        }
        setErrorMessage?.(detail || "Calendar request failed.");
    } else {
        setErrorMessage?.("Calendar request failed.");
    }
    return "other";
};

// Helper: map the surfaced error kind to the right discriminator
// return shape used by all calendar service functions. Keeps each
// function's catch block tight.
const errorReturn = <T extends CalendarConnectionError>(
    error: unknown,
    setErrorMessage: ((value: string) => void) | undefined,
    discriminators: readonly T[]
): T | null => {
    const kind = surfaceError(error, setErrorMessage);
    return (discriminators as readonly CalendarErrorKind[]).includes(kind) ? (kind as T) : null;
};

export const listCalendars = async (
    accessToken: string,
    setErrorMessage?: (value: string) => void
): Promise<
    | { calendars: CalendarSummary[] }
    | "google_not_connected"
    | "calendar_scope_missing"
    | "google_reauth_required"
    | null
> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const res = await api.get<{ calendars: CalendarSummary[] }>("/calendar/list/");
        return res.data;
    } catch (error) {
        return errorReturn(error, setErrorMessage, [
            "google_not_connected",
            "calendar_scope_missing",
            "google_reauth_required",
        ] as const);
    }
};

export const getEvent = async (
    accessToken: string,
    eventId: string,
    opts: { calendarId?: string } = {},
    setErrorMessage?: (value: string) => void
): Promise<
    | CalendarEvent
    | "google_not_connected"
    | "calendar_scope_missing"
    | "google_reauth_required"
    | "event_deleted_upstream"
    | null
> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const res = await api.get<CalendarEvent>(`/calendar/events/${eventId}/`, {
            params: opts.calendarId ? { calendar_id: opts.calendarId } : undefined,
        });
        return res.data;
    } catch (error) {
        // Inspect the response before delegating: a 404 with
        // `event_deleted_upstream` is a domain signal (the linked event
        // was removed on Google), not a network failure. We surface it
        // as a distinct return so callers can offer "Unlink" instead of
        // a generic retry.
        if (axios.isAxiosError(error)) {
            const detail = (error.response?.data as ErrorResponse | undefined)?.detail;
            if (detail === "event_deleted_upstream") return "event_deleted_upstream";
        }
        return errorReturn(error, setErrorMessage, [
            "google_not_connected",
            "calendar_scope_missing",
            "google_reauth_required",
        ] as const);
    }
};

export const listEvents = async (
    accessToken: string,
    opts: { from?: string; to?: string; calendarId?: string },
    setErrorMessage?: (value: string) => void
): Promise<
    | { items: CalendarEvent[] }
    | "google_not_connected"
    | "calendar_scope_missing"
    | "google_reauth_required"
    | null
> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const res = await api.get<{ items: CalendarEvent[] }>("/calendar/events/", {
            params: {
                from: opts.from,
                to: opts.to,
                calendar_id: opts.calendarId,
            },
        });
        return res.data;
    } catch (error) {
        return errorReturn(error, setErrorMessage, [
            "google_not_connected",
            "calendar_scope_missing",
            "google_reauth_required",
        ] as const);
    }
};

export const createEvent = async (
    accessToken: string,
    body: {
        /** When true, attach a Google Meet `createRequest`. The
         *  response's `hangoutLink` may be absent if generation is
         *  pending — callers can poll `getEvent` to await it. */
        add_meet?: boolean;
        /** Other people to put on the event. Google still pushes
         *  the event to each attendee's calendar; the backend sets
         *  `sendUpdates=none` so no email invites go out. */
        attendees?: Array<{ email: string; displayName?: string }>;
        calendar_id?: string;
        description?: string;
        end: CalendarEventDateTime;
        start: CalendarEventDateTime;
        summary: string;
    },
    setErrorMessage?: (value: string) => void
): Promise<
    | CalendarEvent
    | "google_not_connected"
    | "calendar_scope_missing"
    | "google_reauth_required"
    | null
> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const res = await api.post<CalendarEvent>("/calendar/events/", body);
        return res.data;
    } catch (error) {
        return errorReturn(error, setErrorMessage, [
            "google_not_connected",
            "calendar_scope_missing",
            "google_reauth_required",
        ] as const);
    }
};

export const updateEvent = async (
    accessToken: string,
    eventId: string,
    body: Partial<{
        /** Explicitly toggling: true adds a Meet (or keeps one),
         *  false removes any existing Meet. Omit entirely to leave
         *  the event's Meet state untouched. */
        add_meet: boolean;
        /** Sends the full attendee list — Google overwrites any
         *  existing list when this is provided. Omit to leave
         *  attendees untouched. The backend forwards
         *  `sendUpdates=none` when present to suppress email
         *  invites (chat-driven workflows do their own notify). */
        attendees: Array<{ email: string; displayName?: string }>;
        calendar_id: string;
        description: string;
        end: CalendarEventDateTime;
        start: CalendarEventDateTime;
        summary: string;
    }>,
    setErrorMessage?: (value: string) => void
): Promise<
    | CalendarEvent
    | "google_not_connected"
    | "calendar_scope_missing"
    | "google_reauth_required"
    | null
> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const res = await api.patch<CalendarEvent>(`/calendar/events/${eventId}/`, body);
        return res.data;
    } catch (error) {
        return errorReturn(error, setErrorMessage, [
            "google_not_connected",
            "calendar_scope_missing",
            "google_reauth_required",
        ] as const);
    }
};

export const deleteEvent = async (
    accessToken: string,
    eventId: string,
    opts: { calendarId?: string } = {},
    setErrorMessage?: (value: string) => void
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) return false;
        await api.delete(`/calendar/events/${eventId}/`, {
            params: opts.calendarId ? { calendar_id: opts.calendarId } : undefined,
        });
        return true;
    } catch (error) {
        surfaceError(error, setErrorMessage);
        return false;
    }
};
