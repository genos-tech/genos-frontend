// "A calendar event changed outside the calendar": the signal an approved agent write (and the event
// dialog a chip opens) sends to the calendar grid (MIP-1059, AGENT_PARITY_TOOLS).
//
// The grid (`CalendarModal`) keeps what it fetched per window and per selection and holds no socket,
// so nothing tells it that the agent just made, moved or deleted an event. The agent's
// `tool_call_result` carries a `calendar_event` ref (see `approvedCalendarWrites`); this is the window
// event that takes it to the grid, the same shape as the app's other cross-tree signals
// (`genos:ask-about`, `genos:task-touched`). Nothing listens while the calendar is closed, which is
// right: it drops what it fetched on close and reads afresh on open.

export interface CalendarChange {
    action: "create" | "update" | "delete";
    /** The connected Google account. */
    accountId: string;
    /** Google's calendar id, or `"primary"` (the account's own, which the agent's tools default to). */
    calendarId: string;
    eventId?: string;
}

const EVENT_NAME = "genos:calendar-changed";

export const emitCalendarChanged = (change: CalendarChange): void => {
    window.dispatchEvent(new CustomEvent<CalendarChange>(EVENT_NAME, { detail: change }));
};

/** Listen for a change. Returns the unsubscribe. */
export const onCalendarChanged = (handler: (change: CalendarChange) => void): (() => void) => {
    const listener = (e: Event) => {
        const change = (e as CustomEvent<CalendarChange | undefined>).detail;
        if (change) handler(change);
    };
    window.addEventListener(EVENT_NAME, listener);
    return () => window.removeEventListener(EVENT_NAME, listener);
};
