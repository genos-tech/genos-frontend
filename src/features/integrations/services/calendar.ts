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

export interface CalendarEvent {
    id: string;
    summary?: string;
    description?: string;
    start?: CalendarEventDateTime;
    end?: CalendarEventDateTime;
    htmlLink?: string;
    status?: string;
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
        summary: string;
        start: CalendarEventDateTime;
        end: CalendarEventDateTime;
        description?: string;
        calendar_id?: string;
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
        summary: string;
        start: CalendarEventDateTime;
        end: CalendarEventDateTime;
        description: string;
        calendar_id: string;
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
