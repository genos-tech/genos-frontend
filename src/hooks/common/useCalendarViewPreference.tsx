import { useCallback, useState } from "react";

import { CalendarView } from "../../features/calendar/utils/monthGrid";

// Persists the last-active view (Month / Week / 3-day / Day) so that
// reopening the compact Calendar modal lands the user back on
// whatever granularity they were last working at. Per-device via
// localStorage — there's no server-side preference for this; it's
// presentation only and doesn't need to follow the user across
// machines. Mirrors the standalone localStorage pattern used by
// the other one-shot preferences in this folder (theme, bubble
// style, etc.).

const STORAGE_KEY = "genos-calendar-view-preference";
const VALID_VIEWS: readonly CalendarView[] = ["month", "week", "3day", "day"] as const;

const readPreference = (): CalendarView => {
    if (typeof window === "undefined") return "month";
    try {
        const v = window.localStorage.getItem(STORAGE_KEY);
        if (v && (VALID_VIEWS as readonly string[]).includes(v)) {
            return v as CalendarView;
        }
    } catch {
        // Private mode / quota — fall through to the default.
    }
    return "month";
};

export const useCalendarViewPreference = (): [CalendarView, (v: CalendarView) => void] => {
    const [view, setViewState] = useState<CalendarView>(readPreference);

    const setView = useCallback((next: CalendarView) => {
        setViewState(next);
        try {
            window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Private mode / quota — accept the loss; in-memory
            // value still drives the current session correctly.
        }
    }, []);

    return [view, setView];
};
