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

export interface CalendarEvent {
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

const surfaceError = (
    error: unknown,
    setErrorMessage?: (value: string) => void
): "google_not_connected" | "other" => {
    if (axios.isAxiosError(error)) {
        const detail = (error.response?.data as ErrorResponse | undefined)?.detail;
        if (detail === "google_not_connected") {
            setErrorMessage?.("Google account is not connected.");
            return "google_not_connected";
        }
        setErrorMessage?.(detail || "Calendar request failed.");
    } else {
        setErrorMessage?.("Calendar request failed.");
    }
    return "other";
};

export const listCalendars = async (
    accessToken: string,
    setErrorMessage?: (value: string) => void
): Promise<{ calendars: CalendarSummary[] } | "google_not_connected" | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const res = await api.get<{ calendars: CalendarSummary[] }>("/calendar/list/");
        return res.data;
    } catch (error) {
        return surfaceError(error, setErrorMessage) === "google_not_connected"
            ? "google_not_connected"
            : null;
    }
};

export const getEvent = async (
    accessToken: string,
    eventId: string,
    opts: { calendarId?: string } = {},
    setErrorMessage?: (value: string) => void
): Promise<CalendarEvent | "google_not_connected" | "event_deleted_upstream" | null> => {
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
        return surfaceError(error, setErrorMessage) === "google_not_connected"
            ? "google_not_connected"
            : null;
    }
};

export const listEvents = async (
    accessToken: string,
    opts: { from?: string; to?: string; calendarId?: string },
    setErrorMessage?: (value: string) => void
): Promise<{ items: CalendarEvent[] } | "google_not_connected" | null> => {
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
        return surfaceError(error, setErrorMessage) === "google_not_connected"
            ? "google_not_connected"
            : null;
    }
};

export const createEvent = async (
    accessToken: string,
    body: {
        /** When true, attach a Google Meet `createRequest`. The
         *  response's `hangoutLink` may be absent if generation is
         *  pending — callers can poll `getEvent` to await it. */
        add_meet?: boolean;
        calendar_id?: string;
        description?: string;
        end: CalendarEventDateTime;
        start: CalendarEventDateTime;
        summary: string;
    },
    setErrorMessage?: (value: string) => void
): Promise<CalendarEvent | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const res = await api.post<CalendarEvent>("/calendar/events/", body);
        return res.data;
    } catch (error) {
        surfaceError(error, setErrorMessage);
        return null;
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
        calendar_id: string;
        description: string;
        end: CalendarEventDateTime;
        start: CalendarEventDateTime;
        summary: string;
    }>,
    setErrorMessage?: (value: string) => void
): Promise<CalendarEvent | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const res = await api.patch<CalendarEvent>(`/calendar/events/${eventId}/`, body);
        return res.data;
    } catch (error) {
        surfaceError(error, setErrorMessage);
        return null;
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
